import test from 'node:test';
import assert from 'node:assert/strict';
import { applySecurityHeaders, checkRequestRateLimit } from '../server/security-controls.mjs';

function mockResponse() {
  const headers = new Map();
  return {
    headers,
    headersSent: false,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
  };
}

function mockRequest(remoteAddress) {
  return { headers: {}, socket: { remoteAddress } };
}

test('security headers disable sniffing and framing and constrain browser permissions', () => {
  const res = mockResponse();
  applySecurityHeaders(res, { production: true });
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('strict-transport-security'), 'max-age=31536000');
  assert.match(res.headers.get('permissions-policy'), /microphone=\(self\)/);
});

test('production expensive endpoints fail closed if shared rate limiting is not configured', async () => {
  const result = await checkRequestRateLimit(mockRequest('198.51.100.20'), '/api/image/generate', {
    env: { NODE_ENV: 'production' },
    now: 1_000_000,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 503);
  assert.equal(result.code, 'SHARED_RATE_LIMIT_NOT_CONFIGURED');
});

test('local conversation rate limits reject requests after the configured window quota', async () => {
  const req = mockRequest('198.51.100.21');
  const env = { NODE_ENV: 'test' };
  let result;
  for (let i = 0; i < 20; i += 1) {
    result = await checkRequestRateLimit(req, '/api/chat', { env, now: 2_000_000 });
    assert.equal(result.allowed, true);
  }
  result = await checkRequestRateLimit(req, '/api/chat', { env, now: 2_000_000 });
  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 429);
  assert.equal(result.code, 'RATE_LIMIT_EXCEEDED');
});

test('health checks are exempt from application rate limits', async () => {
  const result = await checkRequestRateLimit(mockRequest('198.51.100.22'), '/api/_healthcheck', {
    env: { NODE_ENV: 'production' },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.mode, 'healthcheck-exempt');
});

test('trusted Cloudflare client IP is used only when explicitly enabled', async () => {
  const req = {
    headers: { 'cf-connecting-ip': '203.0.113.5' },
    socket: { remoteAddress: '198.51.100.30' },
  };
  const env = { NODE_ENV: 'test', JARVIS_TRUST_CLOUDFLARE_HEADERS: 'true' };
  const result = await checkRequestRateLimit(req, '/api/chat', { env, now: 3_000_000 });
  assert.equal(result.allowed, true);
});
