import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContentStrategy,
  scoreContentIdea,
} from '../server/content-strategy-office.mjs';

test('kids short strategy', () => {
  const plan = buildContentStrategy({
    series: 'kids',
    topic: 'Kobi and the Singing Bird',
    age: 7,
    platforms: ['youtube', 'tiktok'],
  });

  assert.equal(plan.version, 'content-strategy-v1');
  assert.equal(plan.packaging[0].aspectRatio, '9:16');
  assert.equal(plan.variants.length, 2);
  assert.equal(plan.safety.reviewRequired, true);
});

test('unsupported platforms fail closed', () => {
  assert.throws(
    () => buildContentStrategy({
      topic: 'Test',
      platforms: ['unknown'],
    }),
    /supported platform/,
  );
});

test('idea score is deterministic', () => {
  const result = scoreContentIdea({
    topic: 'bird teaches sharing',
    clarity: 1,
    curiosity: 1,
    educationalValue: 1,
    seriesFit: 1,
    productionEase: 1,
  });

  assert.equal(result.score, 100);
  assert.equal(result.tier, 'strong');
});

test('score signals are clamped', () => {
  const result = scoreContentIdea({
    topic: 'Test',
    curiosity: 99,
    clarity: -5,
  });

  assert.ok(result.score >= 0 && result.score <= 100);
});
