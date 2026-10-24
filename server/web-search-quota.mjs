import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const localCounters = new Map();

function productionMode(env) {
  return env.NODE_ENV === 'production' || env.VERCEL === '1';
}

function dailyWindow(now) {
  const date = new Date(now);
  const resetAt = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return {
    day: date.toISOString().slice(0, 10),
    ttlSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    resetAt,
  };
}

function positiveLimit(env, key, fallback) {
  const parsed = Number(env[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(1_000_000, Math.floor(parsed)));
}

export function webSearchDailyLimit({ userId, planCode = 'free', env = process.env } = {}) {
  if (!userId) return positiveLimit(env, 'JARVIS_WEB_SEARCH_GUEST_DAILY_LIMIT', 2);
  const plan = String(planCode || 'free').trim().toLowerCase();
  if (plan === 'premium') return positiveLimit(env, 'JARVIS_WEB_SEARCH_PREMIUM_DAILY_LIMIT', 50);
  if (plan === 'pro') return positiveLimit(env, 'JARVIS_WEB_SEARCH_PRO_DAILY_LIMIT', 25);
  return positiveLimit(env, 'JARVIS_WEB_SEARCH_FREE_DAILY_LIMIT', 5);
}

function requestClientAddress(req, env) {
  const cloudflareAddress = String(req.headers?.['cf-connecting-ip'] || '').trim();
  if (env.JARVIS_TRUST_CLOUDFLARE_HEADERS === 'true' && isIP(cloudflareAddress)) {
    return cloudflareAddress;
  }

  const vercelAddress = String(req.headers?.['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  if ((env.VERCEL === '1' || env.JARVIS_TRUST_VERCEL_IP_HEADER === 'true') && isIP(vercelAddress)) {
    return vercelAddress;
  }

  return String(req.socket?.remoteAddress || 'unknown');
}

function identityHash({ userId, req, env }) {
  const identity = userId
    ? 'user:' + String(userId)
    : 'guest-ip:' + requestClientAddress(req, env);
  return createHash('sha256').update(identity).digest('hex').slice(0, 40);
}

async function incrementSharedQuota({ redisUrl, redisToken, userKey, globalKey, ttlSeconds, userLimit, globalLimit, fetchImpl }) {
  const script = [
    "local userCount = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "local globalCount = tonumber(redis.call('GET', KEYS[2]) or '0')",
    "local userLimit = tonumber(ARGV[2])",
    "local globalLimit = tonumber(ARGV[3])",
    "if userCount >= userLimit then return {0, 'user_limit', userCount, globalCount} end",
    "if globalCount >= globalLimit then return {0, 'global_limit', userCount, globalCount} end",
    "userCount = redis.call('INCR', KEYS[1])",
    "if userCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "globalCount = redis.call('INCR', KEYS[2])",
    "if globalCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end",
    "return {1, 'ok', userCount, globalCount}",
  ].join('; ');

  const response = await fetchImpl(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + redisToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify([
      'EVAL', script, '2', userKey, globalKey,
      String(ttlSeconds), String(userLimit), String(globalLimit),
    ]),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error || !Array.isArray(payload?.result) || payload.result.length < 4) {
    throw new Error('Shared web-search quota service is unavailable.');
  }

  const [allowed, reason, userCountRaw, globalCountRaw] = payload.result;
  return {
    allowed: Number(allowed) === 1,
    reason: String(reason || 'unknown'),
    userCount: Math.max(0, Number(userCountRaw) || 0),
    globalCount: Math.max(0, Number(globalCountRaw) || 0),
    mode: 'shared',
  };
}

function incrementLocalQuota({ userKey, globalKey, now, ttlSeconds, userLimit, globalLimit }) {
  for (const [key, value] of localCounters) {
    if (now >= value.resetAt) localCounters.delete(key);
  }
  const resetAt = now + ttlSeconds * 1000;
  let userEntry = localCounters.get(userKey);
  if (!userEntry || now >= userEntry.resetAt) userEntry = { count: 0, resetAt };
  let globalEntry = localCounters.get(globalKey);
  if (!globalEntry || now >= globalEntry.resetAt) globalEntry = { count: 0, resetAt };

  if (userEntry.count >= userLimit) {
    return { allowed: false, reason: 'user_limit', userCount: userEntry.count, globalCount: globalEntry.count, mode: 'local' };
  }
  if (globalEntry.count >= globalLimit) {
    return { allowed: false, reason: 'global_limit', userCount: userEntry.count, globalCount: globalEntry.count, mode: 'local' };
  }

  userEntry.count += 1;
  globalEntry.count += 1;
  localCounters.set(userKey, userEntry);
  localCounters.set(globalKey, globalEntry);
  return { allowed: true, reason: 'ok', userCount: userEntry.count, globalCount: globalEntry.count, mode: 'local' };
}

function denied(result, userLimit, globalLimit) {
  if (result.reason === 'user_limit') {
    return {
      allowed: false,
      statusCode: 429,
      code: 'WEB_SEARCH_DAILY_LIMIT_REACHED',
      message: 'Your daily live web-search allowance has been used. It resets at midnight UTC.',
      limit: userLimit,
      remaining: 0,
      globalLimit,
      mode: result.mode,
    };
  }
  if (result.reason === 'global_limit') {
    return {
      allowed: false,
      statusCode: 429,
      code: 'WEB_SEARCH_GLOBAL_LIMIT_REACHED',
      message: 'JARVIS has reached its daily live-search safety budget. Web search will return when the budget resets at midnight UTC.',
      limit: userLimit,
      remaining: Math.max(0, userLimit - result.userCount),
      globalLimit,
      mode: result.mode,
    };
  }
  return null;
}

export async function consumeWebSearchQuota({
  req,
  userId = null,
  planCode = 'free',
  env = process.env,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  if (!req || !req.headers) {
    return {
      allowed: false,
      statusCode: 503,
      code: 'WEB_SEARCH_QUOTA_UNAVAILABLE',
      message: 'Live web search is unavailable because its usage-protection context is missing.',
    };
  }

  const window = dailyWindow(now);
  const userLimit = webSearchDailyLimit({ userId, planCode, env });
  const globalLimit = positiveLimit(env, 'JARVIS_WEB_SEARCH_GLOBAL_DAILY_LIMIT', 250);
  const hash = identityHash({ userId, req, env });
  const userKey = 'jarvis:web-search:daily:' + window.day + ':' + hash;
  const globalKey = 'jarvis:web-search:global:' + window.day;
  const redisUrl = String(env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const redisToken = String(env.UPSTASH_REDIS_REST_TOKEN || '');
  let result;

  if (redisUrl && redisToken) {
    try {
      result = await incrementSharedQuota({
        redisUrl, redisToken, userKey, globalKey,
        ttlSeconds: window.ttlSeconds, userLimit, globalLimit, fetchImpl,
      });
    } catch {
      if (productionMode(env)) {
        return {
          allowed: false,
          statusCode: 503,
          code: 'WEB_SEARCH_QUOTA_UNAVAILABLE',
          message: 'Live web search is temporarily unavailable because its shared usage-protection service could not be reached.',
          limit: userLimit,
          globalLimit,
        };
      }
    }
  } else if (productionMode(env)) {
    return {
      allowed: false,
      statusCode: 503,
      code: 'WEB_SEARCH_QUOTA_NOT_CONFIGURED',
      message: 'Live web search is temporarily unavailable until its shared usage-protection service is configured.',
      limit: userLimit,
      globalLimit,
    };
  }

  if (!result) {
    result = incrementLocalQuota({
      userKey, globalKey, now, ttlSeconds: window.ttlSeconds, userLimit, globalLimit,
    });
  }

  const rejected = denied(result, userLimit, globalLimit);
  if (rejected) return rejected;
  return {
    allowed: true,
    limit: userLimit,
    remaining: Math.max(0, userLimit - result.userCount),
    globalLimit,
    globalRemaining: Math.max(0, globalLimit - result.globalCount),
    mode: result.mode,
  };
}
