const HIGGSFIELD_BASE_URL = String(process.env.HIGGSFIELD_API_BASE_URL || 'https://api.higgsfield.ai').replace(/\/$/, '');
const HIGGSFIELD_API_KEY = String(process.env.HIGGSFIELD_API_KEY || '').trim();

export const HIGGSFIELD_VIDEO_MODEL = 'kling-video/v3.0-turbo/image-to-video';

export function isHiggsfieldConfigured() {
  return Boolean(HIGGSFIELD_API_KEY);
}

function authHeaders() {
  if (!HIGGSFIELD_API_KEY) throw Object.assign(new Error('Higgsfield API key is not configured.'), { code: 'HIGGSFIELD_NOT_CONFIGURED' });
  return {
    Authorization: `Key ${HIGGSFIELD_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function higgsfieldFetch(pathname, options = {}) {
  const response = await fetch(`${HIGGSFIELD_BASE_URL}${pathname}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = String(data?.message || data?.error || data?.detail || data?.raw || `HTTP ${response.status}`).slice(0, 1000);
    const error = new Error(`Higgsfield API request failed (${response.status}): ${message}`);
    error.statusCode = response.status;
    error.provider = 'higgsfield';
    throw error;
  }
  return data;
}

export async function uploadReferenceImage({ body, contentType = 'image/png' }) {
  if (!Buffer.isBuffer(body)) throw new Error('Higgsfield reference image must be a Buffer.');
  const upload = await higgsfieldFetch('/files/generate-upload-url', {
    method: 'POST',
    body: JSON.stringify({ content_type: contentType }),
  });
  const uploadUrl = String(upload?.upload_url || '').trim();
  const publicUrl = String(upload?.public_url || '').trim();
  if (!uploadUrl || !publicUrl) throw new Error('Higgsfield did not return a usable reference upload URL.');

  const uploadHeaders = upload?.upload_headers && typeof upload.upload_headers === 'object' ? upload.upload_headers : {};
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Higgsfield reference upload failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return { publicUrl };
}

export async function generateImageToVideo({ imageUrl, prompt, durationSeconds = 5, resolution = '720p' }) {
  const cleanImageUrl = String(imageUrl || '').trim();
  if (!cleanImageUrl) throw new Error('Higgsfield requires a reference image URL.');
  const duration = Math.max(3, Math.min(15, Math.round(Number(durationSeconds) || 5)));
  const payload = {
    prompt: String(prompt || 'Gently animate this storybook scene while preserving character identity, composition, colors, and setting.'),
    duration,
    image_url: cleanImageUrl,
    resolution: resolution === '1080p' ? '1080p' : '720p',
  };

  const submitted = await higgsfieldFetch(`/${HIGGSFIELD_VIDEO_MODEL}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const requestId = String(submitted?.request_id || '').trim();
  if (!requestId) throw new Error('Higgsfield accepted the request without returning a request id.');
  return { requestId, statusUrl: String(submitted?.status_url || `/requests/${requestId}/status`), payload };
}

export async function waitForHiggsfieldVideo(requestId, { timeoutMs = 8 * 60_000, pollMs = 4_000 } = {}) {
  const id = String(requestId || '').trim();
  if (!id) throw new Error('Higgsfield request id is required.');
  const deadline = Date.now() + timeoutMs;
  let lastStatus = '';

  while (Date.now() < deadline) {
    const status = await higgsfieldFetch(`/requests/${encodeURIComponent(id)}/status`, { method: 'GET' });
    lastStatus = String(status?.status || '').toLowerCase();
    if (lastStatus === 'completed') {
      const videoUrl = String(status?.video?.url || '').trim();
      if (!videoUrl) throw new Error('Higgsfield completed the request without returning a video URL.');
      return { requestId: id, status: lastStatus, videoUrl, raw: status };
    }
    if (['failed', 'nsfw', 'canceled'].includes(lastStatus)) {
      const message = String(status?.error?.message || status?.message || `Higgsfield request ended with status ${lastStatus}.`);
      throw Object.assign(new Error(message.slice(0, 1200)), { code: `HIGGSFIELD_${lastStatus.toUpperCase()}` });
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }

  throw Object.assign(new Error(`Higgsfield video generation timed out while status was ${lastStatus || 'pending'}.`), { code: 'HIGGSFIELD_TIMEOUT', requestId: id, safeToRetry: false });
}

export async function generateVideoFromImage({ body, imageUrl, prompt, durationSeconds = 5, resolution = '720p' }) {
  const submitted = await generateImageToVideo({ imageUrl, prompt, durationSeconds, resolution });
  const completed = await waitForHiggsfieldVideo(submitted.requestId);
  return { ...completed, model: HIGGSFIELD_VIDEO_MODEL, payload: submitted.payload };
}
