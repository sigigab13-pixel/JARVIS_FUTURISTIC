import { buildSceneDirectorPrompt, normalizeScenePlan } from '../../server/sceneDirector.mjs';

const MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';
const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN;
  if (!token) return res.status(503).json({ error: 'Children Scene Director is not configured.' });

  try {
    const body = req.body || {};
    const prompt = buildSceneDirectorPrompt(body);

    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are JARVIS Scene Director. Return structured, original, child-safe production planning. Never claim that scenes have been rendered or published.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 5000,
        temperature: 0.5,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || data?.error || 'Scene generation failed.' });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'The AI returned no scene plan.' });

    return res.status(200).json(normalizeScenePlan(content));
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Scene Director failed.' });
  }
}
