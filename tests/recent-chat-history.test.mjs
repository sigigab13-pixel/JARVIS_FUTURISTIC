import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';

const calls = [];
const originalFetch = globalThis.fetch;
const messages = [
  { role: 'user', content: 'Oldest message', created_at: '2026-10-21T10:00:00Z' },
  { role: 'assistant', content: 'Middle reply', created_at: '2026-10-21T11:00:00Z' },
  { role: 'user', content: 'Newest message', created_at: '2026-10-21T12:00:00Z' },
];

function response(body) {
  return {
    ok: true,
    status: 200,
    async text() { return JSON.stringify(body); },
  };
}

globalThis.fetch = async (url) => {
  calls.push(String(url));
  const parsed = new URL(String(url));
  if (parsed.pathname.endsWith('/conversations')) {
    return response([{ id: 'conversation-123', title: 'JARVIS Conversation' }]);
  }
  if (parsed.pathname.endsWith('/conversation_messages')) {
    const newestFirst = parsed.searchParams.get('order') === 'created_at.desc';
    const sorted = newestFirst ? [...messages].reverse() : [...messages];
    const limit = Number(parsed.searchParams.get('limit') || 50);
    return response(sorted.slice(0, limit));
  }
  throw new Error('Unexpected test request: ' + parsed.pathname);
};

const store = await import('../server/store.mjs?recent-chat-history-test');
const USER_ID = '123e4567-e89b-12d3-a456-426614174000';

test.after(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
});

test('loads the most recent messages and returns them in chronological order', async () => {
  calls.length = 0;
  const history = await store.getConversationMessages(USER_ID, 2);

  assert.deepEqual(history, [
    { role: 'assistant', content: 'Middle reply' },
    { role: 'user', content: 'Newest message' },
  ]);

  const request = calls.find(url => url.includes('/conversation_messages?'));
  assert.ok(request);
  assert.match(request, /order=created_at\.desc/);
  assert.match(request, /limit=2/);
});
