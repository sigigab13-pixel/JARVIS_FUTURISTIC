import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHealthReport } from '../server/health.mjs';

test('health report is sanitized and exposes no secret values', async () => {
  const report = await buildHealthReport();

  assert.equal(report.version, 'health-v1');
  assert.equal(typeof report.healthy, 'boolean');
  assert.equal(typeof report.readiness, 'string');
  assert.equal(report.checks.application.healthy, true);

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /UPSTASH_REDIS_REST_TOKEN/i);
  assert.doesNotMatch(serialized, /SUPABASE_SECRET_KEY/i);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9_-]+/i);
});

test('health readiness does not require Redis or storage to be the source of truth', async () => {
  const report = await buildHealthReport();

  if (!report.checks.supabase.healthy || !report.checks.ai.configured) {
    assert.equal(report.healthy, false);
    assert.equal(report.readiness, 'not_ready');
  }
});
