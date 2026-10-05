const ELEVENLABS_BASE_URL = String(process.env.ELEVENLABS_API_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
const ELEVENLABS_API_KEY = String(process.env.ELEVENLABS_API_KEY || '').trim();
export const ELEVENLABS_MODEL = String(process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2').trim();

export function isElevenLabsConfigured() {
  return Boolean(ELEVENLABS_API_KEY && String(process.env.ELEVENLABS_VOICE_ID || '').trim());
}

export async function synthesizeNarration({ text, voiceId = process.env.ELEVENLABS_VOICE_ID, modelId = ELEVENLABS_MODEL }) {
  if (!isElevenLabsConfigured()) {
    throw Object.assign(new Error('ElevenLabs narration is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to the server environment.'), { code: 'ELEVENLABS_NOT_CONFIGURED', safeToRetry: false });
  }
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new Error('Narration text is empty.');
  const voice = String(voiceId || '').trim();
  const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text: cleanText.slice(0, 20_000), model_id: String(modelId || ELEVENLABS_MODEL) }),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 1000);
    throw Object.assign(new Error(`ElevenLabs speech generation failed (${response.status}): ${detail || 'unknown error'}`), { statusCode: response.status, code: `ELEVENLABS_HTTP_${response.status}`, safeToRetry: false });
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) throw new Error('ElevenLabs returned an empty audio file.');
  return { audio, contentType: response.headers.get('content-type') || 'audio/mpeg', voiceId: voice, modelId: String(modelId || ELEVENLABS_MODEL) };
}
