import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebSearchConfigured, searchWeb } from '../server/web-search.mjs';

test('web search reports unconfigured when TAVILY_API_KEY is absent', () => {
  const original = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  try {
    assert.equal(isWebSearchConfigured(), false);
  } finally {
    if (original === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = original;
  }
});

test('web search fails clearly when the provider key is missing', async () => {
  const original = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  try {
    await assert.rejects(
      () => searchWeb('latest children content trends'),
      error => error?.code === 'WEB_SEARCH_NOT_CONFIGURED' && error?.statusCode === 503,
    );
  } finally {
    if (original === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = original;
  }
});
