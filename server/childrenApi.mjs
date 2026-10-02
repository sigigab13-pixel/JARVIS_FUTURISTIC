import { buildChildrenStoryPrompt, normalizeChildrenStory } from './childrenStudio.mjs';
import { buildClipDirectorPrompt, normalizeClipPlan } from './clipDirector.mjs';
import { buildCharacterBiblePrompt, normalizeCharacterBible } from './characterBible.mjs';
import { buildSceneDirectorPrompt, normalizeScenePlan } from './sceneDirector.mjs';
import { checkCharacterContinuity } from './continuityGuard.mjs';
import { buildLipSyncPrompt, normalizeLipSyncPlan } from './lipSyncDirector.mjs';
import { runProductionQa } from './productionQa.mjs';
import { buildStoryPack, validateStoryPack } from './storyPack.mjs';
import { buildTimelinePlan } from './timelineDirector.mjs';
import { buildVisualMotionPrompt, normalizeVisualMotionPlan } from './visualMotionDirector.mjs';
import { buildVoiceAudioPrompt, normalizeVoiceAudioPlan } from './voiceAudioDirector.mjs';
import { buildGenerationPlan } from './generationGateway.mjs';

const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST');
  return json(res, 405, { error: 'Method not allowed' });
}

async function callHf({ token, system, prompt, maxTokens, temperature }) {
  const response = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error || 'Hugging Face request failed.';
    const error = new Error(String(message));
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
}

export async function handleChildrenApi(req, res, pathname, body = {}) {
  if (!pathname.startsWith('/api/children/')) return false;
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return true;
  }

  try {
    if (pathname === '/api/children/continuity') {
      return json(res, 200, checkCharacterContinuity(body));
    }

    if (pathname === '/api/children/story-pack') {
      const pack = buildStoryPack(body);
      const validation = validateStoryPack(pack);
      if (!validation.valid) return json(res, 400, { error: 'Invalid story pack', details: validation.errors });
      return json(res, 200, pack);
    }

    if (pathname === '/api/children/timeline') {
      return json(res, 200, buildTimelinePlan(body));
    }

    if (pathname === '/api/children/qa') {
      return json(res, 200, runProductionQa(body));
    }

    if (pathname === '/api/children/generation-plan') {
      return json(res, 200, buildGenerationPlan(body));
    }

    const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
    if (!token) return json(res, 503, { error: 'JARVIS AI core is not configured.' });

    if (pathname === '/api/children/story') {
      const prompt = buildChildrenStoryPrompt(body);
      const content = await callHf({
        token,
        system: 'You are JARVIS Children Story Director. Produce original, child-safe stories. Never claim media has been rendered or published.',
        prompt,
        maxTokens: 1600,
        temperature: 0.8,
      });
      if (!content) return json(res, 502, { error: 'The AI core returned no content.' });
      return json(res, 200, normalizeChildrenStory(content));
    }

    if (pathname === '/api/children/clips') {
      const prompt = buildClipDirectorPrompt(body);
      const content = await callHf({
        token,
        system: 'You are JARVIS Clip Director. Produce concise, original, child-safe production plans. Never claim that a clip has been rendered or published.',
        prompt,
        maxTokens: 1200,
        temperature: 0.7,
      });
      if (!content) return json(res, 502, { error: 'Clip planner returned no content.' });
      return json(res, 200, normalizeClipPlan(content));
    }

    if (pathname === '/api/children/characters') {
      const prompt = buildCharacterBiblePrompt(body);
      const content = await callHf({
        token,
        system: 'You are JARVIS Character Bible Director. Return structured, original, child-safe production planning. Never claim that characters have been rendered or visually verified.',
        prompt,
        maxTokens: 5000,
        temperature: 0.4,
      });
      return json(res, 200, normalizeCharacterBible(content));
    }

    if (pathname === '/api/children/scenes') {
      const prompt = buildSceneDirectorPrompt(body);
      const content = await callHf({
        token,
        system: 'You are JARVIS Scene Director. Return structured, original, child-safe production planning. Never claim that scenes have been rendered or published.',
        prompt,
        maxTokens: 5000,
        temperature: 0.5,
      });
      if (!content) return json(res, 502, { error: 'The AI returned no scene plan.' });
      return json(res, 200, normalizeScenePlan(content));
    }

    if (pathname === '/api/children/lipsync') {
      const prompt = buildLipSyncPrompt(body)
        .replace('__CHARACTERS__', JSON.stringify(body.characters || []).slice(0, 5000))
        .replace('__SCENES__', JSON.stringify(body.scenes || []).slice(0, 18000));
      const content = await callHf({
        token,
        system: 'You are JARVIS Lip-Sync Director. Return valid JSON planning only. Never claim lip-sync has been generated or rendered.',
        prompt,
        maxTokens: 5000,
        temperature: 0.3,
      });
      if (!content) throw new Error('The model returned no lip-sync plan.');
      return json(res, 200, normalizeLipSyncPlan(content));
    }

    if (pathname === '/api/children/visual-motion') {
      const prompt = buildVisualMotionPrompt(body);
      const content = await callHf({
        token,
        system: 'You are JARVIS Visual and Motion Director. Return structured, original, child-safe production planning. Never claim images or video have been generated.',
        prompt,
        maxTokens: 5000,
        temperature: 0.45,
      });
      return json(res, 200, normalizeVisualMotionPlan(content));
    }

    if (pathname === '/api/children/voice-audio') {
      const prompt = buildVoiceAudioPrompt(body);
      const content = await callHf({
        token,
        system: 'You are JARVIS Voice and Audio Director. Return structured, original, child-safe production planning. Never claim audio has been generated.',
        prompt,
        maxTokens: 4500,
        temperature: 0.4,
      });
      return json(res, 200, normalizeVoiceAudioPlan(content));
    }

    return json(res, 404, { error: 'Children Content route not found.' });
  } catch (error) {
    const status = Number(error?.statusCode) || 400;
    return json(res, status, { error: error?.message || 'Children Content request failed.' });
  }
}
