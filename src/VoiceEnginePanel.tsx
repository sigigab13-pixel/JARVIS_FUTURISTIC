import { useEffect, useState } from 'react';
import { api } from './api';

type Props = { text: string };
type Voice = { voiceId: string; name: string; category?: string; description?: string; previewUrl?: string | null };

export default function VoiceEnginePanel({ text }: Props) {
    const [voiceId, setVoiceId] = useState('');
    const [voices, setVoices] = useState<Voice[]>([]);
    const [rate, setRate] = useState(0.96);
    const [pitch, setPitch] = useState(0);
    const [configured, setConfigured] = useState(false);
    const [provider, setProvider] = useState('Voice Engine');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('Checking voice engine…');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        void Promise.all([
            api.get('/api/tts/status'),
            api.get('/api/voice/settings'),
            api.get('/api/voices').catch(() => ({ data: { voices: [] } })),
        ]).then(([statusResponse, settingsResponse, voicesResponse]) => {
            if (!active) return;
            const ready = Boolean(statusResponse.data?.configured);
            const nextProvider = String(statusResponse.data?.provider || 'Voice Engine');
            const available = Array.isArray(voicesResponse.data?.voices) ? voicesResponse.data.voices : [];
            setConfigured(ready);
            setProvider(nextProvider);
            setVoices(available);
            setVoiceId(String(settingsResponse.data?.voiceId || available[0]?.voiceId || ''));
            if (ready) setMessage(available.length ? nextProvider + ' connected. Select a voice.' : nextProvider + ' connected. A voice ID may be configured by JARVIS.');
            else setMessage(nextProvider + ' needs its secure API key. Browser fallback is available.');
        }).catch(() => {
            if (active) setMessage('Voice engine status unavailable. Browser fallback is available.');
        });
        return () => {
            active = false;
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const selectVoice = async (nextVoiceId: string) => {
        setVoiceId(nextVoiceId);
        if (!nextVoiceId) return;
        try {
            await api.post('/api/voice/select', { voiceId: nextVoiceId });
            setMessage('Voice selected for JARVIS: ' + (voices.find(item => item.voiceId === nextVoiceId)?.name || nextVoiceId));
        } catch (error: any) {
            setMessage(error?.response?.data?.error || 'Voice selection could not be saved.');
        }
    };

    const browserFallback = () => {
        if (!text || !('speechSynthesis' in window)) {
            setMessage('No browser speech engine is available.');
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const browserVoice = window.speechSynthesis.getVoices().find(item => /^en(-|_)/i.test(item.lang));
        if (browserVoice) utterance.voice = browserVoice;
        utterance.lang = browserVoice?.lang || 'en-US';
        utterance.rate = 0.92;
        utterance.pitch = 0.98;
        window.speechSynthesis.speak(utterance);
        setMessage('Playing browser fallback voice.');
    };

    const generate = async () => {
        if (!text) {
            setMessage('Generate a video plan first.');
            return;
        }
        if (!configured) {
            setMessage(provider + ' is not configured. Use Browser fallback.');
            browserFallback();
            return;
        }
        if (!voiceId) {
            setMessage('No server voice is selected yet. Use Browser fallback or configure an ElevenLabs voice.');
            return;
        }
        setBusy(true);
        setMessage(provider + ' is generating natural speech…');
        try {
            const response = await api.post('/api/tts/synthesize', {
                text: text.slice(0, 5000),
                voice: voiceId,
                languageCode: 'en-US',
                speakingRate: rate,
                pitch,
            });
            const data = response.data;
            if (!data?.audioContent) throw new Error(data?.error || provider + ' returned no audio.');
            const binary = atob(data.audioContent);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            const nextUrl = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/mpeg' }));
            setAudioUrl(nextUrl);
            setMessage('Ready · ' + (voices.find(item => item.voiceId === voiceId)?.name || voiceId) + ' · ' + rate.toFixed(2) + 'x speed');
        } catch (error: any) {
            setMessage(error?.response?.data?.error || (error instanceof Error ? error.message : provider + ' failed.') + ' Browser fallback is available.');
        } finally {
            setBusy(false);
        }
    };

    return <article className="studio-card">
        <span className="card-label">02 · VOICE ENGINE</span>
        <h3>{provider}</h3>
        <p>Server-side voice synthesis with a browser fallback. API keys stay on the server.</p>
        <label style={{ display: 'grid', gap: 5, color: '#7faebd', fontSize: 8 }}>VOICE
            <select value={voiceId} onChange={event => void selectVoice(event.target.value)} disabled={!voices.length} style={{ background: '#07131b', border: '1px solid #244758', color: '#d6edf5', borderRadius: 7, padding: 8 }}>
                {!voices.length && <option value="">No server voices loaded</option>}
                {voices.map(item => <option key={item.voiceId} value={item.voiceId}>{item.name}</option>)}
            </select>
        </label>
        <label style={{ display: 'grid', gap: 5, color: '#7faebd', fontSize: 8, marginTop: 8 }}>SPEED · {rate.toFixed(2)}x
            <input type="range" min="0.75" max="1.25" step="0.01" value={rate} onChange={event => setRate(Number(event.target.value))} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: '#7faebd', fontSize: 8, marginTop: 8 }}>PITCH · {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}
            <input type="range" min="-6" max="6" step="0.5" value={pitch} onChange={event => setPitch(Number(event.target.value))} />
        </label>
        <div className="studio-list" style={{ marginTop: 10 }}>
            <span>{configured ? '✓ ' + provider + ' connected' : '○ ' + provider + ' not configured'}</span>
            <span>✓ Audio output with browser fallback</span>
            <span>✓ Server-side secret protection</span>
            <span>✓ Voice selection persists to the JARVIS account</span>
        </div>
        <div className="empire-actions">
            <button onClick={() => void generate()} disabled={busy || !text}>{busy ? 'Generating voice…' : 'Generate voice'}</button>
            <button onClick={browserFallback} disabled={!text}>Browser fallback</button>
        </div>
        <p>{message}</p>
        {audioUrl && <audio controls src={audioUrl} style={{ width: '100%', marginTop: 8 }} />}
    </article>;
}
