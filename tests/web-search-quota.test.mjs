import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeWebSearchQuota, webSearchDailyLimit } from '../server/web-search-quota.mjs';

function request(ip = '198.51.100.1') {
  return {
    headers: {},
    socket: { remoteAddress: ip },
  };
}

test('daily search limits default to bounded guest, free, pro and premium quotas', () => {
  assert.equal(webSearchDailyLimit({ userId: null, planCode: 'free', env: {} }), 2);
  assert.equal(webSearchDailyLimit({ userId: 'user-a', planCode: 'free', env: {} }), 5);
  assert.equal(webSearchDailyLimit({ userId: 'user-b', planCode: 'pro', env: {} }), 25);
  assert.equal(webSearchDailyLimit({ userId: 'user-c', planCode: 'premium', env: {} }), 50);
  assert.equal(webSearchDailyLimit({ userId: 'user-c', planCode: 'premium', env: { JARVIS_WEB_SEARCH_PREMIUM_DAILY_LIMIT: '7' } }), 7);
});

test('free-user daily quota rejects extra searches without incrementing usage again', async () => {
  const env = { NODE_ENV: 'test' };
  let result;
  for (let i = 0; i < 5; i += 1) {
    result = await consumeWebSearchQuota({
      req: request('198.51.100.101'),
      userId: '11111111-1111-4111-8111-111111111111',
      planCode: 'free',
      env,
      now: Date.UTC(2027, 0, 5, 12),
    });
    assert.equal(result.allowed, true);
  }
  assert.equal(result.remaining, 0);

  result = await consumeWebSearchQuota({
    req: request('198.51.100.101'),
    userId: '11111111-1111-4111-8111-111111111111',
    planCode: 'free',
    env,
    now: Date.UTC(2027, 0, 5, 12),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 429);
  assert.equal(result.code, 'WEB_SEARCH_DAILY_LIMIT_REACHED');
});

test('guest searches are isolated by IP and subject to a stricter daily quota', async () => {
  const env = { NODE_ENV: 'test' };
  const now = Date.UTC(2027, 0, 6, 12);
  assert.equal((await consumeWebSearchQuota({ req: request('198.51.100.111'), env, now })).allowed, true);
  assert.equal((await consumeWebSearchQuota({ req: request('198.51.100.111'), env, now })).allowed, true);
  const denied = await consumeWebSearchQuota({ req: request('198.51.100.111'), env, now });
  assert.equal(denied.code, 'WEB_SEARCH_DAILY_LIMIT_REACHED');
  assert.equal((await consumeWebSearchQuota({ req: request('198.51.100.112'), env, now })).allowed, true);
});

test('global daily cap stops new users without charging the blocked request', async () => {
  const env = { NODE_ENV: 'test', JARVIS_WEB_SEARCH_GLOBAL_DAILY_LIMIT: '2' };
  const now = Date.UTC(2027, 0, 7, 12);
  assert.equal((await consumeWebSearchQuota({ req: request('198.51.100.121'), userId: 'user-a', env, now })).allowed, true);
  assert.equal((await consumeWebSearchQuota({ req: request('198.51.100.122'), userId: 'user-b', env, now })).allowed, true);
  const denied = await consumeWebSearchQuota({ req: request('198.51.100.123'), userId: 'user-c', env, now });
  assert.equal(denied.allowed, false);
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.code, 'WEB_SEARCH_GLOBAL_LIMIT_REACHED');
});

test('production search fails closed when Upstash quota protection is not configured', async () => {
  const result = await consumeWebSearchQuota({
    req: request(),
    userId: '11111111-1111-4111-8111-111111111111',
    env: { NODE_ENV: 'production' },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 503);
  assert.equal(result.code, 'WEB_SEARCH_QUOTA_NOT_CONFIGURED');
});

test('shared quota uses one atomic Redis script and does not send raw user identifiers', async () => {
  let command;
  const userId = '11111111-1111-4111-8111-111111111111';
  const result = await consumeWebSearchQuota({
    req: request(),
    userId,
    planCode: 'free',
    env: {
      NODE_ENV: 'test',
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    },
    now: Date.UTC(2027, 0, 8, 12),
    fetchImpl: async (_url, options) => {
      command = JSON.parse(options.body);
      return { ok: true, json: async () => ({ result: [1, 'ok', 1, 1] }) };
    },
  });
  assert.equal(command[0], 'EVAL');
  assert.equal(command[2], '2');
  assert.equal(command[3].includes(userId), false);
  assert.equal(result.allowed, true);
  assert.equal(result.mode, 'shared');
  assert.equal(result.remaining, 4);
  assert.equal(result.globalRemaining, 249);
});

test('production search fails closed if the shared quota store errors', async () => {
  const result = await consumeWebSearchQuota({
    req: request(),
    userId: '11111111-1111-4111-8111-111111111111',
    env: {
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    },
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'unavailable' }) }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 503);
  assert.equal(result.code, 'WEB_SEARCH_QUOTA_UNAVAILABLE');
});
