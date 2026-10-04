import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dequeueJob, enqueueJob, isRedisConfigured } from './queue.mjs';
import { groupWorkloadBatch, nextWorkDelayMs, workloadClass } from './workload-governor.mjs';
import {
  claimDueRoutines,
  dispatchRoutineForUser,
  fanOutRoutineRun,
  updateRoutineRunFromChildren,
  getMissionForUser,
  updateMissionForUser,
} from './store.mjs';
import { executeMissionStep } from './mission-executor.mjs';
import { canTransition, transitionMission } from './mission-runtime.mjs';
import { createMediaKey, getMedia, isSupabaseStorageConfigured, putMedia } from './media.mjs';
import { generateVideoFromImage, isHiggsfieldConfigured, uploadReferenceImage } from './higgsfield.mjs';
import { isElevenLabsConfigured, synthesizeNarration } from './elevenlabs.mjs';
import { validateChildrenFactoryVideo } from './factory-qa.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
}

async function rpc(name, body) {
  if (!configured()) throw new Error('Supabase worker persistence is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase worker RPC failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

export function createWorkerId(prefix = 'jarvis-worker') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function claimNextJob(workerId) {
  const rows = await rpc('worker_claim_next_job', { p_worker_id: workerId });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

export async function claimJob(jobId, workerId) {
  if (!jobId) return null;
  const rows = await rpc('worker_claim_job', { p_job_id: jobId, p_worker_id: workerId });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

export async function heartbeatJob(jobId, workerId) {
  return rpc('worker_heartbeat_job', { p_job_id: jobId, p_worker_id: workerId });
}

export async function finishJob(jobId, workerId, result) {
  return rpc('worker_finish_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_result: result,
  });
}

export async function failJob(jobId, workerId, error) {
  return rpc('worker_fail_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_error: {
      message: String(error?.message || error || 'Worker execution failed.').slice(0, 2000),
      name: String(error?.name || 'Error').slice(0, 200),
    },
  });
}

async function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(Object.assign(error, { code: error.code || 'FFMPEG_UNAVAILABLE' })));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1200)}`)));
  });
}

async function runFfprobe(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height',
      '-of', 'json',
      file,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(Object.assign(error, { code: error.code || 'FFPROBE_UNAVAILABLE' })));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}: ${stderr.slice(-1200)}`));
      try { resolve(JSON.parse(stdout || '{}')); }
      catch { reject(new Error('ffprobe returned invalid JSON.')); }
    });
  });
}

