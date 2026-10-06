import test from 'node:test';
import assert from 'node:assert/strict';
import { routeIntent } from '../server/intent-router.mjs';

const caps = [
  { id: 'image', description: 'Generate and edit images.', keywords: ['image', 'picture', 'photo', 'illustration', 'illustrate', 'draw', 'thumbnail', 'poster'] },
  { id: 'youtube', description: 'Upload and publish videos to YouTube.', keywords: ['youtube', 'upload', 'publish'] },
  { id: 'video', description: 'Plan and manage video production projects and pipeline jobs.', keywords: ['video', 'animation', 'reel', 'short', 'storyboard', 'film', 'movie'] },
  { id: 'web_intelligence', description: 'Search current information on the public web.', keywords: ['search', 'current', 'web', 'latest', 'research'] },
  { id: 'business', description: 'Manage business clients and workflows.', keywords: ['business', 'client', 'customer', 'manage'] },
  { id: 'durable_missions', description: 'Long-running queued jobs with persistent state and worker processing.', keywords: ['mission', 'automate', 'schedule', 'monitor', 'background', 'workflow'] },
];

function route(prompt) {
  return routeIntent({
    messages: [{ role: 'user', content: prompt }],
    availableCapabilities: caps,
  });
}

function expectIntent(prompts, intent) {
  for (const prompt of prompts) {
    const result = route(prompt);
    assert.equal(result.intent, intent, 'Expected "' + prompt + '" -> ' + intent + ', got ' + result.intent);
  }
}

test('children factory prompts route away from generic chat', () => {
  expectIntent([
    'make a bedtime story for a 5yr old',
    'write a nursery rhyme for kids about kindness',
    'create a story for children aged 7 about sharing',
    'give me a gentle bedtime tale for my little brother',
  ], 'children-story');
});

test('image prompts route to image intent and capability', () => {
  for (const prompt of [
    'create an image of a colorful jungle',
    'draw a picture of a friendly robot',
    'make me a photo-style thumbnail for YouTube',
    'design a poster for our children channel',
    'illustrate a moonlit village',
  ]) {
    const result = route(prompt);
    assert.equal(result.intent, 'image', 'Expected "' + prompt + '" -> image');
    assert.ok(result.candidateCapabilities.some(item => item.id === 'image'), 'Image capability missing for "' + prompt + '"');
  }
});

test('repair prompts route to the repair intent', () => {
  expectIntent([
    'fix the broken login flow',
    'repair the worker issue',
    'the AI core is broken, diagnose it',
    'something is wrong with the deployment, fix it',
  ], 'repair');
});

test('research and publishing prompts choose the appropriate operating mode', () => {
  for (const [prompt, mode, capability] of [
    ['search for the latest children content trends', 'search', 'web_intelligence'],
    ['research what is new in YouTube kids content', 'search', 'web_intelligence'],
    ['upload this video to YouTube', 'execute', 'youtube'],
    ['publish the approved video', 'execute', 'youtube'],
    ['upload the finished short to YouTube', 'execute', 'youtube'],
  ]) {
    const result = route(prompt);
    assert.equal(result.mode, mode, 'Expected "' + prompt + '" -> ' + mode + ', got ' + result.mode);
    assert.ok(result.candidateCapabilities.some(item => item.id === capability), 'Missing ' + capability + ' for "' + prompt + '"');
  }
});

test('contextual and management prompts preserve grounding requirements', () => {
  const contextual = routeIntent({
    messages: [
      { role: 'assistant', content: 'I found your report from yesterday.' },
      { role: 'user', content: 'check that and summarize it' },
    ],
    availableCapabilities: caps,
  });
  assert.equal(contextual.mode, 'inspect');
  assert.equal(contextual.references.some(item => item.type === 'contextual'), true);
  assert.equal(contextual.needsClarification, false);

  const management = route('manage my business customers');
  assert.equal(management.mode, 'manage');
  assert.ok(management.candidateCapabilities.some(item => item.id === 'business'));
});


test('routes supported product surfaces from natural-language intent', () => {
  const cases = [
    ['make a bedtime story about sharing for kids', 'children-story', ''],
    ['the login is broken, check what is wrong', 'repair', ''],
    ['help me create a video about a friendly robot', 'chat', 'video'],
    ['manage my business customers', 'chat', 'business'],
    ['publish my approved video to YouTube', 'chat', 'youtube'],
    ['run this mission in the background', 'chat', 'durable_missions'],
  ];

  for (const [prompt, intent, capability] of cases) {
    const result = route(prompt);
    assert.equal(result.intent, intent, 'Expected "' + prompt + '" -> ' + intent + ', got ' + result.intent);
    if (capability) assert.ok(result.candidateCapabilities.some(item => item.id === capability), 'Missing ' + capability + ' for "' + prompt + '"');
  }
});
