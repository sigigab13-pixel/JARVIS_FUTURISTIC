import { queueDepth, isRedisConfigured } from './queue.mjs';
import { isSupabaseStorageConfigured } from './media.mjs';

const SAFE_RECOVERY_ACTIONS = Object.freeze({
  configuration: 'report_configuration_gap',
  transient: 'bounded_retry',
  dependency: 'degrade_optional_dependency',
  authentication: 'require_reauthentication',
  authorization: 'deny_and_escalate',
  unknown: 'stop_and_escalate',
});

const TERMINAL_FAILURES = new Set(['authorization', 'unknown']);

export function classifyRepairFailure({ category = 'unknown', retryable = false } = {}) {
  const normalized = String(category || 'unknown').trim().toLowerCase();
  if (!Object.hasOwn(SAFE_RECOVERY_ACTIONS, normalized)) return 'unknown';
  if (TERMINAL_FAILURES.has(normalized)) return normalized;
  if (normalized === 'transient' && !retryable) return 'unknown';
  return normalized;
}

export function buildRepairDecision({ category = 'unknown', retryable = false, attempts = 0, maxAttempts = 3 } = {}) {
  const normalizedAttempts = Number.isInteger(attempts) && attempts >= 0 ? attempts : 0;
  const normalizedMax = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3;
  const failureClass = classifyRepairFailure({ category, retryable });

  if (failureClass === 'transient' && normalizedAttempts < normalizedMax) {
    return {
      status: 'recoverable',
      action: SAFE_RECOVERY_ACTIONS.transient,
      attempt: normalizedAttempts + 1,
      maxAttempts: normalizedMax,
      terminal: false,
    };
  }

  return {
    status: 'escalate',
    action: SAFE_RECOVERY_ACTIONS[failureClass] || SAFE_RECOVERY_ACTIONS.unknown,
    attempt: normalizedAttempts,
    maxAttempts: normalizedMax,
    terminal: true,
  };
}


async function withTimeout(task, timeoutMs = 4000) {
  let timer;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Health probe timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function statusForFailure(errorCategory) {
  return errorCategory == 'configuration' ? 'BLOCKED' : 'ATTENTION';
}

async function probe(name, category, run, evidence) {
  try {
    const result = await run();
    return {
      name,
      category,
      status: 'READY',
      evidence: typeof evidence == 'function' ? evidence(result) : String(evidence || 'Verified by read-only health probe.'),
    };
  } catch (error) {
    return {
      name,
      category: classifyRepairFailure({ category, retryable: false }),
      status: statusForFailure(category),
      evidence: String(error?.message || error || 'Health probe failed.').slice(0, 240),
    };
  }
}

export async function getRepairOfficeDiagnostics() {
  const checks = [];

  checks.push({
    name: 'JARVIS API',
    category: 'configuration',
    status: 'READY',
    evidence: 'Production API is executing this authenticated diagnostic request.',
  });

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!supabaseUrl || !supabaseKey) {
    checks.push({
      name: 'Supabase',
      category: 'configuration',
      status: 'BLOCKED',
      evidence: 'Server-side Supabase configuration is incomplete.',
    });
  } else {
    checks.push(await probe(
      'Supabase',
      'dependency',
      async () => {
        const response = await withTimeout(() => fetch(supabaseUrl + '/auth/v1/settings', {
          headers: { apikey: supabaseKey, Accept: 'application/json' },
        }));
        if (!response.ok) throw new Error('Supabase health endpoint returned HTTP ' + response.status + '.');
        return response;
      },
      'Supabase Auth settings endpoint responded successfully.',
    ));
  }

  if (!isRedisConfigured()) {
    checks.push({
      name: 'Upstash Redis',
      category: 'configuration',
      status: 'BLOCKED',
      evidence: 'Redis REST URL/token is not configured.',
    });
  } else {
    checks.push(await probe(
      'Upstash Redis',
      'dependency',
      async () => ({ depth: await queueDepth() }),
      result => 'Redis responded to a read-only queue-depth probe; queue depth: ' + String(result?.depth ?? 0) + '.',
    ));
  }

  const storageConfigured = isSupabaseStorageConfigured();
  checks.push({
    name: 'Supabase Storage',
    category: 'configuration',
    status: storageConfigured ? 'READY' : 'BLOCKED',
    evidence: storageConfigured
      ? 'Storage configuration is present; no media was written during this check.'
      : 'Storage configuration is incomplete.',
  });

  const aiConfigured = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HF_TOKEN
  );
  checks.push({
    name: 'AI Core',
    category: 'configuration',
    status: aiConfigured ? 'READY' : 'BLOCKED',
    evidence: aiConfigured
      ? 'At least one supported AI credential is configured; no paid provider generation was triggered.'
      : 'No supported AI credential is configured.',
  });

  const blocking = checks.filter(item => item.status === 'BLOCKED').length;
  const attention = checks.filter(item => item.status === 'ATTENTION').length;
  return {
    timestamp: new Date().toISOString(),
    overallStatus: blocking ? 'BLOCKED' : attention ? 'ATTENTION' : 'READY',
    checks,
    policy: getRepairOfficePolicy(),
  };
}

export function getRepairOfficePolicy() {
  return {
    autonomousMutation: false,
    maxRetryAttempts: 3,
    safeActions: { ...SAFE_RECOVERY_ACTIONS },
    parentLaws: [1, 3, 4, 5, 23, 26, 27],
  };
}
