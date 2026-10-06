import test from 'node:test';
import assert from 'node:assert/strict';
import { planGoal, replanGoal } from '../server/goal-outcome-core.mjs';

test('classifies answer requests and keeps workflow minimal', () => {
  const plan = planGoal({ request: 'What is the difference between the free and pro plans?' });
  assert.equal(plan.requestMode, 'answer');
  assert.equal(plan.subtasks.length, 2);
  assert.equal(plan.bounded, true);
});

test('classifies decision requests', () => {
  const plan = planGoal({ request: 'Help me decide which video provider is cheapest.' });
  assert.equal(plan.requestMode, 'decide');
  assert.match(plan.completionDefinition, /compared/i);
});

test('classifies prepare requests without authorizing external action', () => {
  const plan = planGoal({ request: 'Prepare Episode 1 for Kobi and the Singing Bird.' });
  assert.equal(plan.requestMode, 'prepare');
  assert.equal(plan.executionPolicy, 'plan_and_return');
  assert.ok(plan.subtasks.some(step => /artifact/i.test(step)));
});

test('classifies execution requests and requires authorization dependency', () => {
  const plan = planGoal({ request: 'Publish Episode 1 to YouTube.' });
  assert.equal(plan.requestMode, 'execute');
  assert.ok(plan.dependencies.includes('Explicit authorization for consequential external actions'));
  assert.match(plan.executionPolicy, /authorize_then_execute/);
});

test('extracts bounded constraints', () => {
  const plan = planGoal({ request: 'Find a free option using Everygen without a subscription.' });
  assert.ok(plan.constraints.some(value => /free/i.test(value)));
  assert.ok(plan.constraints.some(value => /using Everygen/i.test(value)));
});

test('supports explicit target and dependencies', () => {
  const plan = planGoal({
    request: 'Create the Kobi episode package.',
    target: 'A verified 9:16 Kobi episode package',
    dependencies: ['Everygen credits'],
  });
  assert.equal(plan.target, 'A verified 9:16 Kobi episode package');
  assert.ok(plan.dependencies.includes('Everygen credits'));
});

test('replans only when new evidence exists', () => {
  const plan = planGoal({ request: 'Find the best video provider.' });
  const unchanged = replanGoal(plan);
  assert.equal(unchanged.replanned, false);

  const replanned = replanGoal(plan, { changes: ['Everygen account has zero credits'] });
  assert.equal(replanned.replanned, true);
  assert.ok(replanned.evidenceApplied.includes('Everygen account has zero credits'));
  assert.ok(replanned.dependencies.includes('Everygen account has zero credits'));
});

test('rejects an empty goal', () => {
  assert.throws(() => planGoal({ request: '' }), /GOAL_REQUEST_REQUIRED/);
});
