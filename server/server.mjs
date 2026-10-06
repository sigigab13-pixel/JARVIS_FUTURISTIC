import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  ensureJarvisUser,
  getConversationMessages,
  appendConversationMessages,
  saveOAuthState,
  getOAuthState,
  deleteOAuthState,
  getYouTubeConnection,
  saveYouTubeConnection,
  ensureJarvisAuthUser,
  searchSemanticMemories,
  saveSemanticMemory,
  getJarvisPreferences,
  updateJarvisPreferences,
  ensureJarvisEntitlement,
  getJarvisEntitlement,
  getRegionalPlanPrices,
  consumeImageGeneration,
  getBusinessForUser,
  createBusinessForUser,
  updateBusinessForUser,
  getBrandKitForUser,
  upsertBrandKitForUser,
  createVideoProjectForUser,
  getVideoProjectsForUser,
  getVideoProjectForUser,
  addVideoCharacterForUser,
  updateVideoCharacterForUser,
  getVideoCharactersForUser,
  addVideoSceneForUser,
  updateVideoSceneForUser,
  getVideoScenesForUser,
  queueVideoJobForUser,
  getJobForUser,
  createMissionForUser,
  getMissionForUser,
  listMissionsForUser,
  updateMissionForUser,
  recordMissionEventForUser,
  getMissionEventsForUser,
  queueMissionStepForUser,
  createRoutineForUser,
  getRoutineForUser,
  listRoutinesForUser,
  updateRoutineForUser,
  listSemanticMemories,
  deleteSemanticMemory,
  deleteAllSemanticMemories,
} from './store.mjs';
import { enqueueJob, isRedisConfigured } from './queue.mjs';
import { createMediaKey, getMedia, isSupabaseStorageConfigured, putMedia } from './media.mjs';
import { capabilityContextForPrompt, getCapabilityRegistry, getAvailableCapabilities, rankCapabilitiesForIntent } from './capabilities.mjs';
import { routeContextForPrompt, routeIntent } from './intent-router.mjs';
import { createMissionState, transitionMission, advanceMissionStep } from './mission-runtime.mjs';
import { preflightMission, getMissionAdapters } from './mission-executor.mjs';
import { generateHuggingFaceImage, HF_IMAGE_MODELS, HF_IMAGE_EDIT_MODELS, HF_IMAGE_PROVIDERS } from './image-generator.mjs';
import { getYouTubeAccessToken, getYouTubeAnalytics, getYouTubeChannel, uploadYouTubeVideo } from './youtube.mjs';
import { getRepairOfficeDiagnostics, getRepairOfficePolicy } from './repair-office.mjs';
import { generateIntelligentResponse, getOpenAIModels } from './intelligence-core.mjs';
import { formatDecisionMemory, parseExplicitDecision } from './decision-memory.mjs';
import { buildRepairInstruction, inspectAssistantResponse, selfCheckAndNormalize } from './self-check-core.mjs';
import { assessUncertainty, buildEpistemicInstruction } from './uncertainty-core.mjs';
import { normalizeMemoryList, parseMemoryDeletionRequest } from './memory-control.mjs';
import { buildTimeAwarenessInstruction, getTimeContextForRequest } from './time-freshness-core.mjs';
import { buildContradictionInstruction, detectMemoryContradictions } from './contradiction-core.mjs';
import { formatCorrectionMemory, parseUserCorrection } from './correction-memory.mjs';
import { planGoal } from './goal-outcome-core.mjs';

const PORT = Number(process.env.PORT || 10000);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = 'openai/gpt-oss-120b:fastest';
const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v2/voices';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const ELEVENLABS_DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const YOUTUBE_CLIENT_ID = process.env.GOOGLE_YOUTUBE_CLIENT_ID || '';
const YOUTUBE_CLIENT_SECRET = process.env.GOOGLE_YOUTUBE_CLIENT_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const JARVIS_CREATOR_NAME = String(process.env.JARVIS_CREATOR_NAME || 'Saviour').trim() || 'Saviour';

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  const pair = header.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}

function getJarvisUserId(req) {
  const value = readCookie(req, 'jarvis_user_id');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
}

function jarvisCookie(userId) {
  return `jarvis_user_id=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000; Secure`;
}

async function requireAuthenticatedJarvisUser(req) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim() || '';
  if (!accessToken) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseServerKey) {
    throw Object.assign(new Error('Supabase authentication is not configured on this deployment.'), { statusCode: 503 });
  }

  const response = await fetch(supabaseUrl + '/auth/v1/user', {
    headers: { apikey: supabaseServerKey, Authorization: 'Bearer ' + accessToken },
  });
  const user = await response.json().catch(() => ({}));
  if (!response.ok || !user?.id) {
    throw Object.assign(new Error('Your JARVIS session is invalid or expired.'), { statusCode: 401 });
  }

  const jarvisUser = await ensureJarvisAuthUser(user);
  return { authUser: user, jarvisUser };
}

