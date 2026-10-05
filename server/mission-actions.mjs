import { transitionMission } from './mission-runtime.mjs';

function invalid(code, message) {
  return Object.assign(new Error(message), { code });
}

export function prepareMissionAction(current, action) {
  const type = String(action || '').trim().toLowerCase();

  if (!current || typeof current !== 'object') {
    throw invalid('MISSION_STATE_INVALID', 'Mission state is required.');
  }

  if (type === 'start') {
    if (current.status !== 'draft') {
      throw invalid('MISSION_NOT_DRAFT', 'Only a draft mission can be started.');
    }
    return {
      next: transitionMission(current, 'queued'),
      eventType: 'mission.queued',
      message: 'Mission queued with its first durable execution step.',
    };
  }

  if (type === 'approve') {
    if (current.status !== 'waiting_approval') {
      throw invalid('MISSION_NOT_WAITING_FOR_APPROVAL', 'Mission is not waiting for approval.');
    }
    const next = current.metadata?.factory === 'children-v1' && current.metadata?.factoryStage === 'approval' && !current.steps?.length
      ? transitionMission(current, 'succeeded')
      : transitionMission(current, 'running');
    next.approval = {
      ...(current.approval || {}),
      required: true,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    };
    return {
      next,
      eventType: 'mission.approved',
      message: next.status === 'succeeded'
        ? 'Children Factory publishing approval recorded; the draft remains protected until an explicit publish action.'
        : 'Mission approval recorded and the first execution step is ready to queue.',
    };
  }

  if (type === 'resume') {
    if (current.status !== 'paused') {
      throw invalid('MISSION_NOT_PAUSED', 'Only a paused mission can be resumed.');
    }
    return {
      next: transitionMission(current, 'queued'),
      eventType: 'mission.resumed',
      message: 'Mission resumed and queued for execution.',
    };
  }

  if (type === 'retry') {
    if (current.status !== 'failed') {
      throw invalid('MISSION_NOT_FAILED', 'Only a failed mission can be retried.');
    }
    return {
      next: transitionMission(current, 'queued'),
      eventType: 'mission.retried',
      message: 'Failed mission retried and queued for execution.',
    };
  }

  throw invalid('MISSION_ACTION_UNSUPPORTED', 'Mission action is not supported.');
}
