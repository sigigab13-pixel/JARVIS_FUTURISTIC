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

test('classifies consequential side-effect verbs as execution and requires authorization', () => {
  for (const request of [
    'Schedule the video for tomorrow.',
    'Upload the finished file.',
    'Deploy the website.',
    'Change the account settings.',
    'Cancel the scheduled post.',
    'Create and publish the announcement.',
  ]) {
    const plan = planGoal({ request });
    assert.equal(plan.requestMode, 'execute', request);
    assert.ok(plan.dependencies.includes('Explicit authorization for consequential external actions'), request);
    assert.equal(plan.executionPolicy, 'plan_then_authorize_then_execute_then_verify', request);
  }
});

test('keeps how-to questions in answer mode even when they mention side effects', () => {
  for (const request of [
    'How do I publish a video?',
    'Explain how to upload a file.',
    'Show me how to delete a test record.',
  ]) {
    const plan = planGoal({ request });
    assert.equal(plan.requestMode, 'answer', request);
    assert.equal(plan.executionPolicy, 'plan_and_return', request);
  }
});

test('classifies a direct build request as preparation rather than external execution', () => {
  const plan = planGoal({ request: 'Build JARVIS PRIME.' });
  assert.equal(plan.requestMode, 'prepare');
  assert.equal(plan.executionPolicy, 'plan_and_return');
});

test('distinguishes direct commands from planning or ambiguous intent', () => {
  const planning = planGoal({ request: 'Create a plan to deploy the website.' });
  assert.equal(planning.requestMode, 'prepare');

  const compound = planGoal({ request: 'Build the app and then deploy it.' });
  assert.equal(compound.requestMode, 'execute');
  assert.ok(compound.dependencies.includes('Explicit authorization for consequential external actions'));

  const addressed = planGoal({ request: 'Can you deploy the website?' });
  assert.equal(addressed.requestMode, 'execute');

  const educational = planGoal({ request: 'Can you explain how to deploy a website?' });
  assert.equal(educational.requestMode, 'answer');

  const ambiguous = planGoal({ request: 'I want to publish a video.' });
  assert.notEqual(ambiguous.requestMode, 'execute');
});
