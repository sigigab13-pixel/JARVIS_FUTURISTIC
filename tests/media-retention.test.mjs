import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_MEDIA_BUCKET = 'jarvis-media';

const {
  createMediaKey,
  registerMediaAsset,
  markMediaRetention,
  listExpiredMediaAssets,
  deleteMediaObject,
  cleanupExpiredMedia,
} = await import('../server/media.mjs');

test('media keys preserve user ownership path', () => {
  const key = createMediaKey({
    userId: '11111111-1111-4111-8111-111111111111',
    kind: 'children-factory',
    extension: 'png',
    id: 'scene-1',
  });
  assert.equal(key, 'jarvis/11111111-1111-4111-8111-111111111111/children-factory/2026-10-06/scene-1.png');
});

test('media registry assigns safe retention classes by media kind', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify([{ id: 'asset-1', retention_class: 'working', status: 'active' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await registerMediaAsset({
      userId: '11111111-1111-4111-8111-111111111111',
      key: 'jarvis/11111111-1111-4111-8111-111111111111/children-factory/2026-10-06/scene.png',
      contentType: 'image/png',
      sizeBytes: 1000,
    });
    assert.equal(result.tracked, true);
    assert.equal(result.retentionClass, 'working');
    assert.ok(result.expiresAt);
    assert.equal(calls.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('protected media never receives an automatic expiry', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify([{ id: 'asset-1' }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    const result = await registerMediaAsset({
      userId: '11111111-1111-4111-8111-111111111111',
      key: 'jarvis/11111111-1111-4111-8111-111111111111/video-render/2026-10-06/final.mp4',
      contentType: 'video/mp4',
      sizeBytes: 1000,
    });
    assert.equal(result.retentionClass, 'protected');
    assert.equal(result.expiresAt, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test('expired cleanup deletes only registry-approved user-owned objects', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    const target = String(url);
    if (target.includes('jarvis_media_assets?select=')) {
      return new Response(JSON.stringify([{
        id: 'asset-1',
        user_id: '11111111-1111-4111-8111-111111111111',
        bucket_id: 'jarvis-media',
        object_key: 'jarvis/11111111-1111-4111-8111-111111111111/mission-image/2026-10-01/a.png',
        retention_class: 'ephemeral',
        expires_at: '2026-10-05T00:00:00Z',
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (target.includes('/storage/v1/object/')) {
      return new Response('', { status: 200 });
    }
    return new Response('', { status: 200 });
  };

  try {
    const result = await cleanupExpiredMedia({ limit: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.deleted, 1);
    assert.equal(result.failed, 0);
    assert.ok(calls.some(call => call.method === 'DELETE'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('media deletion rejects objects outside the configured bucket', async () => {
  await assert.rejects(
    deleteMediaObject({ bucketId: 'other-bucket', key: 'jarvis/user/file.mp4' }),
    /outside the configured JARVIS bucket/i
  );
});

test('retention updates are user-scoped', async () => {
  const originalFetch = global.fetch;
  let requestUrl = '';
  global.fetch = async (url) => {
    requestUrl = String(url);
    return new Response(JSON.stringify([{ id: 'asset-1' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await markMediaRetention({
      userId: '11111111-1111-4111-8111-111111111111',
      key: 'jarvis/11111111-1111-4111-8111-111111111111/video-render/2026-10-06/final.mp4',
      retentionClass: 'published',
    });
    assert.equal(result.updated, true);
    assert.match(requestUrl, /user_id=eq./);
  } finally {
    global.fetch = originalFetch;
  }
});
