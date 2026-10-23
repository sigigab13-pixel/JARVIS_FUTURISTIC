import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const localWindows = new Map();
const WINDOW_MS = 60_000;
const LIMITS = Object.freeze({ general: 120, conversation: 20, speech: 10, expensive: 5 });

function productionMode(env) {
  return env.NODE_ENV === 'production' || env.VERCEL === '1';
}

function clientAddress(req, env) {
  const cloudflareAddress = String(req.headers?.['cf-connecting-ip'] || '').trim();
  if (env.JARVIS_TRUST_CLOUDFLARE_HEADERS === 'true' && isIP(cloudflareAddress)) return cloudflareAddress;

  const vercelAddress = String(req.headers?.['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  const trustVercelAddress = env.JARVIS_TRUST_VERCEL_IP_HEADER === 'true'
    || (env.VERCEL === '1' && env.JARVIS_TRUST_CLOUDFLARE_HEADERS !== 'true');
  if (trustVercelAddress && isIP(vercelAddress)) return vercelAddress;

  return String(req.socket?.remoteAddress || 'unknown');
}

function policyForPath(pathname) {
  if (pathname === '/api/_healthcheck') return null;
  if (/^\/api\/(image\/generate|image\/edit|factory\/children|youtube\/publish)(\/|$)/.test(pathname)
      || pathname.startsWith('/api/video/')) {
    return { bucket: 'expensive', limit: LIMITS.expensive, windowMs: WINDOW_MS, failClosed: true };
  }
  if (pathname === '/api/chat' || pathname === '/api/route') {
    return { bucket: 'conversation', limit: LIMITS.conversation, windowMs: WINDOW_MS, failClosed: false };
  }
  if (pathname === '/api/tts/synthesize') {
    return { bucket: 'speech', limit: LIMITS.speech, windowMs: WINDOW_MS, failClosed: true };
  }
  return { bucket: 'general', limit: LIMITS.general, windowMs: WINDOW_MS, failClosed: false };
}

function localIncrement(key, now, windowMs) {
  let entry = localWindows.get(key);
  if (!entry || now >= entry.resetAt) entry = { count: 0, resetAt: now + windowMs };
  entry.count += 1;
  localWindows.set(key, entry);

  if (localWindows.size > 10_000) {
    for (const [storedKey, stored] of localWindows) {
      if (now >= stored.resetAt) localWindows.delete(storedKey);
    }
  }
  return { count: entry.count, ttlMs: Math.max(0, entry.resetAt - now), mode: 'local' };
}

async function sharedIncrement({ key, windowMs, redisUrl, redisToken, fetchImpl }) {
  const script = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; local ttl = redis.call('PTTL', KEYS[1]); return {count, ttl}";
  const response = await fetchImpl(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + redisToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(['EVAL', script, '1', key, String(windowMs)]),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error || !Array.isArray(payload?.result)) {
    throw new Error('Shared rate-limit service is unavailable.');
  }
  return {
    count: Number(payload.result[0]),
    ttlMs: Math.max(0, Number(payload.result[1]) || windowMs),
    mode: 'shared',
  };
}

export function applySecurityHeaders(res, { production = productionMode(process.env) } = {}) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  };
  if (production) headers['Strict-Transport-Security'] = 'max-age=31536000';
  for (const [name, value] of Object.entries(headers)) {
    if (!res.headersSent) res.setHeader(name, value);
  }
}

export async function checkRequestRateLimit(req, pathname, {
  env = process.env,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  if (!pathname.startsWith('/api/')) return { allowed: true, mode: 'not-applicable' };
  const policy = policyForPath(pathname);
  if (!policy) return { allowed: true, mode: 'healthcheck-exempt' };

  const address = clientAddress(req, env);
  const addressHash = createHash('sha256').update(address).digest('hex').slice(0, 32);
  const localKey = policy.bucket + ':' + addressHash;
  const redisUrl = String(env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const redisToken = String(env.UPSTASH_REDIS_REST_TOKEN || '');
  let counter;

  if (redisUrl && redisToken) {
    const redisKey = 'jarvis:security:ratelimit:v1:' + policy.bucket + ':' + addressHash;
    try {
      counter = await sharedIncrement({ key: redisKey, windowMs: policy.windowMs, redisUrl, redisToken, fetchImpl });
    } catch {
      if (policy.failClosed && productionMode(env)) {
        return {
          allowed: false,
          statusCode: 503,
          code: 'SHARED_RATE_LIMIT_UNAVAILABLE',
          message: 'This resource-intensive feature is temporarily unavailable because its abuse-protection service cannot be reached.',
          retryAfterSeconds: 30,
          limit: policy.limit,
        };
      }
    }
  } else if (policy.failClosed && productionMode(env) && env.JARVIS_ALLOW_LOCAL_RATE_LIMIT_FALLBACK !== 'true') {
    return {
      allowed: false,
      statusCode: 503,
      code: 'SHARED_RATE_LIMIT_NOT_CONFIGURED',
      message: 'This resource-intensive feature is temporarily unavailable until shared abuse protection is configured.',
      retryAfterSeconds: 30,
      limit: policy.limit,
    };
  }

  if (!counter) counter = localIncrement(localKey, now, policy.windowMs);
  const remaining = Math.max(0, policy.limit - counter.count);
  if (counter.count <= policy.limit) return { allowed: true, limit: policy.limit, remaining, mode: counter.mode };
  return {
    allowed: false,
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please wait a little and try again.',
    retryAfterSeconds: Math.max(1, Math.ceil(counter.ttlMs / 1000)),
    limit: policy.limit,
    remaining: 0,
    mode: counter.mode,
  };
}

export async function protectRequest(req, res, pathname, options = {}) {
  applySecurityHeaders(res, { production: productionMode(options.env || process.env) });
  const decision = await checkRequestRateLimit(req, pathname, options);
  if (decision.allowed) return true;

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Retry-After': String(decision.retryAfterSeconds || 30),
  };
  if (decision.limit) headers['X-RateLimit-Limit'] = String(decision.limit);
  res.writeHead(decision.statusCode || 429, headers);
  res.end(JSON.stringify({ error: decision.message, code: decision.code }));
  return false;
}
