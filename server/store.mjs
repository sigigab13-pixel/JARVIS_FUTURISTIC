import { normalizeMissionForStorage } from './mission-runtime.mjs';
import { nextRunAt } from './routine-scheduler.mjs';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_SERVER_KEY = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);

const memory = {
  oauth: new Map(),
  youtube: new Map(),
  users: new Map(),
  conversations: new Map(),
  missions: new Map(),
  missionEvents: new Map(),
};

export function persistenceMode() {
  return configured ? 'supabase' : 'memory';
}

async function request(pathname, options = {}) {
  if (!configured) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : null;
}

export async function saveOAuthState(state, redirectUri, userId = null) {
  if (!configured) {
    memory.oauth.set(state, { redirectUri, userId, createdAt: Date.now() });
    return;
  }
  await request('youtube_oauth_state', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ state, redirect_uri: redirectUri, user_id: userId || null, created_at: new Date().toISOString() }),
  });
}

export async function getOAuthState(state) {
  if (!configured) return memory.oauth.get(state) || null;
  const rows = await request(`youtube_oauth_state?select=state,redirect_uri,user_id,created_at&state=eq.${encodeURIComponent(state)}&limit=1`);
  const row = rows?.[0];
  return row ? { redirectUri: row.redirect_uri, userId: row.user_id || null, createdAt: new Date(row.created_at).getTime() } : null;
}

export async function deleteOAuthState(state) {
  if (!configured) {
    memory.oauth.delete(state);
    return;
  }
  await request(`youtube_oauth_state?state=eq.${encodeURIComponent(state)}`, { method: 'DELETE' });
}

export async function getYouTubeConnection(userId) {
  if (!validUuid(userId)) return null;
  if (!configured) return memory.youtube.get(userId) || null;
  const rows = await request(`youtube_connection?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows?.[0] || null;
}

export async function saveYouTubeConnection(userId, connection) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) {
    memory.youtube.set(userId, connection);
    return;
  }
  await request('youtube_connection', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: userId,
      user_id: userId,
      channel_id: connection.channelId,
      channel_title: connection.channelTitle,
      refresh_token: connection.refreshToken,
      access_token: connection.accessToken,
      expires_at: new Date(connection.expiresAt).toISOString(),
      connected_at: connection.connectedAt,
    }),
  });
}


function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureJarvisAuthUser(authUser) {
  const authUserId = String(authUser?.id || '').trim();
  if (!validUuid(authUserId)) throw new Error('Invalid Supabase auth user id.');
  const email = String(authUser?.email || '').trim() || null;
  const metadata = authUser?.user_metadata || {};
  const name = String(metadata.full_name || metadata.name || email || 'JARVIS User').trim().slice(0, 200) || 'JARVIS User';
  if (!configured) {
    const id = crypto.randomUUID();
    memory.users.set(id, { id, name, email, auth_user_id: authUserId });
    return memory.users.get(id);
  }
  const existing = await request('jarvis_users?select=id,name,email,preferences,auth_user_id&auth_user_id=eq.' + encodeURIComponent(authUserId) + '&limit=1');
  if (existing?.[0]) {
    await request('jarvis_users?auth_user_id=eq.' + encodeURIComponent(authUserId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name, email, updated_at: new Date().toISOString() }),
    });
    return { ...existing[0], name, email };
  }
  const id = crypto.randomUUID();
  const rows = await request('jarvis_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ id, name, email, auth_user_id: authUserId, preferences: {} }),
  });
  return rows?.[0] || { id, name, email, auth_user_id: authUserId, preferences: {} };
}

export async function getJarvisPreferences(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return memory.users.get(userId)?.preferences || {};
  const rows = await request(`jarvis_users?select=preferences&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows?.[0]?.preferences || {};
}

export async function updateJarvisPreferences(userId, preferences) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const safePreferences = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  if (!configured) {
    const user = memory.users.get(userId) || { id: userId, name: 'Guest' };
    user.preferences = safePreferences;
    memory.users.set(userId, user);
    return safePreferences;
  }
  await request(`jarvis_users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ preferences: safePreferences, updated_at: new Date().toISOString() }),
  });
  return safePreferences;
}

export async function ensureJarvisUser(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) {
    if (!memory.users.has(userId)) memory.users.set(userId, { id: userId, name: 'Guest' });
    return memory.users.get(userId);
  }
  const existing = await request(`jarvis_users?select=id,name,preferences&id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (existing?.[0]) return existing[0];
  const rows = await request('jarvis_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ id: userId, name: 'Guest', preferences: {} }),
  });
  return rows?.[0] || { id: userId, name: 'Guest', preferences: {} };
}

export async function getOrCreateConversation(userId) {
  if (!configured) {
    if (!memory.conversations.has(userId)) memory.conversations.set(userId, []);
    return { id: userId };
  }
  const rows = await request(`conversations?select=id,title&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1`);
  if (rows?.[0]) return rows[0];
  const created = await request('conversations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title: 'JARVIS Conversation' }),
  });
  if (!created?.[0]) throw new Error('Could not create JARVIS conversation.');
  return created[0];
}

