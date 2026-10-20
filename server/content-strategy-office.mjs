export const CONTENT_PLATFORM_IDS = Object.freeze(['youtube', 'tiktok', 'facebook']);

export const CONTENT_FORMATS = Object.freeze({
  short: Object.freeze({
    aspectRatio: '9:16',
    durationSeconds: Object.freeze({ min: 15, max: 60 }),
  }),
  long: Object.freeze({
    aspectRatio: '16:9',
    durationSeconds: Object.freeze({ min: 60, max: 3600 }),
  }),
  square: Object.freeze({
    aspectRatio: '1:1',
    durationSeconds: Object.freeze({ min: 15, max: 180 }),
  }),
});

export const CONTENT_SERIES = Object.freeze({
  kids: Object.freeze({
    id: 'kids',
    label: 'Kids Stories & Rhymes',
    defaultFormat: 'short',
    defaultAgeRange: Object.freeze([3, 12]),
  }),
  bible: Object.freeze({
    id: 'bible',
    label: 'Bible & Motivation',
    defaultFormat: 'short',
    defaultAgeRange: Object.freeze([8, 17]),
  }),
  history: Object.freeze({
    id: 'history',
    label: 'What If & History',
    defaultFormat: 'short',
    defaultAgeRange: Object.freeze([10, 18]),
  }),
  life: Object.freeze({
    id: 'life',
    label: 'Normal Human Life',
    defaultFormat: 'short',
    defaultAgeRange: Object.freeze([13, 18]),
  }),
  military: Object.freeze({
    id: 'military',
    label: 'Military History',
    defaultFormat: 'short',
    defaultAgeRange: Object.freeze([13, 18]),
  }),
});

function clean(value, maxLength = 300) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizePlatform(value) {
  const normalized = clean(value, 30).toLowerCase();
  return CONTENT_PLATFORM_IDS.includes(normalized) ? normalized : null;
}

function normalizeSeries(value) {
  const normalized = clean(value, 30).toLowerCase();
  if (!normalized) return 'kids';
  if (!CONTENT_SERIES[normalized]) {
    throw new Error('Unsupported content series.');
  }
  return normalized;
}

function normalizeFormat(value, seriesId) {
  const normalized = clean(value, 30).toLowerCase();
  if (!normalized) return CONTENT_SERIES[seriesId].defaultFormat;
  if (!CONTENT_FORMATS[normalized]) {
    throw new Error('Unsupported content format.');
  }
  return normalized;
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function buildContentStrategy(input = {}) {
  const series = normalizeSeries(input.series);
  const format = normalizeFormat(input.format, series);
  const platforms = Array.isArray(input.platforms)
    ? [...new Set(input.platforms.map(normalizePlatform).filter(Boolean))].slice(0, 3)
    : ['youtube'];

  if (!platforms.length) {
    throw new Error('At least one supported platform is required.');
  }

  const topic = clean(input.topic, 500);
  if (!topic) {
    throw new Error('A content topic is required.');
  }

  const suppliedAge = Number(input.age);
  const targetAge = Number.isFinite(suppliedAge)
    ? Math.min(18, Math.max(3, Math.floor(suppliedAge)))
    : CONTENT_SERIES[series].defaultAgeRange[0];

  const hook = clean(input.hook, 180)
    || `A quick, clear opening that makes viewers curious about ${topic}.`;

  const variants = [
    {
      id: 'A',
      title: createTitle(topic, series, 'A'),
      thumbnailText: createThumbnailText(topic, series, 'A'),
      hook,
    },
    {
      id: 'B',
      title: createTitle(topic, series, 'B'),
      thumbnailText: createThumbnailText(topic, series, 'B'),
      hook: `What happens when ${topic.toLowerCase()} changes everything?`,
    },
  ];

  const packaging = platforms.map(platform => ({
    platform,
    format,
    aspectRatio: CONTENT_FORMATS[format].aspectRatio,
    durationSeconds: CONTENT_FORMATS[format].durationSeconds,
    titleLimit: platform === 'youtube' ? 100 : 150,
    madeForKidsReview: series === 'kids',
  }));

  return {
    version: 'content-strategy-v1',
    series,
    seriesLabel: CONTENT_SERIES[series].label,
    topic,
    targetAge,
    format,
    platforms,
    hook,
    variants,
    packaging,
    safety: {
      reviewRequired: series === 'kids',
      publishRequiresApproval: true,
      externalProviderOptional: true,
    },
    pipeline: ['strategy', 'script', 'assets', 'render', 'qa', 'approval', 'publish'],
  };
}

function createTitle(topic, series, variant) {
  if (series === 'kids') {
    return variant === 'A'
      ? `${topic}: A Little Story with a Big Lesson!`
      : `What Happens in ${topic}? | Kids Story`;
  }

  return variant === 'A' ? topic : `The Story Behind ${topic}`;
}

function createThumbnailText(topic, series, variant) {
  const trimmed = topic.replace(/[.!?]+$/, '').slice(0, 38);
  if (series === 'kids') {
    return variant === 'A' ? trimmed : 'WHAT HAPPENS?';
  }
  return variant === 'A' ? trimmed : 'THE STORY';
}

export function scoreContentIdea(input = {}) {
  const topic = clean(input.topic, 500);
  if (!topic) {
    throw new Error('A content topic is required.');
  }

  const raw = {
    clarity: Number(input.clarity ?? 0.7),
    curiosity: Number(input.curiosity ?? 0.7),
    educationalValue: Number(input.educationalValue ?? 0.7),
    seriesFit: Number(input.seriesFit ?? 0.8),
    productionEase: Number(input.productionEase ?? 0.7),
  };

  const signals = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, clamp(value)]),
  );

  const score = Math.round(
    (
      signals.clarity * 0.15
      + signals.curiosity * 0.30
      + signals.educationalValue * 0.20
      + signals.seriesFit * 0.20
      + signals.productionEase * 0.15
    ) * 100,
  );

  return {
    topic,
    score,
    tier: score >= 80 ? 'strong' : score >= 60 ? 'promising' : 'needs-work',
    signals,
  };
}
