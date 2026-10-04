import crypto from 'node:crypto';
import { transitionMission, advanceMissionStep } from './mission-runtime.mjs';
import {
  getMissionForUser,
  updateMissionForUser,
  createMissionForUser,
  fanOutRoutineRun,
  queueMissionStepForUser,
  consumeImageGeneration,
} from './store.mjs';
import { createMediaKey, isSupabaseStorageConfigured, putMedia } from './media.mjs';
import { generateHuggingFaceImage } from './image-generator.mjs';
import { appendChildrenFactoryImage, markChildrenFactoryBuildComplete } from './factory-runtime.mjs';

async function executeImageGeneration(job) {
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const step = payload?.step && typeof payload.step === 'object' ? payload.step : {};
  const prompt = String(step?.prompt || '').trim().slice(0, 4000);
  if (!prompt) {
    throw Object.assign(new Error('Image generation mission step requires a prompt.'), {
      code: 'IMAGE_PROMPT_REQUIRED',
    });
  }

  const blob = await generateHuggingFaceImage(prompt);
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (!buffer.length) {
    throw Object.assign(new Error('Image provider returned an empty asset.'), {
      code: 'IMAGE_ASSET_EMPTY',
    });
  }

  const mimeType = blob.type || 'image/png';
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Mission execution needs a durable asset reference because workers cannot
  // safely return a large binary payload through the mission job result.
  if (!isSupabaseStorageConfigured()) {
    throw Object.assign(new Error('Image mission execution requires configured Supabase media storage.'), {
      code: 'IMAGE_ASSET_STORAGE_UNAVAILABLE',
    });
  }

  const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
  const key = createMediaKey({
    userId: String(job.user_id),
    kind: 'mission-image',
    extension,
    id: String(payload?.mission_id || job.id),
  });
  const media = await putMedia({
    key,
    body: buffer,
    contentType: mimeType,
    metadata: {
      user_id: String(job.user_id),
      mission_id: String(payload?.mission_id || ''),
      source: 'mission_image_generate',
      sha256,
    },
    upsert: true,
  });

  const consumed = await consumeImageGeneration(String(job.user_id), {
    prompt: prompt.slice(0, 500),
    mode: 'mission_generate',
    mission_id: String(payload?.mission_id || ''),
    sha256,
  });

  return {
    operation: 'image_generation',
    provider: 'huggingface',
    completed: true,
    verifiedAsset: true,
    mimeType,
    bytes: buffer.length,
    sha256,
    media,
    allowance: {
      remaining: Number(consumed?.credits_remaining ?? 0),
    },
  };
}

const ADAPTERS = new Map([
  ['routine_fanout', async job => fanOutRoutineRun({
    ...job,
    type: 'routine_fanout',
  })],
  ['image_generation', executeImageGeneration],
]);

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stepAdapterType(step) {
  return String(step?.executorType || step?.executor_type || step?.type || '').trim();
}

export function missionStatusCanExecute(status) {
  return ['queued', 'running'].includes(String(status || ''));
}

export function getMissionAdapters() {
  return [...ADAPTERS.keys()];
}

export function preflightMission(mission) {
  const steps = Array.isArray(mission?.steps) ? mission.steps : [];
  if (!mission?.id || !validUuid(String(mission.id))) {
    return { ok: false, reason: 'Mission identity is invalid.' };
  }
  if (!validUuid(String(mission.userId || ''))) {
    return { ok: false, reason: 'Mission user identity is invalid.' };
  }
  if (!steps.length) {
    return { ok: false, reason: 'Mission has no executable steps.' };
  }

  const unsupported = [];
  const unsafeWithoutApproval = [];
  steps.forEach((step, index) => {
    const adapter = stepAdapterType(step);
    if (!ADAPTERS.has(adapter)) unsupported.push({ index, adapter: adapter || null });
    const sideEffect = step?.sideEffect === true || step?.side_effect === true;
    if (sideEffect && mission.autonomy === 'advise') unsafeWithoutApproval.push({ index, reason: 'advise mode' });
    if (sideEffect && mission.autonomy === 'prepare') unsafeWithoutApproval.push({ index, reason: 'prepare mode' });
    if (sideEffect && mission.autonomy === 'execute_with_approval' && mission?.approval?.status !== 'approved') {
      unsafeWithoutApproval.push({ index, reason: 'approval required' });
    }
  });

  if (unsupported.length) return { ok: false, reason: 'Mission contains unsupported execution adapters.', unsupported };
  if (unsafeWithoutApproval.length) return { ok: false, reason: 'Mission contains side-effect steps that are not authorized.', unsafeWithoutApproval };
  return { ok: true, adapters: steps.map(stepAdapterType) };
}

function verifiedEvidence(adapter, result) {
  return {
    verified: true,
    adapter,
    completed: true,
    completedAt: new Date().toISOString(),
    result: result && typeof result === 'object' ? result : { value: result },
  };
}

