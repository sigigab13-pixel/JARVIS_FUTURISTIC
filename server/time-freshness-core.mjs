const DEFAULT_TIME_ZONE = 'Africa/Lagos';
const FRESHNESS_CUES = /\b(latest|current|today|tonight|yesterday|tomorrow|this\s+week|next\s+week|recent|recently|as\s+of|right\s+now|now|currently|deadline|schedule|opens?|closed|available|availability|when)\b/i;
const ROUTE_MODES = new Set(['search', 'manage', 'decide']);

function clean(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function safeTimeZone(value) {
  const candidate = clean(value || DEFAULT_TIME_ZONE);
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getCurrentTimeContext({ now = new Date(), timeZone } = {}) {
  const zone = safeTimeZone(timeZone || process.env.JARVIS_TIMEZONE || DEFAULT_TIME_ZONE);
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter(item => item.type !== 'literal').map(item => [item.type, item.value]));
  const localDate = [values.year, values.month, values.day].join('-');
  const localTime = [values.hour, values.minute, values.second].join(':');

  return {
    iso: date.toISOString(),
    timeZone: zone,
    localDate,
    localTime,
    weekday: clean(values.weekday, 20),
    display: new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(date),
  };
}

export function classifyTimeNeed({ latestUserMessage = '', route = null } = {}) {
  const text = String(latestUserMessage ?? '').trim().slice(0, 4000).toLowerCase();
  return {
    timeSensitive: FRESHNESS_CUES.test(text) || ROUTE_MODES.has(String(route?.mode || '').toLowerCase()),
  };
}

export function classifyMemoryStaleness(memory, { now = new Date(), staleAfterDays = 30 } = {}) {
  const reference = memory?.updated_at || memory?.last_accessed_at || memory?.created_at;
  const parsed = reference ? new Date(reference) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { potentiallyStale: false, ageDays: null, reason: 'no_reliable_timestamp' };
  }

  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const ageDays = Math.max(0, (current.getTime() - parsed.getTime()) / 86400000);
  return {
    potentiallyStale: ageDays > Math.max(1, Number(staleAfterDays) || 30),
    ageDays: Math.round(ageDays * 10) / 10,
    reason: ageDays > Math.max(1, Number(staleAfterDays) || 30) ? 'older_than_stale_window' : 'within_stale_window',
  };
}

export function buildTimeAwarenessInstruction({
  timeContext,
  timeSensitive = false,
  potentiallyStaleMemoryCount = 0,
} = {}) {
  const lines = [
    'TIME AWARENESS:',
    'Current JARVIS time reference: ' + String(timeContext?.display || ''),
    'Timezone: ' + String(timeContext?.timeZone || DEFAULT_TIME_ZONE) + '.',
    'Use this time reference when interpreting relative dates such as today, yesterday, tomorrow, or this week.',
    'Do not claim a date or time was verified unless the evidence actually supports it.',
    'Do not treat old saved memory as automatically current.',
  ];

  if (timeSensitive) {
    lines.push('This request appears time-sensitive. Anchor relative dates to the current time reference and state an as-of point when that materially affects the answer.');
  }

  if (Number(potentiallyStaleMemoryCount) > 0) {
    lines.push(String(potentiallyStaleMemoryCount) + ' saved memory item(s) may be older than the freshness window. Treat them as context, not proof of current facts.');
  }

  return lines.join('\n');
}

export function getTimeContextForRequest({
  latestUserMessage = '',
  route = null,
  memories = [],
  now = new Date(),
  timeZone,
  staleAfterDays = 30,
} = {}) {
  const timeContext = getCurrentTimeContext({ now, timeZone });
  const need = classifyTimeNeed({ latestUserMessage, route });
  const potentiallyStaleMemoryCount = Array.isArray(memories)
    ? memories.reduce((count, memory) => count + (classifyMemoryStaleness(memory, { now, staleAfterDays }).potentiallyStale ? 1 : 0), 0)
    : 0;

  return {
    ...timeContext,
    ...need,
    potentiallyStaleMemoryCount,
    staleAfterDays: Math.max(1, Number(staleAfterDays) || 30),
  };
}

export const TIME_AWARENESS_LIMITS = {
  staleAfterDays: 30,
};