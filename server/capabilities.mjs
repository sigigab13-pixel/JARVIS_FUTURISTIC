const capabilities = [
  {
    id: 'chat',
    label: 'Conversation Core',
    category: 'core',
    description: 'General conversation, reasoning, planning, and natural-language assistance.',
    keywords: ['chat', 'question', 'help', 'reason', 'plan'],
    available: () => Boolean(process.env.OPENAI_API_KEY || process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN),
  },
  {
    id: 'memory',
    label: 'Long-Term Memory',
    category: 'core',
    description: 'Persistent conversation and semantic memory for the authenticated user.',
    keywords: ['memory', 'remember', 'history', 'previous', 'yesterday'],
    available: () => Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
  },
  {
    id: 'image',
    label: 'Image Lab',
    category: 'creation',
    description: 'Generate and edit images from natural-language prompts and authorized reference images.',
    keywords: ['image', 'picture', 'photo', 'illustration', 'draw', 'visual', 'poster', 'thumbnail'],
    available: () => Boolean(process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN),
  },
  {
    id: 'voice',
    label: 'Voice',
    category: 'multimodal',
    description: 'Speech input and voice output through supported browser and voice providers.',
    keywords: ['voice', 'speak', 'audio', 'listen', 'microphone', 'call', 'talk'],
    available: () => Boolean(process.env.ELEVENLABS_API_KEY),
  },
  {
    id: 'video',
    label: 'Video Lab',
    category: 'creation',
    description: 'Plan and manage children's video production projects and pipeline jobs.',
    keywords: ['video', 'animation', 'reel', 'short', 'storyboard', 'film', 'movie'],
    available: () => Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
  },
  {
    id: 'business',
    label: 'Business Manager',
    category: 'business',
    description: 'Manage authorized business profiles, brand information, projects, and future business workflows.',
    keywords: ['business', 'client', 'customer', 'crm', 'lead', 'company', 'sales', 'shop', 'brand'],
    available: () => Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
  },
  {
    id: 'web_intelligence',
    label: 'Web Intelligence',
    category: 'research',
    description: 'Real-time public-web research and current-information retrieval when a search provider is connected.',
    keywords: ['search', 'web', 'latest', 'today', 'news', 'research', 'competitor', 'current', 'online'],
    available: () => Boolean(process.env.JARVIS_WEB_SEARCH_API_KEY || process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY),
  },
  {
    id: 'youtube',
    label: 'YouTube',
    category: 'publishing',
    description: 'Authorized YouTube channel connection and publishing workflows.',
    keywords: ['youtube', 'channel', 'upload', 'publish', 'shorts'],
    available: () => Boolean(process.env.GOOGLE_YOUTUBE_CLIENT_ID && process.env.GOOGLE_YOUTUBE_CLIENT_SECRET && process.env.PUBLIC_URL),
  },
  {
    id: 'durable_missions',
    label: 'Durable Missions',
    category: 'orchestration',
    description: 'Long-running queued jobs with persistent state and worker processing.',
    keywords: ['mission', 'automate', 'schedule', 'monitor', 'background', 'every', 'workflow'],
    available: () => Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
  },
  {
    id: 'redis_queue',
    label: 'Upstash Queue',
    category: 'orchestration',
    description: 'Optional queue dispatch and background-work acceleration.',
    keywords: ['queue', 'background', 'worker', 'job', 'async'],
    available: () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  },
];

export function getCapabilityRegistry() {
  return capabilities.map(({ id, label, category, description, available }) => ({
    id,
    label,
    category,
    description,
    keywords: Array.isArray(capability.keywords) ? capability.keywords : [],
    available: Boolean(available()),
  }));
}

export function getAvailableCapabilities() {
  return getCapabilityRegistry().filter(capability => capability.available);
}

export function capabilityContextForPrompt() {
  return [
    'JARVIS capability registry (current server state):',
    ...getCapabilityRegistry().map(capability =>
      `- ${capability.id}: ${capability.description} [${capability.available ? 'available' : 'not configured'}]`
    ),
    'Do not claim a capability is available or an action is complete when the registry says the capability is unavailable or no connected tool confirms completion.',
  ].join('\n');
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const intentHints = {
  image: ['image', 'picture', 'photo', 'illustration', 'draw', 'visual'],
  video: ['video', 'animation', 'reel', 'short', 'storyboard'],
  voice: ['voice', 'speak', 'audio', 'listen', 'microphone', 'call'],
  business: ['business', 'client', 'customer', 'crm', 'lead', 'company', 'sales'],
  web_intelligence: ['search', 'web', 'latest', 'today', 'news', 'research', 'competitor', 'current'],
  youtube: ['youtube', 'channel', 'upload', 'publish'],
  memory: ['remember', 'memory', 'previous', 'yesterday', 'before'],
  durable_missions: ['mission', 'automate', 'schedule', 'monitor', 'background', 'every'],
};

export function rankCapabilitiesForIntent(input, limit = 4) {
  const tokens = new Set(tokenize(input));
  const scored = getCapabilityRegistry().map(capability => {
    const hints = intentHints[capability.id] || [];
    const score = hints.reduce((total, hint) => total + (tokens.has(hint) ? 1 : 0), 0);
    return { ...capability, score };
  });
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.available) - Number(a.available))
    .slice(0, Math.max(1, Math.min(8, Number(limit) || 4)));
}