export async function executeMissionStep(job) {
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '');
  const missionId = String(payload.mission_id || '');
  const stepIndex = Number(payload.step_index);

  if (!validUuid(userId) || !validUuid(missionId) || !Number.isInteger(stepIndex)) {
    throw Object.assign(new Error('Mission step job has invalid identity or step index.'), { code: 'MISSION_STEP_INVALID' });
  }

  const mission = await getMissionForUser(userId, missionId);
  if (!mission) throw Object.assign(new Error('Mission no longer exists.'), { code: 'MISSION_NOT_FOUND' });

  if (mission.status === 'queued') {
    const running = transitionMission(mission, 'running');
    await updateMissionForUser(userId, missionId, running, {
      eventType: 'mission.started',
      message: 'Mission execution started from its durable queue.',
    });
  }

  const current = await getMissionForUser(userId, missionId);
  if (!current) throw Object.assign(new Error('Mission disappeared during execution.'), { code: 'MISSION_NOT_FOUND' });

  if (!missionStatusCanExecute(current.status)) {
    return {
      accepted: true,
      completed: false,
      skipped: true,
      missionId,
      stepIndex,
      status: current.status,
      message: 'Mission is not executable in its current lifecycle state; stale queued work was not executed.',
    };
  }

  if (current.currentStep !== stepIndex) {
    const existingStep = current.steps?.[stepIndex];
    if (existingStep?.status === 'succeeded') {
      return {
        accepted: true,
        completed: true,
        idempotent: true,
        missionId,
        stepIndex,
        status: 'already_completed',
        evidence: verifiedEvidence(stepAdapterType(existingStep), { idempotent: true }),
      };
    }
    throw Object.assign(new Error('Mission step is not the current executable step.'), { code: 'MISSION_STEP_OUT_OF_ORDER' });
  }

  const step = current.steps?.[stepIndex];
  const adapter = stepAdapterType(step);
  const preflight = preflightMission(current);
  if (!preflight.ok) {
    throw Object.assign(new Error(preflight.reason), {
      code: 'MISSION_PREFLIGHT_BLOCKED',
      details: preflight,
    });
  }
  const adapterFn = ADAPTERS.get(adapter);
  if (!adapterFn) throw Object.assign(new Error('Mission adapter is not available.'), { code: 'MISSION_ADAPTER_UNAVAILABLE' });

  const result = await adapterFn(job);
  const evidence = verifiedEvidence(adapter, result);

  let metadata = current.metadata && typeof current.metadata === 'object' ? current.metadata : {};
  if (metadata.factory === 'children-v1' && adapter === 'image_generation') {
    metadata = appendChildrenFactoryImage(metadata, stepIndex + 1, result);
  }

  const next = advanceMissionStep({
    ...current,
    lastEvidence: evidence,
    metadata,
  });
  next.lastEvidence = evidence;

  if (metadata.factory === 'children-v1' && next.status === 'succeeded') {
    next.metadata = markChildrenFactoryBuildComplete(metadata);
  }

  const updated = await updateMissionForUser(userId, missionId, next, {
    eventType: next.status === 'succeeded' ? 'mission.completed' : 'mission.checkpoint',
    message: next.status === 'succeeded'
      ? 'Mission completed from a verified executor result.'
      : 'Mission step completed from a verified executor result.',
    metadata: { stepIndex, adapter },
  });

  let approvalMission = null;
  if (updated.status === 'succeeded' && updated.metadata?.factory === 'children-v1' && !updated.metadata?.approvalMissionId) {
    const approvalState = createMissionState({
      missionId: crypto.randomUUID(),
      userId,
      goal: 'Children Factory: approve and publish ' + String(updated.metadata.title || 'children content'),
      autonomy: 'execute_with_approval',
      steps: [],
    });
    approvalState.approval = {
      required: true,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      action: 'publish',
    };
    approvalState.metadata = {
      factory: 'children-v1',
      projectId: updated.metadata.projectId || null,
      buildMissionId: updated.id,
      topic: updated.metadata.topic || null,
      age: updated.metadata.age || null,
      story: updated.metadata.story || null,
      characterId: updated.metadata.characterId || null,
      characterBible: updated.metadata.characterBible || null,
      images: Array.isArray(updated.metadata.images) ? updated.metadata.images : [],
    };
    approvalMission = transitionMission(approvalState, 'waiting_approval');
    approvalMission.approval = approvalState.approval;
    approvalMission = await createMissionForUser(userId, approvalMission);
    const linkedMetadata = {
      ...(updated.metadata || {}),
      approvalMissionId: approvalMission.id,
    };
    await updateMissionForUser(userId, updated.id, { ...updated, metadata: linkedMetadata }, {
      eventType: 'mission.approval_created',
      message: 'Children Factory build completed; publishing approval is now waiting for user review.',
      metadata: { approvalMissionId: approvalMission.id },
    });
  }

  let nextJob = null;
  if (updated.status !== 'succeeded' && updated.currentStep >= 0) {
    nextJob = await queueMissionStepForUser(userId, updated);
  }

  return {
    accepted: true,
    completed: true,
    missionId,
    stepIndex,
    adapter,
    status: updated.status,
    evidence,
    nextJobId: nextJob?.id || null,
    message: updated.status === 'succeeded'
      ? 'Mission completed and verified.'
      : 'Mission step completed and the next step was queued.',
  };
}
