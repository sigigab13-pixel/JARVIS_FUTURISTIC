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

function inferRetentionClass(key, metadata = {}) {
  const explicit = String(metadata?.retentionClass || metadata?.retention_class || '').trim().toLowerCase();
  if (['ephemeral', 'working', 'published', 'protected'].includes(explicit)) return explicit;
  const kind = String(key || '').split('/')[2] || 'media';
  if (kind === 'mission-image') return 'ephemeral';
  if (kind === 'children-factory') return 'working';
  return 'protected';
}

function retentionExpiry(retentionClass, metadata = {}) {
  if (metadata?.expiresAt) {
    const explicit = new Date(metadata.expiresAt);
    if (!Number.isNaN(explicit.getTime())) return explicit.toISOString();
  }
  const days = retentionClass === 'ephemeral' ? 14 : retentionClass === 'working' ? 60 : retentionClass === 'published' ? 180 : 0;
  return days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
}

function mediaRegistryConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function mediaRegistryRequest(pathname, options = {}) {
  if (!mediaRegistryConfigured()) throw new Error('Supabase media registry is not configured.');
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Supabase media registry request failed (${response.status}): ${raw.slice(0, 500)}`);
  return raw ? JSON.parse(raw) : null;
}

export async function registerMediaAsset({ userId, key, contentType, sizeBytes = 0, sha256 = null, metadata = {} }) {
  if (!isSupabaseStorageConfigured()) return { tracked: false, reason: 'storage_not_configured' };
  const retentionClass = inferRetentionClass(key, metadata);
  const expiresAt = retentionExpiry(retentionClass, metadata);
  try {
    const rows = await mediaRegistryRequest('jarvis_media_assets', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: userId,
        bucket_id: bucket,
        object_key: key,
        media_kind: String(key || '').split('/')[2] || 'media',
        content_type: contentType,
        size_bytes: Math.max(0, Number(sizeBytes) || 0),
        sha256: sha256 || metadata?.sha256 || null,
        retention_class: retentionClass,
        status: 'active',
        expires_at: expiresAt,
        last_referenced_at: new Date().toISOString(),
        metadata,
        updated_at: new Date().toISOString(),
      }),
    });
    return { tracked: true, retentionClass, expiresAt, record: Array.isArray(rows) ? rows[0] || null : rows || null };
  } catch (error) {
    return { tracked: false, retentionClass, expiresAt, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function markMediaRetention({ userId, key, retentionClass = 'protected', expiresAt = null, metadata = {} }) {
  if (!isSupabaseStorageConfigured()) return { updated: false, reason: 'storage_not_configured' };
  const safeClass = ['ephemeral', 'working', 'published', 'protected'].includes(String(retentionClass)) ? String(retentionClass) : 'protected';
  const safeExpiry = safeClass === 'protected' ? null : (expiresAt ? new Date(expiresAt).toISOString() : retentionExpiry(safeClass, metadata));
  try {
    const rows = await mediaRegistryRequest(
      'jarvis_media_assets?bucket_id=eq.' + encodeURIComponent(bucket) + '&object_key=eq.' + encodeURIComponent(key) + '&user_id=eq.' + encodeURIComponent(userId),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ retention_class: safeClass, expires_at: safeExpiry, last_referenced_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: metadata && typeof metadata === 'object' ? metadata : {} }),
      }
    );
    return { updated: Array.isArray(rows) ? rows.length > 0 : Boolean(rows), retentionClass: safeClass, expiresAt: safeExpiry };
  } catch (error) {
    return { updated: false, retentionClass: safeClass, expiresAt: safeExpiry, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function listExpiredMediaAssets({ limit = 10 } = {}) {
  const safeLimit = Math.min(25, Math.max(1, Number(limit) || 10));
  const rows = await mediaRegistryRequest(
    'jarvis_media_assets?select=id,user_id,bucket_id,object_key,retention_class,expires_at&status=eq.active&expires_at=not.is.null&expires_at=lte.' + encodeURIComponent(new Date().toISOString()) + '&retention_class=in.(ephemeral,working,published)&order=expires_at.asc&limit=' + safeLimit
  );
  return Array.isArray(rows) ? rows : [];
}

export async function deleteMediaObject({ bucketId = bucket, key }) {
  const cleanBucket = String(bucketId || '').trim();
  const cleanKey = String(key || '').trim();
  if (!cleanKey || cleanBucket !== bucket) throw new Error('Media deletion target is outside the configured JARVIS bucket.');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(cleanBucket)}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (response.status === 404) return { deleted: true, alreadyMissing: true };
  const raw = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Supabase Storage delete failed (${response.status}): ${raw.slice(0, 400)}`);
  return { deleted: true, alreadyMissing: false };
}

export async function cleanupExpiredMedia({ limit = 10 } = {}) {
  if (!isSupabaseStorageConfigured()) return { ok: false, deleted: 0, failed: 0, skipped: 0, reason: 'storage_not_configured', assets: [] };
  let assets;
  try {
    assets = await listExpiredMediaAssets({ limit });
  } catch (error) {
    return { ok: false, deleted: 0, failed: 0, skipped: 0, reason: error instanceof Error ? error.message : String(error), assets: [] };
  }

  let deleted = 0;
  let failed = 0;
  const results = [];
  for (const asset of assets) {
    if (!String(asset?.object_key || '').startsWith(`jarvis/${asset?.user_id}/`)) {
      results.push({ id: asset?.id || null, status: 'skipped', reason: 'ownership_path_mismatch' });
      continue;
    }
    try {
      await mediaRegistryRequest('jarvis_media_assets?id=eq.' + encodeURIComponent(asset.id) + '&status=eq.active', {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'delete_pending', updated_at: new Date().toISOString() }),
      });
      const deletion = await deleteMediaObject({ bucketId: asset.bucket_id, key: asset.object_key });
      await mediaRegistryRequest('jarvis_media_assets?id=eq.' + encodeURIComponent(asset.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'deleted', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
      deleted += 1;
      results.push({ id: asset.id, status: 'deleted', alreadyMissing: deletion.alreadyMissing });
    } catch (error) {
      failed += 1;
      try {
        await mediaRegistryRequest('jarvis_media_assets?id=eq.' + encodeURIComponent(asset.id), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'active', metadata: { cleanupError: String(error?.message || error).slice(0, 400) }, updated_at: new Date().toISOString() }),
        });
      } catch {}
      results.push({ id: asset.id, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: failed === 0, deleted, failed, skipped: results.filter(item => item.status === 'skipped').length, assets: results };
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
  const sizeBytes = Buffer.isBuffer(body) ? body.length : Number(metadata?.sizeBytes || 0);
  const registry = await registerMediaAsset({ userId: String(key).split('/')[1] || '', key, contentType, sizeBytes, sha256: metadata?.sha256 || null, metadata });
  return { key, bucket, contentType, path: key, stored: true, registry };
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