export async function appendConversationMessages(userId, messages) {
  const conversation = await getOrCreateConversation(userId);
  const normalized = messages
    .filter(m => ['user', 'assistant', 'system'].includes(String(m?.role)) && String(m?.content || '').trim())
    .map(m => ({
      conversation_id: conversation.id,
      role: String(m.role),
      content: String(m.content).trim(),
    }));
  if (!normalized.length) return;
  if (!configured) {
    const current = memory.conversations.get(userId) || [];
    current.push(...normalized.map(m => ({ role: m.role, content: m.content, created_at: new Date().toISOString() })));
    memory.conversations.set(userId, current.slice(-200));
    return;
  }
  await request('conversation_messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(normalized),
  });
  await request(`conversations?id=eq.${encodeURIComponent(conversation.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
}

export async function getConversationMessages(userId, limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const conversation = await getOrCreateConversation(userId);
  if (!configured) {
    return (memory.conversations.get(userId) || []).slice(-safeLimit).map(m => ({
      role: m.role,
      content: m.content,
    }));
  }
  const rows = await request(
    `conversation_messages?select=role,content,created_at&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.asc&limit=${safeLimit}`
  );
  return (rows || []).map(m => ({ role: m.role, content: m.content }));
}


const EMBEDDING_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/jarvis-embed` : '';

export async function generateJarvisEmbedding(input) {
  const text = String(input || '').trim();
  if (!configured || !EMBEDDING_FUNCTION_URL || !text) return null;
  const response = await fetch(EMBEDDING_FUNCTION_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text.slice(0, 8000) }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Embedding service failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const data = body ? JSON.parse(body) : null;
  return Array.isArray(data?.embedding) && data.embedding.length === 384 ? data.embedding : null;
}

export async function searchSemanticMemories(userId, input, options = {}) {
  if (!configured || !validUuid(userId)) return [];
  const embedding = await generateJarvisEmbedding(input);
  if (!embedding) return [];
  const threshold = Number(options.threshold ?? 0.72);
  const count = Math.min(12, Math.max(1, Number(options.count) || 8));
  const memoryTypes = Array.isArray(options.memoryTypes) && options.memoryTypes.length
    ? options.memoryTypes.map(String)
    : null;
  return await rpc('match_jarvis_memories', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: count,
    filter_user_id: userId,
    filter_memory_types: memoryTypes,
  });
}

