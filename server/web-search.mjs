const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 6;
const DEFAULT_TIMEOUT_MS = 12000;

export function isWebSearchConfigured() {
  return Boolean(String(process.env.TAVILY_API_KEY || '').trim());
}

function normalizeQuery(query) {
  return String(query || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
}

function cleanText(value, max = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function searchWeb(query, { maxResults = MAX_RESULTS, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const apiKey = String(process.env.TAVILY_API_KEY || '').trim();
  const normalizedQuery = normalizeQuery(query);

  if (!apiKey) {
    throw Object.assign(new Error('Live web search is not configured. Add TAVILY_API_KEY to the JARVIS server environment.'), {
      statusCode: 503,
      code: 'WEB_SEARCH_NOT_CONFIGURED',
    });
  }
  if (!normalizedQuery) {
    throw Object.assign(new Error('A search query is required.'), { statusCode: 400, code: 'WEB_SEARCH_QUERY_REQUIRED' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        topic: 'general',
        search_depth: 'basic',
        max_results: Math.min(Math.max(Number(maxResults) || MAX_RESULTS, 1), MAX_RESULTS),
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.detail || data?.error || 'Tavily web search failed.';
      throw Object.assign(new Error(String(detail)), {
        statusCode: response.status === 429 ? 429 : 502,
        code: response.status === 429 ? 'WEB_SEARCH_RATE_LIMITED' : 'WEB_SEARCH_PROVIDER_FAILED',
      });
    }

    const results = Array.isArray(data?.results)
      ? data.results.map((item, index) => ({
          rank: index + 1,
          title: cleanText(item?.title, 220),
          url: String(item?.url || '').trim(),
          snippet: cleanText(item?.content, 1000),
          publishedDate: cleanText(item?.published_date || item?.publishedDate, 80) || null,
          score: typeof item?.score === 'number' ? item.score : null,
        })).filter(item => item.title && /^https?:\/\//i.test(item.url))
      : [];

    return {
      query: normalizedQuery,
      provider: 'Tavily',
      results,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(new Error('Live web search timed out. Please try the search again.'), {
        statusCode: 504,
        code: 'WEB_SEARCH_TIMEOUT',
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function webSearchContext(search) {
  if (!search?.results?.length) return '';
  return [
    'Live web search results retrieved just now.',
    `Search query: ${search.query}`,
    ...search.results.map(item => [
      `[${item.rank}] ${item.title}`,
      `URL: ${item.url}`,
      item.publishedDate ? `Published: ${item.publishedDate}` : '',
      `Snippet: ${item.snippet}`,
    ].filter(Boolean).join('\n')),
    'Use these sources as the factual basis for the current answer.',
    'Cite factual claims with [1], [2], etc. matching the source numbers above.',
    'Do not invent sources, URLs, dates, or facts not supported by the retrieved results.',
  ].join('\n\n');
}
