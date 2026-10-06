import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenance, extractWebCitations } from '../server/provenance-core.mjs';

test('extracts URL citations from output annotations', () => {
  const sources = extractWebCitations({
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        annotations: [
          { type: 'url_citation', title: 'Example source', url: 'https://example.com/a' },
          { type: 'url_citation', title: 'Duplicate', url: 'https://example.com/a' },
        ],
      }],
    }],
  });
  assert.deepEqual(sources, [{
    type: 'live_web',
    title: 'Example source',
    url: 'https://example.com/a',
    evidence: 'external',
  }]);
});

test('extracts search-call source URLs when annotations are absent', () => {
  const sources = extractWebCitations({
    output: [{
      type: 'web_search_call',
      action: {
        sources: [
          { type: 'url', url: 'https://example.com/source', title: 'Search source' },
        ],
      },
    }],
  });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, 'https://example.com/source');
});

test('provenance distinguishes externally verified web evidence', () => {
  const result = buildProvenance({
    messageCount: 3,
    memoryCount: 2,
    webSearchUsed: true,
    webCitations: [{ url: 'https://example.com', title: 'Example' }],
    provider: 'OpenAI Responses API',
  });
  assert.equal(result.evidenceLevel, 'externally_verified');
  assert.deepEqual(result.basis, ['externally_verified_web', 'saved_user_memory', 'conversation_context', 'model_inference']);
  assert.equal(result.sources.length, 3);
  assert.equal(result.webSourceCount, 1);
});

test('provenance does not call live search independently verified when no citation exists', () => {
  const result = buildProvenance({
    messageCount: 1,
    webSearchUsed: true,
    webCitations: [],
    provider: 'OpenAI Responses API',
  });
  assert.equal(result.evidenceLevel, 'live_search_no_citation');
  assert.ok(result.note.includes('no provider citation'));
});

test('inferred answers are explicitly labeled as inference', () => {
  const result = buildProvenance({ messageCount: 1, memoryCount: 0, webSearchUsed: false });
  assert.equal(result.evidenceLevel, 'contextual');
  assert.ok(result.basis.includes('model_inference'));
});