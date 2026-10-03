import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistenceMode,
  createMissionForUser,
  getMissionForUser,
  listMissionsForUser,
  updateMissionForUser,
  getMissionEventsForUser,
} from '../server/store.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const missionId = '22222222-2222-4222-8222-222222222222';

test('mission store round-trips state and events in memory mode', async t => {
  if (persistenceMode() !== 'memory') {
    t.skip('Requires SUPABASE_URL/SUPABASE_SECRET_KEY to be unset for the in-memory adapter.');
    return;
  }

  const created = await createMissionForUser(userId, {
    id: missionId,
    userId,
    goal: 'Test mission',
    autonomy: 'advise',
    status: 'draft',
    currentStep: 0,
    steps: [{ id: 'step-1', title: 'Test step', capability: 'chat', status: 'pending' }],
    approval: { required: false, status: 'not_required' },
    lastEvidence: {},
    metadata: { test: true },
    createdAt: new Date().toISOString(),
  });

  assert.equal(created.id, missionId);
  assert.equal(created.status, 'draft');
  assert.equal((await getMissionForUser(userId, missionId))?.goal, 'Test mission');
  assert.equal((await listMissionsForUser(userId)).length, 1);

  const updated = await updateMissionForUser(userId, missionId, {
    ...created,
    status: 'canceled',
  }, {
    eventType: 'mission.canceled',
    message: 'Canceled in test.',
  });

  assert.equal(updated.status, 'canceled');
  const events = await getMissionEventsForUser(userId, missionId);
  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, 'mission.canceled');
  assert.equal(events[1].eventType, 'mission.created');
});
