import { buildCharacterBiblePrompt, normalizeCharacterBible } from '../../server/characterBible.mjs';

const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN;
  if (!token) return res.status(503).json({ error: 'Hugging Face is not configured.' });

  try {
    const prompt = buildCharacterBiblePrompt(req.body || {});
    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: 'system', content: 'You are JARVIS Character Bible Director. Return structured, original, child-safe production planning. Never claim that characters have been rendered or visually verified.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 5000,
        temperature: 0.4,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error || 'Character Bible generation failed.' });
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
    return res.status(200).json(normalizeCharacterBible(content));
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Character Bible generation failed.' });
  }
}
