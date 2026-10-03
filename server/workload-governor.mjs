const DEFAULTS = {
  light: { maxConcurrency: 8, maxAttempts: 3 },
  standard: { maxConcurrency: 4, maxAttempts: 3 },
  heavy: { maxConcurrency: 1, maxAttempts: 2 },
};

const HEAVY_TYPES = new Set([
  'video_pipeline',
  'video_render',
  'video_generation',
  'computer_use',
]);

const LIGHT_TYPES = new Set([
  'memory_maintenance',
  'notification',
  'analytics_refresh',
  'trend_scan',
  'health_check',
]);

export function workloadClass(jobOrType) {
  const type = typeof jobOrType === 'string'
    ? jobOrType
    : String(jobOrType?.type || '');
  if (HEAVY_TYPES.has(type)) return 'heavy';
  if (LIGHT_TYPES.has(type)) return 'light';
  return 'standard';
}

export function workloadPolicy(jobOrType, overrides = {}) {
  const key = workloadClass(jobOrType);
  const base = DEFAULTS[key];
  return {
    class: key,
    maxConcurrency: Math.max(1, Number(overrides.maxConcurrency || base.maxConcurrency)),
    maxAttempts: Math.max(1, Number(overrides.maxAttempts || base.maxAttempts)),
    checkpointRequired: key === 'heavy',
  };
}

export function groupWorkloadBatch(jobs, concurrency = 4) {
  const remaining = Array.isArray(jobs) ? jobs.slice() : [];
  const batch = [];
  const heavy = remaining.find(job => workloadClass(job) === 'heavy');
  if (heavy) return [heavy];

  for (const job of remaining) {
    if (batch.length >= concurrency) break;
    if (workloadClass(job) !== 'heavy') batch.push(job);
  }
  return batch;
}

export function nextWorkDelayMs({
  queueEmpty = false,
  failureCount = 0,
  baseMs = 1000,
  maxMs = 30000,
} = {}) {
  if (queueEmpty) return Math.min(maxMs, Math.max(baseMs, 5000));
  const failures = Math.max(0, Number(failureCount) || 0);
  return Math.min(maxMs, Math.max(baseMs, baseMs * (2 ** Math.min(failures, 5))));
}
