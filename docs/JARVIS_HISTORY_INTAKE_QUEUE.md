# JARVIS Historical Knowledge Intake Queue

**Status:** ACTIVE — promote one item at a time  
**Created:** 2026-10-06  
**Purpose:** Consolidate recoverable JARVIS project knowledge from prior conversation context and the current GitHub project record into one controlled intake queue.

## Important boundary

This queue is a **project-knowledge consolidation**, not a raw export of every historical chat message. It includes information recoverable from the conversation context available to this session plus the GitHub repository/issues/PRs/docs inspected during consolidation.

Private credentials, API keys, OAuth secrets, tokens, passwords, personal account identifiers, and other sensitive chat details are intentionally excluded.

### Evidence labels

- **REPO-VERIFIED** — directly supported by current repository files, GitHub issues/PRs, or workflow evidence inspected.
- **CHAT-RECOVERED** — recoverable from earlier JARVIS conversation context available to this session.
- **DECISION** — a product/architecture choice directed by the user.
- **PLANNED** — intended future behavior; not proof of implementation.
- **INCIDENT** — observed failure/operational event.
- **VERIFY** — must be rechecked in the live target environment before becoming a verified production fact.

---

# A. Identity and Project Boundaries

### JQ-001 — Canonical GitHub repository
**Evidence:** REPO-VERIFIED  
**Record:** `sigigab13-pixel/JARVIS_FUTURISTIC` is the canonical JARVIS source repository.

### JQ-002 — Canonical Vercel project
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** `jarvis-futuristic` is the intended canonical Vercel project.

### JQ-003 — Duplicate Vercel projects
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Similarly named duplicate projects `jarvis-futureristic` and `jarvis-futureristic-679d` were identified as duplicates and paused. The canonical correctly spelled project should be the only JARVIS Vercel project used.

### JQ-004 — Canonical public URL
**Evidence:** CHAT-RECOVERED  
**Record:** Intended public address is `https://jarvis-futuristic.vercel.app`.

### JQ-005 — Canonical URL serving status
**Evidence:** INCIDENT / VERIFY  
**Record:** The canonical URL has recently returned `503 SERVICE_UNAVAILABLE` with `DEPLOYMENT_PAUSED`. A domain being configured or an underlying deployment being READY is not sufficient evidence that production is serving traffic.

### JQ-006 — Canonical Supabase project identity
**Evidence:** CHAT-RECOVERED  
**Record:** Intended Supabase project display name is `jarvis_futureristic`. Current live project linkage must be verified before treating the name as authoritative runtime configuration.

### JQ-007 — Creator/ownership language
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Public project documentation identifies Saviour as creator/developer of JARVIS. Public shared links should not expose private identity details unnecessarily.

### JQ-008 — Project naming consistency
**Evidence:** DECISION  
**Record:** Keep the canonical JARVIS project spelling consistent and avoid resurrecting duplicate/misspelled projects.

---

# B. Product Vision and User Experience

### JQ-009 — JARVIS is a unified assistant
**Evidence:** REPO-VERIFIED / CHAT-RECOVERED  
**Record:** JARVIS is intended to be a unified conversational AI operating system rather than a simple chatbot or a set of disconnected mini-apps.

### JQ-010 — Central chat is the main hub
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Users should access supported capabilities from the central JARVIS chat whenever practical.

### JQ-011 — Avoid “separate brains”
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** The project experienced behavior that felt like two competing brains, including frontend/backend routing disagreement and `[object Object]` style failures. Server-authoritative routing was introduced to reduce duplicate decision-making.

### JQ-012 — Natural-language interaction
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** The user should be able to describe a goal naturally instead of knowing exact tool names or opening separate labs.

### JQ-013 — Image and PDF input
**Evidence:** CHAT-RECOVERED / PLANNED  
**Record:** Central JARVIS chat should accept images, screenshots, scans, documents and PDFs so JARVIS can inspect problems and explain them.

### JQ-014 — Voice interaction
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS is intended to support speech input and spoken output, with voice mode using the same intent/memory/tool infrastructure as text.

### JQ-015 — Multilingual interaction
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS is intended to support language detection, multilingual text, multilingual speech-to-text/text-to-speech, translation, and mixed-language conversations where providers support them.

### JQ-016 — Live research mode
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS is intended to support real-time web search and research with source-backed answers and freshness awareness.

### JQ-017 — Real-time tool identification
**Evidence:** CHAT-RECOVERED / PLANNED  
**Record:** JARVIS should identify the needed capability from ordinary language and choose the appropriate tool/provider rather than requiring the user to select a lab.

### JQ-018 — Business and personal assistant modes
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Business Manager and Personal Assistant are first-class modes reachable from the central chat.

