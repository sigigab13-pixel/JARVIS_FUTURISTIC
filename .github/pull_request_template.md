# JARVIS Parent Gate

Every PR is judged by `docs/JARVIS_PARENT_LAWS.md`.

## Parent Gate — required before merge

### 1. Truth
- [ ] I have evidence for the capability changed in this PR.
- [ ] I am not describing a mock, stub, estimate, or planned feature as "working."

### 2. Safety & Security
- [ ] No new secret is exposed to the browser, client bundle, logs, or source control.
- [ ] User isolation / authorization is preserved.
- [ ] Irreversible external actions have explicit approval, idempotency, and safe failure behavior.

### 3. Reliability
- [ ] Critical failure modes are detectable.
- [ ] Retry behavior is bounded and idempotent where side effects exist.
- [ ] Recovery / rollback behavior is understood.

### 4. Truth & Data
- [ ] I verified the real schema/API contract before relying on it.
- [ ] No unnecessary duplicate source of truth was introduced.
- [ ] Durable truth remains in its designated system.

### 5. Cost & Scale
- [ ] New provider/API/storage/compute costs are bounded or measured.
- [ ] Quotas, concurrency, payload, timeout, and retry limits were considered where relevant.

### 6. Verification
- [ ] Appropriate tests/checks pass locally or in CI.
- [ ] Runtime behavior was verified in a safe environment when applicable.
- [ ] Production was not used as an unreviewed test environment.

### 7. Rollback
- [ ] This change can be reverted safely.
- [ ] Any migration or state change has a rollback/recovery path.

## Parent stop condition

Stop merging and request changes when any of these are true:

- [ ] User isolation is uncertain.
- [ ] A secret may be exposed.
- [ ] A consequential side effect lacks approval or idempotency.
- [ ] A critical failure cannot be detected.
- [ ] A critical job cannot recover or terminate safely.
- [ ] Retry/cost behavior is unbounded.
- [ ] A production migration has not been reviewed and tested safely.
- [ ] The PR claims functionality without evidence.
- [ ] A duplicate source of truth was introduced without a documented reason.

## Evidence

**What changed?**

**What proves it works?**

**What can fail, and how is failure detected?**

**How does recovery/rollback work?**

**What are the cost/quota implications?**

**Which Parent Laws are especially relevant?**

Related docs:
- `docs/JARVIS_PARENT_LAWS.md`
- `docs/JARVIS_PARENT_PROGRAM.md`
- `docs/JARVIS_FAILURE_REGISTER.md`
