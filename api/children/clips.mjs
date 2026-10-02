import {
  buildClipDirectorPrompt,
  normalizeClipPlan,
} from '../../server/clipDirector.mjs';

const MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!HF_TOKEN) {
    return res.status(503).json({ error: 'AI provider is not configured' });
  }

  try {
    const body = req.body || {};
    const prompt = buildClipDirectorPrompt(body);

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + HF_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are JARVIS Clip Director. Produce concise, original, child-safe production plans. Never claim that a clip has been rendered or published.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || 'Clip planning provider request failed',
      });
    }

    const text =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      '';

    if (!text) {
      return res.status(502).json({ error: 'Clip planner returned no content' });
    }

    return res.status(200).json(normalizeClipPlan(text));
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Clip planning failed',
    });
  }
}