### JQ-019 — Simple, distinctive visual identity
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** User preference is a simple, unique interface with a cool animated visual background and a strong JARVIS wordmark rather than an overloaded interface.

### JQ-020 — Preferred visual direction
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** Discussed visual direction centers on dark navy with cyan/electric-blue/violet/teal accents cycling through the experience.

### JQ-021 — Avoid bulky chat presentation
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** User prefers compact, attractive interaction rather than oversized/bulky chat text.

---

# C. Parent Governance and Operating Doctrine

### JQ-022 — Parent priority order
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Core order is **Survivability → Intelligence → Wealth**.

### JQ-023 — Truth before status
**Evidence:** REPO-VERIFIED  
**Record:** JARVIS must never claim a test, feature, deployment, gate, or release is passed/working/verified/healthy without the required evidence.

### JQ-024 — Survivability first
**Evidence:** REPO-VERIFIED  
**Record:** Reliability, security, recovery, and observability outrank new features.

### JQ-025 — Fail safely
**Evidence:** REPO-VERIFIED  
**Record:** Important subsystems require explicit safe failure modes.

### JQ-026 — Detect failure
**Evidence:** REPO-VERIFIED  
**Record:** Silent failure is unacceptable; diagnostic context should make failures understandable.

### JQ-027 — Bounded retries
**Evidence:** REPO-VERIFIED  
**Record:** Retries require limits, backoff where appropriate, and a terminal state.

### JQ-028 — Supabase owns durable truth
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Supabase is the durable system of record unless a reviewed architecture decision says otherwise.

### JQ-029 — Redis is not authoritative history
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Upstash Redis is for queueing, cache, dispatch and temporary coordination, not durable authoritative history.

### JQ-030 — No duplicate sources of truth
**Evidence:** REPO-VERIFIED  
**Record:** Plans, entitlements, identities, pricing, job state, and lifecycle state must not be controlled by competing authoritative implementations.

### JQ-031 — Idempotency before side effects
**Evidence:** REPO-VERIFIED  
**Record:** Side-effecting operations and important jobs need stable idempotency.

### JQ-032 — Leases and heartbeats
**Evidence:** REPO-VERIFIED  
**Record:** Long-running jobs need claim/lease/heartbeat semantics and recovery after worker failure.

### JQ-033 — Dead-letter state
**Evidence:** REPO-VERIFIED  
**Record:** Jobs that exhaust safe retry budgets should become visible in a terminal/dead-letter state.

### JQ-034 — Least privilege
**Evidence:** REPO-VERIFIED  
**Record:** Users, services, workers, credentials and providers receive only the permissions they require.

### JQ-035 — User isolation is absolute
**Evidence:** REPO-VERIFIED  
**Record:** Users/workspaces must never gain access to another user's memories, tokens, files, jobs, videos, analytics or private business data.

### JQ-036 — Secrets never enter the browser
**Evidence:** REPO-VERIFIED  
**Record:** Service-role keys, provider secrets, OAuth secrets, access/refresh tokens and database secrets stay server-side/secret-managed.

### JQ-037 — Authentication is not authorization
**Evidence:** REPO-VERIFIED  
**Record:** Being signed in is not enough; ownership and action permission must be explicit.

### JQ-038 — Approval before consequential actions
**Evidence:** REPO-VERIFIED  
**Record:** Publishing, charging, ordering and similar consequential actions require explicit approval and verified prerequisites unless a separately reviewed policy permits otherwise.

### JQ-039 — Provenance follows the asset
**Evidence:** REPO-VERIFIED  
**Record:** Important generated content/assets should retain provider/origin/version/lifecycle provenance.

### JQ-040 — Important artifacts need identity
**Evidence:** REPO-VERIFIED  
**Record:** Content, assets, jobs, missions, publishes, analytics and monetization records need stable identifiers.

### JQ-041 — Build the full chain
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Target chain is trend → strategy → content → asset → QA/approval → publish → analytics → cost/revenue → learning.

### JQ-042 — Safety before distribution
**Evidence:** REPO-VERIFIED  
**Record:** Children's content and sensitive outputs require safety/quality gates before publication.

### JQ-043 — Provider independence
**Evidence:** REPO-VERIFIED  
**Record:** External media/AI providers are adapters, not identity foundations. Provider outages or pricing changes must not destroy durable JARVIS state.

### JQ-044 — Graceful degradation
**Evidence:** REPO-VERIFIED  
**Record:** Optional dependency failures should degrade safely instead of taking down unrelated platform capabilities.

### JQ-045 — Cost ceilings
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Automated processes must have bounded quota/cost/compute and visible stop conditions.

### JQ-046 — Honest economics
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Estimated revenue must stay labeled as estimated, and real margin must account for AI, storage, compute, quotas and platform costs.

