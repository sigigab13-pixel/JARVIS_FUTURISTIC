import { createSignedMediaUrls } from './media.mjs';

const API_BASE = 'https://api.higgsfield.ai';

function credential() {
  return String(
    process.env.HIGGSFIELD_API_KEY ||
    process.env.HF_CREDENTIALS ||
    ''
  ).trim();
}

function configured() {
  return Boolean(credential());
}

function headers() {
  return {
    Authorization: 'Key ' + credential(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function assertProviderUrl(value) {
  const url = String(value || '').trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error('Higgsfield media references must be valid HTTPS URLs.'), { statusCode: 400, provider: 'higgsfield' });
  }
  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Higgsfield media references must use HTTPS.'), { statusCode: 400, provider: 'higgsfield' });
  }
  return parsed.toString();
}

function assertHiggsfieldUrl(value) {
  const url = String(value || '').trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error('Higgsfield request URL is invalid.'), { statusCode: 400, provider: 'higgsfield' });
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.higgsfield.ai') {
    throw Object.assign(new Error('Higgsfield request URL must stay on api.higgsfield.ai.'), { statusCode: 400, provider: 'higgsfield' });
  }
  return parsed.toString();
}

function apiError(response, body, fallback) {
  const detail = body?.error?.message || body?.error || body?.message || body?.detail || fallback;
  return Object.assign(new Error(String(detail).slice(0, 1000)), {
    statusCode: response.status,
    provider: 'higgsfield',
  });
}

function normalizeStatus(data = {}) {
  const raw = String(data?.status || data?.state || '').trim().toLowerCase();
  const terminal = new Set(['completed', 'failed', 'nsfw', 'canceled', 'cancelled']);
  const status = raw === 'cancelled' ? 'canceled' : raw || 'unknown';
  return {
    status,
    terminal: terminal.has(status),
    requestId: String(data?.request_id || data?.id || '').trim() || null,
    statusUrl: String(data?.status_url || '').trim() || null,
    cancelUrl: String(data?.cancel_url || '').trim() || null,
    videoUrl: String(
      data?.video?.url ||
      data?.video?.output_url ||
      data?.video_url ||
      data?.result?.video?.url ||
      data?.result?.video_url ||
      ''
    ).trim() || null,
    raw: data,
  };
}

export function isHiggsfieldConfigured() {
  return configured();
}

export function buildHiggsfieldRequest({
  model = 'bytedance/seedance-2.5/reference-to-video',
  imageUrls = [],
  prompt = '',
  duration = 5,
  resolution = '720p',
  aspectRatio = '9:16',
  outputFormat = 'mp4',
  generateAudio = true,
} = {}) {
  const cleanImages = Array.isArray(imageUrls)
    ? imageUrls.map(assertProviderUrl).slice(0, 12)
    : [];
  if (!cleanImages.length) throw new Error('Higgsfield video generation requires at least one image URL.');
  const seconds = Math.min(30, Math.max(4, Math.round(Number(duration) || 5)));
  const allowedResolution = ['480p', '720p'].includes(String(resolution)) ? String(resolution) : '720p';
  const allowedAspectRatio = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'].includes(String(aspectRatio))
    ? String(aspectRatio)
    : '9:16';
  const allowedFormat = ['mp4', 'mov'].includes(String(outputFormat)) ? String(outputFormat) : 'mp4';

  return {
    model: String(model || 'bytedance/seedance-2.5/reference-to-video').trim(),
    input: {
      prompt: String(prompt || '').trim().slice(0, 2500),
      image_urls: cleanImages,
      duration: seconds,
      resolution: allowedResolution,
      aspect_ratio: allowedAspectRatio,
      output_format: allowedFormat,
      generate_audio: Boolean(generateAudio),
    },
  };
}

export async function submitHiggsfieldVideoFromMediaKeys({
  userId,
  mediaKeys = [],
  prompt = '',
  duration = 5,
  resolution = '720p',
  aspectRatio = '9:16',
  outputFormat = 'mp4',
  generateAudio = true,
} = {}) {
  if (!String(userId || '').trim()) {
    throw Object.assign(new Error('JARVIS user identity is required for provider media signing.'), {
      statusCode: 400,
      provider: 'higgsfield',
    });
  }
  const keys = Array.isArray(mediaKeys) ? mediaKeys.map(String).map(key => key.trim()).filter(Boolean).slice(0, 12) : [];
  if (!keys.length) {
    throw Object.assign(new Error('At least one JARVIS media key is required for Higgsfield video generation.'), {
      statusCode: 400,
      provider: 'higgsfield',
    });
  }

  const imageUrls = await createSignedMediaUrls({
    userId: String(userId),
    keys,
    expiresIn: 600,
  });

  return submitHiggsfieldVideo({
    imageUrls,
    prompt,
    duration,
    resolution,
    aspectRatio,
    outputFormat,
    generateAudio,
  });
}

export async function submitHiggsfieldVideo(options = {}) {
  if (!configured()) throw Object.assign(new Error('Higgsfield is not configured.'), { statusCode: 503 });
  const request = buildHiggsfieldRequest(options);
  const response = await fetch(API_BASE + '/' + request.model, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(request.input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(response, data, 'Higgsfield video request failed.');
  const normalized = normalizeStatus(data);
  if (!normalized.requestId) {
    throw Object.assign(new Error('Higgsfield accepted no request id.'), { statusCode: 502, provider: 'higgsfield' });
  }
  return {
    ...normalized,
    provider: 'higgsfield',
    model: request.model,
  };
}

export async function getHiggsfieldVideoStatus(requestIdOrUrl) {
  if (!configured()) throw Object.assign(new Error('Higgsfield is not configured.'), { statusCode: 503 });
  const target = String(requestIdOrUrl || '').trim();
  if (!target) throw Object.assign(new Error('Higgsfield request id is required.'), { statusCode: 400 });
  const url = /^https:\/\//i.test(target)
    ? assertHiggsfieldUrl(target)
    : API_BASE + '/requests/' + encodeURIComponent(target) + '/status';
  const response = await fetch(url, {
    method: 'GET',
    headers: headers(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(response, data, 'Higgsfield status request failed.');
  return {
    ...normalizeStatus(data),
    provider: 'higgsfield',
  };
}

export async function cancelHiggsfieldVideo(requestIdOrUrl) {
  if (!configured()) throw Object.assign(new Error('Higgsfield is not configured.'), { statusCode: 503 });
  const target = String(requestIdOrUrl || '').trim();
  if (!target) throw Object.assign(new Error('Higgsfield request id is required.'), { statusCode: 400 });
  const url = /^https:\/\//i.test(target)
    ? assertHiggsfieldUrl(target)
    : API_BASE + '/requests/' + encodeURIComponent(target) + '/cancel';
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(response, data, 'Higgsfield cancel request failed.');
  return {
    ...normalizeStatus(data),
    provider: 'higgsfield',
  };
}
