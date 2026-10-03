import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistenceMode,
  createRoutineForUser,
  getRoutineForUser,
  listRoutinesForUser,
} from '../server/store.mjs';

const userId = '33333333-3333-4333-8333-333333333333';

test('routine store creates isolated recurring routines in memory mode', async t => {
  if (persistenceMode() !== 'memory') {
    t.skip('Requires SUPABASE_URL/SUPABASE_SECRET_KEY to be unset for the in-memory adapter.');
    return;
  }

  const routine = await createRoutineForUser(userId, {
    name: 'Morning test routine',
    schedule: 'daily 08:00',
    timezone: 'Africa/Lagos',
    maxParallelJobs: 2,
    jobTemplates: [
      { id: 'check', type: 'health_check', payload: { source: 'test' } },
      { id: 'scan', type: 'trend_scan', payload: { topic: 'children' } },
    ],
  });

  assert.equal(routine.name, 'Morning test routine');
  assert.equal(routine.maxParallelJobs, 2);
  assert.equal(routine.jobTemplates.length, 2);
  assert.ok(new Date(routine.nextRunAt).getTime() > Date.now());

  const found = await getRoutineForUser(userId, routine.id);
  assert.equal(found?.id, routine.id);
  assert.equal((await listRoutinesForUser(userId)).some(item => item.id === routine.id), true);
});
