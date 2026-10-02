const BASE_URL = 'https://api.higgsfield.ai';

function credentials() {
  return String(process.env.HIGGSFIELD_API_KEY || process.env.HF_CREDENTIALS || '').trim();
}

function authHeaders() {
  const key = credentials();
  if (!key) throw Object.assign(new Error('Higgsfield API is not configured on this deployment.'), { statusCode: 503 });
  return { Authorization: 'Key ' + key, 'Content-Type': 'application/json' };
}

function safeText(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

const PATHS = {
  image: process.env.HIGGSFIELD_IMAGE_PATH || 'marketing-studio/image/sunburst',
  visual: process.env.HIGGSFIELD_VIDEO_PATH || 'bytedance/seedance-2.0/text-to-video',
};

export function getHiggsfieldExecutionCapabilities() {
  const configured = Boolean(credentials());
  return {
    configured,
    provider: 'higgsfield',
    image: { model: 'gpt_image_2_5', apiPath: PATHS.image, status: configured ? 'ready_to_submit' : 'provider_not_configured' },
    visual: { model: 'cinematic_studio_video_4_0', apiPath: PATHS.visual, status: configured ? 'ready_to_submit' : 'provider_not_configured' },
    audio: { provider: 'elevenlabs', status: process.env.ELEVENLABS_API_KEY ? 'ready_to_submit' : 'provider_not_configured' },
    lipSync: { status: 'not_verified_for_rest_execution' },
  };
}

export async function submitHiggsfield({ lane, prompt, format = '16:9', duration = 5, imageUrl = '' }) {
  if (!['image', 'visual'].includes(lane)) {
    throw Object.assign(new Error('This provider bridge currently supports image and visual generation only.'), { statusCode: 400 });
  }
  const path = PATHS[lane];
  const body = {
    prompt: safeText(prompt),
    aspect_ratio: ['16:9', '9:16', '1:1'].includes(format) ? format : '16:9',
  };

  if (lane === 'image') {
    body.resolution = '2k';
    body.quality = 'high';
    body.moderation = 'auto';
    body.enhance_prompt = false;
  } else {
    body.duration = Math.max(4, Math.min(15, Number(duration) || 5));
    body.resolution = '720p';
    body.generate_audio = false;
    if (imageUrl) body.image_url = safeText(imageUrl, 2000);
  }

  const response = await fetch(BASE_URL + '/' + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail?.message || data?.detail || data?.error || 'Higgsfield generation request failed.';
    throw Object.assign(new Error(String(message).slice(0, 500)), { statusCode: response.status >= 500 ? 502 : 400 });
  }

  const requestId = String(data?.request_id || data?.id || '').trim();
  if (!requestId) {
    throw Object.assign(new Error('Higgsfield accepted the request but returned no request ID.'), { statusCode: 502 });
  }

  return {
    provider: 'higgsfield',
    lane,
    providerJobId: requestId,
    status: String(data?.status || 'queued'),
    statusUrl: String(data?.status_url || BASE_URL + '/requests/' + requestId + '/status'),
  };
}

export async function getHiggsfieldStatus(providerJobId) {
  const id = safeText(providerJobId, 200);
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(id)) {
    throw Object.assign(new Error('Invalid Higgsfield request ID.'), { statusCode: 400 });
  }
  const response = await fetch(BASE_URL + '/requests/' + encodeURIComponent(id) + '/status', {
    headers: { Authorization: 'Key ' + credentials(), Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail?.message || data?.detail || data?.error || 'Higgsfield status request failed.';
    throw Object.assign(new Error(String(message).slice(0, 500)), { statusCode: response.status >= 500 ? 502 : 400 });
  }

  const status = String(data?.status || 'unknown');
  const resultUrl = String(
    data?.video?.url ||
    data?.images?.[0]?.url ||
    data?.audio?.url ||
    ''
  ).trim();

  return {
    provider: 'higgsfield',
    providerJobId: id,
    status,
    resultUrl: status === 'completed' ? resultUrl : '',
  };
}
