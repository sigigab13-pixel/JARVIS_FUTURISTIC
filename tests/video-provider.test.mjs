import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertVideoProviderReady,
  getVideoProvider,
  listVideoProviders,
  normalizeVideoProvider,
  validateVideoProviderRequest,
} from '../server/video-provider.mjs';

test('video provider registry contains the implemented FFmpeg and explicit external adapter states', () => {
  const providers = listVideoProviders();
  assert.ok(providers.some(item => item.provider === 'ffmpeg' && item.submission === 'implemented'));
  assert.ok(providers.some(item => item.provider === 'higgsfield' && item.submission === 'adapter_not_verified'));
  assert.ok(providers.some(item => item.provider === 'everygen' && item.submission === 'adapter_not_verified'));
});

test('provider normalization falls back safely for unknown providers', () => {
  assert.equal(normalizeVideoProvider('HIGGSFIELD'), 'higgsfield');
  assert.equal(normalizeVideoProvider('not-a-provider'), 'ffmpeg');
  assert.equal(getVideoProvider('higgsfield')?.recommendedModel, 'seedance_2_5');
});

test('Higgsfield children profile accepts a 9:16 five-second scene', () => {
  assert.deepEqual(
    validateVideoProviderRequest({
      provider: 'higgsfield',
      mode: 'image_to_video',
      model: 'seedance_2_5',
      aspectRatio: '9:16',
      duration: 5,
    }),
    {
      ok: true,
      provider: 'higgsfield',
      model: 'seedance_2_5',
      mode: 'image_to_video',
      aspectRatio: '9:16',
      duration: 5,
      submission: 'adapter_not_verified',
    },
  );
});

test('unverified external providers never report ready', () => {
  assert.throws(
    () => assertVideoProviderReady({
      provider: 'higgsfield',
      mode: 'image_to_video',
      model: 'seedance_2_5',
      aspectRatio: '9:16',
      duration: 5,
    }),
    error => error?.code === 'VIDEO_PROVIDER_ADAPTER_UNAVAILABLE',
  );
});

test('invalid provider requests fail before any provider call', () => {
  const result = validateVideoProviderRequest({
    provider: 'higgsfield',
    mode: 'image_to_video',
    model: 'seedance_2_5',
    aspectRatio: '2:3',
    duration: 5,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIDEO_PROVIDER_ASPECT_RATIO_UNSUPPORTED');
});
