import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSixHourTrendCheck,
  buildTrendQueue,
  normalizeTrendSignal,
  rankTrendOpportunity,
} from '../server/content-trend-office.mjs';

test('normalizes a kids trend signal', () => {
  const result = normalizeTrendSignal({
    topic: 'Kobi singing bird',
    platform: 'youtube',
    velocity: 2,
    engagement: -1,
  });

  assert.equal(result.velocity, 1);
  assert.equal(result.engagement, 0);
  assert.equal(result.platform, 'youtube');
});

test('ranks opportunities deterministically', () => {
  const result = rankTrendOpportunity({
    topic: 'Funny bird song',
    platform: 'tiktok',
    velocity: 1,
    engagement: 1,
    freshness: 1,
    audienceFit: 1,
  });

  assert.equal(result.score, 100);
  assert.equal(result.tier, 'priority');
});

test('trend queue sorts and limits', () => {
  const result = buildTrendQueue([
    { topic: 'A', platform: 'youtube', velocity: 1 },
    { topic: 'B', platform: 'youtube', velocity: 0.1 },
  ], { limit: 1 });

  assert.equal(result.length, 1);
  assert.equal(result[0].rank, 1);
  assert.equal(result[0].topic, 'A');
});

test('six-hour check never claims automatic publishing', () => {
  const result = buildSixHourTrendCheck({
    series: 'kids',
    platforms: ['youtube', 'bad'],
  });

  assert.equal(result.intervalHours, 6);
  assert.deepEqual(result.platforms, ['youtube']);
  assert.equal(result.publishAutomatically, false);
  assert.equal(result.requiresFreshEvidence, true);
});