### JQ-047 — Restorable backups
**Evidence:** REPO-VERIFIED  
**Record:** Backups are not considered verified until restore procedures have actually been exercised.

### JQ-048 — Reversible changes
**Evidence:** REPO-VERIFIED  
**Record:** Prefer small, isolated, reviewable changes with clear rollback.

### JQ-049 — Production is sacred
**Evidence:** REPO-VERIFIED  
**Record:** Production databases and irreversible external systems are never the first testing environment.

### JQ-050 — Every merge earns its place
**Evidence:** REPO-VERIFIED  
**Record:** PRs should explain problem, changes, non-changes and evidence. Draft work must not be treated as production-ready.

### JQ-051 — Growth follows evidence
**Evidence:** REPO-VERIFIED  
**Record:** New capability/scale should require evidence in safety, security, observability, recovery and economics.

### JQ-052 — Queue, batch, then deploy once
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Routine development must accumulate on branches/PRs, be tested and verified, then be released deliberately rather than repeatedly deployed for every small change.

### JQ-053 — Production releases are deliberate
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Production deployment should be an explicit release action, not a side effect of routine source-control activity.

### JQ-054 — Release order
**Evidence:** REPO-VERIFIED  
**Record:** Default order is **build → test → verify → batch → deploy once → verify production**.

### JQ-055 — Definition-of-Done questions
**Evidence:** REPO-VERIFIED  
**Record:** Major capabilities should answer: does it work; fail safely; detect failure; recover; scale responsibly; create durable value; improve with evidence; make economic sense.

---

# D. Architecture and Infrastructure

### JQ-056 — Multi-cloud foundation
**Evidence:** REPO-VERIFIED  
**Record:** Target architecture uses GitHub for source/CI, Vercel for web/API delivery, Supabase for Auth/Postgres/durable state, Upstash Redis for queues/cache/dispatch, Cloudflare R2 for media/object storage, and Oracle Cloud for long-running workers.

### JQ-057 — Vercel role
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Vercel is the web application/API delivery layer, not the sole durable brain of JARVIS.

### JQ-058 — Supabase role
**Evidence:** REPO-VERIFIED  
**Record:** Auth, PostgreSQL, memory, missions/events, routines/runs and durable application state belong here unless explicitly redesigned.

### JQ-059 — Upstash role
**Evidence:** REPO-VERIFIED  
**Record:** Queueing, caching and temporary dispatch/coordination.

### JQ-060 — Cloudflare R2
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Intended long-term media/object storage layer; live connection must be verified before claiming it is active.

### JQ-061 — Oracle Cloud workers
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Desired long-running worker platform, but not to be described as connected until verified.

### JQ-062 — Worker safety model
**Evidence:** REPO-VERIFIED  
**Record:** Worker design includes bounded concurrency, per-job heartbeat, isolated failures, durable checkpoints and safe retry behavior.

### JQ-063 — Bounded parallel workers
**Evidence:** REPO-VERIFIED  
**Record:** A prior implementation allowed a worker invocation to claim up to 4 jobs concurrently with a hard concurrency ceiling. Current live status should be rechecked before calling this the active production configuration.

### JQ-064 — Mission Runtime direction
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS is moving toward durable missions with permissions, approval gates, checkpoints, transactions, recovery and monitoring.

---

# E. Chat, Routing, Memory, and Intelligence

### JQ-065 — Central orchestrator
**Evidence:** REPO-VERIFIED  
**Record:** Orchestration foundation includes a central tool registry/execution layer and an `/api/jarvis` entry point.

### JQ-066 — Tool registry
**Evidence:** REPO-VERIFIED  
**Record:** Core orchestration foundations include health checks, persistent-memory search, image generation, video planning and chat generation.

### JQ-067 — Validated execution plans
**Evidence:** REPO-VERIFIED  
**Record:** Supported requests can be converted into validated execution plans with tool-name validation, bounded plan length and execution-result verification.

### JQ-068 — Nested tool-result reference fix
**Evidence:** REPO-VERIFIED  
**Record:** A previous orchestration defect involving nested references to prior tool outputs was fixed.

### JQ-069 — Server-authoritative chat routing
**Evidence:** REPO-VERIFIED  
**Record:** The server intent router is the canonical decision for supported chat-to-surface navigation; the browser consumes that decision.

### JQ-070 — Negative routing tests
**Evidence:** REPO-VERIFIED  
**Record:** Regression coverage checks that ordinary mentions of products/tools do not accidentally open a surface.

### JQ-071 — Router verification milestone
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Earlier intent-router verification used 20 representative natural-language prompts.

### JQ-072 — Larger routing regression suite
**Evidence:** REPO-VERIFIED  
**Record:** Routing PR evidence reports 77/77 repository tests and a successful Vite production build for the exact branch at that milestone.

