process.env.GOOGLE_YOUTUBE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_YOUTUBE_CLIENT_SECRET = 'test-client-secret';

import test from 'node:test';
import assert from 'node:assert/strict';

const { getYouTubeAccessToken, withYouTubeAccessToken } = await import('../server/youtube.mjs');

test('YouTube access-token lookup reuses a non-expired token', async () => {
  const result = await getYouTubeAccessToken({
    access_token: 'stored-access',
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    refresh_token: 'unused-refresh',
  });
  assert.deepEqual(result, { accessToken: 'stored-access', refreshed: false });
});

test('YouTube access-token lookup can force exactly one refresh', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await getYouTubeAccessToken({
      access_token: 'stored-access',
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      refresh_token: 'refresh-token',
    }, { forceRefresh: true });
    assert.equal(result.accessToken, 'fresh-access');
    assert.equal(result.refreshed, true);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube operation retries once when a stored token is rejected early', async () => {
  const originalFetch = global.fetch;
  let tokenCalls = 0;
  global.fetch = async (url) => {
    assert.equal(String(url), 'https://oauth2.googleapis.com/token');
    tokenCalls += 1;
    return new Response(JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const seenTokens = [];
    const execution = await withYouTubeAccessToken({
      access_token: 'stored-access',
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      refresh_token: 'refresh-token',
    }, async accessToken => {
      seenTokens.push(accessToken);
      if (accessToken === 'stored-access') {
        throw Object.assign(new Error('invalid token'), { statusCode: 401 });
      }
      return { accepted: true, accessToken };
    });

    assert.deepEqual(seenTokens, ['stored-access', 'fresh-access']);
    assert.deepEqual(execution.result, { accepted: true, accessToken: 'fresh-access' });
    assert.equal(execution.token.refreshed, true);
    assert.equal(tokenCalls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('YouTube operation does not loop after a refresh-authenticated operation still returns 401', async () => {
  const originalFetch = global.fetch;
  let tokenCalls = 0;
  global.fetch = async () => {
    tokenCalls += 1;
    return new Response(JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await assert.rejects(
      withYouTubeAccessToken({
        access_token: 'expired-access',
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        refresh_token: 'refresh-token',
      }, async () => {
        throw Object.assign(new Error('still unauthorized'), { statusCode: 401 });
      }),
      /still unauthorized/
    );
    assert.equal(tokenCalls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