async function getOptionalAuthenticatedJarvisUser(req) {
  const authorization = String(req.headers.authorization || '');
  if (!authorization.trim()) return null;
  return requireAuthenticatedJarvisUser(req);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 12_000_000) {
        req.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function classifyMemory(text) {
  const correction = parseUserCorrection(text);
  if (correction) return { type: 'correction', importance: 0.99, correction };

  const value = String(text || '').trim().toLowerCase();
  if (/\\b(call me|my name is|i am|i'm)\\b/.test(value)) return { type: 'identity', importance: 0.95 };
  if (/\\b(i prefer|i like|i love|my favorite|i dislike|i hate|i don't like)\\b/.test(value)) return { type: 'preference', importance: 0.85 };
  if (/\\b(my goal|i plan to|i want to become|i want to build|i'm building|i am building)\\b/.test(value)) return { type: 'goal', importance: 0.9 };
  if (/\\b(we decided|from now on|always|never|use .* instead|the architecture|the plan is)\\b/.test(value)) return { type: 'project_decision', importance: 0.9 };
  if (/\\b(remember|don't forget|do not forget|keep in mind)\\b/.test(value)) return { type: 'instruction', importance: 0.9 };
  return { type: 'chat_memory', importance: 0.7 };
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const target = path.normalize(path.join(DIST, requested));
  return target.startsWith(DIST) ? target : null;
}

export function canPublishChildrenFactoryMission(mission) {
  return mission?.metadata?.factory !== 'children-v1'
    || (mission?.approval?.status === 'approved'
      && mission?.metadata?.pipeline?.render === 'completed'
      && mission?.metadata?.pipeline?.verified_video === 'completed'
      && Boolean(mission?.metadata?.verifiedVideo?.mediaKey));
}

export function buildChildrenFactoryPipeline({
  sceneAssetsStatus = 'completed',
  renderQueued = false,
  renderCompleted = false,
  verifiedVideo = false,
  approvalStatus = 'pending',
  published = false,
} = {}) {
  return [
    { id: 'story', label: 'Story', status: 'completed' },
    { id: 'character_bible', label: 'Character Bible', status: 'completed' },
    { id: 'scene_assets', label: 'Scene Assets', status: sceneAssetsStatus },
    { id: 'render', label: '9:16 Render', status: renderCompleted ? 'completed' : renderQueued ? 'queued' : 'pending' },
    { id: 'verified_video', label: 'Verified Video', status: verifiedVideo ? 'completed' : 'blocked' },
    { id: 'approval', label: 'Approval', status: published ? 'completed' : approvalStatus },
    { id: 'publish', label: 'Publish', status: published ? 'completed' : 'blocked' },
  ];
}

async function generateChildrenFactoryDraft(topic, age) {
  const hfToken = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
  if (!hfToken) {
    throw Object.assign(new Error('Hugging Face is not configured for the Children Factory.'), { statusCode: 503 });
  }

  const prompt = [
    'You are JARVIS Children Factory v1.',
    'Create one safe, age-appropriate children story.',
    'Return ONLY valid JSON. No markdown and no extra text.',
    'Schema:',
    '{"title":"string","story":"about 200 words","character":{"name":"string","species":"string","color":"string","clothes":"string","description":"string"}}',
    'Keep the story gentle, imaginative, educational or emotionally positive.',
    'Do not include frightening, graphic, sexual, dangerous, or age-inappropriate material.',
    'Keep the main character visually consistent for image generation.',
    'Topic: ' + String(topic).slice(0, 500),
    'Target age: ' + String(age),
  ].join('\\n');

  const response = await fetch(HF_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + hfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
      temperature: 0.7,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError = data?.error;
    const message = providerError?.message || providerError?.detail || providerError?.error
      || (typeof providerError === 'string' ? providerError : null)
      || (providerError && typeof providerError === 'object' ? JSON.stringify(providerError) : null)
      || 'Children Factory story generation failed.';
    throw Object.assign(new Error(String(message)), { statusCode: response.status >= 400 && response.status < 500 ? 400 : 502 });
  }

  const raw = String(data?.choices?.[0]?.message?.content || '').trim();
  const cleaned = raw.replace(/^\s*\`\`\`json\s*/i, '').replace(/\s*\`\`\`\s*$/i, '').trim();
  let draft;
  try {
    draft = JSON.parse(cleaned);
  } catch {
    throw Object.assign(new Error('Children Factory received an invalid story format from the AI Core.'), { statusCode: 502 });
  }

  const story = String(draft?.story || '').trim();
  const storyWordCount = story ? story.split(/\s+/).filter(Boolean).length : 0;
  const character = draft?.character && typeof draft.character === 'object' ? draft.character : {};
  if (!story || storyWordCount < 120 || storyWordCount > 300 || !character.name || !character.species || !character.color || !character.clothes) {
    throw Object.assign(new Error('Children Factory received an incomplete story or character bible.'), { statusCode: 502 });
  }

  return {
    title: String(draft.title || 'JARVIS Children Story').trim().slice(0, 200),
    story: story.slice(0, 5000),
    character: {
      name: String(character.name).trim().slice(0, 120),
      species: String(character.species).trim().slice(0, 120),
      color: String(character.color).trim().slice(0, 120),
      clothes: String(character.clothes).trim().slice(0, 300),
      description: String(character.description || '').trim().slice(0, 1000),
    },
  };
}

export async function handleApi(req, res, pathname, url) {
  if (req.method === 'GET' && pathname === '/api/_healthcheck') {
    return json(res, 200, { message: 'Success', service: 'JARVIS', deployment: 'vercel' });
  }

  if (req.method === 'GET' && pathname === '/api/repair/health') {
    await requireAuthenticatedJarvisUser(req);
    return json(res, 200, {
      service: 'JARVIS Repair Office',
      mode: 'diagnose-and-escalate',
      policy: getRepairOfficePolicy(),
      message: 'Repair Office is bounded: it may classify failures and recommend safe recovery, but it cannot mutate production autonomously.',
    });
  }

  if (req.method === 'GET' && pathname === '/api/repair/diagnostics') {
    await requireAuthenticatedJarvisUser(req);
    return json(res, 200, await getRepairOfficeDiagnostics());
  }


  if (req.method === 'GET' && pathname === '/api/capabilities') {
    await requireAuthenticatedJarvisUser(req);
    return json(res, 200, {
      capabilities: getCapabilityRegistry(),
      note: 'Availability reflects the current server configuration; authorization is still checked when an action is executed.',
    });
  }

  if (req.method === 'GET' && pathname === '/api/business') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const business = await getBusinessForUser(jarvisUser.id);
    const brandKit = business ? await getBrandKitForUser(jarvisUser.id, business.id) : null;
    return json(res, 200, { business, brandKit });
  }

  if (req.method === 'POST' && pathname === '/api/business') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const existing = await getBusinessForUser(jarvisUser.id);
    const business = existing
      ? await updateBusinessForUser(jarvisUser.id, existing.id, body)
      : await createBusinessForUser(jarvisUser.id, body);
    return json(res, 200, { business });
  }

  if (req.method === 'POST' && pathname === '/api/business/brand-kit') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const business = await getBusinessForUser(jarvisUser.id);
    if (!business) return json(res, 400, { error: 'Create your business profile first.' });
    const brandKit = await upsertBrandKitForUser(jarvisUser.id, business.id, body);
    return json(res, 200, { brandKit });
  }

  if (pathname.startsWith('/api/video')) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const entitlement = await ensureJarvisEntitlement(jarvisUser.id);
    const features = entitlement?.jarvis_plans?.features || {};
    if (features.advanced_video !== true) {
      return json(res, 403, { error: 'Video Engine requires a plan with advanced video access.', code: 'VIDEO_FEATURE_LOCKED' });
    }

    if (req.method === 'GET' && pathname === '/api/video/projects') {
      return json(res, 200, { projects: await getVideoProjectsForUser(jarvisUser.id) });
    }

    if (req.method === 'POST' && pathname === '/api/video/projects') {
      const body = await parseBody(req);
      const project = await createVideoProjectForUser(jarvisUser.id, body);
      return json(res, 201, { project });
    }

    const projectMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && projectMatch) {
      const project = await getVideoProjectForUser(jarvisUser.id, projectMatch[1]);
      if (!project) return json(res, 404, { error: 'Video project not found.' });
      return json(res, 200, { project });
    }

    const charactersMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/characters$/i);
    if (charactersMatch) {
      const projectId = charactersMatch[1];
      if (req.method === 'GET') return json(res, 200, { characters: await getVideoCharactersForUser(jarvisUser.id, projectId) });
      if (req.method === 'POST') {
        const body = await parseBody(req);
        return json(res, 201, { character: await addVideoCharacterForUser(jarvisUser.id, projectId, body) });
      }
    }

    const characterEditMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/characters\/([0-9a-f-]{36})$/i);
    if (req.method === 'PATCH' && characterEditMatch) {
      const body = await parseBody(req);
      return json(res, 200, { character: await updateVideoCharacterForUser(jarvisUser.id, characterEditMatch[1], characterEditMatch[2], body) });
    }

    const scenesMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/scenes$/i);
    if (scenesMatch) {
      const projectId = scenesMatch[1];
      if (req.method === 'GET') return json(res, 200, { scenes: await getVideoScenesForUser(jarvisUser.id, projectId) });
      if (req.method === 'POST') {
        const body = await parseBody(req);
        return json(res, 201, { scene: await addVideoSceneForUser(jarvisUser.id, projectId, body) });
      }
    }

    const sceneEditMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/scenes\/([0-9a-f-]{36})$/i);
    if (req.method === 'PATCH' && sceneEditMatch) {
      const body = await parseBody(req);
      return json(res, 200, { scene: await updateVideoSceneForUser(jarvisUser.id, sceneEditMatch[1], sceneEditMatch[2], body) });
    }

    const planMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/plan$/i);
    if (req.method === 'POST' && planMatch) {
      const projectId = planMatch[1];
      const project = await getVideoProjectForUser(jarvisUser.id, projectId);
      if (!project) return json(res, 404, { error: 'Video project not found.' });
      const [characters, scenes] = await Promise.all([
        getVideoCharactersForUser(jarvisUser.id, projectId),
        getVideoScenesForUser(jarvisUser.id, projectId),
      ]);
      const body = await parseBody(req);
      const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : '';
      const job = await queueVideoJobForUser(jarvisUser.id, projectId, {
        operation: 'plan',
        format: project.format,
        title: project.title,
        story_bible: project.story_bible,
        characters,
        scenes,
        request: body,
      }, idempotencyKey);
      let dispatch = { queued: false, provider: 'supabase' };
      if (isRedisConfigured()) {
        try {
          dispatch = { queued: true, provider: 'upstash_redis', message: await enqueueJob(job.id, job.type) };
        } catch (queueError) {
          console.error('JARVIS Redis dispatch error:', queueError);
          dispatch = { queued: false, provider: 'supabase', fallback: 'redis_unavailable' };
        }
      }
      return json(res, 202, {
        job,
        dispatch,
        pipeline: ['story_director','character_bible','world_asset_bible','scene_director','storyboard_cost_gate','visual_generation','motion','voice_audio','lip_sync','editing','subtitles','continuity_brand_qa','repair_recovery','render','final_qa','publish'],
      });
    }

    const jobMatch = pathname.match(/^\/api\/video\/jobs\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && jobMatch) {
      const job = await getJobForUser(jarvisUser.id, jobMatch[1]);
      if (!job) return json(res, 404, { error: 'Video job not found.' });
      return json(res, 200, { job });
    }

    const renderMatch = pathname.match(/^\/api\/video\/projects\/([0-9a-f-]{36})\/render$/i);
    if (req.method === 'POST' && renderMatch) {
      const projectId = renderMatch[1];
      const project = await getVideoProjectForUser(jarvisUser.id, projectId);
      if (!project) return json(res, 404, { error: 'Video project not found.' });
      if (!isSupabaseStorageConfigured()) {
        return json(res, 503, { error: 'Supabase Storage is required before rendering a video.', code: 'VIDEO_STORAGE_UNAVAILABLE' });
      }
      const body = await parseBody(req);
      const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : '';
      const imageKeys = Array.isArray(body?.imageKeys) ? body.imageKeys.map(String).map(v => v.trim()).filter(Boolean).slice(0, 12) : [];
      const missionId = String(body?.missionId || '').trim();
      if (!imageKeys.length) return json(res, 400, { error: 'At least one stored image key is required.' });
      if (imageKeys.some(key => !key.startsWith(`jarvis/${jarvisUser.id}/`))) {
        return json(res, 403, { error: 'One or more image assets do not belong to this JARVIS user.' });
      }
      if (missionId) {
        if (!/^[0-9a-f-]{36}$/i.test(missionId)) return json(res, 400, { error: 'missionId must be a valid mission id.' });
        const mission = await getMissionForUser(jarvisUser.id, missionId);
        if (!mission) return json(res, 404, { error: 'Render mission not found.' });
        if (mission.metadata?.factory && mission.metadata.factory !== 'children-v1') return json(res, 409, { error: 'The supplied mission is not a Children Factory publishing mission.', code: 'VIDEO_MISSION_MISMATCH' });
        if (mission.metadata?.projectId && mission.metadata.projectId !== projectId) return json(res, 409, { error: 'The render project does not match the selected mission.', code: 'VIDEO_PROJECT_MISMATCH' });
        if (mission.metadata?.pipeline?.render === 'completed') return json(res, 409, { error: 'This Children Factory render is already completed. A new render must create a new verified video state.', code: 'VIDEO_RENDER_ALREADY_COMPLETED' });
      }
      const job = await queueVideoJobForUser(jarvisUser.id, projectId, {
        operation: 'render',
        mission_id: missionId || null,
        image_keys: imageKeys,
        format: project.format,
        title: project.title,
      }, idempotencyKey);
      let dispatch = { queued: false, provider: 'supabase' };
      if (isRedisConfigured()) {
        try {
          dispatch = { queued: true, provider: 'upstash_redis', message: await enqueueJob(job.id, job.type) };
        } catch (queueError) {
          console.error('JARVIS Redis video render dispatch error:', queueError);
          dispatch = { queued: false, provider: 'supabase', fallback: 'redis_unavailable' };
        }
      }
      return json(res, 202, {
        job,
        dispatch,
        renderer: 'ffmpeg-image-sequence-v2',
        note: 'The worker will render the supplied stored images into a 9:16 MP4 and save the verified video asset to JARVIS media storage.',
      });
    }

    return json(res, 404, { error: 'Video Engine route not found.' });
  }

  if (req.method === 'GET' && pathname === '/api/routines') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const limit = Number(url.searchParams.get('limit') || 50);
    return json(res, 200, { routines: await listRoutinesForUser(jarvisUser.id, limit) }, {
      'Set-Cookie': jarvisCookie(jarvisUser.id),
    });
  }

  if (req.method === 'POST' && pathname === '/api/routines') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    try {
      const routine = await createRoutineForUser(jarvisUser.id, {
        name: body?.name,
        description: body?.description,
        schedule: body?.schedule,
        timezone: body?.timezone,
        status: body?.status,
        priority: body?.priority,
        maxParallelJobs: body?.maxParallelJobs,
        jobTemplates: body?.jobTemplates || body?.jobs,
        metadata: body?.metadata,
      });
      return json(res, 201, { routine }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      return json(res, Number(error?.statusCode) || 400, {
        error: error instanceof Error ? error.message : 'Routine could not be created.',
      });
    }
  }

  const routineMatch = pathname.match(/^\/api\/routines\/([0-9a-f-]{36})$/i);
  if (routineMatch) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const routineId = routineMatch[1];

    if (req.method === 'GET') {
      const routine = await getRoutineForUser(jarvisUser.id, routineId);
      if (!routine) return json(res, 404, { error: 'Routine not found.' });
      return json(res, 200, { routine }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (req.method === 'PATCH') {
      const body = await parseBody(req);
      try {
        const routine = await updateRoutineForUser(jarvisUser.id, routineId, body);
        return json(res, 200, { routine }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
      } catch (error) {
        return json(res, Number(error?.statusCode) || 400, {
          error: error instanceof Error ? error.message : 'Routine could not be updated.',
        });
      }
    }

    return json(res, 405, { error: 'Method not allowed.' });
  }

  if (req.method === 'GET' && pathname === '/api/missions') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const limit = Number(url.searchParams.get('limit') || 20);
    return json(res, 200, { missions: await listMissionsForUser(jarvisUser.id, limit) }, {
      'Set-Cookie': jarvisCookie(jarvisUser.id),
    });
  }

  if (req.method === 'POST' && pathname === '/api/missions') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const goal = String(body?.goal || '').trim();
    if (!goal) return json(res, 400, { error: 'A mission goal is required.' });

    const autonomy = String(body?.autonomy || 'advise');
    const allowedAutonomy = new Set(['advise', 'prepare', 'execute_with_approval', 'execute_within_policy']);
    if (!allowedAutonomy.has(autonomy)) {
      return json(res, 400, { error: 'Invalid mission autonomy level.' });
    }

    const steps = Array.isArray(body?.steps) ? body.steps.slice(0, 30) : [];
    const state = createMissionState({
      missionId: crypto.randomUUID(),
      userId: jarvisUser.id,
      goal,
      autonomy,
      steps,
    });
    state.approval = autonomy === 'execute_with_approval'
      ? { required: true, status: 'not_requested', requestedAt: null, approvedAt: null }
      : { required: false, status: 'not_required' };
    state.metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {};
    const mission = await createMissionForUser(jarvisUser.id, state);
    return json(res, 201, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
  }

  const missionMatch = pathname.match(/^\/api\/missions\/([0-9a-f-]{36})(?:\/(start|request-approval|approve|pause|resume|retry|cancel|checkpoint|events))?$/i);
  if (missionMatch) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const missionId = missionMatch[1];
    const action = missionMatch[2] || '';

    if (req.method === 'GET' && !action) {
      const mission = await getMissionForUser(jarvisUser.id, missionId);
      if (!mission) return json(res, 404, { error: 'Mission not found.' });
      return json(res, 200, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (req.method === 'GET' && action === 'events') {
      const events = await getMissionEventsForUser(jarvisUser.id, missionId, Number(url.searchParams.get('limit') || 100));
      if (!(await getMissionForUser(jarvisUser.id, missionId))) return json(res, 404, { error: 'Mission not found.' });
      return json(res, 200, { events }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

    const current = await getMissionForUser(jarvisUser.id, missionId);
    if (!current) return json(res, 404, { error: 'Mission not found.' });

    if (action === 'start') {
      const preflight = preflightMission(current);
      if (!preflight.ok) {
        return json(res, 409, {
          error: preflight.reason,
          code: 'MISSION_PREFLIGHT_BLOCKED',
          supportedAdapters: getMissionAdapters(),
          preflight,
          mission: current,
        }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
      }
      if (current.autonomy === 'execute_with_approval' && current.approval?.status !== 'approved') {
        return json(res, 409, {
          error: 'This mission requires approval before execution can start.',
          code: 'MISSION_APPROVAL_REQUIRED',
          mission: current,
        }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
      }
      const next = transitionMission(current, 'queued');
      const queuedJob = await queueMissionStepForUser(jarvisUser.id, next);
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: 'mission.queued',
        message: 'Mission queued with its first durable execution step.',
        metadata: { jobId: queuedJob?.id || null, stepIndex: next.currentStep },
      });
      let dispatch = { queued: false, provider: 'supabase' };
      if (queuedJob?.id && isRedisConfigured()) {
        try {
          dispatch = { queued: true, provider: 'upstash_redis', message: await enqueueJob(queuedJob.id, queuedJob.type) };
        } catch (queueError) {
          console.error('JARVIS mission Redis dispatch error:', queueError);
          dispatch = { queued: false, provider: 'supabase', fallback: 'redis_unavailable' };
        }
      }
      return json(res, 202, { mission, job: queuedJob, dispatch }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (action === 'request-approval') {
      if (current.metadata?.factory === 'children-v1' && current.metadata?.pipeline?.verified_video !== 'completed' && !current.metadata?.verifiedVideo?.mediaKey) {
        return json(res, 409, { error: 'Children Factory approval requires a verified video render first.', code: 'CHILDREN_FACTORY_VERIFIED_VIDEO_REQUIRED', mission: current });
      }
      const next = transitionMission(current, 'waiting_approval');
      next.approval = {
        ...(current.approval || {}),
        required: true,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: 'mission.approval_requested',
        message: 'Mission is waiting for user approval.',
      });
      return json(res, 200, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (action === 'approve') {
      if (current.status !== 'waiting_approval') {
        return json(res, 409, { error: 'Mission is not waiting for approval.', code: 'MISSION_NOT_WAITING_FOR_APPROVAL' });
      }
      const next = transitionMission(current, 'running');
      next.approval = {
        ...(current.approval || {}),
        required: true,
        status: 'approved',
        approvedAt: new Date().toISOString(),
      };
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: 'mission.approved',
        message: 'Mission approval recorded. Execution remains subject to tool-boundary authorization.',
      });
      return json(res, 200, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (action === 'pause') {
      if (!['queued', 'running', 'waiting_approval'].includes(current.status)) {
        return json(res, 409, { error: 'Mission cannot be paused from its current state.', code: 'MISSION_CANNOT_PAUSE' });
      }
      const next = transitionMission(current, 'paused');
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: 'mission.paused',
        message: 'Mission paused by the user.',
      });
      return json(res, 200, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (action === 'resume' || action === 'retry') {
      if (action === 'resume' && current.status !== 'paused') {
        return json(res, 409, { error: 'Only a paused mission can be resumed.', code: 'MISSION_NOT_PAUSED' });
      }
      if (action === 'retry' && current.status !== 'failed') {
        return json(res, 409, { error: 'Only a failed mission can be retried.', code: 'MISSION_NOT_FAILED' });
      }
      if (process.env.JARVIS_MISSION_EXECUTOR_ENABLED !== '1') {
        return json(res, 409, {
          error: 'The mission executor is not enabled yet, so JARVIS will not pretend to resume or retry external work.',
          code: 'MISSION_EXECUTOR_NOT_ENABLED',
          mission: current,
        }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
      }
      const next = transitionMission(current, 'queued');
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: action === 'resume' ? 'mission.resumed' : 'mission.retried',
        message: action === 'resume' ? 'Mission resumed and queued for execution.' : 'Failed mission retried and queued for execution.',
      });
      return json(res, 202, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (action === 'cancel') {
      if (['succeeded', 'canceled'].includes(current.status)) {
        return json(res, 409, { error: 'Mission is already finished.', code: 'MISSION_TERMINAL' });
      }
      const next = transitionMission(current, 'canceled');
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: 'mission.canceled',
        message: 'Mission canceled by the user.',
      });
      return json(res, 200, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    if (action === 'checkpoint') {
      if (current.status !== 'running') {
        return json(res, 409, { error: 'Mission must be running before a checkpoint can be recorded.', code: 'MISSION_NOT_RUNNING' });
      }
      const body = await parseBody(req);
      const evidence = body?.evidence && typeof body.evidence === 'object' && !Array.isArray(body.evidence)
        ? body.evidence
        : null;
      if (!evidence) return json(res, 400, { error: 'Verified evidence is required to complete a mission step.' });
      const next = advanceMissionStep({ ...current, lastEvidence: evidence });
      next.lastEvidence = evidence;
      next.metadata = {
        ...(current.metadata || {}),
        lastCheckpointResult: body?.result && typeof body.result === 'object' ? body.result : { message: String(body?.result || '') },
      };
      const mission = await updateMissionForUser(jarvisUser.id, missionId, next, {
        eventType: next.status === 'succeeded' ? 'mission.completed' : 'mission.checkpoint',
        message: next.status === 'succeeded'
          ? 'Mission completed from a verified final checkpoint.'
          : 'Verified mission step completed and checkpoint persisted.',
        metadata: { stepIndex: current.currentStep, evidence },
      });
      return json(res, 200, { mission }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    }

    return json(res, 404, { error: 'Mission action not found.' });
  }

  if (req.method === 'POST' && pathname === '/api/factory/children') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const topic = String(body?.topic || '').trim().slice(0, 500);
    const age = Number(body?.age || 5);
    if (!topic) return json(res, 400, { error: 'A story topic is required.' });
    if (!Number.isInteger(age) || age < 3 || age > 12) return json(res, 400, { error: 'Age must be a whole number from 3 to 12.' });
    if (!isSupabaseStorageConfigured()) {
      return json(res, 503, { error: 'Supabase Storage is not configured for Children Factory assets.', code: 'CHILDREN_FACTORY_STORAGE_UNAVAILABLE' });
    }
    const entitlement = await getJarvisEntitlement(jarvisUser.id) || await ensureJarvisEntitlement(jarvisUser.id);
    const imageAllowance = Number(entitlement?.credits_remaining ?? 0);
    if (imageAllowance < 3) {
      return json(res, 402, { error: 'Children Factory v1 requires at least 3 image-generation credits.', code: 'CHILDREN_FACTORY_CREDITS_REQUIRED', required: 3, remaining: imageAllowance });
    }

    try {
      const draft = await generateChildrenFactoryDraft(topic, age);

      const project = await createVideoProjectForUser(jarvisUser.id, {
        title: draft.title,
        description: 'JARVIS Children Factory v1 draft.',
        format: '9:16',
        story_bible: {
          factory: 'children-v1',
          topic,
          age,
          story: draft.story,
          character_bible: draft.character,
        },
      });

      const character = await addVideoCharacterForUser(jarvisUser.id, project.id, {
        name: draft.character.name,
        role: 'main character',
        profile: {
          species: draft.character.species,
          description: draft.character.description,
          age_target: age,
        },
        appearance: { color: draft.character.color },
        wardrobe: { clothes: draft.character.clothes },
        continuity_rules: {
          locked: true,
          identity_fields: ['name', 'species', 'color', 'clothes'],
        },
      });

      const state = createMissionState({
        missionId: crypto.randomUUID(),
        userId: jarvisUser.id,
        goal: 'Children Factory: approve and publish ' + draft.title,
        autonomy: 'execute_with_approval',
        steps: [],
      });
      state.approval = {
        required: true,
        status: 'not_requested',
        requestedAt: null,
        approvedAt: null,
        action: 'publish',
      };
      state.metadata = {
        factory: 'children-v1',
        projectId: project.id,
        characterId: character?.id || null,
        topic,
        age,
        story: draft.story,
        characterBible: draft.character,
        images: [],
        pipeline: buildChildrenFactoryPipeline({ sceneAssetsStatus: 'running', approvalStatus: 'blocked' }),
      };

      const runningState = transitionMission(transitionMission(state, 'queued'), 'running');
      let mission = await createMissionForUser(jarvisUser.id, runningState);

      const asyncFactory = body?.async !== false
        && String(process.env.JARVIS_ATOMIC_IMAGE_CREDITS || '').toLowerCase() === 'true';
      if (asyncFactory) {
        const sceneJobs = [];
        try {
          for (let scene = 1; scene <= 3; scene += 1) {
            const job = await queueVideoJobForUser(jarvisUser.id, project.id, {
              operation: 'children_factory_scene',
              mission_id: mission.id,
              title: draft.title,
              story: draft.story,
              character: draft.character,
              scene,
              total_scenes: 3,
              format: '9:16',
              priority: 10,
            }, `children-factory:${mission.id}:scene:${scene}`);
            if (!job?.id) throw new Error('Children Factory scene job was not created for scene ' + String(scene) + '.');
            sceneJobs.push(job);
            if (isRedisConfigured()) {
              try {
                await enqueueJob(job.id, job.type);
              } catch (queueError) {
                console.error('JARVIS Children Factory Redis dispatch warning:', queueError);
              }
            }
          }
        } catch (queueError) {
          try {
            const failed = transitionMission(mission, 'failed');
            mission = await updateMissionForUser(jarvisUser.id, mission.id, {
              ...failed,
              metadata: {
                ...(mission.metadata || {}),
                factoryFailure: {
                  stage: 'scene_queue',
                  message: String(queueError?.message || queueError).slice(0, 1000),
                  recordedAt: new Date().toISOString(),
                  queuedScenes: sceneJobs.length,
                },
                pipeline: buildChildrenFactoryPipeline({
                  sceneAssetsStatus: 'failed',
                  approvalStatus: 'blocked',
                }),
              },
            }, {
              eventType: 'children_factory.failed',
              message: 'Children Factory could not queue all scene jobs; partial queue progress was persisted.',
              metadata: { queuedScenes: sceneJobs.length },
            });
          } catch (persistError) {
            console.error('JARVIS Children Factory queue failure checkpoint error:', persistError);
          }
          throw queueError;
        }

        return json(res, 202, {
          factory: 'children-v1',
          status: 'scenes_queued',
          draft: {
            project,
            character,
            story: draft.story,
            characterBible: draft.character,
            images: [],
            pipeline: buildChildrenFactoryPipeline({ sceneAssetsStatus: 'running', approvalStatus: 'blocked' }),
          },
          approvalGate: {
            required: true,
            status: 'render_waiting',
            missionId: mission.id,
            sceneJobs: sceneJobs.map(job => ({
              id: job.id,
              status: job.status,
              scene: Number(job.payload?.scene || 0),
            })),
            label: 'Scenes are being generated by the JARVIS Worker',
            autoPublish: false,
            publishingProvider: 'youtube',
            note: 'JARVIS waits for all verified scene assets before video rendering or approval.',
          },
        }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
      }

      const imageResults = [];
      const characterPrompt = [
        'Create a child-friendly storybook illustration.',
        'Keep this exact character consistent in every image:',
        'Name: ' + draft.character.name,
        'Species: ' + draft.character.species,
        'Color: ' + draft.character.color,
        'Clothes: ' + draft.character.clothes,
        'Description: ' + draft.character.description,
        'Style: warm, colorful, friendly, simple storybook art.',
        'No text, no watermark.',
      ].join(' ');

      for (let index = 1; index <= 3; index += 1) {
        try {
          const blob = await generateHuggingFaceImage(
            characterPrompt + ' Illustration ' + index + ' should depict a different moment from this story: ' + draft.story.slice(0, 1800)
          );
          const buffer = Buffer.from(await blob.arrayBuffer());
          const mimeType = blob.type || 'image/png';
          const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
          let media = null;
          if (isSupabaseStorageConfigured()) {
            const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
            const key = createMediaKey({
              userId: jarvisUser.id,
              kind: 'children-factory',
              extension,
              id: sha256,
            });
            media = await putMedia({
              key,
              body: buffer,
              contentType: mimeType,
              metadata: {
                user_id: jarvisUser.id,
                source: 'children_factory_v1',
                sha256,
                character: draft.character.name,
                scene: index,
              },
              upsert: true,
            });
          } else {
            throw Object.assign(new Error('Supabase Storage is not configured for Children Factory assets.'), { statusCode: 503 });
          }
          await consumeImageGeneration(jarvisUser.id, {
            prompt: `${draft.title} — Children Factory scene ${index}`.slice(0, 500),
            mode: 'children-factory-v1',
            sha256,
            media_path: media?.path || null,
          });
          imageResults.push({
            scene: index,
            sha256,
            media,
          });

          mission = await updateMissionForUser(jarvisUser.id, mission.id, {
            ...mission,
            metadata: {
              ...(mission.metadata || {}),
              images: imageResults,
              pipeline: buildChildrenFactoryPipeline({
                sceneAssetsStatus: imageResults.length === 3 ? 'completed' : 'running',
                approvalStatus: 'blocked',
              }),
            },
          }, {
            eventType: 'children_factory.scene_completed',
            message: `Children Factory scene ${index} completed and its asset was persisted.`,
            metadata: { scene: index, sha256, asset: media?.path || null },
          });
        } catch (sceneError) {
          try {
            mission = await updateMissionForUser(jarvisUser.id, mission.id, {
              ...mission,
              status: transitionMission(mission, 'failed').status,
              metadata: {
                ...(mission.metadata || {}),
                images: imageResults,
                factoryFailure: {
                  stage: 'scene_assets',
                  scene: index,
                  message: String(sceneError?.message || sceneError).slice(0, 1000),
                  recordedAt: new Date().toISOString(),
                  completedScenes: imageResults.length,
                },
                pipeline: buildChildrenFactoryPipeline({
                  sceneAssetsStatus: 'failed',
                  approvalStatus: 'blocked',
                }),
              },
              completedAt: new Date().toISOString(),
            }, {
              eventType: 'children_factory.failed',
              message: `Children Factory stopped at scene ${index}; partial progress was persisted for recovery.`,
              metadata: { scene: index, completedScenes: imageResults.length },
            });
          } catch (persistError) {
            console.error('JARVIS Children Factory failure checkpoint error:', persistError);
          }
          throw sceneError;
        }
      }

      return json(res, 201, {
        factory: 'children-v1',
        status: 'render_required',
        draft: {
          project,
          character,
          story: draft.story,
          characterBible: draft.character,
          images: imageResults,
          pipeline: buildChildrenFactoryPipeline({ approvalStatus: 'pending' }),
        },
        approvalGate: {
          required: true,
          status: 'render_required',
          missionId: mission.id,
          label: 'Render, Verify, then Request Approval',
          autoPublish: false,
          publishingProvider: 'youtube',
          note: 'JARVIS requires a completed verified video before approval can be requested. JARVIS never publishes automatically.'
        },
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('JARVIS Children Factory error:', error);
      return json(res, Number(error?.statusCode) || 502, {
        error: error instanceof Error ? error.message : 'Children Factory failed.',
        code: 'CHILDREN_FACTORY_FAILED',
      });
    }
  }

  if (req.method === 'GET' && pathname === '/api/plans') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const entitlement = await ensureJarvisEntitlement(jarvisUser.id);
    const countryHeader = String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').trim().toUpperCase();
    const region = /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : 'GLOBAL';
    const prices = await getRegionalPlanPrices(region);
    return json(res, 200, {
      entitlement,
      pricing: {
        region,
        currency: prices[0]?.currency || 'usd',
        provider: 'stripe',
        localized: region !== 'GLOBAL' && prices.some(price => price.region_code === region),
        plans: prices.map(price => ({
          code: price.plan_code,
          name: price.plan_name,
          currency: price.currency,
          unitAmount: price.unit_amount,
          interval: price.interval || 'month',
          stripePriceIdConfigured: Boolean(price.stripe_price_id),
        })),
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/tts/status') {
    return json(res, 200, {
      configured: Boolean(process.env.ELEVENLABS_API_KEY),
      provider: 'ElevenLabs',
      model: ELEVENLABS_MODEL,
    });
  }

  if (req.method === 'GET' && pathname === '/api/voice/settings') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const preferences = await getJarvisPreferences(jarvisUser.id);
    return json(res, 200, {
      voiceId: String(preferences?.voice_id || ELEVENLABS_DEFAULT_VOICE_ID || ''),
      voiceEnabled: preferences?.voice_enabled !== false,
    });
  }

  if (req.method === 'GET' && pathname === '/api/voices') {
    await requireAuthenticatedJarvisUser(req);
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) return json(res, 503, { error: 'ElevenLabs is not configured on this deployment.' });
    const response = await fetch(ELEVENLABS_VOICES_URL + '?page_size=50', {
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, { error: data?.detail?.message || data?.detail || 'ElevenLabs voice list request failed.' });
    const voices = Array.isArray(data?.voices) ? data.voices : [];
    return json(res, 200, {
      voices: voices.map(voice => ({
        voiceId: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description || '',
        labels: voice.labels || {},
        previewUrl: voice.preview_url || null,
      })),
      nextPageToken: data?.next_page_token || null,
    });
  }

  if (req.method === 'POST' && pathname === '/api/voice/select') {
    const input = await parseBody(req);
    const voiceId = String(input.voiceId || '').trim();
    if (!voiceId || !/^[A-Za-z0-9_-]{8,128}$/.test(voiceId)) return json(res, 400, { error: 'A valid ElevenLabs voice ID is required.' });
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) return json(res, 503, { error: 'ElevenLabs is not configured on this deployment.' });
    const response = await fetch('https://api.elevenlabs.io/v1/voices/' + encodeURIComponent(voiceId), {
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    });
    const voice = await response.json().catch(() => ({}));
    if (!response.ok || !voice?.voice_id) return json(res, 400, { error: 'That voice is not available to this JARVIS account.' });
    const current = await getJarvisPreferences(jarvisUser.id);
    const preferences = await updateJarvisPreferences(jarvisUser.id, { ...current, voice_id: voiceId });
    return json(res, 200, { ok: true, voiceId: preferences.voice_id, voice: { voiceId: voice.voice_id, name: voice.name, previewUrl: voice.preview_url || null } });
  }

  if (req.method === 'POST' && pathname === '/api/tts/synthesize') {
    const input = await parseBody(req);
    const text = String(input.text || '').trim();
    if (!text) return json(res, 400, { error: 'Text is required.' });
    if (text.length > 5000) return json(res, 400, { error: 'Text is limited to 5,000 characters.' });
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) return json(res, 503, { error: 'ElevenLabs is not configured on this deployment.' });
    const preferences = await getJarvisPreferences(jarvisUser.id);
    const voiceId = String(preferences?.voice_id || ELEVENLABS_DEFAULT_VOICE_ID || '').trim();
    if (!voiceId) return json(res, 503, { error: 'No ElevenLabs voice is configured for this JARVIS account.' });
    const response = await fetch(ELEVENLABS_TTS_URL + '/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 0.96 },
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, { error: errorBody.slice(0, 500) || 'ElevenLabs TTS request failed.' });
    }
    const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
    return json(res, 200, { audioContent: audio, mimeType: 'audio/mpeg', voiceId });
  }
  if (req.method === 'POST' && pathname === '/api/auth/sync') {
    const input = await parseBody(req);
    const accessToken = String(input.accessToken || '').trim();
    if (!accessToken) return json(res, 401, { error: 'Authentication token is required.' });
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !supabaseServerKey) return json(res, 503, { error: 'Supabase authentication is not configured on this deployment.' });
    const response = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: { apikey: supabaseServerKey, Authorization: 'Bearer ' + accessToken },
    });
    const user = await response.json().catch(() => ({}));
    if (!response.ok || !user?.id) return json(res, 401, { error: 'Your JARVIS session is invalid or expired.' });
    const jarvisUser = await ensureJarvisAuthUser(user);
    return json(res, 200, { ok: true, user: { id: jarvisUser.id, name: jarvisUser.name, email: jarvisUser.email || user.email || null } }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
  }

  if (req.method === 'GET' && pathname === '/api/chat/history') {
    const authenticated = await getOptionalAuthenticatedJarvisUser(req);
    if (!authenticated) return json(res, 200, { messages: [], persistent: false, guest: true });
    const history = await getConversationMessages(authenticated.jarvisUser.id, 100);
    return json(res, 200, { messages: history, persistent: true }, { 'Set-Cookie': jarvisCookie(authenticated.jarvisUser.id) });
  }

  if (req.method === 'GET' && pathname === '/api/memory') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const limit = Number(url.searchParams.get('limit') || 50);
    try {
      const rows = await listSemanticMemories(jarvisUser.id, limit);
      const memories = normalizeMemoryList(rows, limit);
      return json(res, 200, {
        memories,
        count: memories.length,
        persistent: true,
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('JARVIS memory list error:', error);
      return json(res, 502, { error: 'Could not load your JARVIS memories.' });
    }
  }

  if (req.method === 'DELETE' && pathname === '/api/memory') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const request = parseMemoryDeletionRequest(await parseBody(req));
    if (request.mode === 'invalid') {
      return json(res, 400, { error: request.reason, code: 'MEMORY_DELETE_CONFIRMATION_REQUIRED' });
    }

    try {
      const result = request.mode === 'all'
        ? await deleteAllSemanticMemories(jarvisUser.id)
        : await deleteSemanticMemory(jarvisUser.id, request.memoryId);

      return json(res, 200, {
        deleted: result.deleted,
        deletedCount: result.deletedCount,
        scope: request.mode,
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('JARVIS memory delete error:', error);
      return json(res, 502, { error: 'Could not delete the requested JARVIS memory.' });
    }
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/memory/')) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const memoryId = decodeURIComponent(pathname.slice('/api/memory/'.length));
    const request = parseMemoryDeletionRequest({ id: memoryId });
    if (request.mode === 'invalid') {
      return json(res, 400, { error: request.reason, code: 'INVALID_MEMORY_ID' });
    }

    try {
      const result = await deleteSemanticMemory(jarvisUser.id, request.memoryId);
      if (!result.deleted) {
        return json(res, 404, { error: 'That JARVIS memory was not found.' });
      }
      return json(res, 200, {
        deleted: true,
        deletedCount: result.deletedCount,
        scope: 'single',
        memoryId: request.memoryId,
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('JARVIS memory delete-by-id error:', error);
      return json(res, 502, { error: 'Could not delete the requested JARVIS memory.' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/chat') {
    return json(res, 200, {
      service: 'JARVIS chat',
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      openaiModels: getOpenAIModels(),
      reasoningThreshold: Number(process.env.OPENAI_REASONING_THRESHOLD || 3),
      supabaseServerConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      huggingFaceConfigured: Boolean(process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN),
      fallbackAvailable: Boolean(process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN),
    });
  }

  if (req.method === 'POST' && pathname === '/api/route') {
    const input = await parseBody(req);
    const messages = Array.isArray(input.messages)
      ? input.messages
        .filter(m => ['user', 'assistant'].includes(String(m?.role)) && String(m?.content || '').trim())
        .slice(-16)
        .map(m => ({ role: String(m.role), content: String(m.content).slice(0, 12000) }))
      : [];
    if (!messages.length) return json(res, 400, { error: 'A message is required.' });

    const authenticated = await getOptionalAuthenticatedJarvisUser(req);
    const route = routeIntent({
      messages,
      availableCapabilities: getAvailableCapabilities(),
      user: authenticated?.jarvisUser || null,
    });

    return json(res, 200, {
      route: { ...route, authenticatedUserId: null },
      evidence: {
        generatedAt: new Date().toISOString(),
        sideEffects: false,
        providerCalls: false,
      },
    }, authenticated?.jarvisUser ? { 'Set-Cookie': jarvisCookie(authenticated.jarvisUser.id) } : {});
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    const input = await parseBody(req);
    const messages = Array.isArray(input.messages)
      ? input.messages
        .filter(m => ['user', 'assistant'].includes(String(m?.role)) && String(m?.content || '').trim())
        .slice(-16)
        .map(m => ({ role: String(m.role), content: String(m.content).slice(0, 12000) }))
      : [];
    if (!messages.length) return json(res, 400, { error: 'A message is required.' });

    const authenticated = await getOptionalAuthenticatedJarvisUser(req);
    const userId = authenticated?.jarvisUser?.id || null;
    const latestUserMessage = String(messages[messages.length - 1]?.content || '').trim();
    const displayName = String(authenticated?.jarvisUser?.name || authenticated?.jarvisUser?.email || '').trim();
    const userIdentity = displayName ? `${displayName}'s` : 'the current user';
    const intentCandidates = rankCapabilitiesForIntent(latestUserMessage, 4);
    const route = routeIntent({
      messages,
      availableCapabilities: getAvailableCapabilities(),
      user: authenticated?.jarvisUser || null,
    });

    const childrenFactoryRoute = route.intent === 'children-story';

    const goalPlan = planGoal({ request: latestUserMessage });

    const imageAction = /\b(generate|create|make|draw|illustrate|render)\b/i.test(latestUserMessage);
    const imageNoun = /\b(image|picture|photo|illustration)\b/i.test(latestUserMessage);
    const imageRequest = imageAction && imageNoun;
    if (imageRequest) {
      if (!authenticated?.jarvisUser?.id) {
        return json(res, 401, { error: 'Sign in to generate images with JARVIS.' });
      }
      const entitlement = await getJarvisEntitlement(authenticated.jarvisUser.id) || await ensureJarvisEntitlement(authenticated.jarvisUser.id);
      const remainingBefore = Number(entitlement?.credits_remaining ?? 0);
      if (remainingBefore <= 0) {
        return json(res, 402, { error: 'Your image-generation allowance is used up for this billing period.' });
      }
      try {
        const blob = await generateHuggingFaceImage(latestUserMessage);
        const buffer = Buffer.from(await blob.arrayBuffer());
        const mimeType = blob.type || 'image/png';
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        let media = null;
        if (isSupabaseStorageConfigured()) {
          try {
            const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
            const key = createMediaKey({
              userId: authenticated.jarvisUser.id,
              kind: 'chat-image',
              extension,
              id: sha256,
            });
            media = await putMedia({
              key,
              body: buffer,
              contentType: mimeType,
              metadata: {
                user_id: authenticated.jarvisUser.id,
                source: 'chat_image_generate',
                sha256,
              },
              upsert: true,
            });
          } catch (storageError) {
            console.error('JARVIS chat image storage error:', storageError);
          }
        }

        const consumed = await consumeImageGeneration(authenticated.jarvisUser.id, {
          prompt: latestUserMessage.slice(0, 500),
          mode: 'chat-image',
          sha256,
          media_path: media?.path || null,
        });
        const responseText = `Done, ${displayName || 'there'}. I generated the image and opened it in Image Lab.`;
        await appendConversationMessages(authenticated.jarvisUser.id, [
          { role: 'user', content: latestUserMessage },
          { role: 'assistant', content: responseText },
        ]);
        return json(res, 200, {
          text: responseText,
          image: { data: buffer.toString('base64'), mimeType },
          media,
          evidence: { verified: true, sha256, stored: Boolean(media?.stored) },
          provider: 'Hugging Face Inference Providers',
          model: 'automatic image provider routing',
          persistent: true,
          guest: false,
          allowance: { remaining: Number(consumed?.credits_remaining ?? Math.max(0, remainingBefore - 1)) },
        }, { 'Set-Cookie': jarvisCookie(authenticated.jarvisUser.id) });
      } catch (error) {
        console.error('JARVIS chat image generation error:', error);
        return json(res, 502, { error: error instanceof Error ? error.message : 'Image generation failed.' });
      }
    }

    let semanticMemories = [];
    try {
      semanticMemories = userId ? await searchSemanticMemories(userId, latestUserMessage, {
        threshold: 0.72,
        count: 8,
      }) : [];
    } catch (memoryError) {
      console.error('Semantic memory retrieval error:', memoryError);
    }

    const memoryContext = semanticMemories.length
      ? `Relevant long-term memories for this user, ranked by relevance and importance:\n${semanticMemories.map((m, i) => `${i + 1}. [${String(m.memory_type || 'memory')}] ${String(m.content || '').trim()}`).join('\n')}\nUse only memories that genuinely help answer the current request. Prefer correction memories first when relevant, then identity, preferences, goals, project decisions, decision memories, and explicit instructions. Treat active JARVIS correction memories as the highest-priority user-provided update: when an older memory conflicts with a correction, use the correction as current truth and do not silently revive the superseded value. Corrections are not deletions; do not claim that older records were removed. Treat active JARVIS decision memories as user constraints: do not re-propose a rejected alternative unless the user explicitly reopens it or relevant circumstances have materially changed, and explain the change when appropriate. Do not mention the memory system unless asked.`
      : '';

    const timeContext = getTimeContextForRequest({
      latestUserMessage,
      route,
      memories: semanticMemories,
    });
    const memoryConsistency = detectMemoryContradictions(semanticMemories);
    const contradictionAwareness = buildContradictionInstruction(memoryConsistency);
    const timeAwareness = buildTimeAwarenessInstruction({
      timeContext,
      timeSensitive: timeContext.timeSensitive,
      potentiallyStaleMemoryCount: timeContext.potentiallyStaleMemoryCount,
    });

    const systemMessage = [
`You are JARVIS FUTURISTIC, the AI assistant for ${userIdentity}.`,
      `JARVIS was created by ${JARVIS_CREATOR_NAME}. If asked who created you, answer with that creator identity and do not confuse it with the current user's identity.`,
      capabilityContextForPrompt(),
      intentCandidates.length
        ? `Likely capabilities for the current request (hints, not execution): ${intentCandidates.map(item => item.id).join(', ')}`
        : 'No capability was confidently identified from simple routing hints; use reasoning and available tools rather than inventing a capability.',
      routeContextForPrompt(route),
      `Goal-to-Outcome planning metadata (planning only; never an authorization): ${JSON.stringify(goalPlan)}`,
      timeAwareness,
      contradictionAwareness,
      "The JARVIS application provides you with the current conversation messages and, when available, relevant long-term memories retrieved from its persistent memory system.",
      "Use the supplied conversation and memory context to maintain continuity. Do not claim that you cannot remember previous conversations when relevant history or memory is supplied.",
      "Do not describe yourself as ChatGPT, Claude, Hugging Face, or another underlying model unless the user explicitly asks which model/provider is being used.",
      "Do not output generic capability lists or generic knowledge-cutoff disclaimers unless the user explicitly asks for them.",
      "Be accurate, concise, friendly, and honest about capabilities. Do not claim an external action happened unless the connected service confirms it.",
      "Distinguish verified facts from inference. For current, latest, recent, source, or verification requests, never present unverified current details as confirmed. When evidence is insufficient, say so plainly instead of guessing. Never invent citations, sources, browsing, or verification.",
      "Never claim that an image, file, video, or other external asset was generated unless JARVIS actually received and returned that asset from its connected generation service. Never invent image URLs or markdown image links.",
      "For security topics, stay defensive and educational. For NEXORA, keep trading simulated/paper-only.",
      memoryContext,
    ].filter(Boolean).join('\n\n');

    const openaiKey = process.env.OPENAI_API_KEY || '';
    const hfToken = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
    const enableWebSearch = route.mode === 'search'
      && String(process.env.OPENAI_ENABLE_WEB_SEARCH || '').toLowerCase() === 'true';

    let text = '';
    let provider = '';
    let model = '';
    let intelligenceTier = '';
    let responseId = null;
    let webSearchUsed = false;

    if (openaiKey) {
      try {
        const result = await generateIntelligentResponse({
          apiKey: openaiKey,
          instructions: systemMessage,
          messages,
          latestUserMessage,
          route,
          enableWebSearch,
        });
        text = result.text;
        provider = result.provider;
        model = result.model;
        intelligenceTier = result.tier;
        responseId = result.responseId || null;
        webSearchUsed = Boolean(result.webSearchUsed);
      } catch (error) {
        console.error('JARVIS OpenAI intelligence core failed:', error?.statusCode || '', error?.message || error);
      }
    }

    if (!text && hfToken) {
      const response = await fetch(HF_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: HF_MODEL,
          messages: [
            { role: 'system', content: systemMessage },
            ...messages,
          ],
          max_tokens: 1200,
          temperature: 0.7,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const providerError = data?.error;
        const message = providerError?.message || providerError?.detail || providerError?.error
          || (typeof providerError === 'string' ? providerError : null)
          || (providerError && typeof providerError === 'object' ? JSON.stringify(providerError) : null)
          || 'JARVIS AI core request failed.';
        console.error('JARVIS Hugging Face request failed:', response.status, message);
        return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, {
          error: String(message),
          code: 'AI_PROVIDER_REQUEST_FAILED',
          provider: 'Hugging Face Inference Providers',
        });
      }
      text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (text) {
        provider = 'Hugging Face Inference Providers';
        model = HF_MODEL;
        intelligenceTier = 'fallback';
        webSearchUsed = false;
      }
    }

    if (!text) {
      return json(res, 503, {
        error: openaiKey || hfToken
          ? 'JARVIS AI core returned no usable response.'
          : 'JARVIS AI core is not configured on this deployment. Add OPENAI_API_KEY in Vercel Environment Variables.',
      });
    }

    const initialSelfCheck = selfCheckAndNormalize(text, {
      request: latestUserMessage,
      provider,
    });
    text = initialSelfCheck.text;
    let selfCheck = initialSelfCheck.after;
    let selfRepairAttempted = false;
    let selfRepairSucceeded = false;

    if (!selfCheck.ok) {
      if (!selfCheck.repairable) {
        return json(res, 502, {
          error: 'JARVIS self-check rejected the response because the detected failure is not safely repairable.',
          code: 'SELF_CHECK_FAILED',
          issues: selfCheck.issues.map(item => item.code),
        });
      }

      selfRepairAttempted = true;
      const uncertaintySignal = assessUncertainty({ latestUserMessage, route, responseText: text, webSearchUsed });
      const repairInstruction = buildRepairInstruction(selfCheck) + (uncertaintySignal.shouldSignal ? '\\n\\n' + buildEpistemicInstruction(uncertaintySignal) : '');
      let repairedText = '';

      try {
        if (provider === 'OpenAI Responses API' && openaiKey) {
          const repaired = await generateIntelligentResponse({
            apiKey: openaiKey,
            instructions: systemMessage + '\n\n' + repairInstruction,
            messages: [...messages, { role: 'assistant', content: text }],
            latestUserMessage,
            route,
            enableWebSearch: false,
          });
          repairedText = repaired.text;
          provider = repaired.provider;
          model = repaired.model;
          intelligenceTier = repaired.tier;
          responseId = repaired.responseId || responseId;
        } else if (provider === 'Hugging Face Inference Providers' && hfToken) {
          const response = await fetch(HF_CHAT_URL, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + hfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: HF_MODEL,
              messages: [
                { role: 'system', content: systemMessage + '\n\n' + repairInstruction },
                ...messages,
                { role: 'assistant', content: text },
              ],
              max_tokens: 1200,
              temperature: 0.3,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) repairedText = String(data?.choices?.[0]?.message?.content || '').trim();
        }
      } catch (repairError) {
        console.error('JARVIS self-repair attempt failed:', repairError?.message || repairError);
      }

      if (repairedText) {
        const repairedCheck = selfCheckAndNormalize(repairedText, {
          request: latestUserMessage,
          provider,
        });
        if (repairedCheck.after.ok) {
          text = repairedCheck.text;
          selfCheck = repairedCheck.after;
          selfRepairSucceeded = true;
        } else {
          selfCheck = repairedCheck.after;
        }
      }
    }

    if (!selfCheck.ok) {
      return json(res, 502, {
        error: 'JARVIS self-check could not produce a verified user-facing response.',
        code: 'SELF_CHECK_FAILED',
        issues: selfCheck.issues.map(item => item.code),
        repairAttempted: selfRepairAttempted,
      });
    }

    if (userId && latestUserMessage.length >= 12) {
      const decision = parseExplicitDecision(latestUserMessage);
      const memory = classifyMemory(latestUserMessage);
      try {
        if (memory.type === 'correction' && memory.correction) {
          await saveSemanticMemory(
            userId,
            formatCorrectionMemory(memory.correction),
            {
              source: 'explicit_user_correction',
              importance: 0.99,
              correction: true,
              scope: memory.correction.scope,
              field: memory.correction.field,
              previous: memory.correction.previous,
              current: memory.correction.current,
            },
            'correction',
          );
        } else if (decision) {
          await saveSemanticMemory(
            userId,
            formatDecisionMemory(decision),
            {
              source: 'chat',
              importance: 0.97,
              decision: decision.decision,
              rationale: decision.rationale,
              rejected: decision.rejected,
              scope: decision.scope,
            },
            'decision',
          );
        } else {
          await saveSemanticMemory(userId, latestUserMessage, {
            source: 'chat',
            importance: memory.importance,
          }, memory.type);
        }
      } catch (memoryError) {
        console.error('Semantic memory save error:', memoryError);
      }
    }

    if (userId) {
      await appendConversationMessages(userId, [
        { role: 'user', content: latestUserMessage },
        { role: 'assistant', content: text },
      ]);
    }

    return json(
      res,
      200,
      {
        text,
        provider,
        model,
        intelligenceTier,
        responseId,
        persistent: Boolean(userId),
        guest: !userId,
        planning: goalPlan,
        verification: {
          selfCheck: selfRepairSucceeded ? 'repaired-and-verified' : 'passed',
          repairAttempted: selfRepairAttempted,
          detectedIssues: initialSelfCheck.before.issues.map(item => item.code),
          epistemic: assessUncertainty({ latestUserMessage, route, responseText: text, webSearchUsed }),
          time: timeContext,
          memoryConsistency,
        },
        routing: {
        mode: route.mode,
        intent: route.intent || 'chat',
        factory: childrenFactoryRoute ? 'children-v1' : null,
        factoryEndpoint: childrenFactoryRoute ? '/api/factory/children' : null,
        candidateCapabilities: route.candidateCapabilities.map(item => item.id),
        referencesDetected: route.references.length,
        needsClarification: route.needsClarification,
        surface: route.surface,
        surfaceAction: route.surfaceAction,
        surfaceReason: route.surfaceReason,
      } },
      userId ? { 'Set-Cookie': jarvisCookie(userId) } : {},
    );
  }

  if (req.method === 'GET' && pathname === '/api/youtube/status') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const connection = await getYouTubeConnection(jarvisUser.id);
    return json(res, 200, {
      configured: Boolean(YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && PUBLIC_URL),
      connected: Boolean(connection),
      channel: connection ? {
        id: connection.channel_id || connection.channelId,
        title: connection.channel_title || connection.channelTitle,
        connectedAt: connection.connected_at || connection.connectedAt,
      } : null,
    }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
  }

  if (req.method === 'GET' && pathname === '/api/youtube/connect') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !PUBLIC_URL) {
      return json(res, 503, { error: 'YouTube OAuth is not configured. Add GOOGLE_YOUTUBE_CLIENT_ID, GOOGLE_YOUTUBE_CLIENT_SECRET and PUBLIC_URL.' });
    }
    const state = crypto.randomUUID();
    const redirectUri = `${PUBLIC_URL}/api/youtube/callback`;
    await saveOAuthState(state, redirectUri, jarvisUser.id);
    const params = new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
      state,
    });
    return json(res, 200, { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
  }

  if (req.method === 'GET' && pathname === '/api/youtube/analytics') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const connection = await getYouTubeConnection(jarvisUser.id);
    if (!connection) return json(res, 409, { error: 'Connect YouTube before requesting analytics.', code: 'YOUTUBE_NOT_CONNECTED' });
    try {
      const token = await getYouTubeAccessToken(connection);
      if (token.refreshed) {
        await saveYouTubeConnection(jarvisUser.id, {
          ...connection,
          accessToken: token.accessToken,
          expiresAt: token.expiresAt,
        });
      }
      const endDate = String(url.searchParams.get('endDate') || new Date().toISOString().slice(0, 10));
      const startDate = String(url.searchParams.get('startDate') || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return json(res, 400, { error: 'startDate and endDate must use YYYY-MM-DD.' });
      }
      const analytics = await getYouTubeAnalytics(token.accessToken, { startDate, endDate });
      return json(res, 200, { startDate, endDate, analytics }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      return json(res, Number(error?.statusCode) || 502, { error: error instanceof Error ? error.message : 'YouTube Analytics failed.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/youtube/publish') {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const missionId = String(body?.missionId || '').trim();
    const mediaKey = String(body?.mediaKey || '').trim();
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const privacyStatus = String(body?.privacyStatus || 'private').trim();
    const tags = Array.isArray(body?.tags) ? body.tags.map(String).map(v => v.trim()).filter(Boolean).slice(0, 30) : [];
    if (!missionId || !mediaKey || !title) return json(res, 400, { error: 'missionId, mediaKey, and title are required.' });
    if (!['private', 'unlisted', 'public'].includes(privacyStatus)) return json(res, 400, { error: 'privacyStatus must be private, unlisted, or public.' });
    if (title.length > 100 || Buffer.byteLength(description, 'utf8') > 5000) return json(res, 400, { error: 'YouTube title/description limits were exceeded.' });
    if (!mediaKey.startsWith(`jarvis/${jarvisUser.id}/`)) return json(res, 403, { error: 'That media asset does not belong to this JARVIS user.' });

    const mission = await getMissionForUser(jarvisUser.id, missionId);
    if (!mission) return json(res, 404, { error: 'Approval mission not found.' });
    if (mission.approval?.status !== 'approved') {
      return json(res, 409, { error: 'YouTube publishing requires an approved JARVIS mission.', code: 'YOUTUBE_APPROVAL_REQUIRED', mission });
    }
    if (mission.metadata?.factory === 'children-v1' && !canPublishChildrenFactoryMission(mission)) {
      return json(res, 409, { error: 'Children Factory publishing requires a completed, verified video render and approval.', code: 'CHILDREN_FACTORY_PIPELINE_INCOMPLETE', mission });
    }
    if (mission.metadata?.youtube?.videoId) {
      return json(res, 409, { error: 'This mission has already been published to YouTube.', code: 'YOUTUBE_ALREADY_PUBLISHED', mission });
    }
    if (mission.metadata?.factory === 'children-v1' && mission.metadata?.renderedVideo?.mediaKey !== mediaKey) {
      return json(res, 409, { error: 'The selected video asset is not the verified render bound to this Children Factory mission.', code: 'YOUTUBE_ASSET_MISMATCH' });
    }
    const connection = await getYouTubeConnection(jarvisUser.id);
    if (!connection) return json(res, 409, { error: 'Connect YouTube before publishing.', code: 'YOUTUBE_NOT_CONNECTED' });

    try {
      const media = await getMedia({ key: mediaKey });
      if (!String(media.contentType).startsWith('video/')) {
        return json(res, 400, { error: 'The selected media asset is not a video.' });
      }
      const token = await getYouTubeAccessToken(connection);
      if (token.refreshed) {
        await saveYouTubeConnection(jarvisUser.id, { ...connection, accessToken: token.accessToken, expiresAt: token.expiresAt });
      }
      const video = await uploadYouTubeVideo(token.accessToken, {
        videoBuffer: media.body,
        contentType: media.contentType,
        body: {
          snippet: { title, description, tags, categoryId: '24' },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: Boolean(body?.madeForKids),
          },
        },
      });
      const videoId = String(video.id || '').trim();
      if (!videoId) return json(res, 502, { published: false, provider: 'youtube', error: 'YouTube did not return a video id.' });
      const evidence = {
        provider: 'youtube',
        videoId,
        url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        privacyStatus,
        mediaKey,
        publishedAt: new Date().toISOString(),
      };
      let missionUpdated = false;
      try {
        const completed = transitionMission(mission, 'succeeded');
        completed.lastEvidence = evidence;
        completed.metadata = { ...(mission.metadata || {}), youtube: evidence };
        await updateMissionForUser(jarvisUser.id, mission.id, completed, {
          eventType: 'mission.published',
          message: 'YouTube confirmed the upload and the mission was completed with verified evidence.',
          metadata: evidence,
        });
        missionUpdated = true;
      } catch (missionError) {
        console.error('YouTube mission completion update failed:', missionError);
      }
      return json(res, 200, {
        published: true,
        provider: 'youtube',
        videoId,
        url: evidence.url,
        status: video.status || null,
        missionUpdated,
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('YouTube publish error:', error);
      return json(res, Number(error?.statusCode) || 502, {
        published: false,
        provider: 'youtube',
        error: error instanceof Error ? error.message : 'YouTube publishing failed.',
      });
    }
  }

  if (req.method === 'GET' && pathname === '/api/youtube/callback') {
    const state = String(url.searchParams.get('state') || '');
    const code = String(url.searchParams.get('code') || '');
    const errorMessage = String(url.searchParams.get('error') || '');
    if (errorMessage) return redirect(res, `/?youtube=error&message=${encodeURIComponent('Google authorization was not completed.')}`);
    const pending = await getOAuthState(state);
    if (!pending || !code || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return redirect(res, '/?youtube=error&message=Authorization%20session%20expired');
    }
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          redirect_uri: pending.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed.');
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const channelData = await channelResponse.json();
      const channel = channelData?.items?.[0];
      if (!channel?.id) throw new Error('No YouTube channel was returned.');
      const youtubeConnection = {
        channelId: String(channel.id),
        channelTitle: String(channel.snippet?.title || 'YouTube Channel'),
        refreshToken: String(tokenData.refresh_token || ''),
        accessToken: String(tokenData.access_token),
        expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
        connectedAt: new Date().toISOString(),
      };
      if (!pending.userId) throw new Error('YouTube authorization is missing its JARVIS user binding.');
      await saveYouTubeConnection(pending.userId, youtubeConnection);
      await deleteOAuthState(state);
      return redirect(res, `/?youtube=connected&message=${encodeURIComponent(`YouTube connected: ${youtubeConnection.channelTitle}.`)}`);
    } catch (error) {
      console.error('YouTube OAuth callback error:', error);
      return redirect(res, `/?youtube=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'YouTube connection failed.')}`);
    }
  }

  if (req.method === 'GET' && pathname === '/api/image/diagnostics') {
    const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
    const modelChecks = await Promise.all(HF_IMAGE_MODELS.map(async model => {
      try {
        const response = await fetch('https://huggingface.co/api/models/' + model);
        return { model, available: response.ok, status: response.status };
      } catch (error) {
        return { model, available: false, status: 0, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    let tokenValid = false;
    let tokenStatus = token ? 0 : null;
    if (token) {
      try {
        const response = await fetch('https://huggingface.co/api/whoami-v2', {
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        });
        tokenValid = response.ok;
        tokenStatus = response.status;
      } catch {
        tokenStatus = 0;
      }
    }
    return json(res, 200, {
      imageLab: 'ready',
      tokenConfigured: Boolean(token),
      tokenValid,
      tokenStatus,
      providers: HF_IMAGE_PROVIDERS,
      generationModels: HF_IMAGE_MODELS,
      editModels: HF_IMAGE_EDIT_MODELS,
      modelChecks,
    });
  }

  if (req.method === 'POST' && (pathname === '/api/image/generate' || pathname === '/api/image/edit')) {
    const { jarvisUser } = await requireAuthenticatedJarvisUser(req);
    const body = await parseBody(req);
    const prompt = String(body?.prompt || '').trim();
    if (!prompt) return json(res, 400, { error: 'An image prompt is required.' });
    const reference = body?.referenceImage && typeof body.referenceImage === 'object' ? body.referenceImage : null;
    if (pathname === '/api/image/edit' && !reference?.data) {
      return json(res, 400, { error: 'A reference image is required for image editing.' });
    }
    const entitlement = await getJarvisEntitlement(jarvisUser.id) || await ensureJarvisEntitlement(jarvisUser.id);
    const remainingBefore = Number(entitlement?.credits_remaining ?? 0);
    if (remainingBefore <= 0) {
      return json(res, 402, { error: 'Your image-generation allowance is used up for this billing period.' });
    }
    try {
      const blob = await generateHuggingFaceImage(
        prompt,
        pathname.endsWith('/edit') ? reference : null
      );
      const consumed = await consumeImageGeneration(jarvisUser.id, { prompt: prompt.slice(0, 500), mode: pathname.endsWith('/edit') ? 'edit' : 'generate' });
      const buffer = Buffer.from(await blob.arrayBuffer());
      const mimeType = blob.type || 'image/png';
      let media = null;
      if (isSupabaseStorageConfigured()) {
        const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
        try {
          const key = createMediaKey({ userId: jarvisUser.id, kind: pathname.endsWith('/edit') ? 'image-edit' : 'image', extension });
          media = await putMedia({
            key,
            body: buffer,
            contentType: mimeType,
            metadata: { user_id: jarvisUser.id, source: pathname.endsWith('/edit') ? 'image_edit' : 'image_generate' },
          });
        } catch (storageError) {
          console.error('JARVIS Supabase Storage upload error:', storageError);
        }
      }
      return json(res, 200, {
        image: { data: buffer.toString('base64'), mimeType },
        media,
        allowance: { remaining: Number(consumed?.credits_remaining ?? remainingBefore - 1) },
      }, { 'Set-Cookie': jarvisCookie(jarvisUser.id) });
    } catch (error) {
      console.error('JARVIS image generation error:', error);
      return json(res, 502, { error: error instanceof Error ? error.message : 'Image generation failed.' });
    }
  }

  return json(res, 404, { error: 'API route not found.' });
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname, url);

    const file = safePath(url.pathname);
    if (!file) return json(res, 403, { error: 'Forbidden' });
    fs.stat(file, (error, stat) => {
      if (!error && stat.isFile()) {
        res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
        return;
      }
      const index = path.join(DIST, 'index.html');
      if (fs.existsSync(index)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        fs.createReadStream(index).pipe(res);
      } else {
        json(res, 404, { error: 'JARVIS build not found. Run npm run build first.' });
      }
    });
  } catch (error) {
    console.error('JARVIS server error:', error);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error.' });
  }
});

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isMainModule && process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS listening on port ${PORT}`);
  });
}