### JQ-073 — Memory direction
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS is intended to combine structured durable facts/preferences with semantic/vector retrieval while preserving strict workspace boundaries.

### JQ-074 — Evidence and truth engine
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS should distinguish facts, retrieved evidence, user-provided information, assumptions, estimates and generated suggestions, with provenance and confidence appropriate to task stakes.

### JQ-075 — Uncertainty manager
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS should detect insufficient information, ask the smallest useful clarification, and offer safe previews for potentially irreversible actions.

### JQ-076 — Workflow simulator/dry run
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS should simulate workflows before side effects, including dependencies, permissions, cost, likely failures and approvals.

### JQ-077 — Evaluation/self-improvement loop
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Failed missions and user corrections should become regression tests; changes should be compared against the current version rather than silently replacing critical workflows.

### JQ-078 — Adaptive fallback/recovery brain
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Choose safe fallbacks based on capability, reliability, cost and health; resume from verified checkpoints; record successful recovery paths.

### JQ-079 — Universal inbox/event bus
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Long-term plan includes unified authorized email/calendar/support/social/business events with preserved permissions.

### JQ-080 — Opportunity scout
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS should scout authorized data and public sources for content, business and cost-saving opportunities without taking external action without authorization.

---

# F. Children Content Factory — Current Strategic Priority

### JQ-081 — Flagship monetization workflow
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Children's rhymes, stories, educational content and age-appropriate media are currently the flagship production workflow.

### JQ-082 — Kobi and the Singing Bird
**Evidence:** CHAT-RECOVERED  
**Record:** Episode 1 working concept is **“Kobi and the Singing Bird.”**

### JQ-083 — Kobi short format
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** Episode 1 target is a 9:16 children's Short suitable for short-form platforms such as Shorts/Reels/TikTok.

### JQ-084 — Children Factory lifecycle
**Evidence:** REPO-VERIFIED  
**Record:** Intended chain is idea/trend → age-appropriate research → story/rhyme/script → character/world consistency → image/video/voice production → quality/continuity → approval → publishing → analytics → learning.

### JQ-085 — Kobi proof chain
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** Target Year-0/Year-1 evidence chain is trendId → strategyId → contentId → assetId → publishId → analyticsId → revenue.

### JQ-086 — Children Factory durability
**Evidence:** REPO-VERIFIED  
**Record:** Scene generation has been moved toward durable worker execution with per-scene job identity, bounded retries, failure checkpoints and atomic image-credit accounting.

### JQ-087 — Children Factory failure state
**Evidence:** REPO-VERIFIED  
**Record:** Partial scene-generation progress and provider/storage/credit failures were made durable and explicit.

### JQ-088 — Children media provider safety
**Evidence:** REPO-VERIFIED  
**Record:** Provider execution is intended to be authenticated, approval-aware and never silently autonomous for consequential actions.

### JQ-089 — Character consistency
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Children Factory includes character/world bible concepts and continuity tracking so scenes do not become disconnected random images.

### JQ-090 — Video pipeline
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Video Engine architecture includes Story Director, Character Bible, Outfit Engine, World/Asset Bible, Scene Director, storyboard/cost gate, visual generation, motion, voice/audio, lip-sync, editing, localization, subtitles, preview, continuity QA, recovery, rendering, final QA, publishing and performance memory.

### JQ-091 — Current first render path
**Evidence:** REPO-VERIFIED  
**Record:** A first real render path can queue stored images to a worker, render an MP4 with FFmpeg, store the resulting asset with a SHA-256 identifier, and hand it to the YouTube publisher.

### JQ-092 — Full AI motion remains future
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Full multi-scene AI motion, voice, lip-sync and advanced rendering remain future adapters rather than already-verified complete features.

---

# G. Providers and Media Tools

### JQ-093 — OpenAI
**Evidence:** CHAT-RECOVERED  
**Record:** OpenAI API is being used/considered for JARVIS chat and image-related capabilities.

### JQ-094 — Hugging Face
**Evidence:** REPO-VERIFIED / CHAT-RECOVERED  
**Record:** Hugging Face provider/fallback paths exist for image generation and related AI execution. Exact current provider/model configuration must be verified before claiming it is the active production route.

### JQ-095 — Higgsfield
**Evidence:** REPO-VERIFIED / CHAT-RECOVERED  
**Record:** JARVIS has a provider-independent Higgsfield video adapter and a bridge for passing private JARVIS media through short-lived signed URLs.

### JQ-096 — Viewmax
**Evidence:** CHAT-RECOVERED  
**Record:** Viewmax was connected in the JARVIS media-provider work. Current connection should be revalidated before a production capability claim.

