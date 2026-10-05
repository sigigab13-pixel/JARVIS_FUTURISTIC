import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimatePlatformRevenue,
  buildYouTubeRevenueSnapshot,
} from '../server/monetization/youtube-revenue-tracker.mjs';
import { buildKdpExport } from '../server/monetization/kdp-exporter.mjs';
import { buildMerchExport } from '../server/monetization/merch-generator.mjs';
import {
  getSubscriptionPlans,
  getSubscriptionPlan,
  getBillingStatus,
} from '../server/monetization/subscription-plans.mjs';
import { getMonetizationOfficeConfig } from '../server/monetization-office.mjs';

test('revenue tracker estimates from supplied RPM without claiming a payout', () => {
  const result = estimatePlatformRevenue({
    platform: 'youtube',
    views: 12500,
    ratePerThousandViews: 4,
  });

  assert.equal(result.estimatedRevenue, 50);
  assert.equal(result.estimateBasis, 'user-supplied-rate');
  assert.match(result.disclaimer, /planning estimate/i);
});

test('YouTube revenue snapshot aggregates analytics rows', () => {
  const result = buildYouTubeRevenueSnapshot({
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    ratePerThousandViews: 2,
    analytics: {
      columnHeaders: [
        { name: 'day' },
        { name: 'views' },
        { name: 'estimatedMinutesWatched' },
        { name: 'averageViewDuration' },
        { name: 'likes' },
        { name: 'comments' },
        { name: 'subscribersGained' },
        { name: 'subscribersLost' },
      ],
      rows: [
        ['2026-10-01', 1000, 20, 60, 30, 4, 5, 1],
        ['2026-10-02', 1500, 30, 72, 45, 6, 8, 2],
      ],
    },
  });

  assert.equal(result.views, 2500);
  assert.equal(result.likes, 75);
  assert.equal(result.comments, 10);
  assert.equal(result.netSubscribers, 10);
  assert.equal(result.estimatedRevenue, 5);
  assert.equal(result.daysReturned, 2);
});

test('KDP exporter prepares a manuscript without external submission', () => {
  const result = buildKdpExport({
    title: 'Kobi and the Singing Bird',
    author: 'JARVIS Futuristic',
    story: 'Kobi hears a song in the forest and follows it safely home.',
  });

  assert.equal(result.status, 'export_ready');
  assert.match(result.suggestedFilename, /kdp-manuscript\.txt$/);
  assert.match(result.manuscript, /Kobi and the Singing Bird/);
  assert.match(result.note, /does not upload/i);
});

test('merch exporter creates product placeholders from a character', () => {
  const result = buildMerchExport({
    character: {
      name: 'Kobi',
      description: 'A cheerful young forest explorer.',
    },
    products: ['sticker', 'tshirt'],
  });

  assert.deepEqual(result.products, ['sticker', 'tshirt']);
  assert.equal(result.mockupPlaceholders.length, 2);
  assert.equal(result.mockupPlaceholders[0].assetSource, 'character-artwork');
  assert.equal(result.artworkBrief.keepCharacterConsistent, true);
});

test('subscription catalog is non-billing and exposes the proposed plans', () => {
  const plans = getSubscriptionPlans();
  assert.deepEqual(plans.map(plan => plan.code), ['free', 'creator', 'studio']);
  assert.equal(getSubscriptionPlan('creator').monthlyPrice, 19);
  assert.equal(getSubscriptionPlan('studio').monthlyPrice, 99);
  assert.equal(getBillingStatus().enabled, false);
});

test('monetization office config keeps charging and external transactions disabled', () => {
  const config = getMonetizationOfficeConfig();
  assert.equal(config.office, 'monetization');
  assert.equal(config.autoCharge, false);
  assert.equal(config.autoPublish, false);
  assert.equal(config.externalMerchOrder, false);
  assert.equal(config.externalKdpSubmission, false);
});