async function executeFfmpegVideoPipeline({ userId, imageKeys, payload }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-video-'));
  try {
    const inputs = [];
    for (let i = 0; i < imageKeys.length; i += 1) {
      const media = await getMedia({ key: imageKeys[i] });
      if (!String(media.contentType).startsWith('image/')) throw new Error('Video render received a non-image asset.');
      const file = path.join(tempDir, `image-${i}.bin`);
      await fs.writeFile(file, media.body);
      inputs.push(file);
    }
    const output = path.join(tempDir, 'render.mp4');
    const filters = inputs.map((_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
    filters.push(inputs.map((_, i) => `[v${i}]`).join('') + `concat=n=${inputs.length}:v=1:a=0[v]`);
    const args = [];
    for (const file of inputs) args.push('-loop', '1', '-i', file);
    args.push('-filter_complex', filters.join(';'), '-t', String(Math.max(3, inputs.length * 3)), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', output);
    await runFfmpeg(args);
    const video = await fs.readFile(output);
    const sha256 = crypto.createHash('sha256').update(video).digest('hex');
    return { video, sha256, durationSeconds: Math.max(3, inputs.length * 3), provider: 'ffmpeg-image-sequence-v1' };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executeHiggsfieldVideoPipeline({ userId, imageKeys, payload }) {
  if (!isHiggsfieldConfigured()) {
    throw Object.assign(new Error('Higgsfield video generation is not configured. Add HIGGSFIELD_API_KEY to the server environment before using the AI video engine.'), { code: 'HIGGSFIELD_NOT_CONFIGURED', safeToRetry: false });
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-hf-video-'));
  const clipFiles = [];
  const clipRecords = [];
  try {
    const scenePrompts = Array.isArray(payload.scene_prompts) ? payload.scene_prompts.map(String) : [];
    const sceneDurations = Array.isArray(payload.scene_durations) ? payload.scene_durations.map(Number) : [];
    for (let i = 0; i < imageKeys.length; i += 1) {
      const media = await getMedia({ key: imageKeys[i] });
      if (!String(media.contentType).startsWith('image/')) throw new Error('AI video generation received a non-image asset.');
      const uploaded = await uploadReferenceImage({ body: media.body, contentType: media.contentType || 'image/png' });
      const generated = await generateVideoFromImage({
        body: payload,
        imageUrl: uploaded.publicUrl,
        prompt: scenePrompts[i] || `Animate scene ${i + 1} of this children's story. Preserve the character identity, clothing, environment, colors and composition. Use gentle storybook motion and natural camera movement appropriate for children.`,
        durationSeconds: sceneDurations[i] || payload.scene_duration_seconds || 5,
        resolution: payload.resolution || '720p',
      });
      const clipResponse = await fetch(generated.videoUrl);
      if (!clipResponse.ok) throw new Error(`Higgsfield generated video could not be downloaded (${clipResponse.status}).`);
      const clipPath = path.join(tempDir, `clip-${i}.mp4`);
      await fs.writeFile(clipPath, Buffer.from(await clipResponse.arrayBuffer()));
      clipFiles.push(clipPath);
      clipRecords.push({ scene: i + 1, requestId: generated.requestId, model: generated.model });
    }

    const listFile = path.join(tempDir, 'concat.txt');
    await fs.writeFile(listFile, clipFiles.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'));
    const output = path.join(tempDir, 'render.mp4');
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', '-y', output]);
    let video = await fs.readFile(output);
    let audio = null;
    const narrationText = String(payload.narration_text || '').trim();
    if (narrationText) {
      if (!isElevenLabsConfigured()) {
        throw Object.assign(new Error('Narration was requested but ElevenLabs is not configured on the server.'), { code: 'ELEVENLABS_NOT_CONFIGURED', safeToRetry: false });
      }
      const speech = await synthesizeNarration({ text: narrationText });
      const audioSha256 = crypto.createHash('sha256').update(speech.audio).digest('hex');
      const audioKey = createMediaKey({ userId, kind: 'narration', extension: 'mp3', id: audioSha256 });
      const audioStored = await putMedia({ key: audioKey, body: speech.audio, contentType: speech.contentType, metadata: { user_id: userId, source: 'children_factory_narration', sha256: audioSha256, voice_id: speech.voiceId, model: speech.modelId }, upsert: true });
      audio = { mediaKey: audioKey, sha256: audioSha256, media: audioStored, voiceId: speech.voiceId, model: speech.modelId };
      const voicedOutput = path.join(tempDir, 'render-voiced.mp4');
      await fs.writeFile(path.join(tempDir, 'narration.mp3'), speech.audio);
      await runFfmpeg(['-i', output, '-i', path.join(tempDir, 'narration.mp3'), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', '-y', voicedOutput]);
      video = await fs.readFile(voicedOutput);
    }
    const sha256 = crypto.createHash('sha256').update(video).digest('hex');
    const durationSeconds = sceneDurations.slice(0, clipRecords.length).reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 5), 0);
    return { video, sha256, durationSeconds, provider: 'higgsfield', model: clipRecords[0]?.model || '', clips: clipRecords, audio };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executeVideoPipeline(job) {
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '').trim();
  const imageKeys = Array.isArray(payload.image_keys) ? payload.image_keys.map(String).filter(Boolean).slice(0, 12) : [];
  if (!userId || !imageKeys.length || !imageKeys[0].startsWith(`jarvis/${userId}/`)) throw new Error('Video render requires a JARVIS user and stored image assets.');
  if (!isSupabaseStorageConfigured()) throw new Error('Supabase Storage is not configured for video rendering.');
  if (imageKeys.some(key => !key.startsWith(`jarvis/${userId}/`))) throw new Error('Video render asset ownership validation failed.');

  const provider = String(payload.provider || process.env.VIDEO_PROVIDER || 'higgsfield').trim().toLowerCase();
  if (!['higgsfield', 'ffmpeg'].includes(provider)) throw Object.assign(new Error(`Unsupported video provider: ${provider}`), { code: 'VIDEO_PROVIDER_UNSUPPORTED', safeToRetry: false });

  const rendered = provider === 'higgsfield'
    ? await executeHiggsfieldVideoPipeline({ userId, imageKeys, payload })
    : await executeFfmpegVideoPipeline({ userId, imageKeys, payload });
  const qaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-video-qa-'));
  let probe;
  try {
    const qaFile = path.join(qaDir, 'final.mp4');
    await fs.writeFile(qaFile, rendered.video);
    probe = await runFfprobe(qaFile);
  } finally {
    await fs.rm(qaDir, { recursive: true, force: true }).catch(() => {});
  }

  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const videoStream = streams.find(stream => String(stream?.codec_type || '') === 'video') || null;
  const hasAudioStream = streams.some(stream => String(stream?.codec_type || '') === 'audio');
  const probedDuration = Number(probe?.format?.duration || 0);
  const mediaKey = createMediaKey({ userId, kind: 'video-render', extension: 'mp4', id: rendered.sha256 });
  const qa = validateChildrenFactoryVideo({
    videoBytes: rendered.video.length,
    width: Number(videoStream?.width || 0),
    height: Number(videoStream?.height || 0),
    durationSeconds: probedDuration || Number(rendered.durationSeconds || 0),
    sourceImageCount: imageKeys.length,
    expectedImageCount: imageKeys.length,
    hasVideoStream: Boolean(videoStream),
    hasAudioStream,
    narrationRequested: Boolean(String(payload.narration_text || '').trim()),
    provider: rendered.provider,
    mediaKey,
  });
  if (!qa.passed) {
    throw Object.assign(new Error(`Children Factory QA failed: ${qa.reason}`), {
      code: 'CHILDREN_FACTORY_QA_FAILED',
      details: qa,
      safeToRetry: false,
    });
  }

  const stored = await putMedia({
    key: mediaKey,
    body: rendered.video,
    contentType: 'video/mp4',
    metadata: { user_id: userId, source: 'video_pipeline', provider: rendered.provider, model: rendered.model || '', sha256: rendered.sha256, project_id: payload.project_id || '', qa: JSON.stringify(qa) },
    upsert: true,
  });
  const result = { rendered: true, media: stored, mediaKey, sha256: rendered.sha256, durationSeconds: Number(probedDuration || rendered.durationSeconds || 0), format: '16:9', sourceImageCount: imageKeys.length, provider: rendered.provider, model: rendered.model || null, audio: rendered.audio || null, clips: rendered.clips || null, qa, missionId: String(payload.mission_id || '') || null };
  if (payload.mission_id) {
    await finalizeChildrenFactoryVideo(userId, String(payload.mission_id), result, job);
  }
  return result;
}

export function buildMissionFailureState(mission, { jobId = '', adapter = '', attempts = 0, error = null } = {}) {
  if (!mission || !canTransition(String(mission.status || ''), 'failed')) return null;
  const next = transitionMission(mission, 'failed');
  next.lastEvidence = {
    verified: false,
    completed: false,
    adapter: String(adapter || 'unknown'),
    jobId: String(jobId || ''),
    attempts: Number(attempts || 0),
    error: {
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || 'Mission execution failed.').slice(0, 2000),
    },
  };
  next.metadata = {
    ...(mission.metadata || {}),
    lastFailure: {
      jobId: String(jobId || ''),
      adapter: String(adapter || 'unknown'),
      attempts: Number(attempts || 0),
      message: String(error?.message || error || 'Mission execution failed.').slice(0, 2000),
      failedAt: next.updatedAt,
    },
  };
  return next;
}

async function finalizeChildrenFactoryVideo(userId, missionId, result, job) {
  const mission = await getMissionForUser(userId, missionId);
  if (!mission || mission.metadata?.factory !== 'children-v1') return;

  const renderedVideo = {
    ...(result || {}),
    jobId: String(job?.id || ''),
    renderedAt: new Date().toISOString(),
  };
  const buildMetadata = {
    ...(mission.metadata || {}),
    factoryStage: 'approval',
    videoStatus: 'succeeded',
    renderedVideo,
  };
  const updatedBuild = await updateMissionForUser(userId, mission.id, { ...mission, metadata: buildMetadata }, {
    eventType: 'factory.video_completed',
    message: 'Children Factory AI video and narration completed and the verified media asset was stored.',
    metadata: { mediaKey: result?.mediaKey || null, provider: result?.provider || null, jobId: String(job?.id || '') },
  });

  const approvalId = String(updatedBuild.metadata?.approvalMissionId || '').trim();
  if (!approvalId) return;
  const approvalMission = await getMissionForUser(userId, approvalId);
  if (!approvalMission || approvalMission.status !== 'draft') return;

  const approvalReady = transitionMission(approvalMission, 'waiting_approval');
  approvalReady.approval = {
    ...(approvalMission.approval || {}),
    required: true,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    approvedAt: null,
    action: 'publish',
  };
  approvalReady.metadata = {
    ...(approvalMission.metadata || {}),
    images: Array.isArray(updatedBuild.metadata.images) ? updatedBuild.metadata.images : [],
    story: updatedBuild.metadata.story || approvalMission.metadata?.story || null,
    characterBible: updatedBuild.metadata.characterBible || approvalMission.metadata?.characterBible || null,
    renderedVideo,
  };
  await updateMissionForUser(userId, approvalMission.id, approvalReady, {
    eventType: 'mission.approval_requested',
    message: 'Children Factory video is verified; publishing approval is now waiting for user review.',
    metadata: {
      buildMissionId: updatedBuild.id,
      videoJobId: String(job?.id || ''),
      mediaKey: result?.mediaKey || null,
    },
  });
}

async function recordChildrenFactoryVideoFailure(job, error, failureRecord, logger) {
  if (failureRecord?.status !== 'failed') return;
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '');
  const missionId = String(payload.mission_id || '');
  if (!userId || !missionId) return;

  const mission = await getMissionForUser(userId, missionId);
  if (!mission || mission.metadata?.factory !== 'children-v1') return;

  const metadata = {
    ...(mission.metadata || {}),
    factoryStage: 'video',
    videoStatus: 'failed',
    lastVideoFailure: {
      jobId: String(job.id || ''),
      attempts: Number(failureRecord.attempts || 1),
      message: String(error?.message || error || 'Video generation failed.').slice(0, 2000),
      failedAt: new Date().toISOString(),
    },
  };
  await updateMissionForUser(userId, mission.id, { ...mission, metadata }, {
    eventType: 'factory.video_failed',
    message: 'Children Factory AI video generation failed after the durable provider job reached terminal failure.',
    metadata: metadata.lastVideoFailure,
  }).catch(updateError => logger.error?.('[JARVIS worker] failed to persist Children Factory video failure:', updateError));
}

async function recordMissionJobFailure(job, error, failureRecord, logger) {
  if (String(job?.type || '') !== 'mission_step') return;
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '');
  const missionId = String(payload.mission_id || '');
  if (!userId || !missionId) return;

  const mission = await getMissionForUser(userId, missionId);
  if (!mission) {
    logger.warn?.(`[JARVIS worker] mission failure could not be recorded; mission missing ${missionId}`);
    return;
  }

  const attempts = Number(failureRecord?.attempts ?? Number(job?.attempts || 0) + 1);
  if (failureRecord?.status === 'retrying') {
    await updateMissionForUser(userId, missionId, mission, {
      eventType: 'mission.step_retrying',
      message: 'Mission step failed transiently and the durable job was scheduled for retry.',
      metadata: {
        jobId: String(job.id || ''),
        adapter: String(payload.adapter || payload.step?.executorType || 'unknown'),
        attempts,
        nextAttemptAt: failureRecord.scheduled_at || null,
      },
    });
    return;
  }

  if (failureRecord?.status !== 'failed') return;

  const next = buildMissionFailureState(mission, {
    jobId: job.id,
    adapter: payload.adapter || payload.step?.executorType,
    attempts,
    error,
  });

  if (!next) {
    logger.warn?.(`[JARVIS worker] mission ${missionId} was not transitioned to failed from status ${mission.status}`);
    return;
  }

  await updateMissionForUser(userId, missionId, next, {
    eventType: 'mission.failed',
    message: 'Mission execution exhausted its durable job retries and was marked failed.',
    metadata: {
      jobId: String(job.id || ''),
      adapter: String(payload.adapter || payload.step?.executorType || 'unknown'),
      attempts,
      error: next.lastEvidence?.error || {},
    },
  });
}

export async function executeJob(job) {
  const type = String(job?.type || '');
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};

  if (type === 'video_pipeline') return executeVideoPipeline(job);

  if (type === 'routine_fanout') {
    return fanOutRoutineRun(job);
  }

  if (type === 'mission_step') {
    return executeMissionStep(job);
  }

  throw Object.assign(
    new Error(`No verified worker adapter is registered for job type "${type || 'unknown'}".`),
    {
      code: 'JOB_ADAPTER_UNAVAILABLE',
      jobType: type || 'unknown',
      safeToRetry: false,
      payloadKeys: Object.keys(payload).slice(0, 20),
    },
  );
}

async function dispatchDueRoutines(workerId, logger) {
  const routines = await claimDueRoutines(workerId, Number(process.env.JARVIS_ROUTINE_BATCH_LIMIT || 10));
  const dispatched = [];

  for (const routine of routines) {
    try {
      const result = await dispatchRoutineForUser(routine, workerId);
      const parentJobId = result?.parentJob?.id;
      if (parentJobId && isRedisConfigured()) {
        try {
          await enqueueJob(parentJobId, 'routine_fanout');
        } catch (queueError) {
          logger.warn?.('[JARVIS worker] routine Redis dispatch failed; Supabase will remain the fallback queue:', queueError);
        }
      }
      dispatched.push({
        routineId: routine.id,
        runId: result?.run?.id || null,
        parentJobId: parentJobId || null,
        nextRunAt: result?.nextRunAt || routine.nextRunAt,
      });
    } catch (error) {
      logger.error?.(`[JARVIS worker] routine dispatch failed ${routine.id}:`, error);
      dispatched.push({
        routineId: routine.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return dispatched;
}

async function processJob(job, workerId, logger) {
  await heartbeatJob(job.id, workerId);
  const heartbeatMs = Math.max(15_000, Number(process.env.JARVIS_WORKER_HEARTBEAT_MS || 60_000));
  const heartbeatTimer = setInterval(() => {
    heartbeatJob(job.id, workerId).catch(error =>
      logger.warn?.(`[JARVIS worker] heartbeat failed ${job.id}:`, error)
    );
  }, heartbeatMs);

  try {
    const result = await executeJob(job);
    const nextJobId = result?.nextJobId || null;
    if ((job?.type === 'routine_fanout' && result?.childJobIds?.length) && isRedisConfigured()) {
      for (const childJobId of result.childJobIds) {
        try {
          await enqueueJob(childJobId, 'routine_step');
        } catch (queueError) {
          logger.warn?.(`[JARVIS worker] child Redis dispatch failed ${childJobId}; Supabase remains the fallback queue:`, queueError);
        }
      }
    }
    if (nextJobId && isRedisConfigured()) {
      try {
        await enqueueJob(nextJobId, 'mission_step');
      } catch (queueError) {
        logger.warn?.(`[JARVIS worker] next mission step Redis dispatch failed ${nextJobId}; Supabase remains the fallback queue:`, queueError);
      }
    }
    await finishJob(job.id, workerId, result);
    await updateRoutineRunFromChildren(job).catch(error =>
      logger.warn?.(`[JARVIS worker] routine completion check failed ${job.id}:`, error)
    );
    logger.info?.(`[JARVIS worker] completed ${job.id} (${job.type})`);
    return { ok: true, jobId: job.id };
  } catch (error) {
    logger.error?.(`[JARVIS worker] failed ${job.id}:`, error);
    let failureRecord = null;
    try {
      failureRecord = await failJob(job.id, workerId, error);
    } catch (failureError) {
      logger.error?.('[JARVIS worker] failed to persist failure:', failureError);
    }
    try {
      await recordChildrenFactoryVideoFailure(job, error, failureRecord, logger);
    } catch (videoFailureError) {
      logger.error?.(`[JARVIS worker] failed to persist Children Factory video failure ${job.id}:`, videoFailureError);
    }
    try {
      await recordMissionJobFailure(job, error, failureRecord, logger);
    } catch (missionFailureError) {
      logger.error?.(`[JARVIS worker] failed to persist mission failure state ${job.id}:`, missionFailureError);
    }
    await updateRoutineRunFromChildren(job).catch(failureCheckError =>
      logger.warn?.(`[JARVIS worker] routine failure check failed ${job.id}:`, failureCheckError)
    );
    return { ok: false, jobId: job.id, error };
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function claimOne(workerId) {
  const queued = isRedisConfigured() ? await dequeueJob() : null;
  let job = queued?.jobId ? await claimJob(queued.jobId, workerId) : await claimNextJob(workerId);

  // If a stale/duplicate Redis message was consumed, recover any other queued Supabase job.
  if (!job && queued?.jobId) job = await claimNextJob(workerId);
  return job;
}

export async function runWorker({
  workerId = createWorkerId(),
  once = false,
  pollMs = 5000,
  logger = console,
  concurrency = Number(process.env.JARVIS_WORKER_CONCURRENCY || 4),
  maxJobsPerRun = Number(process.env.JARVIS_WORKER_MAX_JOBS_PER_RUN || 24),
  maxRuntimeMs = Number(process.env.JARVIS_WORKER_MAX_RUNTIME_MS || 210000),
} = {}) {
  if (!configured()) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY are required.');

  const maxConcurrency = Math.min(8, Math.max(1, Math.floor(Number(concurrency) || 4)));
  const jobLimit = Math.min(100, Math.max(1, Math.floor(Number(maxJobsPerRun) || 24)));
  const runtimeLimit = Math.min(240000, Math.max(30000, Number(maxRuntimeMs) || 210000));
  const startedAt = Date.now();
  let processed = 0;
  let attempted = 0;
  let routineDispatches = [];
  let failureCount = 0;
  let batches = 0;

  while (attempted < jobLimit && Date.now() - startedAt < runtimeLimit) {
    if (Date.now() - startedAt < runtimeLimit) {
      try {
        routineDispatches.push(...await dispatchDueRoutines(workerId, logger));
      } catch (error) {
        logger.warn?.('[JARVIS worker] routine scheduler tick failed:', error);
      }
    }

    const claimed = [];
    const deferredHeavy = [];
    const claimCount = Math.min(maxConcurrency, jobLimit - attempted);

    for (let i = 0; i < claimCount; i += 1) {
      if (Date.now() - startedAt >= runtimeLimit) break;
      try {
        const job = await claimOne(workerId);
        if (!job) break;

        attempted += 1;
        if (workloadClass(job) === 'heavy' && claimed.length > 0) {
          deferredHeavy.push(job);
          logger.info?.(`[JARVIS worker] heavy job ${job.id} deferred until the routine batch completes.`);
          break;
        }
        claimed.push(job);

        if (workloadClass(job) === 'heavy') break;
      } catch (error) {
        logger.error?.('[JARVIS worker] claim failed:', error);
        failureCount += 1;
        if (once && claimed.length === 0 && deferredHeavy.length === 0) throw error;
        break;
      }
    }

    if (!claimed.length && !deferredHeavy.length) {
      if (once) return { workerId, processed, attempted, batches, concurrency: maxConcurrency };
      await new Promise(resolve => setTimeout(resolve, nextWorkDelayMs({
        queueEmpty: true,
        failureCount,
        baseMs: pollMs,
      })));
      continue;
    }

    const routineJobs = claimed.filter(job => workloadClass(job) !== 'heavy');
    const heavyJobs = [
      ...claimed.filter(job => workloadClass(job) === 'heavy'),
      ...deferredHeavy,
    ];

    if (routineJobs.length) {
      const routineBatch = groupWorkloadBatch(routineJobs, maxConcurrency);
      const results = await Promise.all(routineBatch.map(job => processJob(job, workerId, logger)));
      const successful = results.filter(result => result.ok).length;
      processed += successful;
      batches += 1;
      failureCount = results.length - successful > 0 ? failureCount + 1 : 0;
    }

    for (const heavyJob of heavyJobs) {
      if (Date.now() - startedAt >= runtimeLimit) break;
      const result = await processJob(heavyJob, workerId, logger);
      processed += result.ok ? 1 : 0;
      batches += 1;
      failureCount = result.ok ? 0 : failureCount + 1;
    }

    if (once && attempted >= jobLimit) break;
  }

  return {
    workerId,
    processed,
    attempted,
    batches,
    concurrency: maxConcurrency,
    elapsedMs: Date.now() - startedAt,
    runtimeLimitMs: runtimeLimit,
    routineDispatches,
  };
}

if (process.argv[1] && process.argv[1].endsWith('/worker.mjs')) {
  const once = process.env.JARVIS_WORKER_ONCE === '1' || process.env.JARVIS_WORKER_ONCE === 'true';
  runWorker({ once }).catch(error => {
    console.error('[JARVIS worker] fatal:', error);
    process.exitCode = 1;
  });
}
