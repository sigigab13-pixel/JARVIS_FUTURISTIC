const MAX_MISSION_STEPS = 30;
const MAX_ATTEMPTS = 8;

const SAFE_AUTONOMY = new Set([
  'advise',
  'prepare',
  'execute_with_approval',
  'execute_within_policy',
]);

function clean(value) {
  return String(value ?? '').trim();
}

function positiveIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function inspectMissionAgainstParentLaws(mission) {
  const violations = [];
  const steps = Array.isArray(mission?.steps) ? mission.steps : [];
  const autonomy = clean(mission?.autonomy || 'advise');

  if (!SAFE_AUTONOMY.has(autonomy)) {
    violations.push({
      law: 'Law 16 — Approval Before Irreversible External Action',
      code: 'INVALID_AUTONOMY',
      message: 'Mission autonomy is not an approved JARVIS autonomy level.',
    });
  }

  if (steps.length > MAX_MISSION_STEPS) {
    violations.push({
      law: 'Law 29 — Simplicity Is a Security Feature',
      code: 'MISSION_TOO_LARGE',
      message: `Mission contains more than ${MAX_MISSION_STEPS} steps.`,
    });
  }

  steps.forEach((step, index) => {
    const id = clean(step?.id);
    const sideEffect = step?.sideEffect === true || step?.side_effect === true;
    const explicitAttempts = step?.maxAttempts ?? step?.max_attempts;
    const attempts = positiveIntOrNull(explicitAttempts);

    if (!id) {
      violations.push({
        law: 'Law 18 — Every Important Artifact Needs Identity',
        code: 'STEP_ID_REQUIRED',
        index,
        message: 'Every mission step must have a stable identifier.',
      });
    }

    if (explicitAttempts !== undefined && attempts === null) {
      violations.push({
        law: 'Law 05 — Recover Before We Retry Forever',
        code: 'INVALID_RETRY_BUDGET',
        index,
        message: 'A mission step retry budget must be a positive integer.',
      });
    } else if (attempts !== null && attempts > MAX_ATTEMPTS) {
      violations.push({
        law: 'Law 05 — Recover Before We Retry Forever',
        code: 'RETRY_BUDGET_TOO_LARGE',
        index,
        message: `Mission step retry budget cannot exceed ${MAX_ATTEMPTS} attempts.`,
      });
    }

    if (sideEffect && autonomy === 'execute_within_policy') {
      const policy = mission?.metadata?.autonomyPolicy;
      const policyApproved = policy?.status === 'approved' && policy?.allowSideEffects === true;
      if (!policyApproved) {
        violations.push({
          law: 'Law 16 — Approval Before Irreversible External Action',
          code: 'POLICY_AUTHORIZATION_REQUIRED',
          index,
          message: 'Execute-within-policy missions require an explicit approved side-effect policy.',
        });
      }
    }

    if (sideEffect && !id) {
      violations.push({
        law: 'Law 08 — Idempotency Before Side Effects',
        code: 'SIDE_EFFECT_IDENTITY_REQUIRED',
        index,
        message: 'Side-effecting mission steps need a stable step identity so the durable job can derive an idempotency key.',
      });
    }
  });

  return {
    ok: violations.length === 0,
    violations,
    limits: {
      maxMissionSteps: MAX_MISSION_STEPS,
      maxStepAttempts: MAX_ATTEMPTS,
    },
  };
}

export const PARENT_LAW_MISSION_LIMITS = Object.freeze({
  maxMissionSteps: MAX_MISSION_STEPS,
  maxStepAttempts: MAX_ATTEMPTS,
});
