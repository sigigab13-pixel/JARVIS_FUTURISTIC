import crypto from 'node:crypto';

const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_TIMEOUT_MS = Math.min(
  2000,
  Math.max(250, Number(process.env.JARVIS_REDIS_TIMEOUT_MS) || 750),
);
const REDIS_BREAKER_THRESHOLD = 3;
const REDIS_BREAKER_COOLDOWN_MS = Math.min(
  120_000,
  Math.max(5_000, Number(process.env.JARVIS_REDIS_BREAKER_COOLDOWN_MS) || 30_000),
);

let redisFailureCount = 0;
let redisDisabledUntil = 0;

function configured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

function circuitOpen() {
  return Date.now() < redisDisabledUntil;
}

function recordRedisSuccess() {
  redisFailureCount = 0;
  redisDisabledUntil = 0;
}

function recordRedisFailure() {
  redisFailureCount += 1;
  if (redisFailureCount >= REDIS_BREAKER_THRESHOLD) {
    redisDisabledUntil = Date.now() + REDIS_BREAKER_COOLDOWN_MS;
  }
}

async function redis(command) {
  if (!configured()) throw Object.assign(
    new Error('Upstash Redis is not configured.'),
    { code: 'REDIS_NOT_CONFIGURED' },
  );

  if (circuitOpen()) throw Object.assign(
    new Error('Upstash Redis circuit breaker is open.'),
    {
      code: 'REDIS_CIRCUIT_OPEN',
      retryAfterMs: Math.max(0, redisDisabledUntil - Date.now()),
    },
  );

  try {
    const response = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.error) {
      throw new Error(
        `Upstash Redis request failed (${response.status}): ${String(data?.error || 'unknown error').slice(0, 500)}`,
      );
    }

    recordRedisSuccess();
    return data?.result;
  } catch (error) {
    recordRedisFailure();
    throw error;
  }
}

export function getRedisHealthState() {
  return {
    configured: configured(),
    circuitOpen: circuitOpen(),
    failureCount: redisFailureCount,
    retryAfterMs: circuitOpen() ? Math.max(0, redisDisabledUntil - Date.now()) : 0,
    timeoutMs: REDIS_TIMEOUT_MS,
  };
}

export async function checkRedisHealth() {
  const state = getRedisHealthState();
  if (!state.configured) {
    return {
      ...state,
      healthy: false,
      status: 'not_configured',
    };
  }

  if (state.circuitOpen) {
    return {
      ...state,
      healthy: false,
      status: 'circuit_open',
    };
  }

  const startedAt = Date.now();
  try {
    await redis(['PING']);
    return {
      ...getRedisHealthState(),
      healthy: true,
      status: 'ok',
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ...getRedisHealthState(),
      healthy: false,
      status: error?.name === 'TimeoutError' ? 'timeout' : 'error',
      errorCode: String(error?.code || '').slice(0, 80) || null,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export function createQueueMessage(jobId, type = 'jarvis') {
  return {
    id: crypto.randomUUID(),
    jobId: String(jobId),
    type: String(type || 'jarvis'),
    enqueuedAt: new Date().toISOString(),
  };
}

export async function enqueueJob(jobId, type = 'jarvis') {
  const message = createQueueMessage(jobId, type);
  await redis(['LPUSH', 'jarvis:jobs', JSON.stringify(message)]);
  return message;
}

export async function dequeueJob() {
  const message = await redis(['RPOP', 'jarvis:jobs']);
  if (!message) return null;
  try {
    return JSON.parse(message);
  } catch {
    return { jobId: null, type: 'invalid', raw: String(message) };
  }
}

export async function queueDepth() {
  return Number(await redis(['LLEN', 'jarvis:jobs']) || 0);
}

export { configured as isRedisConfigured };
