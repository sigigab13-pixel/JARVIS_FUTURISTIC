import test from 'node:test';
import assert from 'node:assert/strict';
import { routeIntent, routeContextForPrompt } from '../server/intent-router.mjs';

const caps = [
  { id: 'image', description: 'Generate and edit images.', keywords: ['image', 'picture', 'photo', 'illustration', 'draw', 'thumbnail', 'poster'] },
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


test('routes create intent with candidate capabilities', () => {
  const route = routeIntent({
    messages: [{ role: 'user', content: 'Create a picture for my business' }],
    availableCapabilities: caps,
  });
  assert.equal(route.mode, 'create');
  assert.ok(route.candidateCapabilities.some(item => item.id === 'image'));
});

test('detects contextual references and avoids pretending to resolve them', () => {
  const route = routeIntent({
    messages: [
      { role: 'assistant', content: 'I found your report.' },
      { role: 'user', content: 'Check that and summarize it.' },
    ],
    availableCapabilities: caps,
  });
  assert.equal(route.mode, 'inspect');
  assert.equal(route.references.some(item => item.type === 'contextual'), true);
  assert.equal(route.needsClarification, false);
});

test('provides prompt-safe routing context', () => {
  const context = routeContextForPrompt({
    mode: 'search',
    candidateCapabilities: [{ id: 'web_intelligence' }],
    references: [],
    needsClarification: false,
  });
  assert.match(context, /web_intelligence/);
});

test('server-owned surface routing resolves navigation and task requests', () => {
  const cases = [
    ['open the children factory', 'children', 'open'],
    ['show me the image lab', 'image', 'open'],
    ['make a bedtime story for kids', 'children', 'open'],
    ['create an image of a friendly robot', 'image', 'generate'],
    ['help me create a video about a friendly robot', 'video', 'open'],
    ['manage my business customers', 'business', 'open'],
    ['run this mission in the background', 'mission', 'open'],
  ];

  for (const [prompt, surface, action] of cases) {
    const result = route(prompt);
    assert.equal(result.surface, surface, 'Expected "' + prompt + '" -> ' + surface);
    assert.equal(result.surfaceAction, action, 'Expected "' + prompt + '" -> ' + action);
  }
});

test('server-owned routing does not activate tools from ordinary mentions', () => {
  for (const prompt of [
    'Tell me about YouTube',
    'I use the image lab sometimes',
    'What is the mission of this project?',
    'My business is growing fast',
  ]) {
    const result = route(prompt);
    assert.equal(result.surface, null, 'Unexpected surface for "' + prompt + '"');
    assert.equal(result.surfaceAction, 'chat');
  }
});

test('routing context reports the authoritative surface decision', () => {
  const result = route('open the system center');
  const context = routeContextForPrompt(result);
  assert.match(context, /surface: system/);
  assert.match(context, /surface action: open/);
});
