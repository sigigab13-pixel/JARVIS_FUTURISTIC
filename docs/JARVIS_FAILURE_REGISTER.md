# JARVIS Failure Register

This register records the infrastructure and application failure modes that can
hurt JARVIS as it grows. It is intentionally defensive: it identifies risks,
early warning signs, and controls before enabling more autonomy.

## P0 — Must be reliable before serious autonomy

### Vercel deployment throttling / pause

**Risk:** deployments can be blocked or paused by plan limits, spend controls,
account state, or other platform conditions.

**Current JARVIS evidence:** the connected `jarvis-futureristic-679d` project has
recent deployments in `BLOCKED` state, so deployment health is currently a
release concern.

**Control:**
- keep deployment count low
- avoid retry loops that create deployments
- preserve a known-good deployment
- separate preview testing from production promotion
- treat `DEPLOYMENT_PAUSED` / blocked deployment as an infrastructure incident,
  not an application success/failure signal
- verify deployment protection before automated probes

### Supabase inactivity pause

**Risk:** Free Plan projects can be automatically paused after sustained low
database activity.

**Control:**
- do not design the unattended-operation plan around an always-on Free Plan
  Supabase project
- monitor project activity and pause warnings
- maintain a documented restore procedure
- keep the application able to detect database unavailability cleanly

### Supabase authorization / RLS drift

**Risk:** a table in an exposed schema can be reachable unless grants and RLS
are intentionally configured. Secret/service-role access bypasses RLS and must
remain server-side.

**Control:**
- enable RLS for exposed data
- test allow/deny behavior
- keep service keys server-only
- do not move sensitive tables to direct browser access merely for convenience

### Secret / credential compromise

**Risk:** JARVIS currently handles Supabase server credentials, YouTube OAuth
tokens, AI provider keys, Redis credentials, and other integration secrets.

**Control:**
- store secrets only in deployment secret stores
- use least-privilege credentials
- never return secrets in API payloads or logs
- rotate credentials after suspected exposure
- prefer provider-scoped credentials and minimal OAuth scopes

### Job duplication / ambiguous retry

**Risk:** a generation or publish request can succeed remotely while the local
request times out. Retrying the side effect blindly can create duplicates.

**Control:**
- make jobs idempotent
- bind external operations to stable job/content IDs where supported
- do not retry a generation POST when the outcome is unknown
- poll status endpoints or reconcile by provider request ID

## P1 — Reliability and scale risks

### Upstash command / memory / bandwidth exhaustion

**Risk:** the Free Redis tier has finite data size, bandwidth, and commands.
JARVIS uses Redis for dispatch and may increase command volume as routines and
workers scale.

**Control:**
- use Redis for queue/cache state, not canonical application history
- set TTLs for transient keys
- watch daily/monthly command usage
- use bounded queue payloads
- degrade to the durable Supabase queue when Redis is unavailable

### Upstash eventual consistency

**Risk:** replicated/global Redis reads can be eventually consistent. A read
immediately after a write may not always reflect the latest state.

**Control:**
- treat Supabase as the durable source of truth for mission/job state
- use Redis as dispatch acceleration
- never treat a possibly stale Redis read as proof of completion

### Supabase storage growth

**Risk:** images and rendered videos are much larger than normal database rows.
Storage growth and repeated downloads can become the dominant media cost.

**Control:**
- keep metadata in Postgres, media in object storage
- use deterministic content-addressed media keys
- add lifecycle/retention rules
- avoid repeated downloads through the API when direct object access is safe
- move large uploads to resumable/direct upload patterns when appropriate

### Vercel execution limits

**Risk:** web requests are not a safe home for long media jobs.

**Control:**
- keep Vercel endpoints short and orchestration-oriented
- queue heavy work
- let workers perform rendering and long-running processing
- expose job status instead of holding an HTTP request open

### GitHub Actions validation drift

**Risk:** CI can fail before tests when workflow assumptions do not match the
repository.

**Current JARVIS evidence:** `setup-node` requested npm caching, but the repo
has no lockfile, so recent Phase 3 CI runs stopped before tests/build.

**Control:**
- add a lockfile and use `npm ci`, or intentionally disable npm caching
- keep Node version explicit
- keep workflow concurrency bounded
- separate unit validation from expensive media/integration tests

### Provider concurrency / quota exhaustion

**Risk:** AI and media providers can reject requests for rate, concurrency,
credit, or temporary capacity reasons.

**Control:**
- central provider adapters
- per-provider quotas
- bounded concurrency
- exponential backoff for safe retryable errors
- circuit breaker / cooldown state
- provider fallback only when the operation is safe to reroute

## P1 — Content and child-safety risks

### Made-for-kids policy mistakes

**Risk:** children-directed content can have different privacy, advertising,
and platform features. YouTube requires creators to correctly designate
content made for kids.

**Control:**
- preserve an explicit audience classification field
- require a kids review gate
- keep made-for-kids metadata separate from a generic age number
- never infer platform policy compliance from a model's confidence alone

### Revenue estimate mistaken for real revenue

**Risk:** RPM-based estimates are not accounting records and may be especially
misleading for children-directed content because monetization features differ.

**Control:**
- label every estimate as an estimate
- keep actual platform analytics separate from modeled revenue
- store real payment/payout data only in a later, reviewed finance layer

## P2 — Business and growth risks

### Duplicate sources of truth

**Risk:** independent offices can create competing pricing, entitlement, user,
content, or provider records.

**Control:**
- canonical contracts
- shared identity chain
- one entitlement/pricing source
- one approval policy
- one publication history source

### Vendor lock-in

**Risk:** a provider can change pricing, models, APIs, terms, or availability.

**Control:**
- provider office + adapters
- capability-based routing
- portable prompts/metadata
- stored artifacts independent of generation provider where licensing permits

### Hidden architecture drift

**Risk:** documentation can claim a feature is complete when only a mock,
planning function, or isolated unit test exists.

**Control:**
Every feature gets a verification level:
1. unit-tested
2. integration-tested
3. deployed
4. externally verified

JARVIS documentation must use the highest level actually proven.

## JARVIS-specific red flags

When any of these appears, stop adding features and investigate:

- production deployment suddenly becomes BLOCKED/PAUSED
- repeated provider 429/503 responses
- Redis queue depth keeps increasing
- job leases expire while workers are active
- the same external request ID appears more than once
- a verified asset disappears from storage
- a user can see another user's project or media
- a secret appears in logs or API responses
- a deployment succeeds but health checks disagree
- CI fails before reaching tests
- plan/entitlement values disagree between API and database
- a feature is described as "live" but only has a planning function

## Parent rule

JARVIS should become more capable only after it becomes more observable,
recoverable, and evidence-driven.

Capability growth is not the graduation requirement.

Reliable capability is.
