import test from 'node:test';
import assert from 'node:assert/strict';

process.env.HIGGSFIELD_API_KEY = 'test-key-id:test-key-secret';
process.env.SUPABASE_URL = 'https://wyblfoxpaycguuxdehpn.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.SUPABASE_MEDIA_BUCKET = 'jarvis-media';

const {
  buildHiggsfieldRequest,
  submitHiggsfieldVideo,
  submitHiggsfieldVideoFromMediaKeys,
  getHiggsfieldVideoStatus,
} = await import('../server/higgsfield.mjs');

test('Higgsfield request builder locks Children Factory output to 9:16 and bounded duration', () => {
  const request = buildHiggsfieldRequest({
    imageUrls: ['https://example.com/scene-1.png'],
    prompt: 'Kobi walks through a magical forest.',
    duration: 90,
    resolution: 'bogus',
    aspectRatio: '9:16',
  });

  assert.equal(request.model, 'bytedance/seedance-2.5/reference-to-video');
  assert.equal(request.input.image_urls.length, 1);
  assert.equal(request.input.duration, 30);
  assert.equal(request.input.resolution, '720p');
  assert.equal(request.input.aspect_ratio, '9:16');
  assert.equal(request.input.output_format, 'mp4');
});



test('Higgsfield request builder rejects non-HTTPS media references', () => {
  assert.throws(
    () => buildHiggsfieldRequest({
      imageUrls: ['http://example.com/scene.png'],
    }),
    error => /use HTTPS/i.test(error?.message || ''),
  );
});



test('Higgsfield media-key bridge signs JARVIS assets before submission', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options });

    if (target.includes('/storage/v1/object/sign/')) {
      return new Response(JSON.stringify([{
        path: 'jarvis/11111111-1111-4111-8111-111111111111/children-factory/scene-1.png',
        signedURL: '/object/sign/jarvis-media/signed-scene-1',
      }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      request_id: 'req_bridge_1',
      status: 'queued',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await submitHiggsfieldVideoFromMediaKeys({
      userId: '11111111-1111-4111-8111-111111111111',
      mediaKeys: [
        'jarvis/11111111-1111-4111-8111-111111111111/children-factory/scene-1.png',
      ],
      prompt: 'Animate Kobi walking through a magical forest.',
    });

    assert.equal(result.requestId, 'req_bridge_1');
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/storage\/v1\/object\/sign\//);
    assert.equal(calls[1].options.method, 'POST');
    assert.match(String(calls[1].options.body), /signed-scene-1/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Higgsfield submission keeps credentials server-side and returns request identity', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      request_id: 'req_123',
      status_url: 'https://api.higgsfield.ai/requests/req_123/status',
      cancel_url: 'https://api.higgsfield.ai/requests/req_123/cancel',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await submitHiggsfieldVideo({
      imageUrls: ['https://example.com/scene-1.png'],
      prompt: 'Kobi walks through a magical forest.',
    });
    assert.equal(result.requestId, 'req_123');
    assert.equal(result.provider, 'higgsfield');
    assert.equal(result.status, 'unknown');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Key test-key-id:test-key-secret');
    assert.ok(!String(calls[0].options.body).includes('test-key-secret'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('Higgsfield status normalizes terminal completion and video URL', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    request_id: 'req_123',
    status: 'completed',
    video: { url: 'https://cdn.example.com/kobi.mp4' },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const result = await getHiggsfieldVideoStatus('req_123');
    assert.equal(result.status, 'completed');
    assert.equal(result.terminal, true);
    assert.equal(result.videoUrl, 'https://cdn.example.com/kobi.mp4');
  } finally {
    global.fetch = originalFetch;
  }
});


test('Higgsfield status rejects non-Higgsfield lifecycle URLs', async () => {
  await assert.rejects(
    getHiggsfieldVideoStatus('https://evil.example/request/status'),
    error => /api\.higgsfield\.ai/i.test(error?.message || ''),
  );
});
