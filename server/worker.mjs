import crypto from 'node:crypto';
import { dequeueJob, isRedisConfigured } from './queue.mjs';
import { groupWorkloadBatch, nextWorkDelayMs, workloadClass } from './workload-governor.mjs';

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

export async function executeJob(job) {
  const type = String(job?.type || '');
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};

  if (type === 'video_pipeline') {
    return {
      accepted: true,
      type,
      operation: String(payload.operation || 'unknown'),
      projectId: payload.project_id || null,
      status: 'worker_received',
      message: 'Durable worker received the video job. Generation/rendering adapters remain a later pipeline milestone.',
    };
  }

  if (type === 'memory_maintenance') {
    return {
      accepted: true,
      type,
      status: 'worker_received',
      message: 'Durable worker received the memory maintenance job.',
    };
  }

  return {
    accepted: true,
    type: type || 'unknown',
    status: 'worker_received',
    message: 'Durable worker recorded the job without executing an unregistered job type.',
  };
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
    await finishJob(job.id, workerId, result);
    logger.info?.(`[JARVIS worker] completed ${job.id} (${job.type})`);
    return { ok: true, jobId: job.id };
  } catch (error) {
    logger.error?.(`[JARVIS worker] failed ${job.id}:`, error);
    try {
      await failJob(job.id, workerId, error);
    } catch (failureError) {
      logger.error?.('[JARVIS worker] failed to persist failure:', failureError);
    }
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
  let failureCount = 0;
  let batches = 0;

  while (attempted < jobLimit && Date.now() - startedAt < runtimeLimit) {
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
  };
}

if (process.argv[1] && process.argv[1].endsWith('/worker.mjs')) {
  const once = process.env.JARVIS_WORKER_ONCE === '1' || process.env.JARVIS_WORKER_ONCE === 'true';
  runWorker({ once }).catch(error => {
    console.error('[JARVIS worker] fatal:', error);
    process.exitCode = 1;
  });
}