### JQ-097 — ElevenLabs
**Evidence:** CHAT-RECOVERED  
**Record:** ElevenLabs credentials were created for future voice work; a verified voice ID had not yet been established at the time of the earlier conversation.

### JQ-098 — Everygen
**Evidence:** CHAT-RECOVERED  
**Record:** Everygen was evaluated as a possible video/content provider; pricing/credits were deferred for later inspection.

### JQ-099 — Leonardo
**Evidence:** CHAT-RECOVERED  
**Record:** Leonardo was considered for image generation but was not selected for the current path.

### JQ-100 — Provider capability contracts
**Evidence:** REPO-VERIFIED  
**Record:** Provider-neutral capability contracts were introduced so JARVIS can distinguish internal rendering from external provider capabilities instead of assuming every provider does everything.

---

# H. YouTube and Publishing

### JQ-101 — YouTube-first publishing
**Evidence:** REPO-VERIFIED  
**Record:** YouTube is the currently documented publishing and analytics target for the build phase.

### JQ-102 — YouTube OAuth
**Evidence:** REPO-VERIFIED  
**Record:** Server architecture includes user-scoped YouTube connections, offline OAuth, access-token refresh and channel status.

### JQ-103 — YouTube analytics
**Evidence:** REPO-VERIFIED  
**Record:** Server includes YouTube Analytics reporting.

### JQ-104 — Approval-gated publishing
**Evidence:** REPO-VERIFIED  
**Record:** Publishing is approval-gated and should only be reported successful after YouTube returns a successful video resource.

### JQ-105 — Default private publishing posture
**Evidence:** REPO-VERIFIED  
**Record:** Current publisher defaults to private visibility unless another allowed privacy setting is explicitly selected.

### JQ-106 — Other social platforms
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Broad social publishing to other platforms is intentionally out of scope for the current build phase.

---

# I. Business Manager and Monetization

### JQ-107 — Business Manager
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Business capabilities include profiles, products/services, customers, projects/tasks, documents, knowledge, Brand Kit, marketing workflows, reports, analytics and automation.

### JQ-108 — Personal Assistant
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Personal assistant capabilities include goals, tasks, routines, reminders, calendar, notes, personal knowledge, research, planning, voice and controlled proactive check-ins.

### JQ-109 — Brand Kit
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Brand Kit is intended to become a shared source of truth for generated images, videos, documents and marketing content.

### JQ-110 — Trend and Idea Discovery Office
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** A dedicated trend/idea layer is planned with normalized trend signals, deterministic opportunity scoring, ranked queues and fresh-evidence requirements.

### JQ-111 — Content Strategy Office
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Content strategy planning includes series/platform/format choices, title/thumbnail variants, age targeting and kids review gating.

### JQ-112 — Monetization Office
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Monetization Office is intended to turn content assets into measurable business opportunities while remaining non-transactional unless separately authorized.

### JQ-113 — Pricing direction
**Evidence:** CHAT-RECOVERED / DECISION / PLANNED  
**Record:** Earlier intended business model included free access for the owner/family use and paid Pro/Premium tiers for wider users, with low-cost entry pricing and regional pricing. Exact prices/limits are not production truth and must be finalized from actual operating economics.

### JQ-114 — Economics requirement
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** JARVIS must compare expected value against AI/media/API/storage/compute/platform costs rather than assuming every content workflow is profitable.

---

# J. Security and Reliability Roadmap

### JQ-115 — Repair Office
**Evidence:** REPO-VERIFIED  
**Record:** Repair Office is intentionally bounded. Earlier milestones exposed read-only diagnostics and deterministic recovery plans rather than unrestricted autonomous production mutation.

### JQ-116 — Health checks
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS has health/resilience concepts, including sanitized dependency readiness reporting and diagnostic routes.

### JQ-117 — Future cryptography
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Future-ready cryptography is a roadmap item focused on crypto-agility and adoption of standardized post-quantum capabilities when supported, not on inventing custom cryptography.

### JQ-118 — Security center
**Evidence:** REPO-VERIFIED  
**Record:** Security Center work exposes existing mission permission/approval state rather than inventing or self-granting permissions.

### JQ-119 — Prompt injection defense
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Future control layers include prompt-injection firewalling, secret/credential firewalling and least-privilege mission sandboxes.

### JQ-120 — Intent lock
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Future control layers include binding execution to the authorized intent/mission scope so later text cannot silently expand authority.

---

# K. Advanced JARVIS Capability Roadmap

### JQ-121 — Digital Hands
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Secure computer/browser use for authorized tasks, with screenshots/observe-act loops, approvals, sandboxing and audit.

### JQ-122 — Teach JARVIS Once
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Learn workflows by demonstration, convert them into reusable skills, version them and safely update them when websites/apps change.

