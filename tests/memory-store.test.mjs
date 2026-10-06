import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';

const calls = [];
const originalFetch = globalThis.fetch;

function mockResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  const rawUrl = String(url);
  if (options.method === 'DELETE') {
    const id = new URL(rawUrl).searchParams.get('id');
    return mockResponse(id ? [{ id }] : [{ id: '223e4567-e89b-12d3-a456-426614174001' }]);
  }
  return mockResponse([
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      memory_type: 'preference',
      content: 'Use a simple JARVIS domain.',
      metadata: { source: 'chat' },
      importance: 0.85,
      created_at: '2026-10-06T10:00:00Z',
      last_accessed_at: null,
    },
  ]);
};

const store = await import('../server/store.mjs?true-forget-store-test');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const MEMORY_ID = '223e4567-e89b-12d3-a456-426614174001';
const OTHER_USER_ID = '323e4567-e89b-12d3-a456-426614174002';

test.after(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
});

test('lists only safe, user-scoped memory fields', async () => {
  calls.length = 0;
  const memories = await store.listSemanticMemories(USER_ID, 25);

  assert.equal(memories.length, 1);
  assert.equal(memories[0].id, MEMORY_ID);
  assert.equal(memories[0].content, 'Use a simple JARVIS domain.');

  const request = calls.at(-1);
  assert.match(request.url, /user_id=eq\.123e4567-e89b-12d3-a456-426614174000/);
  assert.match(request.url, /select=id,memory_type,content,metadata,importance,created_at,last_accessed_at/);
  assert.doesNotMatch(request.url, /embedding/);
});

test('deletes one memory only when both memory id and owner id are supplied', async () => {
  calls.length = 0;
  const result = await store.deleteSemanticMemory(USER_ID, MEMORY_ID);

  assert.deepEqual(result, { deleted: true, deletedCount: 1 });
  const request = calls.at(-1);
  assert.equal(request.options.method, 'DELETE');
  assert.match(request.url, /id=eq\.223e4567-e89b-12d3-a456-426614174001/);
  assert.match(request.url, /user_id=eq\.123e4567-e89b-12d3-a456-426614174000/);
  assert.equal(request.options.headers.Prefer, 'return=representation');

  await assert.rejects(
    () => store.deleteSemanticMemory(OTHER_USER_ID, 'not-a-memory'),
    /Invalid JARVIS memory id/
  );
});

test('deletes all memories for exactly one owner', async () => {
  calls.length = 0;
  const result = await store.deleteAllSemanticMemories(USER_ID);

  assert.deepEqual(result, { deleted: true, deletedCount: 1 });
  const request = calls.at(-1);
  assert.equal(request.options.method, 'DELETE');
  assert.match(request.url, /user_id=eq\.123e4567-e89b-12d3-a456-426614174000/);
  assert.equal(new URL(request.url).searchParams.has('id'), false);
});
