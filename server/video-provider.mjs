const PROVIDERS = Object.freeze({
  ffmpeg: Object.freeze({
    provider: 'ffmpeg',
    kind: 'local_renderer',
    supportedModes: Object.freeze(['image_sequence_to_video']),
    aspectRatios: Object.freeze(['16:9', '9:16', '1:1']),
    duration: Object.freeze({ min: 1, max: 900 }),
    submission: 'implemented',
  }),
  higgsfield: Object.freeze({
    provider: 'higgsfield',
    kind: 'external_generator',
    supportedModes: Object.freeze(['image_to_video']),
    recommendedModel: 'seedance_2_5',
    aspectRatios: Object.freeze(['9:16', '16:9', '1:1', '3:4', '4:3', '21:9']),
    duration: Object.freeze({ min: 4, max: 30 }),
    submission: 'adapter_not_verified',
  }),
  everygen: Object.freeze({
    provider: 'everygen',
    kind: 'external_generator',
    supportedModes: Object.freeze(['image_to_video', 'text_to_video']),
    aspectRatios: Object.freeze(['9:16', '16:9', '1:1']),
    duration: Object.freeze({ min: 1, max: 900 }),
    submission: 'adapter_not_verified',
  }),
});

export function listVideoProviders() {
  return Object.values(PROVIDERS).map(provider => ({
    ...provider,
    supportedModes: [...provider.supportedModes],
    aspectRatios: [...provider.aspectRatios],
    duration: { ...provider.duration },
  }));
}

export function getVideoProvider(provider = 'ffmpeg') {
  const key = String(provider || '').trim().toLowerCase();
  return PROVIDERS[key] || null;
}

export function normalizeVideoProvider(provider, fallback = 'ffmpeg') {
  const requested = String(provider || '').trim().toLowerCase();
  if (PROVIDERS[requested]) return requested;
  const safeFallback = String(fallback || 'ffmpeg').trim().toLowerCase();
  return PROVIDERS[safeFallback] ? safeFallback : 'ffmpeg';
}

export function validateVideoProviderRequest({
  provider = 'ffmpeg',
  mode = 'image_sequence_to_video',
  model = null,
  aspectRatio = '16:9',
  duration = 5,
} = {}) {
  const resolved = normalizeVideoProvider(provider);
  const definition = PROVIDERS[resolved];

  if (!definition.supportedModes.includes(mode)) {
    return {
      ok: false,
      code: 'VIDEO_PROVIDER_MODE_UNSUPPORTED',
      message: resolved + ' does not support mode ' + String(mode) + '.',
      provider: resolved,
    };
  }

  if (!definition.aspectRatios.includes(aspectRatio)) {
    return {
      ok: false,
      code: 'VIDEO_PROVIDER_ASPECT_RATIO_UNSUPPORTED',
      message: resolved + ' does not support aspect ratio ' + String(aspectRatio) + '.',
      provider: resolved,
    };
  }

  const numericDuration = Number(duration);
  if (!Number.isFinite(numericDuration) || numericDuration < definition.duration.min || numericDuration > definition.duration.max) {
    return {
      ok: false,
      code: 'VIDEO_PROVIDER_DURATION_UNSUPPORTED',
      message: resolved + ' duration must be between ' + definition.duration.min + ' and ' + definition.duration.max + ' seconds.',
      provider: resolved,
    };
  }

  if (resolved === 'higgsfield' && model && model !== 'seedance_2_5') {
    return {
      ok: false,
      code: 'VIDEO_PROVIDER_MODEL_UNVERIFIED',
      message: 'Only the verified Higgsfield Seedance 2.5 capability profile is registered for JARVIS children image-to-video.',
      provider: resolved,
      model,
    };
  }

  return {
    ok: true,
    provider: resolved,
    model: model || definition.recommendedModel || null,
    mode,
    aspectRatio,
    duration: numericDuration,
    submission: definition.submission,
  };
}

export function assertVideoProviderReady({ provider = 'ffmpeg', ...request } = {}) {
  const result = validateVideoProviderRequest({ provider, ...request });
  if (!result.ok) {
    throw Object.assign(new Error(result.message), {
      code: result.code,
      statusCode: 400,
    });
  }
  if (result.submission !== 'implemented') {
    throw Object.assign(new Error(
      'Video provider ' + result.provider + ' is not available for direct JARVIS server submission yet.'
    ), {
      code: 'VIDEO_PROVIDER_ADAPTER_UNAVAILABLE',
      statusCode: 503,
    });
  }
  return result;
}
