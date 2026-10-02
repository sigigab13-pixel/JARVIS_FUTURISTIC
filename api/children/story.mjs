import { buildChildrenStoryPrompt, normalizeChildrenStory } from '../../server/childrenStudio.mjs';

const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
  if (!token) {
    return res.status(503).json({ error: 'JARVIS AI core is not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = buildChildrenStoryPrompt(body);

    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 1600,
        temperature: 0.8,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.error || 'Content generation failed.';
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: String(message) });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({ error: 'The AI core returned no content.' });

    return res.status(200).json(normalizeChildrenStory(text));
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Invalid content request.' });
  }
}
