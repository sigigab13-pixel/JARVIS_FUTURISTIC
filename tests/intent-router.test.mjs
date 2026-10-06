import test from 'node:test';
import assert from 'node:assert/strict';
import { routeIntent, routeContextForPrompt } from '../server/intent-router.mjs';

const caps = [
  { id: 'image', description: 'Generate and edit images.', keywords: ['image', 'picture', 'photo'] },
  { id: 'youtube', description: 'Upload and publish videos to YouTube.', keywords: ['youtube', 'upload', 'publish'] },
  { id: 'web_intelligence', description: 'Search current information on the public web.', keywords: ['search', 'current', 'web'] },
  { id: 'business', description: 'Manage business clients and workflows.', keywords: ['business', 'client', 'customer'] },
];

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

test('maps explicit product navigation to one canonical surface', () => {
  const cases = [
    ['open the children factory', 'children'],
    ['show me the image lab', 'image'],
    ['launch video studio', 'video'],
    ['take me to YouTube', 'youtube'],
    ['open business manager', 'business'],
    ['show missions', 'mission'],
    ['run a security check', 'security'],
    ['open system center', 'system'],
    ['what can you do', 'capabilities'],
    ['open command center', 'command'],
    ['open empire command', 'empire'],
  ];

  for (const [prompt, surface] of cases) {
    const result = routeIntent({
      messages: [{ role: 'user', content: prompt }],
      availableCapabilities: caps,
    });
    assert.equal(result.surface, surface, 'Expected "' + prompt + '" -> ' + surface);
    assert.equal(result.surfaceAction, 'open');
  }
});

test('maps supported natural-language task requests without frontend regex rules', () => {
  const cases = [
    ['make a bedtime story for a child', 'children'],
    ['make a short animated video for my channel', 'video'],
    ['publish this approved video on youtube', 'youtube'],
    ['manage my business customers', 'business'],
    ['schedule a background mission', 'mission'],
    ['fix the broken login flow', 'system'],
    ['create an image of a friendly robot', 'image'],
  ];

  for (const [prompt, surface] of cases) {
    const result = routeIntent({
      messages: [{ role: 'user', content: prompt }],
      availableCapabilities: caps,
    });
    assert.equal(result.surface, surface, 'Expected "' + prompt + '" -> ' + surface);
    assert.ok(['open', 'generate'].includes(result.surfaceAction));
  }
});
