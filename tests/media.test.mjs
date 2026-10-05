import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://wyblfoxpaycguuxdehpn.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';

const originalFetch = global.fetch;
const fetchCalls = [];
global.fetch = async (url, options = {}) => {
  fetchCalls.push({ url: String(url), options });
  return new Response(JSON.stringify({
    signedURL: '/object/sign/jarvis-media/temporary-token',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const { createSignedMediaUrl, createSignedMediaUrls } = await import('../server/media.mjs');

const userId = '11111111-1111-4111-8111-111111111111';

test.after(() => {
  global.fetch = originalFetch;
});

test('signed media URL rejects an asset owned by another user', async () => {
  await assert.rejects(
    createSignedMediaUrl({
      userId,
      key: 'jarvis/22222222-2222-4222-8222-222222222222/children-factory/2026-10-05/scene.png',
    }),
    error => /ownership validation failed/i.test(error?.message || ''),
  );
});

test('signed media URL returns a temporary provider-safe URL', async () => {
  const url = await createSignedMediaUrl({
    userId,
    key: 'jarvis/11111111-1111-4111-8111-111111111111/children-factory/2026-10-05/scene-1.png',
    expiresIn: 900,
  });

  assert.match(url, /^https:\/\/wyblfoxpaycguuxdehpn\.supabase\.co\/storage\/v1\/object\/sign\//);
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/storage\/v1\/object\/sign\//);
  assert.equal(fetchCalls[0].options.method, 'POST');
});

test('signed media URL batch rejects mixed-ownership assets before provider call', async () => {
  fetchCalls.length = 0;
  await assert.rejects(
    createSignedMediaUrls({
      userId,
      keys: [
        'jarvis/11111111-1111-4111-8111-111111111111/children-factory/2026-10-05/scene-1.png',
        'jarvis/22222222-2222-4222-8222-222222222222/children-factory/2026-10-05/scene-2.png',
      ],
    }),
    error => /ownership validation failed/i.test(error?.message || ''),
  );
  assert.equal(fetchCalls.length, 0);
});

test('signed media URL batch returns empty for no assets', async () => {
  assert.deepEqual(
    await createSignedMediaUrls({ userId, keys: [] }),
    [],
  );
});
