const MAX_WEB_SOURCES = 10;

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeWebSource(item) {
  const url = clean(item?.url, 2000);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return {
    type: 'live_web',
    title: clean(item?.title, 240) || url,
    url,
    evidence: 'external',
  };
}

export function extractWebCitations(data) {
  const sources = [];
  const seen = new Set();

  const add = (item) => {
    const source = normalizeWebSource(item);
    if (!source || seen.has(source.url)) return;
    seen.add(source.url);
    sources.push(source);
  };

  for (const outputItem of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(outputItem?.content) ? outputItem.content : []) {
      for (const annotation of Array.isArray(part?.annotations) ? part.annotations : []) {
        if (annotation?.type === 'url_citation') add(annotation);
      }
    }

    if (outputItem?.type === 'web_search_call') {
      const actionSources = outputItem?.action?.sources;
      for (const source of Array.isArray(actionSources) ? actionSources : []) add(source);
    }
  }

  return sources.slice(0, MAX_WEB_SOURCES);
}

export function buildProvenance({
  messageCount = 0,
  memoryCount = 0,
  webSearchUsed = false,
  webCitations = [],
  provider = '',
} = {}) {
  const sources = [];
  const safeMemoryCount = Math.max(0, Math.min(Number(memoryCount) || 0, 50));
  const safeMessageCount = Math.max(0, Math.min(Number(messageCount) || 0, 50));
  const normalizedWeb = Array.isArray(webCitations)
    ? webCitations.map(normalizeWebSource).filter(Boolean).slice(0, MAX_WEB_SOURCES)
    : [];

  if (safeMessageCount > 0) {
    sources.push({
      type: 'conversation',
      title: 'Current conversation',
      evidence: 'user_context',
    });
  }

  if (safeMemoryCount > 0) {
    sources.push({
      type: 'saved_memory',
      title: safeMemoryCount === 1 ? '1 saved memory' : safeMemoryCount + ' saved memories',
      evidence: 'user_saved',
    });
  }

  sources.push(...normalizedWeb);

  const basis = [];
  if (normalizedWeb.length > 0) basis.push('externally_verified_web');
  else if (webSearchUsed) basis.push('live_web_search_without_citation');
  if (safeMemoryCount > 0) basis.push('saved_user_memory');
  if (safeMessageCount > 0) basis.push('conversation_context');
  basis.push('model_inference');

  const evidenceLevel = normalizedWeb.length > 0
    ? 'externally_verified'
    : webSearchUsed
      ? 'live_search_no_citation'
      : safeMemoryCount > 0 || safeMessageCount > 0
        ? 'contextual'
        : 'inferred';

  return {
    evidenceLevel,
    basis,
    sources,
    provider: clean(provider, 120),
    webSearchUsed: Boolean(webSearchUsed),
    webSourceCount: normalizedWeb.length,
    note: normalizedWeb.length > 0
      ? 'Live web sources are listed from provider-returned citations or search sources.'
      : webSearchUsed
        ? 'Live web search ran, but no provider citation was returned; current claims are not independently sourced here.'
        : 'Model inference is not independent external verification.',
  };
}

export const PROVENANCE_LIMITS = {
  maxWebSources: MAX_WEB_SOURCES,
};