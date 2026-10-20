export const TREND_PLATFORMS = Object.freeze(['youtube', 'tiktok', 'facebook']);

export const TREND_WINDOWS = Object.freeze({
  hourly: 1,
  sixHours: 6,
  daily: 24,
  weekly: 168,
});

function clean(value, maxLength = 300) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function normalizeTrendSignal(input = {}) {
  const topic = clean(input.topic, 500);
  if (!topic) throw new Error('A trend topic is required.');

  const platform = clean(input.platform, 30).toLowerCase();
  if (!TREND_PLATFORMS.includes(platform)) {
    throw new Error('An unsupported trend platform was supplied.');
  }

  return {
    topic,
    platform,
    velocity: clamp(input.velocity ?? 0.5),
    engagement: clamp(input.engagement ?? 0.5),
    freshness: clamp(input.freshness ?? 0.8),
    audienceFit: clamp(input.audienceFit ?? 0.7),
    source: clean(input.source, 200) || 'user-supplied',
    observedAt: clean(input.observedAt, 80) || null,
  };
}

export function rankTrendOpportunity(input = {}) {
  const signal = normalizeTrendSignal(input);
  const score = Math.round(
    (
      signal.velocity * 0.30
      + signal.engagement * 0.25
      + signal.freshness * 0.20
      + signal.audienceFit * 0.25
    ) * 100,
  );

  return {
    ...signal,
    score,
    tier: score >= 80 ? 'priority' : score >= 60 ? 'promising' : 'watch',
  };
}

export function buildTrendQueue(signals = [], options = {}) {
  if (!Array.isArray(signals)) {
    throw new Error('Trend signals must be an array.');
  }

  const requestedLimit = Number(options.limit);
  const max = Math.min(
    20,
    Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 10),
  );

  return signals
    .map(rankTrendOpportunity)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function buildSixHourTrendCheck({
  series = 'kids',
  platforms = TREND_PLATFORMS,
} = {}) {
  const safeSeries = clean(series, 30).toLowerCase() || 'kids';
  const safePlatforms = [
    ...new Set(
      (Array.isArray(platforms) ? platforms : [])
        .map(value => clean(value, 30).toLowerCase())
        .filter(value => TREND_PLATFORMS.includes(value)),
    ),
  ];

  return {
    version: 'trend-office-v1',
    series: safeSeries,
    platforms: safePlatforms.length ? safePlatforms : TREND_PLATFORMS,
    intervalHours: 6,
    nextAction: 'collect-fresh-signals',
    publishAutomatically: false,
    requiresFreshEvidence: true,
  };
}