### JQ-123 — Live Vision
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Near-real-time understanding of an authorized shared screen/camera context with clear access indicators.

### JQ-124 — Mission Watch
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Background mission status, progress, retries, blockers, pause/resume/cancel, recovery and history.

### JQ-125 — Evolving memory
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Separate durable memories, preferences, habits, corrections, goals and temporary context; detect stale knowledge and preserve user control.

### JQ-126 — JARVIS AI Team
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Specialist agents such as Research, Story, Image, Video, Voice, Business, Personal, Publishing, Analytics, Security and Systems, coordinated by a director/orchestrator.

### JQ-127 — Cross-device continuity
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Server-side mission state and memory should allow a user to resume across devices.

### JQ-128 — Natural voice conversation
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Barge-in, turn-taking, pauses, end-of-turn detection and shared text/voice mission context are planned.

### JQ-129 — Intelligence watchdog
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** Scheduled monitoring of approved websites/topics/keywords and meaningful change alerts, including children-content trend monitoring.

### JQ-130 — Interactive workspaces
**Evidence:** REPO-VERIFIED / PLANNED  
**Record:** JARVIS should turn answers into useful reports, tables, charts, planners, calculators, storybooks and other artifacts with versioning and provenance.

---

# L. Historical Incidents and Lessons

### JQ-131 — Vite syntax failure
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** A prior deployment failed because `src/App.tsx` contained an unexpected `}` near the reported line. Lesson: build output, not deployment metadata, determines whether source is buildable.

### JQ-132 — Ignored-build-step incident
**Evidence:** REPO-VERIFIED / INCIDENT  
**Record:** A previous Vercel project configuration used an ignored-build-step command that could return success and cause a deployment to be canceled/ignored. Configuration was corrected and later hardened.

### JQ-133 — 100 deployments/day exhaustion
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** The Vercel Hobby deployment allowance was exhausted after a large number of deployments accumulated in a short period. Deployment history showed roughly 95 deployments in the relevant recent window.

### JQ-134 — Deployment churn lesson
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** User explicitly rejected the practice of deploying each small change and established the queue-first batch release rule.

### JQ-135 — Exact deployment quota reset
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** The prior Vercel API error gave a reset around **October 7, 2026 at 12:08 PM Nigeria time**. This is a historical quota event and must not be treated as a permanent quota number for future plans without fresh verification.

### JQ-136 — Production pause incident
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** Even a Vercel deployment object reported as READY was not necessarily serving traffic because the project was returning `DEPLOYMENT_PAUSED`.

### JQ-137 — READY does not equal LIVE
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** A deployment with READY status, or a configured alias/domain, must never be called “live” until the production domain actually serves the expected application.

### JQ-138 — Manual unpause was insufficient
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** A project-unpause action was attempted, but the user still observed `DEPLOYMENT_PAUSED`. Lesson: account/usage/spend conditions may sit above the project-level pause control.

### JQ-139 — Vercel deployment-policy limitation on Hobby
**Evidence:** CURRENT TOOL EVIDENCE / VERIFY  
**Record:** The current Vercel tool rejected a deployment-policy configuration with a `pro_plan_required` error. This means Pro/Enterprise-only deployment-policy controls cannot be relied upon on the current Hobby plan.

### JQ-140 — No more speculative deployment loops
**Evidence:** DECISION  
**Record:** When Vercel is quota-blocked or paused, repeated redeployment attempts are prohibited. Diagnose the account/project condition and continue work in GitHub/local verification.

---

# M. Current Release Governance Work

### JQ-141 — PR #47
**Evidence:** REPO-VERIFIED  
**Record:** PR #47 is the current queue-first deployment-governance work. It is open and not merged.

### JQ-142 — Parent Gate #68
**Evidence:** REPO-VERIFIED  
**Record:** Parent Gate run #68 succeeded for the current governance branch head.

### JQ-143 — Current CI state
**Evidence:** REPO-VERIFIED at last inspection  
**Record:** JARVIS CI run #208 was still in progress at the last inspection; tests had completed successfully and the frontend build was still running at that moment. Do not call the run fully passed unless a completed success conclusion is observed.

### JQ-144 — Queue branch
**Evidence:** REPO-VERIFIED  
**Record:** This intake queue is being collected on branch `chore/jarvis-history-intake-queue` so the history itself is not silently merged into production.

### JQ-145 — Queue promotion rule
**Evidence:** DECISION  
**Record:** Each historical item must be reviewed, normalized and promoted into the correct durable JARVIS source one at a time. No bulk assumption that historical ideas are production capabilities.

---

# N. V1 Finish Line and Roadmap Status

### JQ-146 — V1 focus
**Evidence:** REPO-VERIFIED  
**Record:** The project is using a focused V1 instead of attempting the entire master roadmap at once.

