import { buildLipSyncPrompt, normalizeLipSyncPlan } from '../../server/lipSyncDirector.mjs';
const MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN;
  if (!token) return res.status(503).json({ error: 'Hugging Face is not configured.' });
  try {
    const body = req.body || {};
    const prompt = buildLipSyncPrompt(body)
      .replace('__CHARACTERS__', JSON.stringify(body.characters || []).slice(0, 5000))
      .replace('__SCENES__', JSON.stringify(body.scenes || []).slice(0, 18000));
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({model:MODEL,messages:[{role:'system',content:'You are JARVIS Lip-Sync Director. Return valid JSON planning only. Never claim lip-sync has been generated or rendered.'},{role:'user',content:prompt}],max_tokens:5000,temperature:0.3}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error || 'Lip-sync planning failed.' });
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('The model returned no lip-sync plan.');
    return res.status(200).json(normalizeLipSyncPlan(raw));
  } catch (error) { return res.status(400).json({ error: error?.message || 'Lip-sync planning is temporarily unavailable.' }); }
}
