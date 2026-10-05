import test from 'node:test';
import assert from 'node:assert/strict';
import { routeIntent } from '../server/intent-router.mjs';

const caps = [
  { id: 'image', description: 'Generate and edit images.', keywords: ['image', 'picture', 'photo', 'illustration', 'illustrate', 'draw', 'thumbnail', 'poster'] },
  { id: 'youtube', description: 'Upload and publish videos to YouTube.', keywords: ['youtube', 'upload', 'publish'] },
  { id: 'web_intelligence', description: 'Search current information on the public web.', keywords: ['search', 'current', 'web', 'latest', 'research'] },
  { id: 'business', description: 'Manage business clients and workflows.', keywords: ['business', 'client', 'customer', 'manage'] },
  { id: 'children_factory', description: "Prepare children's stories, rhymes, images, and approval-gated publish packages.", keywords: ['children', 'kids', 'story', 'rhyme', 'video'] },
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

test('children production prompts route to the Children Factory', () => {
  expectIntent([
    'make a bedtime story video for a 5yr old',
    'write a nursery rhyme video for kids about kindness',
    'create a story animation for children aged 7 about sharing',
  ], 'children-factory');
});

test('simple child storytelling stays a story intent', () => {
  expectIntent([
    'give me a gentle bedtime tale for my little brother',
    'tell me a short story for a child about friendship',
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
