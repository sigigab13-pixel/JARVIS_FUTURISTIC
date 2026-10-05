import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://wyblfoxpaycguuxdehpn.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';

const { createSignedMediaUrl, createSignedMediaUrls } = await import('../server/media.mjs');

const userId = '11111111-1111-4111-8111-111111111111';

test('signed media URL rejects an asset owned by another user', async () => {
  await assert.rejects(
    createSignedMediaUrl({
      userId,
      key: 'jarvis/22222222-2222-4222-8222-222222222222/children-factory/2026-10-05/scene.png',
    }),
    error => /ownership validation failed/i.test(error?.message || ''),
  );
});

test('signed media URL batch rejects mixed-ownership assets before provider call', async () => {
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
});

test('signed media URL batch returns empty for no assets', async () => {
  assert.deepEqual(
    await createSignedMediaUrls({ userId, keys: [] }),
    [],
  );
});
