import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSchedule, nextRunAt } from '../server/routine-scheduler.mjs';

test('routine scheduler parses daily schedules', () => {
  assert.deepEqual(normalizeSchedule('daily 08:30'), { kind: 'daily', hour: 8, minute: 30 });
});

test('routine scheduler supports fixed intervals', () => {
  const from = new Date('2026-10-04T10:00:00.000Z');
  assert.equal(nextRunAt('every 2 hours', { from }).toISOString(), '2026-10-04T12:00:00.000Z');
});

test('routine scheduler supports weekly schedules', () => {
  const from = new Date('2026-10-04T10:00:00.000Z');
  const next = nextRunAt('weekly monday 08:00', { from, timezone: 'Africa/Lagos' });
  assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'long', hour:'2-digit', minute:'2-digit', hour12:false }).format(next), 'Monday, 08:00');
});
