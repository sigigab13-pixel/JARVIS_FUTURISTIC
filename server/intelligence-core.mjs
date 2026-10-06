const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
import { extractWebCitations } from './provenance-core.mjs';

export const DEFAULT_FAST_MODEL = 'gpt-6-luna';
export const DEFAULT_REASONING_MODEL = 'gpt-6.1-sol';

const COMPLEX_MODES = new Set(['search', 'inspect', 'execute', 'manage', 'decide']);
const COMPLEX_INTENTS = new Set(['repair', 'children-story', 'image']);

function cleanText(value, max = 12000) {
  return String(value ?? '').trim().slice(0, max);
}

export function getOpenAIModels(env = process.env) {
  return {
    fast: cleanText(env.OPENAI_FAST_MODEL || env.OPENAI_MODEL || DEFAULT_FAST_MODEL, 120),
    reasoning: cleanText(env.OPENAI_REASONING_MODEL || DEFAULT_REASONING_MODEL, 120),
  };
}

export function estimateComplexity({ latestUserMessage = '', route = null } = {}) {
  const text = cleanText(latestUserMessage, 4000).toLowerCase();
  let score = 0;

  if (text.length > 800) score += 1;
  if (text.length > 2000) score += 1;
  if (/\\b(why|how|compare|design|architect|debug|diagnose|analy[sz]e|research|plan|strategy|trade-?off|pros? and cons?|what should)\\b/.test(text)) score += 2;
  if (/\\b(latest|current|today|yesterday|online|search|source|verify)\\b/.test(text)) score += 2;
  if ((text.match(/\\?/g) || []).length >= 2) score += 1;
  if (route?.mode && COMPLEX_MODES.has(route.mode)) score += 2;
  if (route?.intent && COMPLEX_INTENTS.has(route.intent)) score += 1;
  if (route?.references?.some(item => item?.requiresResolution)) score += 1;

  return Math.min(8, score);
}

export function chooseModel({ latestUserMessage = '', route = null, env = process.env } = {}) {
  const models = getOpenAIModels(env);
  const complexity = estimateComplexity({ latestUserMessage, route });
  const useReasoning = complexity >= Number(env.OPENAI_REASONING_THRESHOLD || 3);
  return {
    model: useReasoning ? models.reasoning : models.fast,
    tier: useReasoning ? 'reasoning' : 'fast',
    complexity,
  };
}

function normalizeMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter(item => item && ['user', 'assistant'].includes(item.role))
    .map(item => ({ role: item.role, content: cleanText(item.content) }))
    .filter(item => item.content)
    .slice(-24);
}

function extractOutputText(data) {
  const direct = cleanText(data?.output_text, 20000);
  if (direct) return direct;
  const output = Array.isArray(data?.output) ? data.output : [];
  const chunks = [];
  for (const item of output) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === 'string') chunks.push(part.text);
    }
  }
  return cleanText(chunks.join(''), 20000);
}

function buildReasoningOptions({ tier, enableWebSearch }) {
  const options = {};
  if (tier === 'reasoning') options.reasoning = { effort: 'medium' };
  if (enableWebSearch) options.tools = [{ type: 'web_search' }];
  return options;
}

export async function callOpenAIResponses({
  apiKey,
  model,
  tier = 'fast',
  instructions,
  messages,
  enableWebSearch = false,
  signal,
  fetchImpl = fetch,
}) {
  if (!String(apiKey || '').trim()) {
    throw Object.assign(new Error('OPENAI_API_KEY is not configured.'), { code: 'OPENAI_NOT_CONFIGURED', statusCode: 503 });
  }

  const normalizedMessages = normalizeMessages(messages);
  if (!normalizedMessages.length) {
    throw Object.assign(new Error('At least one chat message is required.'), { code: 'OPENAI_EMPTY_INPUT', statusCode: 400 });
  }

  const body = {
    model,
    instructions: cleanText(instructions, 30000),
    input: normalizedMessages,
    max_output_tokens: 1800,
    ...buildReasoningOptions({ tier, enableWebSearch }),
  };

  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError = data?.error;
    const message = providerError?.message
      || (typeof providerError === 'string' ? providerError : null)
      || 'OpenAI Responses API request failed.';
    throw Object.assign(new Error(String(message).slice(0, 1000)), {
      code: 'OPENAI_REQUEST_FAILED',
      statusCode: response.status,
      providerStatus: response.status,
      providerError: providerError || null,
    });
  }

  const text = extractOutputText(data);
  if (!text) {
    throw Object.assign(new Error('OpenAI returned no usable response text.'), {
      code: 'OPENAI_EMPTY_RESPONSE',
      statusCode: 502,
    });
  }

  return {
    text,
    provider: 'OpenAI Responses API',
    model,
    tier,
    responseId: cleanText(data?.id, 200),
    usage: data?.usage || null,
    webSearchUsed: Array.isArray(data?.output) && data.output.some(item => String(item?.type || '').includes('search')),
    webCitations: extractWebCitations(data),
  };
}

export async function generateIntelligentResponse({
  apiKey,
  instructions,
  messages,
  latestUserMessage,
  route,
  env = process.env,
  enableWebSearch = false,
  signal,
  fetchImpl = fetch,
}) {
  const selected = chooseModel({ latestUserMessage, route, env });
  try {
    return await callOpenAIResponses({
      apiKey,
      model: selected.model,
      tier: selected.tier,
      instructions,
      messages,
      enableWebSearch,
      signal,
      fetchImpl,
    });
  } catch (error) {
    if (selected.tier !== 'reasoning') throw error;
    const models = getOpenAIModels(env);
    if (models.fast === selected.model) throw error;
    return callOpenAIResponses({
      apiKey,
      model: models.fast,
      tier: 'fast',
      instructions,
      messages,
      enableWebSearch,
      signal,
      fetchImpl,
    });
  }
}
