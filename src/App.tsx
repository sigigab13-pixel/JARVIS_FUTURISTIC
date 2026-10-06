import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import EmpireDashboard from './EmpireDashboard';
import CapabilityCenter from './CapabilityCenter';
import './EmpireDashboard.css';
import { api, image } from './api';
import { supabase, supabaseConfigured } from './supabase';
import {
  Mic,
  MicOff,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  Shield,
  Cpu,
  Activity,
  Sparkles,
  Camera,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  Terminal,
  Monitor,
  BrainCircuit,
  Download,
  RotateCcw,
  Globe,
  Battery,
  Mail,
  Github,
  Apple,
} from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string; image?: { data: string; mimeType: string } };

function safeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : '';
    const code = typeof record.code === 'string' ? record.code : '';
    if (message && code) return `[${code}] ${message}`;
    if (message) return message;
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value);
}

function normalizeMessages(value: unknown, fallback: Message[] = starter): Message[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item: any) => {
      if (item?.role !== 'user' && item?.role !== 'assistant') return null;
      const content = safeText(item?.content).trim();
      const image = item?.image?.data && item?.image?.mimeType ? { data: String(item.image.data), mimeType: String(item.image.mimeType) } : undefined;
      return content || image ? { role: item.role, content, ...(image ? { image } : {}) } : null;
    })
    .filter(Boolean) as Message[];
}

function makeStarter(displayName = 'there'): Message[] {
  const safeName = String(displayName || 'there').trim() || 'there';
  return [{
    role: 'assistant',
    content: `Hello, ${safeName}. JARVIS is online. How can I help you?`,
  }];
}

const starter: Message[] = makeStarter();



function renderInlineMarkdown(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <span key={index}>{part}</span>;
  });
}

