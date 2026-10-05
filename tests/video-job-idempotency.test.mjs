import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';

const { buildVideoJobIdempotencyKey, queueVideoJobForUser } = await import('../server/store.mjs');

test('video job idempotency key is stable for equivalent payloads', () => {
  const a = buildVideoJobIdempotencyKey('project-1', {
    operation: 'render',
    image_keys: ['a', 'b'],
    mission_id: 'mission-1',
  });
  const b = buildVideoJobIdempotencyKey('project-1', {
    mission_id: 'mission-1',
    image_keys: ['a', 'b'],
    operation: 'render',
  });
  assert.equal(a, b);
  assert.match(a, /^video:project-1:render:payload:[a-f0-9]{64}$/);
});

test('video job idempotency key changes when the operation changes', () => {
  const planKey = buildVideoJobIdempotencyKey(
    'project-1',
    { operation: 'plan', request: { title: 'Kobi' } },
  );
  const renderKey = buildVideoJobIdempotencyKey(
    'project-1',
    { operation: 'render', request: { title: 'Kobi' } },
  );
  assert.notEqual(planKey, renderKey);
});

test('video job idempotency key honors an explicit client key', () => {
  const key = buildVideoJobIdempotencyKey(
    'project-1',
    { operation: 'render', image_keys: ['a'] },
    'request-123',
  );
  assert.equal(key, 'video:project-1:render:client:request-123');
});

test('video job enqueue requests duplicate-safe Supabase semantics', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const userId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';

  global.fetch = async (_url, options = {}) => {
    calls.push(options);
    if (calls.length === 1) {
      return new Response(JSON.stringify([{ id: projectId }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify([{
      id: '33333333-3333-4333-8333-333333333333',
      idempotency_key: 'video:' + projectId + ':render:client:render-1',
    }]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const job = await queueVideoJobForUser(
      userId,
      projectId,
      { operation: 'render', prompt: 'Kobi sings' },
      'render-1',
    );
    assert.ok(job);
    assert.equal(
      calls[1].headers.Prefer,
      'resolution=ignore-duplicates,return=representation',
    );
    assert.equal(
      JSON.parse(calls[1].body).idempotency_key,
      'video:' + projectId + ':render:client:render-1',
    );
  } finally {
    global.fetch = originalFetch;
  }
});
