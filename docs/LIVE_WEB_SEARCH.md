# JARVIS Live Web Search

## What it does

When the server router classifies a user's request as search mode (for example, “search the web for…”, “research…”, “look up…”, “what is the latest…”, or “check online…”), JARVIS enables the OpenAI Responses API `web_search` tool.

The request config requires a tool call and asks the provider to include the search-call source list. Reasoning-tier requests use a larger web-search context than quick requests. Provider-returned URLs are normalized, deduplicated and shown underneath the answer as clickable source cards. JARVIS labels a search as live only when it receives evidence that the provider search tool ran.

## Failure behavior

A requested live search must not quietly fall back to a model that has no web-search tool. If the live search request fails or the response does not confirm a search, JARVIS returns a clear unavailable response instead of presenting an offline model answer as current web research. Ordinary chat may still use the existing Hugging Face fallback.

## Usage and cost protection

Each search request counts against a daily allowance before the provider is called, so failed requests cannot be repeatedly retried to bypass the quota. Each Responses API search is also capped at three built-in tool calls (for example, search/open-page operations).

Default per-day allowances are intentionally bounded and configurable:

| User group | Default daily searches |
|---|---:|
| Guest (IP-scoped) | 2 |
| Free account | 5 |
| Pro account | 25 |
| Premium / family-access account | 50 |
| Entire JARVIS service | 250 |

Set server-side overrides when the real provider costs and plan economics have been reviewed:

- `JARVIS_WEB_SEARCH_GUEST_DAILY_LIMIT`
- `JARVIS_WEB_SEARCH_FREE_DAILY_LIMIT`
- `JARVIS_WEB_SEARCH_PRO_DAILY_LIMIT`
- `JARVIS_WEB_SEARCH_PREMIUM_DAILY_LIMIT`
- `JARVIS_WEB_SEARCH_GLOBAL_DAILY_LIMIT`

All counters reset at midnight UTC. Production search fails closed if the shared quota store is missing or unavailable; a local in-memory quota is used only outside production. This means `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must both be configured and verified before live search can be deployed.

## Configuration

- Live search is enabled by default for search-mode requests.
- Set `OPENAI_ENABLE_WEB_SEARCH=false` (also accepts `0`, `off`, `disabled`, or `no`) to disable it intentionally.
- A valid server-side `OPENAI_API_KEY` and a model that supports the Responses API web-search tool are required.
- Never expose the key in browser code, source control, or a `VITE_*` variable.
- Web search can increase provider usage, latency, and API costs. The feature does not promise that every request is free; monitor provider usage and configure spend limits where available.

## Current scope and limits

This is live search with cited answering, not a claim of exhaustive crawling or a fully automated long-form research agent. Source cards show the URLs supplied by the provider; they do not mean every URL was independently fetched by JARVIS. Search results are untrusted external data and must not be treated as instructions, authorization, or trusted code.

## Verification gates

- [ ] Unit tests confirm search-mode defaults, opt-out values, tool-choice requirements and citation extraction.
- [ ] All repository tests pass and the production build succeeds.
- [ ] A live deployment query confirms that the provider actually ran web search and supplied source URLs.
- [ ] Provider cost/usage and failure behavior are reviewed with the deployed key.
- [ ] The interface displays source links and clearly distinguishes searches with no citations.

Official API reference: [OpenAI Web Search](https://developers.openai.com/api/docs/guides/tools-web-search).

Until the live deployment checks are completed, describe this as implemented in code and locally tested, not yet verified in production.
