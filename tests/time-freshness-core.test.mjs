import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTimeAwarenessInstruction,
  classifyMemoryStaleness,
  classifyTimeNeed,
  getCurrentTimeContext,
  getTimeContextForRequest,
} from '../server/time-freshness-core.mjs';

test('current time context uses a deterministic timezone and date format', () => {
  const result = getCurrentTimeContext({
    now: new Date('2026-10-06T14:00:00.000Z'),
    timeZone: 'Africa/Lagos',
  });
  assert.equal(result.timeZone, 'Africa/Lagos');
  assert.equal(result.localDate, '2026-10-06');
  assert.equal(result.localTime, '15:00:00');
  assert.match(result.display, /Tuesday/);
});

test('time-sensitive requests are detected from language and route', () => {
  assert.equal(
    classifyTimeNeed({ latestUserMessage: 'What is the latest information today?', route: { mode: 'answer' } }).timeSensitive,
    true,
  );
  assert.equal(
    classifyTimeNeed({ latestUserMessage: 'Explain photosynthesis.', route: { mode: 'answer' } }).timeSensitive,
    false,
  );
  assert.equal(
    classifyTimeNeed({ latestUserMessage: 'Research this topic.', route: { mode: 'search' } }).timeSensitive,
    true,
  );
});

test('old saved memories are marked potentially stale, not deleted', () => {
  const result = classifyMemoryStaleness(
    { updated_at: '2026-08-01T00:00:00.000Z' },
    { now: new Date('2026-10-06T00:00:00.000Z'), staleAfterDays: 30 },
  );
  assert.equal(result.potentiallyStale, true);
  assert.ok(result.ageDays > 60);
});

test('fresh saved memories remain within the freshness window', () => {
  const result = classifyMemoryStaleness(
    { updated_at: '2026-09-20T00:00:00.000Z' },
    { now: new Date('2026-10-06T00:00:00.000Z'), staleAfterDays: 30 },
  );
  assert.equal(result.potentiallyStale, false);
});

test('request context reports stale-memory count and time anchor', () => {
  const result = getTimeContextForRequest({
    latestUserMessage: 'What is current now?',
    route: { mode: 'search' },
    memories: [
      { updated_at: '2026-07-01T00:00:00.000Z' },
      { updated_at: '2026-10-01T00:00:00.000Z' },
    ],
    now: new Date('2026-10-06T00:00:00.000Z'),
    timeZone: 'Africa/Lagos',
  });
  assert.equal(result.timeSensitive, true);
  assert.equal(result.localDate, '2026-10-06');
  assert.equal(result.potentiallyStaleMemoryCount, 1);
});

test('time awareness instruction warns against treating stale memory as current fact', () => {
  const instruction = buildTimeAwarenessInstruction({
    timeContext: {
      display: 'Tuesday, 6 October 2026 at 15:00:00',
      timeZone: 'Africa/Lagos',
    },
    timeSensitive: true,
    potentiallyStaleMemoryCount: 2,
  });
  assert.match(instruction, /Anchor relative dates/i);
  assert.match(instruction, /old saved memory as automatically current/i);
  assert.match(instruction, /Treat them as context, not proof/i);
});