import test from 'node:test';
import assert from 'node:assert/strict';

// Isolate store configuration before importing it. The mocked REST endpoint
// verifies the server-side claim contract without touching a real Supabase project.
process.env.SUPABASE_URL = 'https://supabase-claim-test.invalid';
process.env.SUPABASE_SECRET_KEY = 'unit-test-only';

const requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  if (String(url).includes('/rpc/jarvis_claim_youtube_upload_attempt')) {
    return new Response('false', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('Unexpected network request in YouTube claim unit test: ' + url);
};

const { claimYouTubeUploadAttemptForUser } = await import('../server/store.mjs');

const userId = '11111111-1111-4111-8111-111111111111';
const missionId = '22222222-2222-4222-8222-222222222222';

test('a rejected atomic claim returns false and sends the expected RPC payload', async () => {
  requests.length = 0;
  const result = await claimYouTubeUploadAttemptForUser(userId, missionId, {
    id: 'attempt-test-1',
    status: 'in_progress',
    startedAt: '2026-10-27T00:00:00.000Z',
  });

  assert.equal(result, false);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/rpc\/jarvis_claim_youtube_upload_attempt$/);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    p_user_id: userId,
    p_mission_id: missionId,
    p_attempt: {
      id: 'attempt-test-1',
      status: 'in_progress',
      startedAt: '2026-10-27T00:00:00.000Z',
    },
  });
});

test('invalid mission identity is rejected before any network request', async () => {
  requests.length = 0;
  await assert.rejects(
    claimYouTubeUploadAttemptForUser('not-a-uuid', missionId, {
      id: 'attempt-test-2',
      status: 'in_progress',
    }),
    /Invalid mission identity/
  );
  assert.equal(requests.length, 0);
});

test('an attempt that is not in progress is rejected before any network request', async () => {
  requests.length = 0;
  await assert.rejects(
    claimYouTubeUploadAttemptForUser(userId, missionId, {
      id: 'attempt-test-3',
      status: 'completed',
    }),
    /valid in-progress YouTube upload attempt/
  );
  assert.equal(requests.length, 0);
});
