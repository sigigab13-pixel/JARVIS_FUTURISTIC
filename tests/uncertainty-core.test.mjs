import test from 'node:test';
import assert from 'node:assert/strict';
import { assessUncertainty, buildEpistemicInstruction, classifyEpistemicNeed } from '../server/uncertainty-core.mjs';

test('freshness-sensitive requests are detected', () => {
  const result = classifyEpistemicNeed({
    latestUserMessage: 'Check the latest current information and verify the source.',
    route: { mode: 'search', intent: 'research' },
  });
  assert.equal(result.currentSensitive, true);
  assert.equal(result.certaintyRequested, false);
});

test('live search produces a supported evidence signal', () => {
  const result = assessUncertainty({
    latestUserMessage: 'What is the latest news?',
    route: { mode: 'search', intent: 'research' },
    responseText: 'The search results support this update.',
    webSearchUsed: true,
  });
  assert.equal(result.level, 'supported');
  assert.equal(result.liveEvidence, true);
  assert.equal(result.shouldSignal, false);
});

test('freshness-sensitive requests without live search are limited', () => {
  const result = assessUncertainty({
    latestUserMessage: 'What is the current price?',
    route: { mode: 'search', intent: 'research' },
    responseText: 'The price is 100.',
    webSearchUsed: false,
  });
  assert.equal(result.level, 'limited');
  assert.equal(result.shouldSignal, true);
});

test('explicit uncertainty is preserved as a cautious signal', () => {
  const result = assessUncertainty({
    latestUserMessage: 'Explain the theory.',
    route: { mode: 'answer', intent: 'chat' },
    responseText: 'I am not sure; this could be one explanation.',
    webSearchUsed: false,
  });
  assert.equal(result.level, 'cautious');
  assert.equal(result.uncertaintyExpressed, true);
});

test('epistemic instruction tells JARVIS not to fake verification', () => {
  const instruction = buildEpistemicInstruction({
    currentSensitive: true,
    certaintyRequested: true,
    liveEvidence: false,
  });
  assert.match(instruction, /Do not present current details as verified/i);
  assert.match(instruction, /do not manufacture confidence/i);
  assert.match(instruction, /do not invent citations/i);
});