import crypto from 'node:crypto';
import { transitionMission, advanceMissionStep } from './mission-runtime.mjs';
import {
  getMissionForUser,
  updateMissionForUser,
  fanOutRoutineRun,
  queueMissionStepForUser,
  consumeImageGeneration,
} from './store.mjs';
import { createMediaKey, isSupabaseStorageConfigured, putMedia } from './media.mjs';
import { generateHuggingFaceImage } from './image-generator.mjs';

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
  const next = advanceMissionStep({
    ...current,
    lastEvidence: evidence,
  });
  next.lastEvidence = evidence;

  const updated = await updateMissionForUser(userId, missionId, next, {
    eventType: next.status === 'succeeded' ? 'mission.completed' : 'mission.checkpoint',
    message: next.status === 'succeeded'
      ? 'Mission completed from a verified executor result.'
      : 'Mission step completed from a verified executor result.',
    metadata: { stepIndex, adapter },
  });

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
