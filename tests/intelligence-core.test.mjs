import test from 'node:test';
import assert from 'node:assert/strict';
import { callOpenAIResponses, chooseModel, estimateComplexity, getOpenAIModels } from '../server/intelligence-core.mjs';

test('OpenAI model defaults are cost-conscious and configurable', () => {
  assert.deepEqual(getOpenAIModels({}), { fast: 'gpt-6-luna', reasoning: 'gpt-6.1-sol' });
  assert.deepEqual(getOpenAIModels({ OPENAI_FAST_MODEL: 'fast-x', OPENAI_REASONING_MODEL: 'reason-x' }), {
    fast: 'fast-x',
    reasoning: 'reason-x',
  });
});

test('simple conversation selects the fast intelligence tier', () => {
  const result = chooseModel({ latestUserMessage: 'Hello JARVIS', route: { mode: 'answer', intent: 'chat' }, env: {} });
  assert.equal(result.tier, 'fast');
  assert.equal(result.model, 'gpt-6-luna');
});

test('complex requests select the reasoning tier', () => {
  const result = chooseModel({
    latestUserMessage: 'Compare these architectures, explain the trade-offs, diagnose the failure, and give me a reliable migration plan.',
    route: { mode: 'decide', intent: 'chat', references: [] },
    env: {},
  });
  assert.equal(result.tier, 'reasoning');
  assert.equal(result.model, 'gpt-6.1-sol');
  assert.ok(result.complexity >= 3);
});

test('search/current language increases complexity', () => {
  const simple = estimateComplexity({ latestUserMessage: 'Tell me a fact.', route: { mode: 'answer', intent: 'chat' } });
  const current = estimateComplexity({ latestUserMessage: 'Research the latest current information online and verify the sources.', route: { mode: 'search', intent: 'chat' } });
  assert.ok(current > simple);
});


test('preserves provider-returned web citations', async () => {
  const result = await callOpenAIResponses({
    apiKey: 'test-key',
    model: 'gpt-test',
    tier: 'fast',
    instructions: 'Return a cited answer.',
    messages: [{ role: 'user', content: 'What is current?' }],
    enableWebSearch: true,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          id: 'resp_test',
          output_text: 'Current answer.',
          output: [{
            type: 'message',
            content: [{
              type: 'output_text',
              text: 'Current answer.',
              annotations: [{
                type: 'url_citation',
                title: 'Example source',
                url: 'https://example.com/current'
              }]
            }]
          }]
        };
      }
    })
  });
  assert.equal(result.webSearchUsed, true);
  assert.deepEqual(result.webCitations, [{
    type: 'live_web',
    title: 'Example source',
    url: 'https://example.com/current',
    evidence: 'external',
  }]);
});
