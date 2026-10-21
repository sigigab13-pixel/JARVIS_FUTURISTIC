const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

function env(name) {
  return String(process.env[name] || '').trim();
}

function youtubeCredentials() {
  return {
    clientId: env('GOOGLE_YOUTUBE_CLIENT_ID'),
    clientSecret: env('GOOGLE_YOUTUBE_CLIENT_SECRET'),
  };
}

async function refreshAccessToken(connection) {
  const refreshToken = String(connection?.refresh_token || connection?.refreshToken || '').trim();
  if (!refreshToken) throw Object.assign(new Error('YouTube authorization has no refresh token. Reconnect YouTube.'), { statusCode: 401 });

  const { clientId, clientSecret } = youtubeCredentials();
  if (!clientId || !clientSecret) throw Object.assign(new Error('YouTube OAuth credentials are not configured.'), { statusCode: 503 });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    throw Object.assign(new Error(String(data?.error_description || data?.error || 'YouTube access token refresh failed.')), { statusCode: 401 });
  }
  return {
    accessToken: String(data.access_token),
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
}

export async function getYouTubeAccessToken(connection, { forceRefresh = false } = {}) {
  const current = String(connection?.access_token || connection?.accessToken || '').trim();
  const expiresAt = new Date(connection?.expires_at || connection?.expiresAt || 0).getTime();
  if (!forceRefresh && current && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return { accessToken: current, refreshed: false };
  }
  const refreshed = await refreshAccessToken(connection);
  return { ...refreshed, refreshed: true };
}

export async function withYouTubeAccessToken(connection, operation) {
  if (typeof operation !== 'function') throw new TypeError('A YouTube token operation is required.');

  let token = await getYouTubeAccessToken(connection);
  try {
    return { result: await operation(token.accessToken), token };
  } catch (error) {
    // A stored token can become invalid before its recorded expiry. Retry exactly once
    // with a fresh access token; never loop, because refresh failures must surface.
    if (Number(error?.statusCode) !== 401 || token.refreshed) throw error;
    token = await getYouTubeAccessToken(connection, { forceRefresh: true });
    return { result: await operation(token.accessToken), token };
  }
}

async function youtubeJson(pathname, accessToken) {
  const response = await fetch(YOUTUBE_API + pathname, {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || 'YouTube API request failed.';
    throw Object.assign(new Error(String(reason)), { statusCode: response.status });
  }
  return data;
}

export async function getYouTubeChannel(accessToken) {
  const data = await youtubeJson('/channels?part=snippet,statistics&mine=true', accessToken);
  const channel = data?.items?.[0];
  if (!channel?.id) throw Object.assign(new Error('No YouTube channel was returned for this authorization.'), { statusCode: 404 });
  return {
    id: channel.id,
    title: String(channel.snippet?.title || 'YouTube Channel'),
    description: String(channel.snippet?.description || ''),
    statistics: channel.statistics || {},
  };
}

export async function getYouTubeAnalytics(accessToken, { startDate, endDate }) {
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained,subscribersLost',
    dimensions: 'day',
    sort: 'day',
  });
  const response = await fetch('https://youtubeanalytics.googleapis.com/v2/reports?' + params.toString(), {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error?.message || 'YouTube Analytics request failed.';
    throw Object.assign(new Error(String(reason)), { statusCode: response.status });
  }
  return data;
}

export async function uploadYouTubeVideo(accessToken, { body, videoBuffer, contentType = 'video/mp4' }) {
  if (!Buffer.isBuffer(videoBuffer) || videoBuffer.length === 0) {
    throw Object.assign(new Error('A non-empty video asset is required.'), { statusCode: 400 });
  }

  const metadataResponse = await fetch(YOUTUBE_UPLOAD + '?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(videoBuffer.length),
    },
    body: JSON.stringify(body),
  });
  if (!metadataResponse.ok) {
    const data = await metadataResponse.json().catch(() => ({}));
    throw Object.assign(new Error(String(data?.error?.message || 'YouTube upload session could not be created.')), { statusCode: metadataResponse.status });
  }

  const uploadUrl = metadataResponse.headers.get('location');
  if (!uploadUrl) throw Object.assign(new Error('YouTube did not return an upload session URL.'), { statusCode: 502 });

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(videoBuffer.length),
    },
    body: videoBuffer,
  });
  const result = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !result?.id) {
    const reason = result?.error?.message || 'YouTube video upload failed.';
    throw Object.assign(new Error(String(reason)), { statusCode: uploadResponse.status || 502 });
  }
  return result;
}
