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
import { createMediaKey, getMedia, isSupabaseStorageConfigured, putMedia } from './media.mjs';

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

function updateChildrenFactoryPipeline(pipeline, updates = {}) {
  const stages = Array.isArray(pipeline) ? pipeline.map(stage => ({ ...stage })) : [];
  return stages.map(stage => updates[stage.id] ? { ...stage, status: updates[stage.id] } : stage);
}

export function getVideoRenderGeometry(format = '16:9') {
  return String(format).trim() === '9:16'
    ? { width: 1080, height: 1920, label: '9:16' }
    : { width: 1280, height: 720, label: '16:9' };
}

export function buildVideoFilter(index, geometry) {
  return `[${index}:v]scale=${geometry.width}:${geometry.height}:force_original_aspect_ratio=increase,crop=${geometry.width}:${geometry.height},setsar=1,zoompan=z='min(zoom+0.0015,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=120:s=${geometry.width}x${geometry.height}:fps=30[v${index}]`;
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

async function executeVideoPipeline(job) {
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '').trim();
  const imageKeys = Array.isArray(payload.image_keys) ? payload.image_keys.map(String).filter(Boolean).slice(0, 12) : [];
  if (!userId || !imageKeys.length || !imageKeys[0].startsWith(`jarvis/${userId}/`)) throw new Error('Video render requires a JARVIS user and stored image assets.');
  if (!isSupabaseStorageConfigured()) throw new Error('Supabase Storage is not configured for video rendering.');
  if (!imageKeys.length) throw new Error('Video render requires at least one stored image asset.');
  if (imageKeys.some(key => !key.startsWith(`jarvis/${userId}/`))) throw new Error('Video render asset ownership validation failed.');

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
    const geometry = getVideoRenderGeometry(payload.format);
    const filters = inputs.map((_, i) => buildVideoFilter(i, geometry));
    filters.push(inputs.map((_, i) => `[v${i}]`).join('') + `concat=n=${inputs.length}:v=1:a=0[v]`);
    const args = [];
    for (const file of inputs) args.push('-loop', '1', '-i', file);
    args.push('-filter_complex', filters.join(';'), '-map', '[v]', '-t', String(Math.max(4, inputs.length * 4)), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', output);
    await runFfmpeg(args);
    const video = await fs.readFile(output);
    const sha256 = crypto.createHash('sha256').update(video).digest('hex');
    const mediaKey = createMediaKey({ userId, kind: 'video-render', extension: 'mp4', id: sha256 });
    const stored = await putMedia({
      key: mediaKey,
      body: video,
      contentType: 'video/mp4',
      metadata: { user_id: userId, source: 'video_pipeline', sha256, project_id: payload.project_id || '' },
      upsert: true,
    });
    const result = { rendered: true, media: stored, mediaKey, sha256, durationSeconds: Math.max(4, inputs.length * 4), format: geometry.label, width: geometry.width, height: geometry.height, sourceImageCount: inputs.length, missionId: String(payload.mission_id || '') || null };
    if (payload.mission_id) {
      const mission = await getMissionForUser(userId, String(payload.mission_id));
      if (!mission) throw new Error('Video render mission was not found for this JARVIS user.');
      const metadata = {
        ...(mission.metadata || {}),
        renderedVideo: {
          mediaKey,
          sha256,
          durationSeconds: result.durationSeconds,
          format: result.format,
          sourceImageCount: result.sourceImageCount,
          jobId: String(job?.id || ''),
          renderedAt: new Date().toISOString(),
        },
        pipeline: updateChildrenFactoryPipeline(mission.metadata?.pipeline, {
          render: 'completed',
          approval: 'pending',
          publish: 'blocked',
        }),
      };
      await updateMissionForUser(userId, mission.id, { ...mission, metadata }, {
        eventType: 'video.rendered',
        message: 'Video render completed and the verified media asset was bound to the mission.',
        metadata: { mediaKey, sha256 },
      });
    }
    return result;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
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
    try {
      await failJob(job.id, workerId, error);
    } catch (failureError) {
      logger.error?.('[JARVIS worker] failed to persist failure:', failureError);
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