function renderRichMessage(content: string): ReactNode[] {
  const lines = String(content || '').split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; text: string }[] = [];

  const flushList = () => {
    if (!list.length) return;
    const ordered = list[0].ordered;
    const items = list.map((item, index) => <li key={index}>{renderInlineMarkdown(item.text)}</li>);
    blocks.push(
      ordered
        ? <ol className="rich-list" key={blocks.length}>{items}</ol>
        : <ul className="rich-list" key={blocks.length}>{items}</ul>
    );
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (orderedMatch || bulletMatch) {
      const ordered = Boolean(orderedMatch);
      if (list.length && list[0].ordered !== ordered) flushList();
      list.push({ ordered, text: (orderedMatch || bulletMatch)![1] });
      continue;
    }

    flushList();

    if (!trimmed) {
      blocks.push(<div className="rich-spacer" key={blocks.length} />);
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      blocks.push(<h3 className="rich-heading" key={blocks.length}>{renderInlineMarkdown(headingMatch[1])}</h3>);
      continue;
    }

    blocks.push(<p className="rich-paragraph" key={blocks.length}>{renderInlineMarkdown(trimmed)}</p>);
  }

  flushList();
  return blocks;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [entitlement, setEntitlement] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>(starter);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [passiveWake, setPassiveWake] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [missions, setMissions] = useState<any[]>([]);
  const [missionPrompt, setMissionPrompt] = useState('');
  const [missionBusy, setMissionBusy] = useState(false);
  const [missionError, setMissionError] = useState('');
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [factoryTopic, setFactoryTopic] = useState('');
  const [factoryAge, setFactoryAge] = useState(5);
  const [factoryBusy, setFactoryBusy] = useState(false);
  const [factoryError, setFactoryError] = useState('');
  const [factoryDraft, setFactoryDraft] = useState<any>(null);
  const [factoryRenderJob, setFactoryRenderJob] = useState<any>(null);
  const [empireOpen, setEmpireOpen] = useState(false);
  const [capabilityOpen, setCapabilityOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [systemResults, setSystemResults] = useState<string[]>([]);
  const [repairDiagnostics, setRepairDiagnostics] = useState<any>(null);
  const [repairDiagnosticsBusy, setRepairDiagnosticsBusy] = useState(false);
  const [passiveStatus, setPassiveStatus] = useState('STARTING');
  const [imageLabOpen, setImageLabOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [brandKit, setBrandKit] = useState<any>(null);
  const [businessBusy, setBusinessBusy] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState<any>(null);
  const [youtubeAnalytics, setYoutubeAnalytics] = useState<any>(null);
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeMediaKey, setYoutubeMediaKey] = useState('');
  const [youtubeMissionId, setYoutubeMissionId] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState(true);
  const [youtubePublishBusy, setYoutubePublishBusy] = useState(false);
  const [youtubePublishResult, setYoutubePublishResult] = useState<any>(null);
  const [videoProjects, setVideoProjects] = useState<any[]>([]);
  const [videoProject, setVideoProject] = useState<any>(null);
  const [videoCharacters, setVideoCharacters] = useState<any[]>([]);
  const [videoScenes, setVideoScenes] = useState<any[]>([]);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<any>(null);
  const [editingScene, setEditingScene] = useState<any>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Not tested');
  const [securityResults, setSecurityResults] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const passiveRecognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const palette = [185, 212, 238, 268, 302, 334, 28, 52, 118, 154];
    const hue = palette[Math.floor(Math.random() * palette.length)];
    document.documentElement.style.setProperty('--jarvis-hue', String(hue));
    return () => {};
  }, []);

  useEffect(() => {
    let active = true;

    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthReady(true);
      return () => { active = false; };
    }

    const syncSession = async (currentSession: any) => {
      if (!currentSession?.access_token) return;
      try {
        const response = await api.post('/api/auth/sync', { accessToken: currentSession.access_token });
        if (!response.data?.ok) throw new Error(response.data?.error || 'Authentication sync failed.');
      } catch (error: any) {
        if (active) setAuthError(error?.message || 'Could not connect your JARVIS account.');
      }
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session || null);
      setAuthReady(true);
      if (data.session) void syncSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
      setAuthError('');
      if (event === 'SIGNED_IN' && nextSession) void syncSession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setEntitlement(null); return; }
    let active = true;
    const authUser = session.user || {};
    const metadata = authUser.user_metadata || {};
    const displayName = String(metadata.full_name || metadata.name || authUser.email || 'there').trim() || 'there';
    const historyKey = `jarvis-history:${String(authUser.id || authUser.email || 'user')}`;
    try {
      const saved = localStorage.getItem(historyKey);
      setMessages(saved ? normalizeMessages(JSON.parse(saved), makeStarter(displayName)) : makeStarter(displayName));
      localStorage.removeItem('jarvis-history');
    } catch {
      setMessages(makeStarter(displayName));
    }
    void api.get('/api/plans').then(response => {
      if (active) setEntitlement(response.data?.entitlement || null);
    }).catch(() => {
      if (active) setEntitlement(null);
    });
    return () => { active = false; };
  }, [session]);

  const signInWithOAuth = async (provider: 'google' | 'github' | 'azure' | 'apple', label: string) => {
    setAuthBusy(true);
    setAuthError('');
    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message || label + ' sign-in failed.');
      setAuthBusy(false);
    }
  };

  const signInWithGoogle = () => signInWithOAuth('google', 'Google');

  const signInWithEmail = async () => {
    setAuthBusy(true);
    setAuthError('');
    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthBusy(false);
      return;
    }
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      setAuthError('Enter your email and password.');
      setAuthBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthBusy(false);
  };

  const createEmailAccount = async () => {
    setAuthBusy(true);
    setAuthError('');
    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthBusy(false);
      return;
    }
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || password.length < 8) {
      setAuthError('Use a valid email and a password of at least 8 characters.');
      setAuthBusy(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
    } else if (!data.session) {
      setAuthError('Account created. Check your email to confirm your address before signing in.');
      setAuthMode('signin');
    }
    setAuthBusy(false);
  };

  const sendMagicLink = async () => {
    setAuthBusy(true);
    setAuthError('');
    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase Auth is not configured in this deployment.');
      setAuthBusy(false);
      return;
    }
    const email = authEmail.trim();
    if (!email) {
      setAuthError('Enter your email address first.');
      setAuthBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setAuthError(error ? error.message : 'Magic link sent. Check your email.');
    setAuthBusy(false);
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setMessages(starter);
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    localStorage.setItem(`jarvis-history:${session.user.id}`, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void api.get('/api/chat/history').then(response => {
      const cloudMessages = Array.isArray(response.data?.messages) ? response.data.messages : [];
      if (!active || cloudMessages.length === 0) return;
      setMessages(normalizeMessages(cloudMessages));
    }).catch(() => {
      // Local memory remains available if the cloud memory service is temporarily unavailable.
    });
    return () => { active = false; };
  }, [session]);

  const speak = async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    try {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(true);
      const response = await api.post('/api/tts/synthesize', { text: text.slice(0, 5000) });
      const audioContent = String(response.data?.audioContent || '');
      const mimeType = String(response.data?.mimeType || 'audio/mpeg');
      if (!audioContent) throw new Error('No audio returned.');
      const audio = new Audio('data:' + mimeType + ';base64,' + audioContent);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setSpeaking(false);
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setSpeaking(false);
      };
      await audio.play();
    } catch {
      setSpeaking(false);
      // Keep the chat usable if ElevenLabs is temporarily unavailable.
    }
  };

  const loadMissions = async () => {
    if (!session?.user?.id) return;
    setMissionBusy(true);
    setMissionError('');
    try {
      const response = await api.missions.list();
      setMissions(Array.isArray(response.data?.missions) ? response.data.missions : []);
    } catch (error: any) {
      setMissionError(String(error?.response?.data?.error || error?.message || 'Could not load missions.'));
    } finally {
      setMissionBusy(false);
    }
  };

  const openYouTubeCenter = async () => {
    setYoutubeOpen(true);
    setYoutubeBusy(true);
    setYoutubeError('');
    try {
      const response = await api.get('/api/youtube/status');
      setYoutubeStatus(response.data || null);
    } catch (error: any) {
      setYoutubeError(String(error?.response?.data?.error || error?.message || 'Could not load YouTube status.'));
    } finally {
      setYoutubeBusy(false);
    }
  };

  const connectYouTube = async () => {
    setYoutubeBusy(true);
    setYoutubeError('');
    try {
      const response = await api.get('/api/youtube/connect');
      const authorizationUrl = String(response.data?.authorizationUrl || '');
      if (!authorizationUrl) throw new Error('YouTube authorization URL was not returned.');
      window.location.assign(authorizationUrl);
    } catch (error: any) {
      setYoutubeError(String(error?.response?.data?.error || error?.message || 'Could not start YouTube connection.'));
      setYoutubeBusy(false);
    }
  };

  const publishToYouTube = async () => {
    if (!youtubeMissionId.trim() || !youtubeMediaKey.trim() || !youtubeTitle.trim() || youtubePublishBusy) return;
    setYoutubePublishBusy(true);
    setYoutubeError('');
    setYoutubePublishResult(null);
    try {
      const response = await api.youtube.publish({
        missionId: youtubeMissionId.trim(),
        mediaKey: youtubeMediaKey.trim(),
        title: youtubeTitle.trim(),
        description: youtubeDescription.trim(),
        privacyStatus: youtubePrivacy,
        madeForKids: youtubeMadeForKids,
      });
      setYoutubePublishResult(response.data || null);
    } catch (error: any) {
      setYoutubeError(String(error?.response?.data?.error || error?.message || 'YouTube publishing failed.'));
    } finally {
      setYoutubePublishBusy(false);
    }
  };

  const loadYouTubeAnalytics = async () => {
    setYoutubeBusy(true);
    setYoutubeError('');
    try {
      const response = await api.get('/api/youtube/analytics');
      setYoutubeAnalytics(response.data?.analytics || null);
    } catch (error: any) {
      setYoutubeError(String(error?.response?.data?.error || error?.message || 'Could not load YouTube analytics.'));
    } finally {
      setYoutubeBusy(false);
    }
  };

  const watchChildrenFactoryScenes = async (missionId: string, initialResponse: any) => {
    const maxAttempts = 45;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await api.missions.list();
      const mission = (response.data?.missions || []).find((item: any) => String(item?.id || '') === missionId);
      if (!mission) throw new Error('Children Factory mission could not be found while scene jobs are running.');

      const metadata = mission.metadata || {};
      const images = Array.isArray(metadata.images) ? metadata.images : [];
      const pipeline = Array.isArray(metadata.pipeline) ? metadata.pipeline : initialResponse?.draft?.pipeline || [];
      setFactoryDraft((current: any) => current
        ? {
            ...current,
            mission,
            draft: {
              ...current.draft,
              images,
              pipeline,
            },
          }
        : current);

      if (String(mission.status || '') === 'failed') {
        const failure = metadata.factoryFailure || {};
        throw new Error(String(
          failure.message ||
          'Children Factory scene generation failed after bounded retries. Partial progress was preserved.'
        ));
      }

      if (images.length >= 3 && String(pipeline.find((stage: any) => stage.id === 'scene_assets')?.status || '') === 'completed') {
        return mission;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Scene generation is still running. The durable jobs have been kept; refresh the factory to continue checking without creating duplicates.');
  };

  const createImageMission = async () => {
    const prompt = missionPrompt.trim();
    if (!prompt || missionBusy) return;
    setMissionBusy(true);
    setMissionError('');
    try {
      await api.missions.createImage(prompt);
      setMissionPrompt('');
      await loadMissions();
    } catch (error: any) {
      setMissionError(String(error?.response?.data?.error || error?.message || 'Could not create mission.'));
    } finally {
      setMissionBusy(false);
    }
  };

  const requestMissionApproval = async (id: string) => {
    setMissionBusy(true);
    setMissionError('');
    try {
      await api.missions.requestApproval(id);
      await loadMissions();
    } catch (error: any) {
      setMissionError(String(error?.response?.data?.error || error?.message || 'Could not request approval.'));
    } finally {
      setMissionBusy(false);
    }
  };

  const createChildrenFactory = async () => {
    const topic = factoryTopic.trim();
    if (!topic || factoryBusy) return;
    setFactoryBusy(true);
    setFactoryError('');
    setFactoryDraft(null);
    setFactoryRenderJob(null);
    try {
      const response = await api.post('/api/factory/children', { topic, age: factoryAge });
      setFactoryDraft(response.data);
      setFactoryTopic('');
      await loadMissions();

      const missionId = String(response.data?.approvalGate?.missionId || '').trim();
      if (missionId && response.data?.status === 'scenes_queued') {
        try {
          await watchChildrenFactoryScenes(missionId, response.data);
        } catch (watchError: any) {
          setFactoryError(String(watchError?.message || 'Children Factory scene generation is still in progress.'));
        }
      }
    } catch (error: any) {
      setFactoryError(String(error?.response?.data?.error || error?.message || 'Children Factory could not create the draft.'));
    } finally {
      setFactoryBusy(false);
    }
  };

  const renderChildrenFactoryVideo = async () => {
    const draft = factoryDraft && factoryDraft.draft;
    const projectId = String(draft && draft.project && draft.project.id || '').trim();
    const imageKeys = Array.isArray(draft && draft.images) ? draft.images.map((item: any) => String(item && item.media && (item.media.path || item.media.key) || '').trim()).filter(Boolean) : [];
    const existingJobId = String(factoryRenderJob && factoryRenderJob.id || '').trim();
    const existingStatus = String(factoryRenderJob && factoryRenderJob.status || '');
    const pipeline = Array.isArray(draft?.pipeline) ? draft.pipeline : [];
    const sceneAssetsComplete = String(pipeline.find((stage: any) => stage.id === 'scene_assets')?.status || '') === 'completed';
    if (!projectId || imageKeys.length < 3 || !sceneAssetsComplete || factoryBusy) return;
    setFactoryBusy(true);
    setFactoryError('');
    try {
      let jobId = existingJobId;
      if (!jobId || !['queued', 'running'].includes(existingStatus)) {
        setFactoryRenderJob({ status: 'queued' });
        const response = await api.video.render(projectId, imageKeys, String((factoryDraft && factoryDraft.approvalGate && factoryDraft.approvalGate.missionId) || ''));
        const job = response.data && response.data.job;
        if (!job || !job.id) throw new Error('Video render job was not created.');
        jobId = String(job.id);
        setFactoryRenderJob(job);
      }
      for (let attempt = 0; attempt < 45; attempt += 1) {
        const statusResponse = await api.video.job(jobId);
        const current = statusResponse.data && statusResponse.data.job;
        if (!current) throw new Error('Video render job could not be found.');
        setFactoryRenderJob(current);
        if (current.status === 'succeeded') {
          const result = current.result || {};
          const mediaKey = String(result.mediaKey || (result.media && (result.media.path || result.media.key)) || '').trim();
          if (!mediaKey) throw new Error('Render completed without a stored video media key.');
          setFactoryDraft((draftState: any) => draftState ? { ...draftState, renderedVideo: result } : draftState);
          setYoutubeMissionId(String(factoryDraft && factoryDraft.approvalGate && factoryDraft.approvalGate.missionId || ''));
          setYoutubeMediaKey(mediaKey);
          setYoutubeTitle(String(draft && draft.project && draft.project.title || 'JARVIS Children Video').slice(0, 100));
          setYoutubeDescription(String(draft && draft.story || '').slice(0, 5000));
          return;
        }
        if (current.status === 'failed' || current.status === 'canceled') throw new Error((current.error && current.error.message) || 'Video render failed.');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      throw new Error('Video render is still running. The existing job has been kept so you can check it again without creating a duplicate.');
    } catch (error: any) {
      setFactoryError(String((error.response && error.response.data && error.response.data.error) || error.message || 'Could not render the children video.'));
    } finally {
      setFactoryBusy(false);
    }
  };

  const approveChildrenFactory = async (id: string) => {
    setFactoryBusy(true);
    setFactoryError('');
    try {
      const response = await api.missions.approve(id);
      setFactoryDraft((current: any) => current ? { ...current, approved: true, mission: response.data?.mission } : current);
      await loadMissions();
    } catch (error: any) {
      setFactoryError(String(error?.response?.data?.error || error?.message || 'Could not approve the draft.'));
    } finally {
      setFactoryBusy(false);
    }
  };

  const approveAndStartMission = async (id: string) => {
    setMissionBusy(true);
    setMissionError('');
    try {
      await api.missions.approve(id);
      await api.missions.start(id);
      await loadMissions();
    } catch (error: any) {
      setMissionError(String(error?.response?.data?.error || error?.message || 'Could not start mission.'));
    } finally {
      setMissionBusy(false);
    }
  };

  const cancelMission = async (id: string) => {
    setMissionBusy(true);
    setMissionError('');
    try {
      await api.missions.cancel(id);
      await loadMissions();
    } catch (error: any) {
      setMissionError(String(error?.response?.data?.error || error?.message || 'Could not cancel mission.'));
    } finally {
      setMissionBusy(false);
    }
  };

  const handleLocalCommand = (clean: string) => {
    const value = clean.toLowerCase().replace(/[!?.,]+$/g, '').trim();
    let response = '';

    if (/^(export|download) (my )?memory$/.test(value)) {
      exportMemory();
      response = 'Your local JARVIS memory export has been prepared.';
    } else if (/^(clear|delete) (my )?(local )?memory$/.test(value)) {
      clearMemory();
      response = 'Local JARVIS memory has been cleared from this browser.';
    } else if (/^(turn|switch|set) voice (on|off)$/.test(value)) {
      const enabled = value.endsWith('on');
      setVoiceEnabled(enabled);
      response = enabled ? 'Voice output is now on.' : 'Voice output is now off.';
    } else if (/^(turn|switch|set) passive wake (on|off)$/.test(value)) {
      const enabled = value.endsWith('on');
      setPassiveWake(enabled);
      if (enabled) startPassiveWake();
      else stopPassiveWake();
      response = enabled ? 'Passive wake is now on.' : 'Passive wake is now off.';
    }

    if (!response) return false;
    setInput('');
    setMessages(current => [...current, { role: 'user', content: clean }, { role: 'assistant', content: response }]);
    if (voiceEnabled) void speak(response);
    return true;
  };

  const openRoutedSurface = (surface: string) => {
    setCommandOpen(false);
    setMissionOpen(false);
    setFactoryOpen(false);
    setCapabilityOpen(false);
    setBusinessOpen(false);
    setVideoOpen(false);
    setYoutubeOpen(false);
    setImageLabOpen(false);
    setSystemOpen(false);
    setSecurityOpen(false);
    setEmpireOpen(false);

    if (surface === 'children') {
      setFactoryOpen(true);
      void loadMissions();
    } else if (surface === 'video') {
      void openVideoStudio();
    } else if (surface === 'youtube') {
      void openYouTubeCenter();
    } else if (surface === 'business') {
      void openBusinessCenter();
    } else if (surface === 'image') {
      setImageLabOpen(true);
    } else if (surface === 'mission') {
      setMissionOpen(true);
      void loadMissions();
    } else if (surface === 'security') {
      setSecurityOpen(true);
      runSecurityCheck();
      void loadMissions();
    } else if (surface === 'system') {
      setSystemOpen(true);
      runSystemCheck();
    } else if (surface === 'capabilities') {
      setCapabilityOpen(true);
    } else if (surface === 'command') {
      setCommandOpen(true);
    } else if (surface === 'empire') {
      setEmpireOpen(true);
    }
  };

  const sendMessage = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (handleLocalCommand(clean)) return;

    const next = [...messages, { role: 'user' as const, content: clean }];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      let response;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await api.post('/api/chat', {
            messages: next.slice(-16),
          });
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      if (!response) throw lastError ?? new Error('AI core request failed');

      const generatedImage = response.data?.image;
      if (generatedImage?.data && generatedImage?.mimeType) {
        setImagePrompt(clean);
        setImageResult(`data:${generatedImage.mimeType};base64,${generatedImage.data}`);
        setImageError('');
        setImageLabOpen(true);
      }

      const routing = response.data?.routing;
      if (routing?.surfaceAction === 'open' && typeof routing.surface === 'string') {
        openRoutedSurface(routing.surface);
      }

      const answer = safeText(
        response.data?.text,
        generatedImage
          ? `Done, ${String(session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email || 'there').trim() || 'there'}. Your image is ready in Image Lab.`
          : 'I could not complete that request. Please try again.',
      );
      setMessages(current => [
        ...current,
        { role: 'assistant', content: answer },
      ]);
      if (voiceEnabled) void speak(answer);
    } catch (error: any) {
      const detail = safeText(error?.response?.data?.error, error?.message || '').trim();
      setMessages(current => [
        ...current,
        {
          role: 'assistant',
          content: detail
            ? `JARVIS AI core error: ${detail}`
            : 'JARVIS AI core is temporarily unavailable. Please try again in a moment.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const getSpeechRecognition = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setMessages(current => [...current, { role: 'assistant', content: 'Voice input is not supported by this browser. You can still type to me.' }]);
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (text) setInput(current => current ? current + ' ' + text : text);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const startPassiveWake = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setPassiveStatus('NOT SUPPORTED');
      return;
    }
    if (passiveRecognitionRef.current) passiveRecognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onstart = () => setPassiveStatus('LISTENING FOR HEY');
    recognition.onend = () => {
      if (passiveWake) setPassiveStatus('RESTARTING');
    };
    recognition.onerror = () => setPassiveStatus('CHECK MIC PERMISSION');
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .slice(-1)
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .toLowerCase();
      if (transcript.includes('hey')) {
        recognition.stop();
        setPassiveStatus('WAKE DETECTED');
        window.setTimeout(() => startListening(), 250);
      }
    };
    passiveRecognitionRef.current = recognition;
    recognition.start();
  };

  const stopPassiveWake = () => {
    passiveRecognitionRef.current?.stop();
    passiveRecognitionRef.current = null;
    setPassiveStatus('OFF');
  };

  const togglePassiveWake = () => {
    const next = !passiveWake;
    setPassiveWake(next);
    if (next) startPassiveWake();
    else stopPassiveWake();
  };

  const exportMemory = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jarvis-memory.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearMemory = () => {
    if (session?.user?.id) localStorage.removeItem(`jarvis-history:${session.user.id}`);
    localStorage.removeItem('jarvis-history');
    audioRef.current?.pause();
    audioRef.current = null;
    setMessages(starter);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (cameraRef.current) cameraRef.current.srcObject = null;
    setCameraActive(false);
  };

  const testCamera = async () => {
    if (cameraActive) {
      stopCamera();
      setCameraStatus('Camera test stopped');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Camera access is not supported by this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      if (cameraRef.current) cameraRef.current.srcObject = stream;
      setCameraActive(true);
      setCameraStatus('Camera is available. No photo is being captured or saved.');
    } catch {
      setCameraStatus('Camera permission was denied or the camera is unavailable');
    }
  };

  const generateImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt || imageBusy) return;
    setImageBusy(true);
    setImageError('');
    try {
      const endpoint = referenceImage ? '/api/image/edit' : '/api/image/generate';
      const response = await api.post(endpoint, referenceImage
        ? { prompt, referenceImage }
        : { prompt });
      const generated = response.data?.image;
      if (!generated?.data || !generated?.mimeType) throw new Error('Invalid image response');
      setImageResult(`data:${generated.mimeType};base64,${generated.data}`);
    } catch (error: any) {
      const detail = String(error?.response?.data?.error || error?.message || '').trim();
      setImageError(detail ? `Image Lab error: ${detail}` : 'I could not generate that image right now. Please try again.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleReferenceImage = async (file: File) => {
    setImageError('');
    try {
      const prepared = await image.resizeIfNeeded(file, {
        maxDimension: 1600,
        maxPixels: 2_000_000,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });
      setReferenceImage({ data: prepared.data, mimeType: prepared.mimeType });
      setReferencePreview(`data:${prepared.mimeType};base64,${prepared.data}`);
    } catch {
      setImageError('I could not prepare that reference image. Try another image.');
    }
  };

  const clearImageLab = () => {
    setImagePrompt('');
    setImageResult(null);
    setImageError('');
    setReferenceImage(null);
    setReferencePreview(null);
  };

  const downloadGeneratedImage = () => {
    if (!imageResult) return;
    const link = document.createElement('a');
    link.href = imageResult;
    const mimeType = imageResult.match(/^data:([^;]+);/)?.[1] || 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
    link.download = `jarvis-generated-image.${extension}`;
    link.click();
  };

  const runSecurityCheck = () => {
    const results = [
      window.isSecureContext ? 'Secure browser context: OK' : 'Secure browser context: check browser security',
      'JARVIS app permissions are user-controlled',
      'No covert camera capture or automatic surveillance is enabled',
      'Mac system lock requires an explicit action outside the browser',
    ];
    setSecurityResults(results);
  };

  const runRepairDiagnostics = async () => {
    if (repairDiagnosticsBusy) return;
    setRepairDiagnosticsBusy(true);
    try {
      const response = await api.get('/api/repair/diagnostics');
      setRepairDiagnostics(response.data || null);
    } catch (error: any) {
      setRepairDiagnostics({
        overallStatus: 'ATTENTION',
        checks: [{
          name: 'Repair Office',
          status: 'ATTENTION',
          evidence: String(error?.response?.data?.error || error?.message || 'Diagnostic request failed.'),
        }],
      });
    } finally {
      setRepairDiagnosticsBusy(false);
    }
  };

  const runSystemCheck = () => {
    const checks = [
      window.isSecureContext ? 'Secure browser context: OK' : 'Secure browser context: check browser security',
      navigator.onLine ? 'Network connection: ONLINE' : 'Network connection: OFFLINE',
      'Local conversation memory: AVAILABLE',
      'AI core: READY',
      'Mac system control: SAFELY RESTRICTED TO EXPLICIT USER ACTIONS',
    ];
    const battery = (navigator as any).getBattery;
    if (battery) checks.push('Battery API: AVAILABLE');
    setSystemResults(checks);
    void runRepairDiagnostics();
  };

  const openSecurityCenter = () => {
    setSecurityOpen(true);
    runSecurityCheck();
  };

  const openBusinessCenter = async () => {
    setBusinessOpen(true);
    try {
      const response = await api.get('/api/business');
      setBusiness(response.data?.business || null);
      setBrandKit(response.data?.brandKit || null);
    } catch {}
  };

  const saveBusiness = async () => {
    setBusinessBusy(true);
    try {
      const response = await api.post('/api/business', business || { name: 'My Business' });
      setBusiness(response.data?.business || business);
    } finally { setBusinessBusy(false); }
  };

  const saveBrandKit = async () => {
    if (!business) return;
    setBusinessBusy(true);
    try {
      const response = await api.post('/api/business/brand-kit', brandKit || {});
      setBrandKit(response.data?.brandKit || brandKit);
    } finally { setBusinessBusy(false); }
  };

  const openVideoStudio = async () => {
    setVideoOpen(true);
    setVideoError('');
    setVideoBusy(true);
    try {
      const response = await api.get('/api/video/projects');
      const projects = Array.isArray(response.data?.projects) ? response.data.projects : [];
      setVideoProjects(projects);
      if (projects[0]) {
        const project = projects[0];
        setVideoProject(project);
        const [characters, scenes] = await Promise.all([
          api.get('/api/video/projects/' + project.id + '/characters'),
          api.get('/api/video/projects/' + project.id + '/scenes'),
        ]);
        setVideoCharacters(characters.data?.characters || []);
        setVideoScenes(scenes.data?.scenes || []);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || error?.message || 'Video Engine is unavailable for this plan.');
    } finally { setVideoBusy(false); }
  };

  const createVideoProject = async () => {
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects', {
        title: 'New JARVIS Production',
        description: 'Video production project',
        format: '16:9',
        story_bible: { premise: '', tone: '', continuity: {} },
      });
      const project = response.data?.project;
      if (project) {
        setVideoProject(project);
        setVideoProjects(current => [project, ...current]);
        setVideoCharacters([]);
        setVideoScenes([]);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the video project.');
    } finally { setVideoBusy(false); }
  };

  const createVideoCharacter = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects/' + videoProject.id + '/characters', {
        name: window.prompt('Character name')?.trim() || 'New Character',
        role: window.prompt('Character role')?.trim() || 'Character',
        profile: { personality: '', history: '', speaking_style: '' },
        appearance: { face: '', hair: '', clothing: '', visual_identity: '' },
        voice: { provider: 'elevenlabs', voice_id: '', speaking_style: '' },
        wardrobe: { current: '', allowed_variations: [] },
        relationships: {},
        reference_assets: [],
        continuity_rules: { identity_locked: true },
      });
      setVideoCharacters(current => [...current, response.data?.character].filter(Boolean));
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the character.');
    } finally { setVideoBusy(false); }
  };

  const createVideoScene = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects/' + videoProject.id + '/scenes', {
        scene_number: videoScenes.length + 1,
        title: 'New Scene',
        script: '',
        dialogue: [],
        characters: videoCharacters.map(character => character.id),
        visual_plan: {},
        camera_plan: {},
        audio_plan: { voice_provider: 'elevenlabs' },
        lip_sync_plan: { enabled: true, status: 'planned', character_audio_pairs: [] },
        continuity_notes: { check_character_identity: true, check_world_assets: true },
      });
      setVideoScenes(current => [...current, response.data?.scene].filter(Boolean));
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the scene.');
    } finally { setVideoBusy(false); }
  };

  const saveVideoCharacter = async () => {
    if (!videoProject || !editingCharacter) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.patch('/api/video/projects/' + videoProject.id + '/characters/' + editingCharacter.id, editingCharacter);
      const saved = response.data?.character;
      if (saved) {
        setVideoCharacters(current => current.map(item => item.id === saved.id ? saved : item));
        setEditingCharacter(null);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not save the character.');
    } finally { setVideoBusy(false); }
  };

  const saveVideoScene = async () => {
    if (!videoProject || !editingScene) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.patch('/api/video/projects/' + videoProject.id + '/scenes/' + editingScene.id, editingScene);
      const saved = response.data?.scene;
      if (saved) {
        setVideoScenes(current => current.map(item => item.id === saved.id ? saved : item));
        setEditingScene(null);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not save the scene.');
    } finally { setVideoBusy(false); }
  };

  const planVideoProduction = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      await api.post('/api/video/projects/' + videoProject.id + '/plan', {
        requested_outputs: ['storyboard', 'generation_plan', 'voice_plan', 'lip_sync_plan', 'qa_plan'],
      });
      setVideoError('Production plan queued successfully.');
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not queue the production plan.');
    } finally { setVideoBusy(false); }
  };

  const openCommand = (command: string) => {
    setCommandOpen(false);
    void sendMessage(command);
  };

  useEffect(() => () => {
    stopCamera();
    recognitionRef.current?.stop();
    passiveRecognitionRef.current?.stop();
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!passiveWake) {
      stopPassiveWake();
      return;
    }
    startPassiveWake();
  }, [passiveWake]);

  if (!authReady) {
    return <main className="jarvis-shell"><section className="auth-screen"><div className="auth-card"><div className="orb"><Sparkles size={20} /></div><span className="eyebrow">JARVIS AUTHENTICATION</span><h1>Connecting to JARVIS...</h1><p>Preparing your secure account session.</p></div></section></main>;
  }

  if (!session) {
    return (
      <main className="jarvis-shell">
        <section className="auth-screen">
          <div className="auth-card">
            <div className="orb"><Sparkles size={20} /></div>
            <span className="eyebrow">JARVIS AUTHENTICATION</span>
            <h1>Sign in to JARVIS</h1>
            <p>Choose a secure sign-in method to sync your conversations, preferences, and long-term JARVIS memory.</p>
            {authError && <div className="auth-error">{authError}</div>}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8, marginTop:12 }}>
              <button className="security-primary" onClick={() => void signInWithGoogle()} disabled={authBusy || !supabaseConfigured}>
                {authBusy ? 'Connecting...' : 'Continue with Google'}
              </button>
              <button className="security-secondary" onClick={() => void signInWithOAuth('github','GitHub')} disabled={authBusy || !supabaseConfigured}>
                <Github size={16} /> GitHub
              </button>
              <button className="security-secondary" onClick={() => void signInWithOAuth('azure','Microsoft')} disabled={authBusy || !supabaseConfigured}>
                Microsoft
              </button>
              <button className="security-secondary" onClick={() => void signInWithOAuth('apple','Apple')} disabled={authBusy || !supabaseConfigured}>
                <Apple size={16} /> Apple
              </button>
            </div>

            <div style={{ display:'grid', gap:8, marginTop:14 }}>
              <div style={{ display:'flex', gap:8 }}>
                <button className={authMode === 'signin' ? 'security-primary' : 'security-secondary'} onClick={() => setAuthMode('signin')} disabled={authBusy}>Sign in</button>
                <button className={authMode === 'signup' ? 'security-primary' : 'security-secondary'} onClick={() => setAuthMode('signup')} disabled={authBusy}>Create account</button>
              </div>
              <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email address" autoComplete="email" />
              <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder={authMode === 'signup' ? 'Password (8+ characters)' : 'Password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} onKeyDown={e=>{if(e.key==='Enter') void (authMode === 'signup' ? createEmailAccount() : signInWithEmail());}} />
              <button className="security-primary" onClick={() => void (authMode === 'signup' ? createEmailAccount() : signInWithEmail())} disabled={authBusy || !supabaseConfigured}>
                <Mail size={16} /> {authMode === 'signup' ? 'Create with Email' : 'Continue with Email'}
              </button>
              <button className="security-secondary" onClick={() => void sendMagicLink()} disabled={authBusy || !supabaseConfigured || !authEmail.trim()}>
                Send Magic Link
              </button>
            </div>

            {!supabaseConfigured && <small>Supabase Auth is not configured in this deployment yet.</small>}
            <small style={{ display:'block', marginTop:8, opacity:.75 }}>Additional social buttons require their provider to be enabled in Supabase Auth.</small>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="jarvis-shell">
      <div className="scanline" />
      <header className="topbar">
        <div className="brand">
          <div className="orb">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>JARVIS</strong>
            <span>SVR • FUTURISTIC ASSISTANT</span>
          </div>
        </div>
        <div className="status">
          <span className="pulse" /> SYSTEM ONLINE
        </div>
      </header>

      <section className="dashboard single-chat">
        <section className="chat-panel">
          <div className="chat-head">
            <div>
              <span className="eyebrow">CONVERSATION CORE</span>
              <h1>What can I help you with?</h1>
              <p className="chat-subtitle">Ask JARVIS anything, or use a tool when you need one.</p>
            </div>
            <div className="head-actions">
              <button className={passiveWake ? 'active-control' : ''} title="Toggle passive Hey wake mode" onClick={togglePassiveWake} aria-label="Toggle passive wake">
                <Radio size={18} />
              </button>
              <button title="Toggle voice output" onClick={() => setVoiceEnabled(v => !v)} aria-label="Toggle voice output">
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <span>
                {speaking ? 'SPEAKING' : listening ? 'LISTENING' : busy ? 'THINKING' : passiveWake ? 'PASSIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div className={'message-row ' + message.role} key={index + '-' + message.content.slice(0, 8)}>
                <div className="message-badge">{message.role === 'user' ? 'S' : 'J'}</div>
                <div className="bubble">
                  <span>{message.role === 'user' ? 'YOU' : 'JARVIS'}</span>
                  {message.content && <div className="message-content">{renderRichMessage(message.content)}</div>}
                  {message.image?.data && message.image?.mimeType && (
                    <div className="chat-generated-image">
                      <img src={`data:${message.image.mimeType};base64,${message.image.data}`} alt="JARVIS generated result" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="thinking">
                <span />
                <span />
                <span /> JARVIS is thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chat-tools" aria-label="JARVIS chat actions">
            {[
              ['Create image', 'Create an image of a cute storybook animal in a magical forest.'],
              ['Children Factory', 'Open children factory'],
              ['Video Lab', 'Open video lab'],
              ['More', 'Open command center'],
            ].map(([label, command]) => (
              <button key={label} onClick={() => void sendMessage(command)} disabled={busy}>{label}</button>
            ))}
          </div>

          <div className="composer">
            <button className={'mic ' + (listening ? 'active' : '')} onClick={startListening} title="Dictate into the message box" aria-label="Start speech to text">
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void sendMessage(); }}
              placeholder={listening ? 'Listening… speak now' : 'Speak or type to JARVIS…'}
              aria-label="Message JARVIS"
            />
            <button className="send" onClick={() => void sendMessage()} disabled={busy || !input.trim()} aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
          <div className="hint">
            {passiveWake ? 'Passive wake is listening for “Hey” • ' : ''}
            Tap the mic to turn speech into editable text • Voice output {voiceEnabled ? 'ON' : 'OFF'}
          </div>
        </section>
      </section>

      {capabilityOpen && <CapabilityCenter onClose={() => setCapabilityOpen(false)} />}

      {empireOpen && createPortal((
        <div className="empire-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Empire Command">
          <section className="empire-panel">
            <div className="security-head">
              <div><span className="eyebrow">DUAL EMPIRE CORE</span><h2>JARVIS Empire Command</h2><p>Attention operations plus a paper-only Nexora forest laboratory.</p></div>
              <button className="close-security" onClick={() => setEmpireOpen(false)} aria-label="Close empire command"><X size={18} /></button>
            </div>
            <EmpireDashboard />
          </section>
        </div>
      ), document.body)}

      {commandOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Command Center">
          <section className="security-panel command-panel">
            <div className="security-head">
              <div><span className="eyebrow">COMMAND CORE</span><h2>JARVIS Command Center</h2><p>Fast actions for study, engineering, planning and everyday help.</p></div>
              <button className="close-security" onClick={() => setCommandOpen(false)} aria-label="Close command center"><X size={18} /></button>
            </div>
            <div className="command-grid">
              {[
                ['Explain something', 'Explain a topic clearly.'],
                ['Help me study', 'Help me study a topic with a simple plan.'],
                ['Children\'s Content Studio', 'Help me create a children\'s rhyme, story, or learning video.'],
                ['Plan my day', 'Help me make a practical plan for today.'],
                ['Give me an idea', 'Give me a useful creative idea.'],
                ['Remember this', 'Remember the important information I am about to give you.'],
              ].map(([title, prompt]) => (
                <button className="command-card" key={title} onClick={() => openCommand(prompt)}>
                  <BrainCircuit size={18} /><b>{title}</b><span>{prompt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {factoryOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Children Factory">
          <section className="security-panel" style={{ maxWidth: 1000 }}>
            <div className="security-head">
              <div>
                <span className="eyebrow">CHILDREN CONTENT FACTORY V1</span>
                <h2>JARVIS Children Factory</h2>
                <p>Topic → story → character bible → 3 consistent images → 9:16 short → approval.</p>
              </div>
              <button className="close-security" onClick={() => setFactoryOpen(false)} aria-label="Close Children Factory"><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gap:10, marginBottom:18 }}>
              <textarea value={factoryTopic} onChange={e => setFactoryTopic(e.target.value.slice(0,500))} placeholder="Example: A little lion learns not to be afraid of water" rows={3} />
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <label>Age <select value={factoryAge} onChange={e => setFactoryAge(Number(e.target.value))}>{[3,4,5,6,7,8,9,10,11,12].map(age => <option key={age} value={age}>{age}</option>)}</select></label>
                <button className="security-primary" onClick={() => void createChildrenFactory()} disabled={factoryBusy || !factoryTopic.trim()}><Sparkles size={16} /> {factoryBusy ? 'Creating…' : 'Create Children Draft'}</button>
              </div>
            </div>
            {factoryError && <div className="lock-note"><AlertTriangle size={16} /><span>{factoryError}</span></div>}
            {factoryDraft?.draft && <article className="security-card" style={{ display:'block', marginTop:12 }}>
              <span className="eyebrow">{factoryDraft.status === 'scenes_queued' ? 'SCENES IN PROGRESS' : 'CHILDREN FACTORY DRAFT'}</span>
              <h3>{factoryDraft.draft.project?.title || 'Children Story'}</h3>
              <p style={{ whiteSpace:'pre-wrap' }}>{factoryDraft.draft.story}</p>
              <div style={{ display:'grid', gap:6 }}>
                <b>Character Bible</b>
                <span>{factoryDraft.draft.characterBible?.name} · {factoryDraft.draft.characterBible?.species} · {factoryDraft.draft.characterBible?.color} · {factoryDraft.draft.characterBible?.clothes}</span>
                <span>Scene assets: {(factoryDraft.draft.images || []).length}/3 · {String(((factoryDraft.draft.pipeline || []).find((stage:any) => stage.id === 'scene_assets') || {}).status || 'unknown')}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8, marginTop:12 }}>
                {(factoryDraft.draft.images || []).map((item:any) => item.media?.url ? <img key={item.scene} src={item.media.url} alt={'Children Factory scene '+item.scene} style={{ width:'100%', borderRadius:10 }} /> : <div key={item.scene} className="lock-note">Scene {item.scene} asset stored</div>)}
                {(factoryDraft.draft.images || []).length < 3 && <div className="lock-note" style={{ gridColumn:'1 / -1' }}>JARVIS Worker is generating the remaining scene assets. The render gate stays locked until all 3 are verified.</div>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                <button className="security-secondary" onClick={() => void renderChildrenFactoryVideo()} disabled={factoryBusy || !(factoryDraft && factoryDraft.draft && factoryDraft.draft.project && factoryDraft.draft.project.id) || ((factoryDraft.draft.images || []).length < 3) || String(((factoryDraft.draft.pipeline || []).find((stage:any) => stage.id === 'scene_assets') || {}).status || '') !== 'completed'}>
                  {factoryDraft.draft.images?.length < 3 ? 'Waiting for scene assets…' : factoryRenderJob && (factoryRenderJob.status === 'running' || factoryRenderJob.status === 'queued') ? 'Rendering 9:16 short…' : 'Render 9:16 Short'}
                </button>
                {factoryDraft && factoryDraft.renderedVideo && factoryDraft.renderedVideo.mediaKey && <button className="security-secondary" onClick={() => { setYoutubeMissionId(String(factoryDraft.approvalGate && factoryDraft.approvalGate.missionId || '')); setYoutubeMediaKey(String(factoryDraft.renderedVideo.mediaKey)); setYoutubeTitle(String(factoryDraft.draft && factoryDraft.draft.project && factoryDraft.draft.project.title || '').slice(0,100)); setYoutubeDescription(String(factoryDraft.draft && factoryDraft.draft.story || '').slice(0,5000)); setFactoryOpen(false); void openYouTubeCenter(); }}>Open YouTube Publisher</button>}
              </div>
              {factoryRenderJob && <div className="security-status"><span>Render job: {factoryRenderJob.status}</span></div>}
              {factoryDraft?.mission?.status === 'failed' && <div className="lock-note" style={{ marginTop:12 }}><AlertTriangle size={16} /><span>{String(factoryDraft.mission?.metadata?.factoryFailure?.message || 'Children Factory stopped after bounded retries. Partial progress was preserved.')}</span></div>}
              <div className="lock-note" style={{ marginTop:12 }}><LockKeyhole size={16} /><span>Rendering creates a stored 9:16 MP4. Publishing is still separate and requires an approved mission.</span></div>
            </article>}
            <div style={{ display:'grid', gap:10, marginTop:16 }}>
              {missions.filter((m:any) => m.metadata?.factory === 'children-v1').map((mission:any) => <article key={mission.id} className="security-card" style={{ alignItems:'flex-start' }}>
                <Activity size={20} /><div style={{ flex:1 }}><b>{mission.goal}</b><span>Status: {mission.status}</span><span>Approval: {mission.approval?.status || 'not_required'}</span>
                  {mission.status === 'waiting_approval' && mission.approval?.status === 'pending' && <button className="security-primary" onClick={() => void approveChildrenFactory(mission.id)} disabled={factoryBusy} style={{ marginTop:10 }}>Approve Draft</button>}
                  {mission.approval?.status === 'approved' && <span style={{ marginTop:8 }}>Approved. YouTube is the current publishing target. Open YouTube Center from the YouTube command when you are ready to publish.</span>}
                </div>
              </article>)}
            </div>
          </section>
        </div>
      )}

      {missionOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Mission Center">
          <section className="security-panel" style={{ maxWidth: 960 }}>
            <div className="security-head">
              <div>
                <span className="eyebrow">MISSION RUNTIME</span>
                <h2>JARVIS Mission Center</h2>
                <p>Durable missions with explicit approval before image-generation side effects.</p>
              </div>
              <button className="close-security" onClick={() => setMissionOpen(false)} aria-label="Close mission center"><X size={18} /></button>
            </div>

            <div style={{ display:'grid', gap:10, marginBottom:18 }}>
              <textarea
                value={missionPrompt}
                onChange={e => setMissionPrompt(e.target.value)}
                placeholder="Describe the image mission you want JARVIS to run..."
                rows={3}
              />
              <button className="security-primary" onClick={() => { void createImageMission(); }} disabled={missionBusy || !missionPrompt.trim()}>
                <Sparkles size={16} /> Create Image Mission
              </button>
            </div>

            {missionError && <div className="lock-note"><AlertTriangle size={16} /> <span>{missionError}</span></div>}
            {missionBusy && <div className="security-status"><p>Mission Center is updating…</p></div>}

            <div style={{ display:'grid', gap:10 }}>
              {missions.length === 0 && !missionBusy && <div className="lock-note"><Radio size={16} /><span>No missions yet.</span></div>}
              {missions.map(mission => (
                <article key={mission.id} className="security-card" style={{ alignItems:'flex-start' }}>
                  <Activity size={20} />
                  <div style={{ flex:1 }}>
                    <b>{mission.goal}</b>
                    <span>Status: {mission.status} · Step {Number(mission.currentStep ?? 0) + 1}</span>
                    {mission.approval?.status && <span>Approval: {mission.approval.status}</span>}
                    <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                      {mission.status === 'draft' && mission.autonomy === 'execute_with_approval' && mission.approval?.status === 'not_requested' && (
                        <button className="security-secondary" onClick={() => { void requestMissionApproval(mission.id); }} disabled={missionBusy}>Request approval</button>
                      )}
                      {mission.status === 'draft' && mission.autonomy === 'execute_with_approval' && mission.approval?.status === 'requested' && (
                        <button className="security-primary" onClick={() => { void approveAndStartMission(mission.id); }} disabled={missionBusy}>Approve & Start</button>
                      )}
                      <button className="security-secondary" onClick={() => { void loadMissions(); }} disabled={missionBusy}>Refresh</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {businessOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Business Center">
          <section className="security-panel" style={{ maxWidth: 920 }}>
            <div className="security-head">
              <div><span className="eyebrow">BUSINESS OPERATIONS CORE</span><h2>JARVIS Business Center</h2><p>Manage your business profile and Brand Kit so JARVIS can use your business context across future tools.</p></div>
              <button className="close-security" onClick={() => setBusinessOpen(false)} aria-label="Close business center"><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gap:12 }}>
              <input value={business?.name || ''} onChange={e=>setBusiness({...business, name:e.target.value})} placeholder="Business name" />
              <input value={business?.industry || ''} onChange={e=>setBusiness({...business, industry:e.target.value})} placeholder="Industry" />
              <input value={business?.website || ''} onChange={e=>setBusiness({...business, website:e.target.value})} placeholder="Website" />
              <textarea value={business?.description || ''} onChange={e=>setBusiness({...business, description:e.target.value})} placeholder="What does your business do?" />
              <button className="security-primary" onClick={()=>void saveBusiness()} disabled={businessBusy}>{businessBusy ? 'Saving...' : 'Save Business Profile'}</button>
              {business && <div className="security-status">
                <b>Brand Kit</b>
                <input value={brandKit?.brand_voice || ''} onChange={e=>setBrandKit({...brandKit, brand_voice:e.target.value})} placeholder="Brand voice" />
                <input value={brandKit?.visual_style || ''} onChange={e=>setBrandKit({...brandKit, visual_style:e.target.value})} placeholder="Visual style" />
                <input value={brandKit?.image_style || ''} onChange={e=>setBrandKit({...brandKit, image_style:e.target.value})} placeholder="Image style" />
                <input value={brandKit?.video_style || ''} onChange={e=>setBrandKit({...brandKit, video_style:e.target.value})} placeholder="Video style" />
                <button className="security-secondary" onClick={()=>void saveBrandKit()} disabled={businessBusy}>Save Brand Kit</button>
              </div>}
            </div>
          </section>
        </div>
      )}

      {videoOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Video Studio">
          <section className="security-panel video-studio-panel">
            <div className="security-head">
              <div><span className="eyebrow">JARVIS VIDEO ENGINE</span><h2>Video Studio</h2><p>Story → Character Bible → Scenes → Voice → Lip-sync → QA → Render → Publish.</p></div>
              <button className="close-security" onClick={() => setVideoOpen(false)} aria-label="Close Video Studio"><X size={18} /></button>
            </div>
            <div className="video-toolbar">
              <button className="security-primary" onClick={() => void createVideoProject()} disabled={videoBusy}>New Production</button>
              <button className="security-secondary" onClick={() => void createVideoCharacter()} disabled={videoBusy || !videoProject}>Add Character</button>
              <button className="security-secondary" onClick={() => void createVideoScene()} disabled={videoBusy || !videoProject}>Add Scene</button>
              <button className="security-secondary" onClick={() => void planVideoProduction()} disabled={videoBusy || !videoProject}>Plan Production</button>
            </div>
            {videoError && <div className="security-result"><AlertTriangle size={14} /> {videoError}</div>}
            <div className="video-engine-grid">
              <div className="video-card">
                <span className="card-label">PRODUCTION</span>
                <h3>{videoProject?.title || 'No production selected'}</h3>
                <p>{videoProject?.description || 'Create a production to begin.'}</p>
                <div className="video-tags"><span>{videoProject?.format || '16:9'}</span><span>{videoProject?.status || 'draft'}</span><span>Version {videoProject?.current_version || 1}</span></div>
                <h4>Pipeline</h4>
                <div className="video-pipeline">
                  {['Story Director','Character Bible','World / Assets','Scene Director','Visual + Motion','Voice / Audio','Lip-sync','Editing','Continuity QA','Render / Publish'].map((item, i) => <div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span></div>)}
                </div>
              </div>
              <div className="video-card">
                <span className="card-label">CHARACTER BIBLE</span>
                <h3>{videoCharacters.length} Characters</h3>
                <p>Identity, appearance, voice, wardrobe, relationships and continuity are stored separately from scenes.</p>
                <div className="video-list">{videoCharacters.map(character => <button className="video-list-item" key={character.id} onClick={() => setEditingCharacter(JSON.parse(JSON.stringify(character)))}><b>{character.name}</b><span>{character.role || 'Character'} • {character.voice?.provider || 'voice'} • {character.continuity_rules?.identity_locked === false ? 'identity editable' : 'identity locked'}</span></button>)}{!videoCharacters.length && <div className="video-empty">No characters yet.</div>}</div>
              </div>
              <div className="video-card">
                <span className="card-label">SCENE DIRECTOR</span>
                <h3>{videoScenes.length} Scenes</h3>
                <p>Every scene carries dialogue, camera, visual, audio, continuity and lip-sync planning data.</p>
                <div className="video-list">{videoScenes.map(scene => <button className="video-list-item" key={scene.id} onClick={() => setEditingScene(JSON.parse(JSON.stringify(scene)))}><b>Scene {scene.scene_number}: {scene.title || 'Untitled'}</b><span>{scene.status} • lip-sync {scene.lip_sync_plan?.enabled ? 'enabled' : 'off'}</span></button>)}{!videoScenes.length && <div className="video-empty">No scenes yet.</div>}</div>
              </div>
              <div className="video-card">
                <span className="card-label">LIP-SYNC</span>
                <h3>Scene-aware synchronization</h3>
                <p>JARVIS will map each character's voice track to the correct character and preserve timing through editing and rendering.</p>
                <div className="video-checks"><span>✓ Character → voice mapping</span><span>✓ Dialogue timing</span><span>✓ Scene synchronization</span><span>✓ Final QA gate</span></div>
              </div>
            </div>
            {videoProjects.length > 0 && <div className="video-projects"><b>Recent productions</b>{videoProjects.slice(0,5).map(project => <button key={project.id} onClick={async()=>{setVideoProject(project);const [c,s]=await Promise.all([api.get('/api/video/projects/'+project.id+'/characters'),api.get('/api/video/projects/'+project.id+'/scenes')]);setVideoCharacters(c.data?.characters||[]);setVideoScenes(s.data?.scenes||[]);}}>{project.title}</button>)}</div>}
          </section>
        </div>
      )}

      {editingCharacter && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="Character Bible Editor">
          <section className="security-panel" style={{ maxWidth: 860 }}>
            <div className="security-head"><div><span className="eyebrow">CHARACTER BIBLE</span><h2>Edit {editingCharacter.name}</h2><p>Identity, appearance, voice, wardrobe and continuity are persistent production data.</p></div><button className="close-security" onClick={() => setEditingCharacter(null)} aria-label="Close character editor"><X size={18} /></button></div>
            <div style={{display:'grid',gap:10}}>
              <input value={editingCharacter.name || ''} onChange={e=>setEditingCharacter({...editingCharacter,name:e.target.value})} placeholder="Character name" />
              <input value={editingCharacter.role || ''} onChange={e=>setEditingCharacter({...editingCharacter,role:e.target.value})} placeholder="Role" />
              <textarea value={editingCharacter.profile?.personality || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,personality:e.target.value}})} placeholder="Personality" />
              <textarea value={editingCharacter.profile?.history || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,history:e.target.value}})} placeholder="History / backstory" />
              <textarea value={editingCharacter.profile?.speaking_style || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,speaking_style:e.target.value}})} placeholder="Speaking style" />
              <textarea value={editingCharacter.appearance?.visual_identity || ''} onChange={e=>setEditingCharacter({...editingCharacter,appearance:{...editingCharacter.appearance,visual_identity:e.target.value}})} placeholder="Visual identity" />
              <textarea value={editingCharacter.appearance?.clothing || ''} onChange={e=>setEditingCharacter({...editingCharacter,appearance:{...editingCharacter.appearance,clothing:e.target.value}})} placeholder="Appearance / clothing rules" />
              <input value={editingCharacter.voice?.voice_id || ''} onChange={e=>setEditingCharacter({...editingCharacter,voice:{...editingCharacter.voice,voice_id:e.target.value}})} placeholder="ElevenLabs voice ID (optional)" />
              <textarea value={editingCharacter.wardrobe?.current || ''} onChange={e=>setEditingCharacter({...editingCharacter,wardrobe:{...editingCharacter.wardrobe,current:e.target.value}})} placeholder="Current outfit" />
              <textarea value={editingCharacter.continuity_rules?.notes || ''} onChange={e=>setEditingCharacter({...editingCharacter,continuity_rules:{...editingCharacter.continuity_rules,notes:e.target.value,identity_locked:true}})} placeholder="Continuity rules" />
              <button className="security-primary" onClick={()=>void saveVideoCharacter()} disabled={videoBusy}>{videoBusy ? 'Saving...' : 'Save Character Bible'}</button>
            </div>
          </section>
        </div>
      )}

      {editingScene && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="Scene Director Editor">
          <section className="security-panel" style={{ maxWidth: 860 }}>
            <div className="security-head"><div><span className="eyebrow">SCENE DIRECTOR</span><h2>Edit Scene {editingScene.scene_number}</h2><p>Write the actual scene script and production direction before generation.</p></div><button className="close-security" onClick={() => setEditingScene(null)} aria-label="Close scene editor"><X size={18} /></button></div>
            <div style={{display:'grid',gap:10}}>
              <input value={editingScene.title || ''} onChange={e=>setEditingScene({...editingScene,title:e.target.value})} placeholder="Scene title" />
              <textarea style={{minHeight:180}} value={editingScene.script || ''} onChange={e=>setEditingScene({...editingScene,script:e.target.value})} placeholder="Scene script, action and dialogue..." />
              <textarea value={editingScene.visual_plan?.description || ''} onChange={e=>setEditingScene({...editingScene,visual_plan:{...editingScene.visual_plan,description:e.target.value}})} placeholder="Visual direction" />
              <textarea value={editingScene.camera_plan?.shots || ''} onChange={e=>setEditingScene({...editingScene,camera_plan:{...editingScene.camera_plan,shots:e.target.value}})} placeholder="Camera / shot direction" />
              <textarea value={editingScene.audio_plan?.notes || ''} onChange={e=>setEditingScene({...editingScene,audio_plan:{...editingScene.audio_plan,notes:e.target.value}})} placeholder="Voice, music and sound direction" />
              <textarea value={editingScene.continuity_notes?.notes || ''} onChange={e=>setEditingScene({...editingScene,continuity_notes:{...editingScene.continuity_notes,notes:e.target.value}})} placeholder="Continuity notes" />
              <button className="security-primary" onClick={()=>void saveVideoScene()} disabled={videoBusy}>{videoBusy ? 'Saving...' : 'Save Scene Director'}</button>
            </div>
          </section>
        </div>
      )}

      {imageLabOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Image Lab">
          <section className="security-panel" style={{ maxWidth: 920 }}>
            <div className="security-head">
              <div><span className="eyebrow">MULTIMODAL CREATIVE CORE</span><h2>JARVIS Image Lab</h2><p>Generate new images or edit a reference image with natural-language instructions.</p></div>
              <button className="close-security" onClick={() => setImageLabOpen(false)} aria-label="Close image lab"><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <textarea
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want, or describe how to edit the reference image..."
                style={{ width: '100%', minHeight: 120, resize: 'vertical', borderRadius: 12, border: '1px solid #21445b', background: '#071018', color: '#dff7ff', padding: 14, outline: 'none' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, border: '1px dashed #315d72', borderRadius: 12, color: '#8fb5c7', background: '#061018', cursor: 'pointer' }}>
                <Camera size={18} />
                {referencePreview ? 'Replace reference image' : 'Add reference image for editing'}
                <input type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void handleReferenceImage(file); }} />
              </label>
              {referencePreview && <img src={referencePreview} alt="Reference" style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 12, background: '#02060a' }} />}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="security-primary" onClick={() => void generateImage()} disabled={imageBusy || !imagePrompt.trim()}>{imageBusy ? 'Generating...' : referenceImage ? 'Edit / Generate' : 'Generate Image'}</button>
                <button className="security-secondary" onClick={clearImageLab}>Clear</button>
                {imageResult && <button className="security-secondary" onClick={downloadGeneratedImage}><Download size={16} /> Save Image</button>}
              </div>
              {imageError && <div className="security-result"><AlertTriangle size={14} /> {imageError}</div>}
              {imageResult && <img src={imageResult} alt="JARVIS generated result" style={{ width: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 14, border: '1px solid #21445b', background: '#02060a' }} />}
            </div>
          </section>
        </div>
      )}

      {youtubeOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS YouTube Center">
          <section className="security-panel" style={{ maxWidth: 900 }}>
            <div className="security-head">
              <div><span className="eyebrow">YOUTUBE OPERATIONS</span><h2>JARVIS YouTube Center</h2><p>Connect, review analytics, and publish only after an approved mission.</p></div>
              <button className="close-security" onClick={() => setYoutubeOpen(false)} aria-label="Close YouTube Center"><X size={18} /></button>
            </div>
            {youtubeError && <div className="lock-note"><AlertTriangle size={16} /><span>{youtubeError}</span></div>}
            <div className="security-status">
              <p><b>Connection:</b> {youtubeStatus?.connected ? 'Connected' : 'Not connected'}</p>
              {youtubeStatus?.channel && <p><b>Channel:</b> {youtubeStatus.channel.title}</p>}
            </div>
            {!youtubeStatus?.connected && <button className="security-primary" onClick={() => void connectYouTube()} disabled={youtubeBusy}>Connect YouTube</button>}
            {youtubeStatus?.connected && <button className="security-secondary" onClick={() => void loadYouTubeAnalytics()} disabled={youtubeBusy}>Load recent analytics</button>}
            {youtubeAnalytics?.rows && <div className="security-status"><b>Recent daily analytics</b>{youtubeAnalytics.rows.slice(-7).map((row:any[], i:number) => <p key={i}>{row.join(' • ')}</p>)}</div>}
            {youtubeStatus?.connected && <div style={{display:'grid',gap:9,marginTop:16}}>
              <b>Approved Video Publisher</b>
              <input value={youtubeMissionId} onChange={e=>setYoutubeMissionId(e.target.value)} placeholder="Approved mission ID" />
              <input value={youtubeMediaKey} onChange={e=>setYoutubeMediaKey(e.target.value)} placeholder="Stored video media key" />
              <input value={youtubeTitle} onChange={e=>setYoutubeTitle(e.target.value.slice(0,100))} placeholder="YouTube title" maxLength={100} />
              <textarea value={youtubeDescription} onChange={e=>setYoutubeDescription(e.target.value.slice(0,5000))} placeholder="Description" rows={4} />
              <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                <label>Privacy <select value={youtubePrivacy} onChange={e=>setYoutubePrivacy(e.target.value as 'private'|'unlisted'|'public')}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>
                <label><input type="checkbox" checked={youtubeMadeForKids} onChange={e=>setYoutubeMadeForKids(e.target.checked)} /> Made for kids</label>
              </div>
              <button className="security-primary" onClick={() => void publishToYouTube()} disabled={youtubePublishBusy || !youtubeMissionId.trim() || !youtubeMediaKey.trim() || !youtubeTitle.trim()}>
                {youtubePublishBusy ? 'Publishing…' : 'Publish Approved Video'}
              </button>
              {youtubePublishResult?.published && <div className="security-status"><p>✓ YouTube confirmed the upload.</p><a href={youtubePublishResult.url} target="_blank" rel="noreferrer">Open published video</a></div>}
            </div>}
            <div className="lock-note" style={{marginTop:14}}><LockKeyhole size={16}/><span>JARVIS requires an approved mission and a stored video asset. Images alone cannot be uploaded as a YouTube video.</span></div>
          </section>
        </div>
      )}

      {systemOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS System Center">
          <section className="security-panel">
            <div className="security-head">
              <div><span className="eyebrow">SYSTEM MONITOR</span><h2>JARVIS System Center</h2><p>Browser-safe diagnostics. No hidden Mac control.</p></div>
              <button className="close-security" onClick={() => setSystemOpen(false)} aria-label="Close system center"><X size={18} /></button>
            </div>
            <div className="system-cards">
              <article className="system-card"><Globe size={18} /><b>Network</b><span>{navigator.onLine ? 'Online' : 'Offline'}</span></article>
              <article className="system-card"><Shield size={18} /><b>Secure Context</b><span>{window.isSecureContext ? 'Protected' : 'Check browser'}</span></article>
              <article className="system-card"><BrainCircuit size={18} /><b>AI Core</b><span>{busy ? 'Thinking' : 'Ready'}</span></article>
              <article className="system-card"><Battery size={18} /><b>Battery</b><span>Browser permission dependent</span></article>
            </div>
            <button className="security-primary" onClick={runSystemCheck}>Run Full System Check</button>
            <div className="security-status">
              {systemResults.map(result => <div key={result} className="security-result"><CheckCircle2 size={14} /> {result}</div>)}
            </div>
            <div className="repair-diagnostics" aria-live="polite">
              <div className="repair-diagnostics-head">
                <div><b>Repair Office</b><span>{repairDiagnosticsBusy ? 'RUNNING READ-ONLY PROBES' : repairDiagnostics?.overallStatus || 'NOT RUN'}</span></div>
                <button type="button" className="repair-refresh" onClick={() => { void runRepairDiagnostics(); }} disabled={repairDiagnosticsBusy}>
                  {repairDiagnosticsBusy ? 'Checking…' : 'Recheck'}
                </button>
              </div>
              {repairDiagnostics?.checks?.map((check: any) => {
                const recoveryAction = ({
                  bounded_retry: 'Bounded retry',
                  report_configuration_gap: 'Report configuration gap',
                  degrade_optional_dependency: 'Degrade optional dependency',
                  require_reauthentication: 'Require re-authentication',
                  deny_and_escalate: 'Deny and escalate',
                  stop_and_escalate: 'Stop and escalate',
                } as Record<string, string>)[String(check.recovery?.action || '')] || 'No action';
                return <div className={'repair-check repair-' + String(check.status || 'ATTENTION').toLowerCase()} key={String(check.name)}>
                  <span className="repair-check-status">{String(check.status || 'ATTENTION')}</span>
                  <div>
                    <b>{String(check.name)}</b>
                    <small>{String(check.evidence || '')}</small>
                    <span className="repair-recovery">Recovery: <strong>{recoveryAction}</strong>{check.recovery?.terminal ? ' · terminal' : ''}</span>
                  </div>
                </div>;
              })}
            </div>
            <div className="lock-note"><Monitor size={16} /><span>Repair Office is read-only in this phase. It can detect and report problems, but it cannot mutate production automatically.</span></div>
          </section>
        </div>
      )}

      {securityOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Security Center">
          <section className="security-panel">
            <div className="security-head">
              <div>
                <span className="eyebrow">DEFENSIVE SYSTEMS</span>
                <h2>JARVIS Security Center</h2>
                <p>User-controlled security tools. No covert monitoring.</p>
              </div>
              <button className="close-security" onClick={() => { stopCamera(); setSecurityOpen(false); }} aria-label="Close security center">
                <X size={18} />
              </button>
            </div>

            <div className="security-grid">
              <article className="security-card">
                <CheckCircle2 size={20} />
                <div>
                  <b>Browser Security</b>
                  <span>Checks the app's secure browser context.</span>
                </div>
              </article>
              <article className="security-card">
                <Camera size={20} />
                <div>
                  <b>Camera Test</b>
                  <span>Only starts after you press the test button. Nothing is saved.</span>
                </div>
              </article>
              <article className="security-card">
                <LockKeyhole size={20} />
                <div>
                  <b>Mac Lock</b>
                  <span>A browser app cannot silently lock macOS. Use your Mac's normal lock command.</span>
                </div>
              </article>
              <article className="security-card">
                <AlertTriangle size={20} />
                <div>
                  <b>Privacy Guard</b>
                  <span>No automatic photos, hidden surveillance, or background camera watcher.</span>
                </div>
              </article>
            </div>

            <div className="security-actions">
              <button className="security-primary" onClick={runSecurityCheck}>Run Security Check</button>
              <button className="security-secondary" onClick={() => { void testCamera(); }}>
                <Camera size={16} /> {cameraActive ? 'Stop Camera Test' : 'Test Camera'}
              </button>
            </div>

            <section className="security-status" aria-label="JARVIS Permissions and Approvals">
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <div>
                  <b>Mission Permissions & Approvals</b>
                  <p style={{ margin:'4px 0 0' }}>Review work that requires your approval before JARVIS can perform a governed side effect.</p>
                </div>
                <button className="security-secondary" onClick={() => { void loadMissions(); }} disabled={missionBusy}>
                  {missionBusy ? 'Updating…' : 'Refresh permissions'}
                </button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8, marginTop:12 }}>
                <article className="system-card"><LockKeyhole size={16} /><b>Approval Required</b><span>{missions.filter((m:any) => m.approval?.required).length}</span></article>
                <article className="system-card"><AlertTriangle size={16} /><b>Pending</b><span>{missions.filter((m:any) => m.approval?.status === 'pending').length}</span></article>
                <article className="system-card"><Shield size={16} /><b>Controlled</b><span>{missions.filter((m:any) => ['execute_with_approval','execute_within_policy'].includes(m.autonomy)).length}</span></article>
              </div>
              <div style={{ display:'grid', gap:8, marginTop:12 }}>
                {missions.filter((m:any) => m.approval?.required && !['succeeded','canceled'].includes(String(m.status || ''))).slice(0,8).map((mission:any) => {
                  const isChildrenFactory = mission.metadata?.factory === 'children-v1';
                  const waitingForApproval = mission.approval?.status === 'pending' && mission.status === 'waiting_approval';
                  const approvalRequested = mission.approval?.status === 'requested' && mission.status === 'draft';
                  const approvalMissing = mission.approval?.status === 'not_requested' && mission.status === 'draft';
                  return <article key={mission.id} className="security-card" style={{ alignItems:'flex-start' }}>
                    <LockKeyhole size={18} />
                    <div style={{ flex:1 }}>
                      <b>{String(mission.goal || 'Governed mission')}</b>
                      <span>Status: {String(mission.status || 'unknown')} · Autonomy: {String(mission.autonomy || 'unknown')}</span>
                      <span>Approval: {String(mission.approval?.status || 'unknown')}</span>
                      <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                        {approvalMissing && <button className="security-secondary" onClick={() => { void requestMissionApproval(mission.id); }} disabled={missionBusy}>Request approval</button>}
                        {approvalRequested && !isChildrenFactory && <button className="security-primary" onClick={() => { void approveAndStartMission(mission.id); }} disabled={missionBusy}>Approve & Start</button>}
                        {waitingForApproval && isChildrenFactory && <button className="security-primary" onClick={() => { void approveChildrenFactory(mission.id); }} disabled={factoryBusy || missionBusy}>Approve</button>}
                        {!['succeeded','canceled','failed'].includes(String(mission.status || '')) && <button className="security-secondary" onClick={() => { void cancelMission(mission.id); }} disabled={missionBusy}>Cancel</button>}
                      </div>
                    </div>
                  </article>;
                })}
                {missions.filter((m:any) => m.approval?.required && !['succeeded','canceled'].includes(String(m.status || ''))).length === 0 && <div className="lock-note"><CheckCircle2 size={16} /><span>No active approval requests. JARVIS will not perform approval-gated work without an explicit approval state.</span></div>}
              </div>
              <div className="lock-note" style={{ marginTop:12 }}><LockKeyhole size={16} /><span>Approval is checked again at the mission/tool boundary. The Security Center only exposes the user's control surface; it does not grant itself permissions.</span></div>
            </section>

            {cameraActive && (
              <div className="camera-test">
                <video ref={cameraRef} autoPlay playsInline muted />
                <p>Live preview only. JARVIS is not taking or storing a photograph.</p>
              </div>
            )}

            <div className="security-status">
              <b>Security status</b>
              <p>{cameraStatus}</p>
              {securityResults.map(result => (
                <div key={result} className="security-result"><CheckCircle2 size={14} /> {result}</div>
              ))}
            </div>

            <div className="lock-note">
              <LockKeyhole size={16} />
              <span>To lock your Mac now, use <b>Control + Command + Q</b>. The web app does not pretend it can perform that system action.</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