### JQ-147 — V1 foundations documented
**Evidence:** REPO-VERIFIED  
**Record:** V1 queue records authentication foundation, persistent data foundation, core chat/API architecture, AI fallback diagnostics, Children Factory foundation, YouTube publishing foundation, queue/worker foundation, permission/approval surface, Repair Office diagnostics/recovery, and unified natural-language routing as major milestones.

### JQ-148 — V1 unfinished milestones
**Evidence:** REPO-VERIFIED  
**Record:** The documented V1 finish line still includes an end-to-end Children Factory demo path and final UI polish/release QA.

### JQ-149 — Large roadmap is deliberately deferred
**Evidence:** REPO-VERIFIED  
**Record:** Business Manager expansion, Personal Assistant expansion, advanced motion/lip-sync, broad social publishing, knowledge graph, advanced proactive intelligence, teams, white-label and other large items are deferred until the foundations justify them.

### JQ-150 — Core growth doctrine
**Evidence:** REPO-VERIFIED / DECISION  
**Record:** Build foundations before surface features; one vertical slice at a time; verify every layer in a real environment; preserve working capabilities; prioritize identity, permissions, isolation, truthfulness, observability and recovery.

---

# O. One-Item Promotion Protocol

For every JQ item promoted into JARVIS durable knowledge:

1. Confirm the source/evidence.
2. Decide whether it is a **fact, decision, planned capability, incident, or hypothesis**.
3. Remove stale or conflicting language.
4. Attach provenance and a last-verified date where practical.
5. Store it in the correct durable JARVIS system rather than in multiple competing stores.
6. Add a regression test when the item describes expected behavior.
7. Verify the result before moving to the next queue item.

**Queue rule:** Historical knowledge never outranks current verified system state.

**Parent rule:** When historical chat and the live system disagree, the live verified system wins, and the disagreement itself is recorded as an incident/knowledge conflict.

---

## Queue completion target

This queue is considered complete for the currently recoverable project history when:

- known product decisions have been captured,
- known architecture decisions have been captured,
- known incidents/failures have been captured,
- current verified capabilities have been separated from planned capabilities,
- provider connection claims are marked with verification state,
- roadmap items are preserved without being mistaken for implementation,
- and each promoted item has provenance.



---

# P. Additional Historical Technical Context Recovered From Prior Conversations

### JQ-151 — Development hardware constraint
**Evidence:** CHAT-RECOVERED  
**Record:** The user has worked on JARVIS from a phone with 2 GB RAM, so lightweight workflows and cloud execution are important.

### JQ-152 — Primary Mac development environment
**Evidence:** CHAT-RECOVERED  
**Record:** Earlier development environment included a 2020 Intel i7 MacBook Pro with 16 GB RAM, macOS 15.7.9, Homebrew 6.0.21 and Python 3.14.7.

### JQ-153 — Vercel plan at last known state
**Evidence:** REPO/TOOL-VERIFIED / CHAT-RECOVERED  
**Record:** The canonical Vercel team was on the Hobby plan at the last verified inspection.

### JQ-154 — Vercel operational constraints observed
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** Earlier work encountered build/deployment limits including deployment-count exhaustion, build-rate blocking, a reported function execution ceiling, and payload-size concerns. Exact limits should always be freshly verified before planning around them.

### JQ-155 — Earlier Vercel traffic snapshot
**Evidence:** CHAT-RECOVERED  
**Record:** A previous dashboard snapshot showed roughly 324 CDN requests and 54 function invocations during the observed period. These were development-era observations, not scale guarantees.

### JQ-156 — Earlier payload/build concern
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** Earlier work encountered a reported payload around 4.5 MB and a 300-second execution/build-related limit. Treat as historical incident evidence, not current platform limits.

### JQ-157 — Hugging Face model/router history
**Evidence:** CHAT-RECOVERED  
**Record:** Earlier configuration discussions used a Hugging Face router model identified as `openai/gpt-oss-120b:fastest` with Anthropic Claude Sonnet fallback. A Qwen model attempt produced a model-not-supported error. Current active provider/model routing must be verified before treating this as present configuration.

### JQ-158 — Supabase permission incident
**Evidence:** CHAT-RECOVERED / INCIDENT  
**Record:** Earlier deployment work hit a Supabase permission error involving `jarvis_users`. Lesson: inspect live schema/RLS/policies before assuming frontend/backend access is correct.

### JQ-159 — Pricing/RLS hardening targets
**Evidence:** CHAT-RECOVERED / REPO-VERIFIED  
**Record:** Earlier security review identified `jarvis_plan_prices` and `jarvis_family_access` as tables requiring explicit RLS/policy attention. A LAB-only PR proposed policies. Do not assume the hardening was applied to production unless current database evidence proves it.

