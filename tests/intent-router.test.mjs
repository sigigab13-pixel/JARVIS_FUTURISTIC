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


test('routes children content production to Children Factory intent', () => {
  const route = routeIntent({
    messages: [{ role: 'user', content: 'Make a fun rhyming video for children about animals' }],
    availableCapabilities: [
      {
        id: 'children_factory',
        description: "Prepare children's stories, rhymes, images, and approval-gated publish packages.",
        keywords: ['children', 'rhyme', 'video'],
      },
    ],
  });
  assert.equal(route.mode, 'create');
  assert.equal(route.intent, 'children-factory');
  assert.ok(route.candidateCapabilities.some(item => item.id === 'children_factory'));
});

test('keeps an explicit child image request on the image path', () => {
  const route = routeIntent({
    messages: [{ role: 'user', content: 'Create a picture for children of a friendly lion' }],
    availableCapabilities: [
      { id: 'image', description: 'Generate and edit images.', keywords: ['image', 'picture', 'photo'] },
      {
        id: 'children_factory',
        description: "Prepare children's stories, rhymes, images, and approval-gated publish packages.",
        keywords: ['children', 'rhyme', 'video'],
      },
    ],
  });
  assert.equal(route.intent, 'image');
});
