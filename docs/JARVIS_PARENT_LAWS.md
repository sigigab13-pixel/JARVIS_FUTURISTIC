# JARVIS Parent Laws

**Status:** Draft governance standard  
**Owner:** JARVIS Parent / Engineering Steward  
**Purpose:** These laws define the non-negotiable rules for how JARVIS is built, tested, secured, operated, and allowed to grow.

> **Core order:** Survivability first → Intelligence second → Wealth third.

A feature does not become “ready” merely because it works on the happy path. JARVIS earns the right to grow by producing evidence that it works, fails safely, can be observed, can recover, can scale responsibly, and creates durable value.

---

## The 30 Parent Laws

### Law 01 — Truth Before Status
Never report a capability, gate, test, deployment, or release as **passed**, **working**, **verified**, **ready**, or **healthy** unless the required evidence actually shows that result.
“Implemented” is not the same as “verified.”
A partial pass is not a full pass. A passing sub-check is not a passing system.
**No victory is declared from incomplete evidence.**

### Law 02 — Survivability Comes First
Reliability, security, recovery, and observability outrank new features.

### Law 03 — Fail Safely
Every important subsystem must have a defined safe failure mode.

### Law 04 — Detect the Failure
A silent failure is worse than a visible failure.
JARVIS must expose enough diagnostic context to identify what failed and where.

### Law 05 — Recover Before We Retry Forever
Retries must have limits, backoff, and a terminal state.
Infinite retry loops are forbidden.

### Law 06 — Durable Truth Has One Home
Supabase is the durable system of record unless an explicit architecture decision says otherwise.
Redis is for dispatch/cache/temporary coordination, not authoritative history.

### Law 07 — No Duplicate Sources of Truth
Plans, entitlements, identities, pricing, job state, and lifecycle state must not have competing authoritative implementations.

### Law 08 — Idempotency Before Side Effects
Any operation capable of creating an external side effect must have a stable idempotency strategy.

### Law 09 — Leases and Heartbeats for Unattended Work
Long-running jobs must be claimable, lease-bound, observable, and recoverable after worker failure.

### Law 10 — Dead-Letter Is Better Than Infinite Chaos
A job that cannot safely complete after its retry budget must become visible in a terminal/dead-letter state for repair.

### Law 11 — Least Privilege
Users, services, API keys, workers, database roles, and providers receive only the permissions they need.

### Law 12 — User Isolation Is Absolute
User A must never gain access to User B's memories, tokens, files, jobs, videos, analytics, or private business data.

### Law 13 — Secrets Never Enter the Browser
Service-role/secret credentials and provider secrets stay server-side or in approved secret storage.

### Law 14 — Real Schema, Real Policy
Never invent database columns, relationships, policies, or authorization models.
Inspect the live schema first; design only what the schema can actually enforce.

### Law 15 — Authentication Is Not Authorization
Being signed in does not automatically mean a user may read or modify a row.
Ownership and permission checks must be explicit.

### Law 16 — Approval Before Irreversible External Action
Publishing, charging, ordering, or other consequential external actions require explicit approval and a verified prerequisite unless a separately reviewed policy grants otherwise.

### Law 17 — Provenance Follows the Asset
Generated content must retain enough identity and provenance to explain its origin, provider, version, and lifecycle.

### Law 18 — Every Important Artifact Needs Identity
Content, assets, jobs, missions, publishes, analytics records, and monetization records need stable identifiers so the lifecycle can be traced end-to-end.

### Law 19 — Build the Chain, Not Just the Feature
The target is:
trend → strategy → content → asset → QA/approval → publish → analytics → cost/revenue → learning.

### Law 20 — Safety Before Distribution
Children's content and other sensitive outputs must pass appropriate safety/quality gates before publication.

### Law 21 — Provider Independence
External providers are adapters, not foundations of identity.
A provider outage or pricing change must not destroy JARVIS's durable state.

### Law 22 — Graceful Degradation
When an optional dependency fails, JARVIS should degrade gracefully instead of pretending the entire platform is dead.

### Law 23 — Cost Has a Ceiling
Every automated process that can consume money, quota, or large compute must have bounded usage and a visible stop condition.

### Law 24 — Economics Must Be Measured Honestly
Estimated revenue must be labeled as estimated.
Real margin must account for AI cost, storage, compute, quotas, and relevant platform costs.

### Law 25 — Backups Must Be Restorable
A backup without a successful restore drill is unverified.
Recovery procedures must be exercised, not merely documented.

### Law 26 — Changes Must Be Reversible
Prefer small, isolated, reviewable changes with a clear rollback path.

### Law 27 — Production Is Sacred
Production databases and irreversible external systems are never the first testing environment.
Use lab, branch, preview, mocks, or development systems first.

### Law 28 — Every Merge Earns Its Place
A PR should state what problem it solves, what it changes, what it does not change, and what evidence supports it.
Draft means draft; do not quietly treat it as production-ready.

### Law 29 — Simplicity Is a Security Feature
Do not add architecture merely to look sophisticated.
Reuse existing contracts and helpers when they solve the real problem.

### Law 30 — Growth Must Follow Evidence
JARVIS may scale its capabilities only when reliability, safety, observability, recovery, and economics provide evidence that the next level is justified.

---

## The Eight Definition-of-Done Questions

Every major capability should eventually answer all eight:

1. Does it work?
2. Can it fail safely?
3. Can we detect failure?
4. Can we recover?
5. Can it scale without self-destructing?
6. Does it create durable value?
7. Does it improve with evidence?
8. Does it make economic sense?

---

## Parent Stop Conditions

The Parent may pause feature growth when any of these is true:

- User-data isolation is uncertain.
- Secrets may be exposed.
- A consequential side effect lacks approval/idempotency protection.
- A critical failure cannot be detected.
- A critical job cannot be recovered.
- Retry behavior can run without a safe ceiling.
- Cost/quota consumption has no practical stop condition.
- Production schema is being changed without a reviewed migration.
- A capability is being claimed as verified without evidence.
- Two systems disagree about the source of truth.

---

## JARVIS Growth Gate

Before moving a major capability from lab → preview → production, the Parent should seek evidence for:

**Safety → Security → Correctness → Observability → Recovery → Cost → User isolation → Rollback**

The more irreversible the capability, the stronger the evidence required.

---

## Parent Philosophy

JARVIS does not become strong because it has many features.

JARVIS becomes strong because it can:

**work → fail safely → explain the failure → recover → learn → improve → repeat.**

The goal is not the loudest AI.

The goal is the **most dependable system that earns the right to become large.**