### JQ-160 — Pricing source duplication risk
**Evidence:** CHAT-RECOVERED  
**Record:** Earlier work identified risk of duplicate pricing definitions between `jarvis_plans` and a creator/studio pricing proposal. Parent Law 07 requires one authoritative pricing source.

### JQ-161 — Redis development state
**Evidence:** CHAT-RECOVERED  
**Record:** Upstash Redis was previously observed healthy and empty, with an indicated 256 MB / 500K-style allowance display. These quota figures are historical and must be rechecked before budgeting.

### JQ-162 — Worker hardening gap recorded previously
**Evidence:** CHAT-RECOVERED / VERIFY  
**Record:** Earlier review identified missing or incomplete idempotency, lease and heartbeat hardening in a worker path. Later PRs added worker safety changes. Current active worker implementation must be inspected before declaring the gap fully closed.

### JQ-163 — Image Lab provider history
**Evidence:** CHAT-RECOVERED  
**Record:** The user reported that Image Lab eventually worked after earlier failures. This should remain a user-reported milestone until an end-to-end current-environment test provides fresh evidence.

### JQ-164 — Viewmax connection
**Evidence:** CHAT-RECOVERED  
**Record:** Viewmax was connected during media-provider work. Current credential/connection health must be verified before production use.

### JQ-165 — Higgsfield credential history
**Evidence:** CHAT-RECOVERED  
**Record:** A Higgsfield API key was created. Never store or reproduce its secret value in project documentation.

### JQ-166 — ElevenLabs credential history
**Evidence:** CHAT-RECOVERED  
**Record:** An ElevenLabs key was created for voice work. A verified voice ID had not yet been established at the last known point.

### JQ-167 — OpenAI image/chat usage
**Evidence:** CHAT-RECOVERED  
**Record:** OpenAI API usage was discussed for JARVIS chat and image capabilities. Exact active usage should be checked against current environment configuration.

### JQ-168 — Old AppDeploy project
**Evidence:** CHAT-RECOVERED  
**Record:** An older AppDeploy project was named “JARVIS Empire Command.” The user later wanted AppDeploy removed/paused rather than used as the canonical production path.

### JQ-169 — Old AppDeploy usage snapshot
**Evidence:** CHAT-RECOVERED  
**Record:** An earlier AppDeploy snapshot reported roughly 173 views / 227.18 credits. This is historical usage information and not a current billing/usage state.

### JQ-170 — Canonical-project-only rule
**Evidence:** DECISION  
**Record:** Do not split JARVIS across the old AppDeploy project and duplicate Vercel projects. The canonical source/application path must remain clear.

### JQ-171 — Children media-provider credit priority
**Evidence:** CHAT-RECOVERED  
**Record:** The user wants to manage expensive image/video/voice provider credits carefully, especially while producing Kobi content. Credits should be spent only after the pipeline and release gates justify generation.

### JQ-172 — Video-provider selection history
**Evidence:** CHAT-RECOVERED  
**Record:** The user compared Higgsfield, Viewmax and Everygen for children's video creation. Provider choice should depend on capability quality, continuity, credits, cost, reliability, and verified integration rather than brand name alone.

### JQ-173 — Kobi production workflow
**Evidence:** CHAT-RECOVERED  
**Record:** Kobi Episode 1 was to be structured for an Everygen-compatible 9:16 children's Short and later evaluated alongside other providers. The workflow should preserve the same character/world identity across scenes.

### JQ-174 — User's cost preference
**Evidence:** CHAT-RECOVERED / DECISION  
**Record:** The project should prefer free/low-cost infrastructure while validating the product, without compromising the Parent Laws around security, reliability and truthfulness.

### JQ-175 — No deployment while quota is exhausted
**Evidence:** DECISION  
**Record:** During an exhausted deployment quota, repository/CI testing is preferred over creating additional Vercel deployments. A release should be assembled first and deployed once the platform is available.

### JQ-176 — Current release-control intent
**Evidence:** DECISION  
**Record:** The queue-first policy is meant to survive beyond the current incident: batch related work, prove it in CI/lab, then spend one deliberate production deployment.

---

# Q. Historical Chat Sources Not Fully Exportable

### JQ-177 — Available history boundary
**Evidence:** CHAT-RECOVERED  
**Record:** The session can recover prior JARVIS context that is surfaced to it, but it does not have a guaranteed raw export of every older conversation thread. Therefore this queue is comprehensive for the currently recoverable context, not a promise of access to unavailable chats.

### JQ-178 — Conflict rule
**Evidence:** DECISION  
**Record:** When an older conversation claim conflicts with current repository/database/provider evidence, current verified evidence wins and the conflict is preserved as historical context rather than silently overwritten.

Updated: 2026-10-06
