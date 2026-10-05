import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const bucket = String(process.env.SUPABASE_MEDIA_BUCKET || 'jarvis-media').trim();

export function isSupabaseStorageConfigured() {
  return Boolean(supabaseUrl && supabaseKey && bucket);
}

function safeSegment(value, fallback = 'unknown') {
  const clean = String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

export function createMediaKey({ userId, kind = 'media', extension = 'bin', id }) {
  const date = new Date().toISOString().slice(0, 10);
  return `jarvis/${safeSegment(userId)}/${safeSegment(kind)}/${date}/${safeSegment(id || crypto.randomUUID())}.${safeSegment(extension, 'bin')}`;
}

export async function putMedia({ key, body, contentType = 'application/octet-stream', metadata = {}, upsert = false }) {
  if (!isSupabaseStorageConfigured()) throw new Error('Supabase Storage is not configured.');
  if (!key) throw new Error('Media object key is required.');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': contentType,
      'x-upsert': upsert ? 'true' : 'false',
      'cache-control': '31536000',
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`x-${safeSegment(k, 'meta')}`, String(v)])),
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase Storage upload failed (${response.status}): ${String(data?.message || data?.error || 'unknown error').slice(0, 500)}`);
  return { key, bucket, contentType, path: key, stored: true };
}


export async function getMedia({ key }) {
  if (!isSupabaseStorageConfigured()) throw new Error('Supabase Storage is not configured.');
  const safeKey = String(key || '').trim();
  if (!safeKey) throw new Error('Media object key is required.');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${safeKey.split('/').map(encodeURIComponent).join('/')}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`Supabase Storage download failed (${response.status}): ${body.slice(0, 300)}`), { statusCode: response.status });
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}



const supabaseAdmin = isSupabaseStorageConfigured()
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function assertUserOwnedMediaKey(userId, key) {
  const safeUserId = safeSegment(userId);
  const cleanKey = String(key || '').trim();
  if (!safeUserId || !cleanKey.startsWith(`jarvis/${safeUserId}/`)) {
    throw new Error('Media asset ownership validation failed.');
  }
  return cleanKey;
}

export async function createSignedMediaUrl({ userId, key, expiresIn = 300 }) {
  if (!isSupabaseStorageConfigured() || !supabaseAdmin) throw new Error('Supabase Storage is not configured.');
  const cleanKey = assertUserOwnedMediaKey(userId, key);
  const ttl = Math.min(3600, Math.max(60, Number(expiresIn) || 300));
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(cleanKey, ttl);
  if (error || !data?.signedUrl) {
    throw Object.assign(new Error(error?.message || 'Supabase Storage signing failed.'), { statusCode: 502 });
  }
  return data.signedUrl;
}

export async function createSignedMediaUrls({ userId, keys = [], expiresIn = 300 }) {
  if (!isSupabaseStorageConfigured() || !supabaseAdmin) throw new Error('Supabase Storage is not configured.');
  const cleanKeys = Array.isArray(keys) ? keys.map(key => assertUserOwnedMediaKey(userId, key)) : [];
  if (!cleanKeys.length) return [];
  const ttl = Math.min(3600, Math.max(60, Number(expiresIn) || 300));
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(cleanKeys, ttl);
  if (error) {
    throw Object.assign(new Error(error.message || 'Supabase Storage signing failed.'), { statusCode: 502 });
  }
  const signed = Array.isArray(data)
    ? data
    : Array.isArray(data?.signedUrls)
      ? data.signedUrls
      : [];
  if (signed.length !== cleanKeys.length || signed.some(item => !item?.signedUrl)) {
    throw Object.assign(new Error('Supabase Storage returned an incomplete signed-URL set.'), { statusCode: 502 });
  }
  return signed.map(item => item.signedUrl);
}

export { bucket as supabaseMediaBucket };