export async function saveSemanticMemory(userId, content, metadata = {}, memoryType = 'semantic') {
  if (!configured || !validUuid(userId)) return null;
  const text = String(content || '').trim();
  if (!text) return null;
  const embedding = await generateJarvisEmbedding(text);
  if (!embedding) return null;

  const rows = await rpc('upsert_jarvis_semantic_memory', {
    p_user_id: userId,
    p_content: text.slice(0, 8000),
    p_embedding: embedding,
    p_memory_type: memoryType,
    p_metadata: metadata,
    p_importance: Number(metadata.importance ?? 0.6),
    p_dedupe_threshold: 0.97,
  });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase RPC failed (${response.status}): ${raw.slice(0, 500)}`);
  }
  return raw ? JSON.parse(raw) : [];
}


export async function getActivePlan(code = 'free') {
  if (!configured) return {
    code,
    name: code === 'premium' ? 'JARVIS Premium' : code === 'pro' ? 'JARVIS Pro' : 'JARVIS Free',
    monthly_image_generations: code === 'premium' ? 150 : code === 'pro' ? 50 : 10,
  };
  const rows = await request(
    'jarvis_plans?select=*&code=eq.' + encodeURIComponent(code) + '&active=eq.true&limit=1'
  );
  return rows?.[0] || null;
}

export async function getFamilyAccess(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return null;
  const rows = await request(
    'jarvis_family_access?select=user_id,access_role,active,granted_at,updated_at&user_id=eq.' +
    encodeURIComponent(userId) + '&active=eq.true&limit=1'
  );
  return rows?.[0] || null;
}

export async function getRegionalPlanPrices(regionCode = 'GLOBAL') {
  const normalizedRegion = String(regionCode || 'GLOBAL').trim().toUpperCase().slice(0, 20) || 'GLOBAL';
  if (!configured) {
    return [
      { plan_code: 'pro', region_code: normalizedRegion, currency: normalizedRegion === 'NG' ? 'ngn' : 'usd', unit_amount: normalizedRegion === 'NG' ? 450000 : 500 },
      { plan_code: 'premium', region_code: normalizedRegion, currency: normalizedRegion === 'NG' ? 'ngn' : 'usd', unit_amount: normalizedRegion === 'NG' ? 800000 : 900 },
    ];
  }

  const rows = await request(
    'jarvis_plan_prices?select=region_code,currency,unit_amount,interval,stripe_price_id,jarvis_plans!inner(code,name,monthly_image_generations,features)&active=eq.true&region_code=eq.' +
    encodeURIComponent(normalizedRegion)
  );
  if (rows?.length) {
    return rows.map(row => ({
      plan_code: row.jarvis_plans?.code,
      plan_name: row.jarvis_plans?.name,
      region_code: row.region_code,
      currency: row.currency,
      unit_amount: Number(row.unit_amount || 0),
      interval: row.interval || 'month',
      stripe_price_id: row.stripe_price_id || null,
    }));
  }
  const globalRows = await request(
    'jarvis_plan_prices?select=region_code,currency,unit_amount,interval,stripe_price_id,jarvis_plans!inner(code,name,monthly_image_generations,features)&active=eq.true&region_code=eq.GLOBAL'
  );
  return (globalRows || []).map(row => ({
    plan_code: row.jarvis_plans?.code,
    plan_name: row.jarvis_plans?.name,
    region_code: 'GLOBAL',
    currency: row.currency,
    unit_amount: Number(row.unit_amount || 0),
    interval: row.interval || 'month',
    stripe_price_id: row.stripe_price_id || null,
  }));
}

function applyFamilyOverride(entitlement, familyAccess, premiumPlan) {
  if (!familyAccess?.active || !premiumPlan) return entitlement;
  return {
    ...(entitlement || {}),
    plan_id: premiumPlan.id || entitlement?.plan_id || null,
    status: 'active',
    jarvis_plans: premiumPlan,
    family_access: {
      role: familyAccess.access_role,
      active: true,
      billing: 'free_family',
    },
    grant_source: 'family',
  };
}

export async function ensureJarvisEntitlement(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) {
    return { user_id: userId, plan_code: 'free', status: 'active', credits_remaining: 10 };
  }

  const familyAccess = await getFamilyAccess(userId);
  const existing = await request(
    'jarvis_entitlements?select=*,jarvis_plans(code,name,monthly_image_generations,features)&user_id=eq.' +
    encodeURIComponent(userId) + '&limit=1'
  );
  if (existing?.[0]) {
    const current = existing[0];
    if (!familyAccess?.active && current.grant_source === 'family') {
      const freePlan = await getActivePlan('free');
      if (freePlan?.id && current.plan_id !== freePlan.id) {
        await request('jarvis_entitlements?user_id=eq.' + encodeURIComponent(userId), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            plan_id: freePlan.id,
            grant_source: 'system',
            credits_remaining: Number(freePlan.monthly_image_generations || 0),
            provider: null,
            provider_customer_id: null,
            provider_subscription_id: null,
            updated_at: new Date().toISOString(),
          }),
        });
        return {
          ...current,
          plan_id: freePlan.id,
          grant_source: 'system',
          credits_remaining: Number(freePlan.monthly_image_generations || 0),
          jarvis_plans: freePlan,
        };
      }
    }
    if (familyAccess?.active) {
      const premiumPlan = await getActivePlan('premium');
      if (premiumPlan?.id && (current.plan_id !== premiumPlan.id || current.grant_source !== 'family')) {
        await request('jarvis_entitlements?user_id=eq.' + encodeURIComponent(userId), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            plan_id: premiumPlan.id,
            grant_source: 'family',
            status: 'active',
            credits_remaining: Number(premiumPlan.monthly_image_generations || 0),
            provider: null,
            provider_customer_id: null,
            provider_subscription_id: null,
            updated_at: new Date().toISOString(),
          }),
        });
        return applyFamilyOverride({
          ...current,
          plan_id: premiumPlan.id,
          grant_source: 'family',
          status: 'active',
          credits_remaining: Number(premiumPlan.monthly_image_generations || 0),
          jarvis_plans: premiumPlan,
        }, familyAccess, premiumPlan);
      }
      return applyFamilyOverride(current, familyAccess, premiumPlan);
    }
    return current;
  }

  const selectedCode = familyAccess?.active ? 'premium' : 'free';
  const plan = await getActivePlan(selectedCode);
  if (!plan?.id) throw new Error('JARVIS ' + selectedCode + ' plan is not configured.');

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const rows = await request('jarvis_entitlements', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      grant_source: familyAccess?.active ? 'family' : 'system',
      credits_remaining: Number(plan.monthly_image_generations || 0),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    }),
  });
  const created = rows?.[0] || null;
  return familyAccess?.active ? applyFamilyOverride(created, familyAccess, plan) : created;
}

export async function getJarvisEntitlement(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return { user_id: userId, plan_code: 'free', status: 'active', credits_remaining: 10 };

  const [rows, familyAccess] = await Promise.all([
    request(
      'jarvis_entitlements?select=*,jarvis_plans(code,name,monthly_image_generations,features)&user_id=eq.' +
      encodeURIComponent(userId) + '&limit=1'
    ),
    getFamilyAccess(userId),
  ]);
  const entitlement = rows?.[0] || null;
  if (familyAccess?.active) {
    const premiumPlan = await getActivePlan('premium');
    return applyFamilyOverride(entitlement, familyAccess, premiumPlan);
  }
  return entitlement;
}

export async function consumeImageGeneration(userId, metadata = {}) {
  const entitlement = await ensureJarvisEntitlement(userId);
  const plan = entitlement?.jarvis_plans || {};
  const limit = Number(plan.monthly_image_generations || 0);
  const remaining = Number(entitlement?.credits_remaining ?? 0);
  if (remaining <= 0) {
    throw Object.assign(new Error('Your image-generation allowance is used up for this billing period.'), {
      statusCode: 402,
      code: 'IMAGE_ALLOWANCE_EXHAUSTED',
    });
  }

  if (!configured) {
    return { ...entitlement, credits_remaining: remaining - 1 };
  }

  const nextRemaining = remaining - 1;
  await request(
    'jarvis_entitlements?user_id=eq.' + encodeURIComponent(userId),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        credits_remaining: nextRemaining,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  await request('jarvis_usage_ledger', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      operation: 'image_generation',
      units: 1,
      credits_charged: 1,
      metadata,
    }),
  });

  return { ...entitlement, credits_remaining: nextRemaining };
}


export async function getBusinessForUser(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return null;
  const rows = await request('jarvis_businesses?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.asc&limit=1');
  return rows?.[0] || null;
}

export async function createBusinessForUser(userId, data = {}) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const business = {
    user_id: userId,
    name: String(data.name || 'My Business').trim().slice(0, 200),
    description: String(data.description || '').trim().slice(0, 2000) || null,
    industry: String(data.industry || '').trim().slice(0, 200) || null,
    website: String(data.website || '').trim().slice(0, 500) || null,
  };
  if (!configured) return { id: crypto.randomUUID(), ...business };
  const rows = await request('jarvis_businesses', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(business),
  });
  return rows?.[0] || null;
}

export async function updateBusinessForUser(userId, businessId, data = {}) {
  if (!validUuid(userId) || !validUuid(businessId)) throw new Error('Invalid business identity.');
  if (!configured) return { id: businessId, ...data };
  const payload = {};
  for (const key of ['name','description','industry','website','status']) {
    if (data[key] !== undefined) payload[key] = String(data[key] || '').trim().slice(0, 2000);
  }
  payload.updated_at = new Date().toISOString();
  const rows = await request('jarvis_businesses?id=eq.' + encodeURIComponent(businessId) + '&user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export async function getBrandKitForUser(userId, businessId) {
  if (!validUuid(userId) || !validUuid(businessId)) throw new Error('Invalid business identity.');
  if (!configured) return null;
  const rows = await request('jarvis_brand_kits?select=*&business_id=eq.' + encodeURIComponent(businessId) + '&limit=1');
  return rows?.[0] || null;
}

export async function upsertBrandKitForUser(userId, businessId, data = {}) {
  if (!validUuid(userId) || !validUuid(businessId)) throw new Error('Invalid business identity.');
  if (!configured) return { business_id: businessId, ...data };
  const payload = {
    business_id: businessId,
    logo_url: String(data.logo_url || '').trim().slice(0, 1000) || null,
    colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
    fonts: data.fonts && typeof data.fonts === 'object' ? data.fonts : {},
    visual_style: String(data.visual_style || '').trim().slice(0, 500) || null,
    brand_voice: String(data.brand_voice || '').trim().slice(0, 1000) || null,
    business_description: String(data.business_description || '').trim().slice(0, 2000) || null,
    products_services: Array.isArray(data.products_services) ? data.products_services : [],
    social_handles: data.social_handles && typeof data.social_handles === 'object' ? data.social_handles : {},
    image_style: String(data.image_style || '').trim().slice(0, 500) || null,
    video_style: String(data.video_style || '').trim().slice(0, 500) || null,
    intro_outro: data.intro_outro && typeof data.intro_outro === 'object' ? data.intro_outro : {},
    character_bible: data.character_bible && typeof data.character_bible === 'object' ? data.character_bible : {},
    updated_at: new Date().toISOString(),
  };
  const rows = await request('jarvis_brand_kits?business_id=eq.' + encodeURIComponent(businessId), {
    method: 'GET',
  });
  if (rows?.[0]?.id) {
    const updated = await request('jarvis_brand_kits?id=eq.' + encodeURIComponent(rows[0].id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    return updated?.[0] || null;
  }
  const created = await request('jarvis_brand_kits', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return created?.[0] || null;
}


export async function createVideoProjectForUser(userId, data = {}) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const project = {
    user_id: userId,
    business_id: validUuid(data.business_id) ? data.business_id : null,
    title: String(data.title || 'Untitled JARVIS Video').trim().slice(0, 200),
    description: String(data.description || '').trim().slice(0, 4000) || null,
    format: ['16:9', '9:16', '1:1'].includes(String(data.format)) ? String(data.format) : '16:9',
    status: 'draft',
    story_bible: data.story_bible && typeof data.story_bible === 'object' ? data.story_bible : {},
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
  };
  if (!configured) return { id: crypto.randomUUID(), ...project };
  const rows = await request('jarvis_video_projects', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(project),
  });
  return rows?.[0] || null;
}

export async function getVideoProjectsForUser(userId) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  if (!configured) return [];
  return await request('jarvis_video_projects?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=updated_at.desc&limit=50');
}

export async function getVideoProjectForUser(userId, projectId) {
  if (!validUuid(userId) || !validUuid(projectId)) throw new Error('Invalid video project identity.');
  if (!configured) return null;
  const rows = await request('jarvis_video_projects?select=*&id=eq.' + encodeURIComponent(projectId) + '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1');
  return rows?.[0] || null;
}

export async function addVideoCharacterForUser(userId, projectId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  const character = {
    project_id: projectId,
    name: String(data.name || 'Unnamed Character').trim().slice(0, 200),
    role: String(data.role || '').trim().slice(0, 200) || null,
    profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
    appearance: data.appearance && typeof data.appearance === 'object' ? data.appearance : {},
    voice: data.voice && typeof data.voice === 'object' ? data.voice : {},
    wardrobe: data.wardrobe && typeof data.wardrobe === 'object' ? data.wardrobe : {},
    relationships: data.relationships && typeof data.relationships === 'object' ? data.relationships : {},
    reference_assets: Array.isArray(data.reference_assets) ? data.reference_assets : [],
    continuity_rules: data.continuity_rules && typeof data.continuity_rules === 'object' ? data.continuity_rules : {},
  };
  if (!configured) return { id: crypto.randomUUID(), ...character };
  const rows = await request('jarvis_video_characters', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(character),
  });
  return rows?.[0] || null;
}

export async function updateVideoCharacterForUser(userId, projectId, characterId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!validUuid(characterId)) throw new Error('Invalid character identity.');
  if (!configured) return { id: characterId, project_id: projectId, ...data };
  const payload = {};
  for (const key of ['name','role']) {
    if (data[key] !== undefined) payload[key] = String(data[key] || '').trim().slice(0, 200) || null;
  }
  for (const key of ['profile','appearance','voice','wardrobe','relationships','continuity_rules']) {
    if (data[key] !== undefined) payload[key] = data[key] && typeof data[key] === 'object' ? data[key] : {};
  }
  if (data.reference_assets !== undefined) payload.reference_assets = Array.isArray(data.reference_assets) ? data.reference_assets : [];
  payload.version = Number(data.version || 1) + 1;
  payload.updated_at = new Date().toISOString();
  const rows = await request('jarvis_video_characters?id=eq.' + encodeURIComponent(characterId) + '&project_id=eq.' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export async function getVideoCharactersForUser(userId, projectId) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!configured) return [];
  return await request('jarvis_video_characters?select=*&project_id=eq.' + encodeURIComponent(projectId) + '&order=created_at.asc');
}

export async function addVideoSceneForUser(userId, projectId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  const scene = {
    project_id: projectId,
    scene_number: Math.max(1, Number(data.scene_number) || 1),
    title: String(data.title || '').trim().slice(0, 200) || null,
    script: String(data.script || '').trim().slice(0, 12000) || null,
    dialogue: Array.isArray(data.dialogue) ? data.dialogue : [],
    characters: Array.isArray(data.characters) ? data.characters : [],
    visual_plan: data.visual_plan && typeof data.visual_plan === 'object' ? data.visual_plan : {},
    camera_plan: data.camera_plan && typeof data.camera_plan === 'object' ? data.camera_plan : {},
    audio_plan: data.audio_plan && typeof data.audio_plan === 'object' ? data.audio_plan : {},
    lip_sync_plan: data.lip_sync_plan && typeof data.lip_sync_plan === 'object' ? data.lip_sync_plan : {},
    continuity_notes: data.continuity_notes && typeof data.continuity_notes === 'object' ? data.continuity_notes : {},
  };
  if (!configured) return { id: crypto.randomUUID(), ...scene };
  const rows = await request('jarvis_video_scenes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(scene),
  });
  return rows?.[0] || null;
}

export async function updateVideoSceneForUser(userId, projectId, sceneId, data = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!validUuid(sceneId)) throw new Error('Invalid scene identity.');
  if (!configured) return { id: sceneId, project_id: projectId, ...data };
  const payload = {};
  if (data.scene_number !== undefined) payload.scene_number = Math.max(1, Number(data.scene_number) || 1);
  if (data.title !== undefined) payload.title = String(data.title || '').trim().slice(0, 200) || null;
  if (data.script !== undefined) payload.script = String(data.script || '').trim().slice(0, 12000) || null;
  for (const key of ['dialogue','characters']) if (data[key] !== undefined) payload[key] = Array.isArray(data[key]) ? data[key] : [];
  for (const key of ['visual_plan','camera_plan','audio_plan','lip_sync_plan','continuity_notes']) {
    if (data[key] !== undefined) payload[key] = data[key] && typeof data[key] === 'object' ? data[key] : {};
  }
  payload.version = Number(data.version || 1) + 1;
  payload.updated_at = new Date().toISOString();
  const rows = await request('jarvis_video_scenes?id=eq.' + encodeURIComponent(sceneId) + '&project_id=eq.' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export async function getVideoScenesForUser(userId, projectId) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  if (!configured) return [];
  return await request('jarvis_video_scenes?select=*&project_id=eq.' + encodeURIComponent(projectId) + '&order=scene_number.asc,version.asc');
}

export async function getJobForUser(userId, jobId) {
  if (!validUuid(userId) || !validUuid(jobId)) throw new Error('Invalid job identity.');
  if (!configured) return null;
  const rows = await request(
    'jobs?select=id,user_id,type,status,result,error,attempts,max_attempts,scheduled_at,started_at,completed_at,updated_at&' +
    'id=eq.' + encodeURIComponent(jobId) + '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1'
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type || ''),
    status: String(row.status || ''),
    result: row.result && typeof row.result === 'object' ? row.result : null,
    error: row.error && typeof row.error === 'object' ? row.error : null,
    attempts: Number(row.attempts || 0),
    maxAttempts: Number(row.max_attempts || 0),
    scheduledAt: row.scheduled_at || null,
    startedAt: row.started_at || null,
    finishedAt: row.completed_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function queueVideoJobForUser(userId, projectId, payload = {}) {
  const project = await getVideoProjectForUser(userId, projectId);
  if (!project) throw Object.assign(new Error('Video project not found.'), { statusCode: 404 });
  const jobPayload = { project_id: projectId, pipeline: 'jarvis_video_engine', ...payload };
  if (!configured) return { id: crypto.randomUUID(), user_id: userId, type: 'video_pipeline', status: 'queued', payload: jobPayload };
  const rows = await request('jobs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      type: 'video_pipeline',
      status: 'queued',
      priority: Number(payload.priority || 5),
      payload: jobPayload,
      attempts: 0,
      max_attempts: 3,
      scheduled_at: new Date().toISOString(),
    }),
  });
  return rows?.[0] || null;
}

function missionStateFromRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: row.user_id ? String(row.user_id) : null,
    goal: String(row.goal || ''),
    autonomy: String(row.autonomy || 'advise'),
    status: String(row.status || 'draft'),
    currentStep: Number(row.current_step ?? -1),
    steps: Array.isArray(row.steps) ? row.steps : [],
    approval: row.approval && typeof row.approval === 'object' ? row.approval : {},
    lastEvidence: row.last_evidence && typeof row.last_evidence === 'object' ? row.last_evidence : {},
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    completedAt: row.completed_at || null,
  };
}

function missionEventFromRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    missionId: String(row.mission_id || ''),
    userId: String(row.user_id || ''),
    eventType: String(row.event_type || ''),
    fromStatus: row.from_status || null,
    toStatus: row.to_status || null,
    message: row.message || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at || null,
  };
}

export async function createMissionForUser(userId, state) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const mission = {
    ...state,
    id: String(state?.id || crypto.randomUUID()),
    userId,
    createdAt: state?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const storage = normalizeMissionForStorage(mission);
  if (!configured) {
    const local = missionStateFromRow({ id: mission.id, user_id: userId, ...storage });
    memory.missions.set(userId + ':' + mission.id, local);
    memory.missionEvents.set(userId + ':' + mission.id, [{
      id: crypto.randomUUID(), missionId: mission.id, userId,
      eventType: 'mission.created', fromStatus: null, toStatus: local.status,
      message: 'Mission created.', metadata: {}, createdAt: new Date().toISOString(),
    }]);
    return local;
  }
  const rows = await request('jarvis_missions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: mission.id, user_id: userId, goal: storage.goal, autonomy: storage.autonomy,
      status: storage.status, current_step: storage.current_step, steps: storage.steps,
      approval: storage.approval, last_evidence: storage.last_evidence, metadata: storage.metadata,
      created_at: storage.created_at, updated_at: storage.updated_at, completed_at: storage.completed_at,
    }),
  });
  const created = missionStateFromRow(rows?.[0] || { id: mission.id, user_id: userId, ...storage });
  await recordMissionEventForUser(userId, created.id, {
    eventType: 'mission.created', toStatus: created.status, message: 'Mission created.',
  });
  return created;
}

export async function getMissionForUser(userId, missionId) {
  if (!validUuid(userId) || !validUuid(missionId)) throw new Error('Invalid mission identity.');
  if (!configured) return memory.missions.get(userId + ':' + missionId) || null;
  const rows = await request(
    'jarvis_missions?select=*&id=eq.' + encodeURIComponent(missionId) +
    '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1'
  );
  return missionStateFromRow(rows?.[0] || null);
}

export async function listMissionsForUser(userId, limit = 20) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  if (!configured) {
    return [...memory.missions.values()]
      .filter(mission => mission.userId === userId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, safeLimit);
  }
  const rows = await request(
    'jarvis_missions?select=*&user_id=eq.' + encodeURIComponent(userId) +
    '&order=updated_at.desc&limit=' + safeLimit
  );
  return (rows || []).map(missionStateFromRow).filter(Boolean);
}

export async function updateMissionForUser(userId, missionId, state, event = {}) {
  if (!validUuid(userId) || !validUuid(missionId)) throw new Error('Invalid mission identity.');
  const existing = await getMissionForUser(userId, missionId);
  if (!existing) throw Object.assign(new Error('Mission not found.'), { statusCode: 404 });
  const mission = { ...state, id: missionId, userId, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  const storage = normalizeMissionForStorage(mission);
  if (!configured) {
    const local = missionStateFromRow({ id: missionId, user_id: userId, ...storage });
    memory.missions.set(userId + ':' + missionId, local);
    if (event?.eventType) await recordMissionEventForUser(userId, missionId, {
      ...event, fromStatus: event.fromStatus ?? existing.status, toStatus: event.toStatus ?? local.status,
    });
    return local;
  }
  const rows = await request(
    'jarvis_missions?id=eq.' + encodeURIComponent(missionId) + '&user_id=eq.' + encodeURIComponent(userId),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        goal: storage.goal, autonomy: storage.autonomy, status: storage.status, current_step: storage.current_step,
        steps: storage.steps, approval: storage.approval, last_evidence: storage.last_evidence, metadata: storage.metadata,
        updated_at: storage.updated_at, completed_at: storage.completed_at,
      }),
    }
  );
  const updated = missionStateFromRow(rows?.[0] || { id: missionId, user_id: userId, ...storage });
  if (event?.eventType) await recordMissionEventForUser(userId, missionId, {
    ...event, fromStatus: event.fromStatus ?? existing.status, toStatus: event.toStatus ?? updated.status,
  });
  return updated;
}

export async function recordMissionEventForUser(userId, missionId, {
  eventType, fromStatus = null, toStatus = null, message = null, metadata = {},
} = {}) {
  if (!validUuid(userId) || !validUuid(missionId)) throw new Error('Invalid mission identity.');
  const event = {
    id: crypto.randomUUID(), missionId, userId,
    eventType: String(eventType || 'mission.event'),
    fromStatus: fromStatus ? String(fromStatus) : null,
    toStatus: toStatus ? String(toStatus) : null,
    message: message ? String(message).slice(0, 2000) : null,
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
    createdAt: new Date().toISOString(),
  };
  if (!configured) {
    const key = userId + ':' + missionId;
    const events = memory.missionEvents.get(key) || [];
    events.push(event); memory.missionEvents.set(key, events.slice(-200));
    return event;
  }
  const rows = await request('jarvis_mission_events', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: event.id, mission_id: missionId, user_id: userId, event_type: event.eventType,
      from_status: event.fromStatus, to_status: event.toStatus, message: event.message,
      metadata: event.metadata, created_at: event.createdAt,
    }),
  });
  return missionEventFromRow(rows?.[0] || event);
}

export async function getMissionEventsForUser(userId, missionId, limit = 100) {
  if (!validUuid(userId) || !validUuid(missionId)) throw new Error('Invalid mission identity.');
  const mission = await getMissionForUser(userId, missionId);
  if (!mission) return [];
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  if (!configured) return (memory.missionEvents.get(userId + ':' + missionId) || []).slice(-safeLimit).reverse();
  const rows = await request(
    'jarvis_mission_events?select=*&mission_id=eq.' + encodeURIComponent(missionId) +
    '&user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.desc&limit=' + safeLimit
  );
  return (rows || []).map(missionEventFromRow).filter(Boolean);
}

function routineFromRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: row.user_id ? String(row.user_id) : null,
    name: String(row.name || ''),
    description: row.description || null,
    schedule: String(row.schedule || ''),
    timezone: String(row.timezone || 'Africa/Lagos'),
    status: String(row.status || 'active'),
    priority: Number(row.priority ?? 50),
    maxParallelJobs: Number(row.max_parallel_jobs ?? 4),
    jobTemplates: Array.isArray(row.job_templates) ? row.job_templates : [],
    nextRunAt: row.next_run_at || null,
    lastRunAt: row.last_run_at || null,
    lastRunStatus: row.last_run_status || null,
    consecutiveFailures: Number(row.consecutive_failures || 0),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    leaseUntil: row.lease_until || null,
    leasedBy: row.leased_by || null,
  };
}

function routineRunFromRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    routineId: String(row.routine_id || ''),
    userId: String(row.user_id || ''),
    scheduledFor: row.scheduled_for || null,
    status: String(row.status || 'queued'),
    childJobIds: Array.isArray(row.child_job_ids) ? row.child_job_ids : [],
    summary: row.summary && typeof row.summary === 'object' ? row.summary : {},
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
  };
}

function safeTemplates(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((template, index) => ({
    id: String(template?.id || `job-${index + 1}`).slice(0, 100),
    type: String(template?.type || '').trim().slice(0, 120),
    priority: Math.min(100, Math.max(0, Number(template?.priority ?? 50))),
    maxAttempts: Math.min(8, Math.max(1, Number(template?.maxAttempts ?? 3))),
    payload: template?.payload && typeof template.payload === 'object' && !Array.isArray(template.payload)
      ? template.payload
      : {},
  })).filter(template => template.type);
}

export async function queueMissionStepForUser(userId, mission) {
  if (!validUuid(userId) || !validUuid(String(mission?.id || ''))) {
    throw new Error('Invalid mission identity.');
  }
  const stepIndex = Number(mission.currentStep);
  const step = mission.steps?.[stepIndex];
  if (!step || stepIndex < 0) return null;
  const adapter = String(step?.executorType || step?.executor_type || step?.type || '').trim();
  if (!adapter) throw new Error('Mission step has no execution adapter.');

  const job = {
    id: crypto.randomUUID(),
    user_id: userId,
    parent_job_id: null,
    type: 'mission_step',
    status: 'queued',
    priority: Math.min(100, Math.max(0, Number(step?.priority ?? mission?.metadata?.priority ?? 50))),
    payload: {
      mission_id: mission.id,
      mission_goal: mission.goal,
      user_id: userId,
      step_index: stepIndex,
      adapter,
      step,
    },
    attempts: 0,
    max_attempts: Math.min(8, Math.max(1, Number(step?.maxAttempts ?? 3))),
    idempotency_key: 'mission:' + mission.id + ':step:' + String(step.id || stepIndex),
    scheduled_at: new Date().toISOString(),
  };

  if (!configured) return job;
  const rows = await request('jobs', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(job),
  });
  return rows?.[0] || (await request(
    'jobs?select=*&user_id=eq.' + encodeURIComponent(userId) +
    '&idempotency_key=eq.' + encodeURIComponent(job.idempotency_key) + '&limit=1'
  ))?.[0] || null;
}

export async function createRoutineForUser(userId, data = {}) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const name = String(data.name || '').trim().slice(0, 200);
  if (!name) throw new Error('Routine name is required.');
  const schedule = String(data.schedule || '').trim().slice(0, 100);
  if (!schedule) throw new Error('Routine schedule is required.');
  const timezone = String(data.timezone || 'Africa/Lagos').trim().slice(0, 100);
  const templates = safeTemplates(data.jobTemplates);
  if (!templates.length) throw new Error('A routine needs at least one job template.');
  const firstRun = data.nextRunAt ? new Date(data.nextRunAt) : nextRunAt(schedule, { timezone });
  if (Number.isNaN(firstRun.getTime())) throw new Error('Invalid next run time.');

  const routine = {
    id: crypto.randomUUID(),
    userId,
    name,
    description: String(data.description || '').trim().slice(0, 2000) || null,
    schedule,
    timezone,
    status: ['active','paused','disabled'].includes(String(data.status)) ? String(data.status) : 'active',
    priority: Math.min(100, Math.max(0, Number(data.priority ?? 50))),
    maxParallelJobs: Math.min(8, Math.max(1, Number(data.maxParallelJobs ?? 4))),
    jobTemplates: templates,
    nextRunAt: firstRun.toISOString(),
    metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {},
  };
  if (!configured) {
    const local = { ...routine, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), consecutiveFailures: 0 };
    memory.missions.set('routine:' + userId + ':' + routine.id, local);
    return local;
  }
  const rows = await request('jarvis_routines', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: routine.id, user_id: userId, name: routine.name, description: routine.description,
      schedule: routine.schedule, timezone: routine.timezone, status: routine.status,
      priority: routine.priority, max_parallel_jobs: routine.maxParallelJobs,
      job_templates: routine.jobTemplates, next_run_at: routine.nextRunAt,
      metadata: routine.metadata,
    }),
  });
  return routineFromRow(rows?.[0] || { id: routine.id, user_id: userId, ...routine });
}

export async function getRoutineForUser(userId, routineId) {
  if (!validUuid(userId) || !validUuid(routineId)) throw new Error('Invalid routine identity.');
  if (!configured) return memory.missions.get('routine:' + userId + ':' + routineId) || null;
  const rows = await request(
    'jarvis_routines?select=*&id=eq.' + encodeURIComponent(routineId) +
    '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1'
  );
  return routineFromRow(rows?.[0] || null);
}

export async function listRoutinesForUser(userId, limit = 50) {
  if (!validUuid(userId)) throw new Error('Invalid JARVIS user id.');
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  if (!configured) {
    return [...memory.missions.values()]
      .filter(routine => routine?.userId === userId && routine?.schedule)
      .sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))
      .slice(0, safeLimit);
  }
  const rows = await request(
    'jarvis_routines?select=*&user_id=eq.' + encodeURIComponent(userId) +
    '&order=next_run_at.asc&limit=' + safeLimit
  );
  return (rows || []).map(routineFromRow).filter(Boolean);
}

export async function updateRoutineForUser(userId, routineId, data = {}) {
  const existing = await getRoutineForUser(userId, routineId);
  if (!existing) throw Object.assign(new Error('Routine not found.'), { statusCode: 404 });
  const schedule = data.schedule !== undefined ? String(data.schedule).trim().slice(0, 100) : existing.schedule;
  const timezone = data.timezone !== undefined ? String(data.timezone).trim().slice(0, 100) : existing.timezone;
  const templates = data.jobTemplates !== undefined ? safeTemplates(data.jobTemplates) : existing.jobTemplates;
  const next = data.nextRunAt ? new Date(data.nextRunAt) : (data.schedule !== undefined || data.timezone !== undefined ? nextRunAt(schedule, { timezone }) : new Date(existing.nextRunAt));
  if (Number.isNaN(next.getTime())) throw new Error('Invalid routine next run time.');
  const status = data.status !== undefined && ['active','paused','disabled'].includes(String(data.status)) ? String(data.status) : existing.status;
  const updated = {
    ...existing,
    name: data.name !== undefined ? String(data.name).trim().slice(0, 200) : existing.name,
    description: data.description !== undefined ? String(data.description).trim().slice(0, 2000) || null : existing.description,
    schedule,
    timezone,
    status,
    priority: data.priority !== undefined ? Math.min(100, Math.max(0, Number(data.priority))) : existing.priority,
    maxParallelJobs: data.maxParallelJobs !== undefined ? Math.min(8, Math.max(1, Number(data.maxParallelJobs))) : existing.maxParallelJobs,
    jobTemplates: templates,
    nextRunAt: next.toISOString(),
    metadata: data.metadata !== undefined && data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : existing.metadata,
    updatedAt: new Date().toISOString(),
  };
  if (!configured) {
    memory.missions.set('routine:' + userId + ':' + routineId, updated);
    return updated;
  }
  const rows = await request('jarvis_routines?id=eq.' + encodeURIComponent(routineId) + '&user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      name: updated.name, description: updated.description, schedule: updated.schedule, timezone: updated.timezone,
      status: updated.status, priority: updated.priority, max_parallel_jobs: updated.maxParallelJobs,
      job_templates: updated.jobTemplates, next_run_at: updated.nextRunAt, metadata: updated.metadata,
      updated_at: updated.updatedAt,
    }),
  });
  return routineFromRow(rows?.[0] || { id: routineId, user_id: userId, ...updated });
}

export async function claimDueRoutines(workerId, limit = 10) {
  if (!configured) return [];
  const rows = await rpc('jarvis_claim_due_routines', { p_worker_id: String(workerId), p_limit: Math.min(50, Math.max(1, Number(limit) || 10)) });
  return (Array.isArray(rows) ? rows : rows ? [rows] : []).map(routineFromRow).filter(Boolean);
}

export async function dispatchRoutineForUser(routine, workerId) {
  if (!routine?.id || !validUuid(routine.userId)) throw new Error('Invalid routine for dispatch.');
  const scheduledFor = new Date(routine.nextRunAt);
  if (Number.isNaN(scheduledFor.getTime())) throw new Error('Routine has an invalid next run time.');
  const idempotencyKey = 'routine:' + routine.id + ':' + scheduledFor.toISOString();

  let run = null;
  if (configured) {
    const existingRun = await request(
      'jarvis_routine_runs?select=*&routine_id=eq.' + encodeURIComponent(routine.id) +
      '&scheduled_for=eq.' + encodeURIComponent(scheduledFor.toISOString()) + '&limit=1'
    );
    run = routineRunFromRow(existingRun?.[0] || null);
  } else {
    run = null;
  }

  if (!run) {
    const rows = await request('jarvis_routine_runs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        routine_id: routine.id, user_id: routine.userId, scheduled_for: scheduledFor.toISOString(), status: 'queued',
      }),
    });
    run = routineRunFromRow(rows?.[0] || null);
    if (!run) {
      const existingRun = await request(
        'jarvis_routine_runs?select=*&routine_id=eq.' + encodeURIComponent(routine.id) +
        '&scheduled_for=eq.' + encodeURIComponent(scheduledFor.toISOString()) + '&limit=1'
      );
      run = routineRunFromRow(existingRun?.[0] || null);
    }
  }

  const jobRows = await request('jobs', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: routine.userId,
      type: 'routine_fanout',
      status: 'queued',
      priority: routine.priority,
      payload: {
        routine_id: routine.id,
        routine_run_id: run?.id || null,
        routine_name: routine.name,
        max_parallel_jobs: routine.maxParallelJobs,
        template_count: routine.jobTemplates.length,
      },
      attempts: 0,
      max_attempts: 3,
      idempotency_key: idempotencyKey,
      scheduled_at: new Date().toISOString(),
    }),
  });
  const parentJob = jobRows?.[0] || (await request(
    'jobs?select=*&user_id=eq.' + encodeURIComponent(routine.userId) +
    '&idempotency_key=eq.' + encodeURIComponent(idempotencyKey) + '&limit=1'
  ))?.[0] || null;

  const next = nextRunAt(routine.schedule, { from: scheduledFor, timezone: routine.timezone });
  await request(
    'jarvis_routines?id=eq.' + encodeURIComponent(routine.id) + '&user_id=eq.' + encodeURIComponent(routine.userId),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        next_run_at: next.toISOString(),
        last_run_at: scheduledFor.toISOString(),
        last_run_status: 'queued',
        consecutive_failures: 0,
        lease_until: null,
        leased_by: workerId,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return { routine, run, parentJob, nextRunAt: next.toISOString() };
}

export async function fanOutRoutineRun(job) {
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '');
  const routineId = String(payload.routine_id || '');
  if (!validUuid(userId) || !validUuid(routineId)) throw new Error('Routine dispatch job has invalid identity.');
  const routine = await getRoutineForUser(userId, routineId);
  if (!routine) throw new Error('Routine no longer exists.');
  const runId = String(payload.routine_run_id || '');
  let run = runId ? await request('jarvis_routine_runs?select=*&id=eq.' + encodeURIComponent(runId) + '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1') : [];
  let runRow = routineRunFromRow(run?.[0] || null);
  if (!runRow) throw new Error('Routine run not found.');

  const existingChildren = Array.isArray(runRow.childJobIds) ? runRow.childJobIds : [];
  const childJobIds = [...existingChildren];

  if (!childJobIds.length) {
    for (const template of routine.jobTemplates) {
      const idempotencyKey = 'routine-run:' + runRow.id + ':' + template.id;
      const rows = await request('jobs', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({
          user_id: userId,
          parent_job_id: job.id,
          type: template.type,
          status: 'queued',
          priority: template.priority,
          payload: {
            ...template.payload,
            routine_id: routine.id,
            routine_run_id: runRow.id,
            routine_template_id: template.id,
            routine_name: routine.name,
          },
          attempts: 0,
          max_attempts: template.maxAttempts,
          idempotency_key: idempotencyKey,
          scheduled_at: new Date().toISOString(),
        }),
      });
      const child = rows?.[0] || (await request(
        'jobs?select=id&user_id=eq.' + encodeURIComponent(userId) +
        '&idempotency_key=eq.' + encodeURIComponent(idempotencyKey) + '&limit=1'
      ))?.[0] || null;
      if (child?.id) childJobIds.push(String(child.id));
    }
  }

  const updated = await request('jarvis_routine_runs?id=eq.' + encodeURIComponent(runRow.id) + '&user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'running',
      child_job_ids: childJobIds,
      summary: { templateCount: routine.jobTemplates.length, childCount: childJobIds.length },
      started_at: runRow.startedAt || new Date().toISOString(),
    }),
  });
  return {
    accepted: true,
    type: 'routine_fanout',
    status: 'fanout_complete',
    routineId: routine.id,
    routineRunId: runRow.id,
    childJobIds,
    message: 'Routine expanded into manageable child jobs. Child jobs remain individually tracked.',
    record: routineRunFromRow(updated?.[0] || null),
  };
}

export async function updateRoutineRunFromChildren(job) {
  const payload = job?.payload && typeof job.payload === 'object' ? job.payload : {};
  const userId = String(job?.user_id || payload.user_id || '');
  const runId = String(payload.routine_run_id || '');
  if (!validUuid(userId) || !validUuid(runId)) return null;
  const runRows = await request('jarvis_routine_runs?select=*&id=eq.' + encodeURIComponent(runId) + '&user_id=eq.' + encodeURIComponent(userId) + '&limit=1');
  const run = routineRunFromRow(runRows?.[0] || null);
  if (!run || !run.childJobIds.length) return null;

  const ids = run.childJobIds.map(encodeURIComponent).join(',');
  const children = await request('jobs?select=id,status,result,error&id=in.(' + ids + ')&user_id=eq.' + encodeURIComponent(userId));
  if (!Array.isArray(children) || !children.length) return null;
  const terminal = new Set(['succeeded','failed','canceled','cancelled']);
  if (!children.every(child => terminal.has(String(child.status)))) return { status: run.status, complete: false };

  const failed = children.filter(child => String(child.status) === 'failed').length;
  const canceled = children.filter(child => String(child.status) === 'cancelled').length;
  const status = failed === 0 && canceled === 0 ? 'succeeded' : failed < children.length ? 'partial' : 'failed';
  const completedAt = new Date().toISOString();
  const summary = {
    childCount: children.length,
    succeeded: children.filter(child => String(child.status) === 'succeeded').length,
    failed,
    canceled,
    completedAt,
  };
  await request('jarvis_routine_runs?id=eq.' + encodeURIComponent(run.id) + '&user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status, summary, completed_at: completedAt }),
  });
  const routine = await getRoutineForUser(userId, run.routineId);
  if (routine) {
    await request('jarvis_routines?id=eq.' + encodeURIComponent(routine.id) + '&user_id=eq.' + encodeURIComponent(userId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        last_run_status: status,
        consecutive_failures: status === 'succeeded' ? 0 : Number(routine.consecutiveFailures || 0) + 1,
        updated_at: completedAt,
      }),
    });
  }
  return { status, complete: true, summary };
}
