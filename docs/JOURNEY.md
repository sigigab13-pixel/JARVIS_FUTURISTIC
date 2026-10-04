# JARVIS Journey

This document is the public development journal for JARVIS.

The purpose is simple: record the real work as it happens.

Each entry should answer:

1. What did we build?
2. Why did we build it?
3. What changed technically?
4. What problem did we solve?
5. What remains?
6. What is the next milestone?

---

## Entry 001 — Rebuilding JARVIS as a real platform

**Status:** In progress

JARVIS is being rebuilt as a full AI platform rather than a single chatbot or a single-purpose content tool.

The architecture is moving toward a multi-cloud foundation using GitHub for source control, Vercel for the web application, Supabase for authentication and persistent data, Oracle Cloud for long-running workers, Cloudflare R2 for media storage, and Upstash Redis for queues and caching.

The product direction now includes business management, Brand Kits, persistent memory, Image Lab, Video Studio, voice, specialized offices, automation, Forest, subscriptions, analytics, repair/recovery and future integrations.

### Video Studio milestone

The Video Engine foundation now persists:

- video projects
- characters
- scenes
- production plans
- dialogue
- visual direction
- camera direction
- audio direction
- lip-sync plans
- continuity information

The Video Studio UI also has editable Character Bible and Scene Director workflows.

This matters because the goal is not to generate disconnected clips. JARVIS needs to understand a production as a structured project with reusable characters, worlds, scenes and continuity.

### Next

The next engineering work will continue turning these foundations into production execution:

- background video workers
- media storage
- generation adapters
- rendering
- QA
- recovery
- quotas
- publishing
- analytics

---

## Entry 002 — Building the JARVIS orchestration engine

**Status:** Implemented and tested on the development branch

The next major step was turning JARVIS from a collection of capabilities into an orchestrated system.

### What we built

JARVIS now has a central tool registry and execution layer for core capabilities including:

- system health checks
- persistent memory search
- image generation
- video planning
- chat generation

The `/api/jarvis` route acts as the orchestration entry point while preserving the existing capability routes.

### Autonomous planning

JARVIS can now build a validated execution plan for supported requests.

For example, a memory-aware request can be planned as:

1. search persistent memory
2. pass the relevant memory into chat generation

Explicit image and video requests are routed to their corresponding tools.

Plans are validated before execution, tool names are checked against the registry, execution results are verified, and retryable failures can be retried within bounded limits.

The execution engine also limits plan length so an unexpected request cannot create an unbounded chain of actions.

### Important fix

During testing, nested references to previous tool results were not being resolved correctly.

That was fixed so references such as nested previous outputs can now be resolved during plan execution.

### Verification

The development test suite currently passes all 6 orchestration tests, including:

- core tool registration
- image routing
- video project validation
- successful tool execution verification
- memory-to-chat autonomous planning
- rejection of unregistered tools

### What remains

The orchestration layer is still being expanded. The next infrastructure work is to connect queued jobs to durable workers, persist execution state, improve recovery, and continue integrating the multi-cloud services.

### Next milestone

**Phase 1D — Redis queue → durable worker → Supabase execution state.**

---

## Writing standard

Public updates should be honest about project status.

Do not claim a feature is deployed, production-ready, connected, or working unless it has actually been verified.

When a feature fails, document the failure and the fix. Those failures are part of the real engineering journey.


### Entry 003 — Durable worker heartbeat hardening

The JARVIS worker was hardened for long-running background jobs. Workers now refresh job heartbeats while processing so longer tasks can keep their execution lease alive. This prepares the system for future Oracle Cloud workers and longer video, memory, and automation jobs.

Development partner: GPT-5.6 Luna.

### Entry 004 — First real mission capability: Image Generation

**Status:** Implemented in source; target deployment verification pending

The first real capability adapter was added to the durable Mission Runtime: text-to-image generation.

### What we built

- Extracted the existing Hugging Face image provider into a shared image-generation service.
- Added an `image_generation` Mission Runtime adapter.
- Restricted the adapter to text-to-image execution for this first vertical slice.
- Added an explicit image-generation prompt requirement.
- Added Supabase media storage for the generated asset.
- Added SHA-256 asset hashing so the mission records verifiable output evidence without storing the full binary in mission state.
- Reused the existing image-generation allowance/usage ledger.
- Made mission media writes retry-safe with explicit storage upsert behavior.
- Added authorization tests covering approval requirements for image-generation missions.

### Verified design path

```text
Mission
  ↓
Approval / autonomy gate
  ↓
mission_step job
  ↓
Hugging Face image generation
  ↓
asset validation + hash
  ↓
Supabase media storage
  ↓
usage/allowance recording
  ↓
verified mission evidence
  ↓
mission checkpoint / completion
```

### Important limitation

The source code now contains the adapter, but this milestone is **not yet claimed as production-live**. The canonical Vercel project had been blocked by an ignored-build-step configuration, so the newly changed source had not yet received a verified production deployment in the target environment.

The adapter therefore remains fail-closed until deployment and a real end-to-end image mission are verified.

### Next

Verify the canonical Vercel deployment, then run one controlled end-to-end image mission before promoting the adapter as production-ready.

### Entry 005 — Deployment gate repair

**Status:** Configuration fixed; deployment verification pending

The canonical Vercel project was inspected before deployment rather than deploying blindly.

The latest canceled production deployment was tied to an **ignored build step**, which meant the Git-connected project could stop before the new source reached a usable production deployment.

The project configuration was corrected by removing that ignored-build-step command.

No production-live claim is being made yet. The next verification is to confirm that the current `main` commit produces a new READY deployment and then exercise the image mission end-to-end.

This is intentionally documented as a configuration repair, not as a successful deployment.


### Entry 006 — Deployment verification trigger

**Status:** Verification initiated; production readiness still unclaimed

After repairing the ignored-build-step configuration, the next safe move is to force the Git-connected deployment path to produce a fresh build from the current `main` source.

This entry records the verification trigger itself, not a successful deployment. The deployment must still be observed as READY and matched to the current `main` commit before JARVIS is considered production-live.

### Verification gate

1. Confirm a new Vercel deployment is created from `main`.
2. Confirm the deployment reaches READY.
3. Confirm its commit matches the current GitHub `main` commit.
4. Run one controlled image mission through the Mission Center with its explicit approval gate.
5. Verify generated media storage, SHA-256 evidence, usage linkage and mission completion.

No step is marked complete until it is actually observed.


### Entry 007 — Ignored-build-step command neutralized

**Status:** Configuration corrected; fresh deployment trigger pending

The first verification deployment reached the Vercel build machine, but its logs exposed an important detail: the previous ignored-build-step command was still being executed and returned exit code 0, causing Vercel to cancel the build.

The canonical project configuration was corrected again so the ignored-build-step command is explicitly neutralized with `exit 1`. This makes the next Git deployment proceed through the normal build instead of being treated as intentionally ignored.

The deployment is **not** being called successful yet. A fresh deployment from the updated configuration must still reach READY and match the current `main` commit.

### Next verification

1. Trigger a new Git deployment from `main`.
2. Confirm the ignored-build-step cancellation no longer occurs.
3. Confirm the deployment reaches READY.
4. Confirm the commit matches current `main`.
5. Run the controlled Mission Center image-generation test.
