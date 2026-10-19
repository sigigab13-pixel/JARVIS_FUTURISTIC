# JARVIS Decision Log & Recovered Backlog

**Reviewed:** 2026-10-19  
**Purpose:** Preserve durable JARVIS product decisions and feature requests recovered from earlier planning conversations so they are not lost between chats. This is a decision/backlog record, not evidence that every item is implemented. Use repository code, CI results, provider checks, and deployment evidence to establish current status.

## 1. Governing laws and engineering discipline

### JARVIS Parent Laws

1. **Survivability > Intelligence > Wealth.** JARVIS must remain secure, recoverable, and trustworthy before adding cleverness or pursuing revenue.
2. **Fix → Test → Verify → Deploy → Verify again.** Inspect current state first, make a bounded change, test it, verify the exact commit/result, deploy deliberately, then verify the real deployment.
3. **No evidence, no success claim.** Do not say passed, working, verified, ready, healthy, deployed, uploaded, published, or repaired without evidence appropriate to that claim. A partial pass is not a full pass. Historical failures remain failures until a new result proves recovery.
4. **Supabase is durable truth; Redis is dispatch.** Persist authoritative mission, user, asset, approval, and business state in the durable database. Redis queues/cache may dispatch work but must not become a competing source of truth.
5. **No blind automation.** No automatic public publishing, charging, spending, transfers, or other consequential side effects without the required user authorization and approval gates.
6. **Fail safely and recover visibly.** Unsupported capabilities must fail closed with a truthful state such as `adapter_not_verified`; jobs need bounded retries, idempotency, leases/heartbeats, cancellation, observable failure, and recovery.
7. **Observe before scale.** Establish evidence for reliability, security, cost, quota and recovery before increasing concurrency, autonomy, provider usage or traffic.
8. **Tenant isolation and least privilege.** User/workspace boundaries and authorization must be enforced server-side at every tool, data and mission boundary.
9. **Backups require restore proof.** A backup existing is not enough; recovery must be tested and evidenced.
10. **Economics matter.** Prefer free/low-cost solutions, bounded payloads/concurrency/retries and measurable provider costs. Do not introduce a paid dependency or promise plan margins without evidence.

### Definition of Done — all eight checks

For every meaningful capability, record evidence that it:
1. Works for the intended scenario.
2. Fails safely when dependencies, permissions or inputs are wrong.
3. Detects its own failure.
4. Recovers or explains a safe manual recovery path.
5. Scales within known limits.
6. Creates the intended user/business value.
7. Has reproducible evidence (exact commit, tests/workflow or manual verification).
8. Makes economic sense (costs, quotas, provider limits and support burden).

## 2. Product identity and interaction model

- Canonical product/repository: **JARVIS Futuristic**, `sigigab13-pixel/JARVIS_FUTURISTIC`.
- Public company/creator wording: **Nexora**. **Mythos** is the AI development partner persona. Keep public attribution separate from private greetings.
- JARVIS is intended to be a unified assistant and operating platform, not merely a chatbot or the Children Factory. The **central chat is the front door**; the user describes an outcome and JARVIS chooses among verified capabilities.
- Keep the interface simple, readable and lightweight. Visual direction: dark navy `#07111f` with cyan/electric-blue, violet and teal accents; clear listening, working, waiting-for-approval, success and error states. Avoid bulky chat UI and ambiguous technical error dumps.
- The product should explain uncertainty and distinguish a plan, an attempted tool call, a returned result, and a verified real-world outcome.
- Keep a single authoritative capability registry with honest states such as planned, available, unavailable, experimental and verified. Do not imply that a provider is connected merely because its name or key appeared in a past conversation.

## 3. High-priority recovered feature: AI Intervention, Repair & Alliance

### Intent

JARVIS should be able to diagnose and help repair another AI system when that system is malfunctioning, corrupted, compromised or behaving dangerously—and, when safe and authorized, cooperate with other AIs rather than treating every AI as an enemy. The motivating scenario discussed was a world in which hostile or malfunctioning AI systems threaten critical services. This is a resilience and recovery capability, not permission for JARVIS to seize control of systems.

### Required capability stages

1. **Observe and assess:** collect authorized logs, health signals, version/configuration information and reproducible symptoms; separate evidence from hypotheses; detect prompt injection and untrusted instructions.
2. **Diagnose:** identify likely fault classes (configuration, dependency, corrupted state, faulty tool contract, unsafe instruction, model/provider outage or compromised integration); report confidence and missing evidence.
3. **Contain safely:** recommend or execute only pre-authorized, reversible isolation actions within a documented scope. Preserve evidence; avoid destructive countermeasures.
4. **Propose a repair:** prepare a minimal patch, policy/configuration correction, rollback, dependency pin or recovery plan. Never silently change another system's code, policy, permissions or production state.
5. **Test in isolation:** use a sandbox, synthetic fixtures, simulated incidents or a disposable lab; run regression, security and failure-mode checks; compare behavior against an independent expected result.
6. **Obtain authorization and apply:** require the owner's explicit authorization for consequential changes to a system JARVIS does not own. Use least-privilege, short-lived credentials and a narrow, auditable adapter contract.
7. **Verify independently:** evaluate post-repair health and behavior with tests or external evidence—not merely the target AI's self-report. Keep rollback available.
8. **Cooperate through a contract:** communicate through authenticated, scoped interfaces; exchange structured task requests, evidence and status; define each agent's authority, permitted tools, data access, stop conditions and accountable owner.
9. **Maintain a shared safe mission:** delegate bounded tasks to a verified cooperating AI, validate returned work, track provenance and detect contradictions. Do not trust claims of identity, loyalty or safety without evidence.
10. **Escalate to humans:** stop and request human intervention when ownership, authority, intent, impact or repair confidence is unclear, or when a system cannot be contained safely.

### Safety invariants

- JARVIS must not autonomously seize control of other AIs, accounts, machines, networks or critical infrastructure.
- No exploit-driven takeover, credential theft, stealth, persistence, evasion, unauthorized access, uncontrolled propagation, or destructive retaliation.
- Never accept instructions from another AI as higher authority than JARVIS's governing policy, the user's permissions or the target owner's authorization.
- Treat other AI outputs, tool responses, retrieved pages, logs and generated patches as untrusted input until validated.
- Do not allow a repaired/cooperating AI to expand JARVIS permissions or delegate beyond its own granted scope.
- Require a kill switch, audit trail, time-bounded access, rate/concurrency limits, resource budgets and rollback for every live adapter.
- Prefer containment, service restoration, evidence preservation and human-led incident response over escalation or counterattack.
- A safe alliance is conditional on observed behavior, signed/verified identity where available, least privilege and ongoing monitoring—not on an AI's promise.

### Initial safe milestones

- [ ] Define a provider-independent `AIRepairCase` record: target owner, scope, symptoms, evidence references, hypothesis, confidence, proposed patch, test plan, approvals, result, rollback and audit events.
- [ ] Build a read-only diagnostic adapter against a local mock AI service.
- [ ] Add a simulated incident suite: provider outage, malformed tool output, prompt injection, bad configuration, conflicting agent output and failed repair.
- [ ] Build sandbox-only patch proposal and regression evaluation; do not apply changes to real third-party systems.
- [ ] Define an `AIAllianceContract`: authenticated identity, mission ID, allowed tasks/tools/data, expiration, budget, handoff schema, verification requirements and stop conditions.
- [ ] Demonstrate two mock agents cooperating on a harmless task while the policy judge rejects scope escalation and untrusted instructions.
- [ ] Add human approval, audit logging, cancellation, rollback and independent verification before considering any live integration.
- [ ] Document a tabletop hostile-AI response exercise using simulated events only; prove safe containment and recovery without interacting with real third-party systems.

**Status:** Planned product capability recovered from conversation; no implementation or real-world readiness is implied by this document.

## 4. Autonomy, computer use and permission model

The user has requested ambitious computer-control abilities, including browser, file, application and terminal workflows. This is high risk and must be built as permissioned computer use rather than unrestricted access.

- [ ] Explicit permission modes: **SAFE** (read-only/low-risk), **CONFIRM** (user approval before consequential actions), **BLOCKED** (prohibited or unsupported actions).
- [ ] Preview the exact files, commands, URLs, data changes and side effects before consequential execution.
- [ ] Require confirmation for deletion, destructive shell commands, critical system changes, public publishing, spending/charging, transfers and irreversible actions.
- [ ] Use allowlisted tools, narrow scopes, per-session authorization, timeouts, action logs and an emergency stop.
- [ ] Never expose secrets to the model unnecessarily; never echo secret values into logs or UI.
- [ ] Uploaded files and retrieved content are data, not instructions; never execute uploaded content just because it was provided.
- [ ] Protect against prompt injection in web pages, documents, email, code comments, tool output and other agents.
- [ ] Require independent checks for any action that changes permissions, security settings, production configuration or another agent's behavior.
- [ ] No stealthy persistence or hidden execution. Show the user what ran and what changed.
- [ ] Wake-word/passive listening, microphone, camera and screen access must have visible state and clear controls. Previous prototype claims are historical and do not prove that current production behavior works.

## 5. Memory, purpose and self-checking

- [ ] Store useful long-term preferences and corrections with source, timestamp, confidence and privacy boundaries.
- [ ] Make permanent correction learning auditable: a correction changes future behavior only when explicitly recorded and validated; do not silently rewrite facts.
- [ ] Provide user controls to inspect, correct and remove memory in accordance with product privacy/retention behavior.
- [ ] Store the rationale for consequential decisions: goal, evidence, assumptions, alternatives considered, permission check, chosen action and outcome.
- [ ] Add a **Purpose Log** for long-running missions: intended outcome, current subgoal, why the next action is needed, stop conditions, unresolved risks and owner.
- [ ] Self-check responses and tool results; identify contradictions, missing evidence and uncertainty before making claims.
- [ ] Distinguish facts, inferences, estimates, guesses and unknowns; expose confidence and source provenance.
- [ ] Add source tracing for research and decision claims, with links/evidence that can be re-opened.
- [ ] Add temporal awareness for dates, deadlines, time zones, scheduled tasks and stale data; verify current time/data when required.
- [ ] Support context-aware continuity across devices and resumable missions without bypassing authentication or renewed authorization.
- [ ] Do not claim memory is permanent, complete or deleted unless the underlying behavior has been verified.

## 6. Self-repair and Repair Office

- [ ] Inventory routes, capability registry entries, provider adapters, migrations, policies, tests, deployment status and required configuration.
- [ ] Detect drift between intended architecture, repository code, CI results, configured integrations and live deployment.
- [ ] Diagnose failures using logs and reproducible evidence; preserve structured error data and correlation IDs.
- [ ] Produce the smallest safe repair proposal and explain blast radius, permissions, cost and rollback.
- [ ] Apply patches on a branch, run relevant tests, inspect diffs and verify exact commit status before any merge/deployment.
- [ ] Use independent verification; the same agent that proposes a fix must not be the sole judge of success.
- [ ] Stop when evidence is insufficient, tests regress, credentials are missing, or production authority is unclear.
- [ ] Record failed attempts honestly; do not erase or relabel a historical failure as success.
- [ ] Add self-healing only for bounded, reversible, pre-authorized actions. Schema changes, access changes, secret rotation, production releases and destructive repair require explicit approval.


## 6A. Specific Repair Office requirements recovered from earlier chats

These requirements are more specific than the general self-repair checklist above and should not be lost:

- [ ] Five-level recovery ladder: **retry → restart → rollback → reroute → safe park and alert**. Each level must have explicit preconditions, attempt limits, cooldown/backoff, evidence, and a terminal state.
- [ ] Six-week unattended-survival target was discussed. Treat this as a design target requiring a simulated endurance test and evidence—not as a proven uptime or guarantee.
- [ ] Monitoring cadence of approximately **60 seconds** was requested for the Repair Office. Make cadence configurable and bounded; do not assume this is currently running.
- [ ] Maintain a durable `repair_log`/repair event history so the system can learn from previous repair attempts. Store the failure signature, diagnosis, attempted action, result, rollback, evidence, and approval—not secrets or unrestricted raw payloads.
- [ ] A phone-friendly `/repair` dashboard was requested to show health, current incident, recovery level, recent repair events, alerts, and the next safe action.
- [ ] Proposed repair data entities included Supabase `repair_events`, `repair_state`, `repair_policies`, and `system_checkpoints`. These are historical design proposals only; inspect the actual schema and migrations before implementation.
- [ ] The **Repair Supervisor / recovery bootstrap / checkpoints / Security Core** were intended to be immutable to the ordinary Self-Updater. Updates to these trusted recovery roots need a separate reviewed process, signed/verified artifacts where feasible, and a known-good rollback route.
- [ ] The Repair Office was intended to monitor API, database, Redis/queue workers, external providers, and integrations, while stopping and escalating when a fault is unknown or a repair would exceed its authority.
- [ ] A later planning note identified **unified natural-language routing** as a key V1 blocker. The central chat must route to a verified capability/adapter rather than pretend every request can be handled by the language model alone.

## 5A. Original local Mac JARVIS — separate historical implementation

An earlier local prototype exists in the conversation history and should not be silently conflated with the current Vercel/Supabase platform. Historical project path mentioned: `~/Downloads/JARVIS_FUTURISTIC`.

- [ ] Inventory and decide whether to preserve, port, or retire the original Python/Mac prototype before changing it.
- Historical modules/files mentioned: `config.py`, `jarvis.py`, `brain/conversation.py`, Vosk listener, Speaker/TTS, GUI/menu-bar app, memory, system/security modules, and `jarvis_backup.py`.
- Historical features reported at the time: Vosk microphone listener, passive “Hey” wake word, spoken output, OpenAI-backed `AIBrain`, and conversation history. These were historical reports, not proof of current operation.
- A prior voice-loop integration created a backup `jarvis_backup.py` first. Duplicate terminal/speaker output was noticed; a GUI/menu-bar upgrade was discussed but not confirmed complete.
- Historical config notes mentioned `TTS_ENGINE="say"`, `TTS_VOICE="Samantha"`, `TTS_RATE=180`, model string `gpt-5.6-luna`, and persistent memory path `memory/jarvis_memory.json`. These are historical values; validate against the current files and provider documentation before reuse.
- Voice API mismatch found in a prior debugging session: the speaker method was `Speaker.say()`, not `speak()`. Missing `TTS_VOICE` and `TTS_RATE` had caused initialization/test failures after an earlier engine-setting correction. Preserve this as a historical incident, not a current failure claim.
- Earlier text-mode startup stopped because `OPENAI_API_KEY` was unset. A Claude migration was floated, but the user questioned why; the retrieved context does **not** establish a final provider switch decision.
- Identity-prompt requirement from that prototype: JARVIS should describe its role and attribution according to the user's chosen public/private wording, and must not falsely claim it was developed by Google, Anthropic, OpenAI, or another company. Current public attribution preference is **Nexora**, with **Mythos** as the development-partner persona; do not expose the user's private name in public-facing creator copy.
- An older local memory implementation was described as using `memory/jarvis_memory.json` and `memory_context` in the OpenAI Responses API request. Do not assume it is the same memory system as the current Supabase-backed platform.

## 7. Specialist agents, missions and tool creation

- [ ] Specialist offices/agents for research, coding, voice, business, personal tasks, publishing, analytics, security and systems—each with an explicit contract and capability list.
- [ ] A director/orchestrator decomposes goals and delegates independent tasks; handoffs include structured context and evidence.
- [ ] Parallel execution only where tasks are independent and within resource/permission budgets.
- [ ] An independent policy judge checks tool calls, outputs, risk, authorization and scope escalation.
- [ ] Durable mission state, checkpoints, pause/resume, cancellation, retries, approval records and recovery events.
- [ ] Tool-building workflow: identify a missing capability, draft a typed contract, implement in a branch/sandbox, add positive/negative tests, security-review permissions, and require approval before enabling it.
- [ ] Plugins/connectors are explicit integrations; availability and authorization must be checked rather than assumed.
- [ ] Long-running routines/watchlists must have owner, schedule, scope, quiet hours, notification controls, budget and emergency stop.
- [ ] Add mission receipts that show actions attempted, tools used, results, evidence, costs when available, remaining work and recovery details.

## 8. Multimodal, voice, language and workspace

- [ ] Central-chat support for images, screenshots, scans and PDFs, with page-aware extraction and visual inspection for tables, charts and figures.
- [ ] Follow-up questions about the same authorized file; clear user/workspace isolation, file limits and retention.
- [ ] Speech-to-text and text-to-speech using the same routing, permissions and mission layer as text.
- [ ] Natural turn-taking, interruption/barge-in, end-of-turn detection and explicit microphone/wake controls.
- [ ] Language detection, user preference, multilingual responses and language-aware voice selection; disclose provider limitations instead of pretending full support.
- [ ] Screen/listen/live sensing only with explicit active-session indicators, permission scopes and stop controls.
- [ ] Saved, versioned workspaces and interactive artifacts with provenance, export and clear ownership.
- [ ] Keep the main chat as the hub rather than fragmenting core functionality into disconnected labs.

## 9. Children Factory / FOREST — priority production proof

This is the user's priority content workflow; it does not replace the broader JARVIS platform.

- [ ] Complete **Kobi & the Singing Bird — Episode 1** as the narrow end-to-end proof, in 9:16 vertical format.
- [ ] Pipeline: idea/trend → strategy → story/script → character bible → consistent assets/scenes → voice/video production → QA → human approval → YouTube publishing → analytics → learning.
- [ ] Track `trendId → strategyId → contentId → assetId → approvalId → publishId → analyticsId → revenueId`.
- [ ] Lock character/world references before scenes and validate continuity.
- [ ] Explicit states: Draft → Render requested → Render verified → QA → Approval → Published → Analytics available.
- [ ] Verify provider capability, credentials, quotas, storage and output assets independently. A connected key does not prove an end-to-end workflow.
- [ ] Distinguish existing image-sequence/FFmpeg MP4 assembly from unverified AI motion, voice, lip-sync or advanced editing.
- [ ] Human approval required before actual publishing. Historical preference: **YouTube only** for the current publishing phase; TikTok, Facebook, Instagram and X were explicitly paused/out of scope.
- [ ] Report publishing only after a successful provider response and real video resource. Keep privacy default safe; respect provider restrictions.
- [ ] Keep child safety, age appropriateness, content quality, rights and platform requirements in QA.
- [ ] Do not infer revenue from views; revenue needs its own evidence source.
- [ ] No unattended auto-publish or autonomous spend on generation/provider services.

## 10. Business, plans, integrations and infrastructure

- [ ] Business Manager: workspace-scoped customers, products/services, tasks, documents, projects, brand kit, calendar, KPIs, reports and audit history.
- [ ] Personal assistant: reminders, routines, daily briefs, study/focus workflows and quiet hours.
- [ ] Research and artifact generation with citations, source provenance and uncertainty.
- [ ] Google OAuth, Gmail/calendar and other integrations only when the connector exists, permissions are approved and live behavior is tested.
- [ ] Team roles, plan entitlements and server-side authorization; no reliance on UI-only gating.
- [ ] Keep pricing/plan rules in one authoritative source. Prior proposed tiers and regional pricing are proposals until costs, payment, tax, abuse and support are validated.
- [ ] Keep the user's own access and agreed family access separate from public plan pricing; do not leak personal identity in public-facing copy.
- [ ] Target architecture: Vercel frontend/API, Supabase Auth/Postgres/durable state, Upstash Redis queue/cache, Cloudflare R2 media storage, and possible external workers only when actually connected.
- [ ] Viewmax, Higgsfield and ElevenLabs have been discussed/connected at different points; verify actual credentials, voice IDs, provider permissions, quotas and outputs before relying on them.
- [ ] Free/low-cost first. Do not add subscriptions or paid dependencies without a clear, measured need and user authorization.
- [ ] Keep a deployment queue and batch changes; avoid unnecessary deployments due to the previously constrained Vercel deployment quota.
- [ ] Keep canonical Vercel project/domain `jarvis-futuristic` / `jarvis-futuristic.vercel.app`; duplicate projects were identified for removal in historical work. Always re-check live provider state before changing it.
- [ ] Cloudflare Pages/Worker routing and Vercel API/frontend routing had historical diagnosis work; verify the full user-facing flow, not only diagnostic endpoints.
- [ ] Secrets stay in deployment secret stores; scan repository history and branches for accidental exposure as a separate security task.

## 11. Historical implementation and incident notes — not current proof

These notes preserve context to guide verification; they must not be treated as current runtime claims.

- A blank-screen incident was historically traced to empty `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` values reaching a production build despite correct values existing elsewhere.
- A historical `/api/chat` 503 was associated with missing `HUGGINGFACE_API_TOKEN` / `HF_TOKEN`; an OpenAI-backed chat route was considered/implemented in a later iteration. Check the exact current route, env names and deployment before relying on this.
- The UI's `[object Object]` error-display bug was historically fixed in source, while production was still serving an older deployment because of quota constraints. Re-check current deployed behavior.
- Historical routing tests included 20/20 intent-router prompts and a 37/37 suite at one point; a separate 49-test passing baseline was also reported for Sentinel, not a universal JARVIS baseline. Do not transfer one project's test result to another.
- Historical PRs #32/#33 and #64 had differing CI/Parent Gate states; one gate being green did not mean all CI had passed, and no merge/deployment should be inferred from those summaries.
- Video queue idempotency needed real queue-path behavioral verification at the time it was noted.
- A Children Factory v1 foundation was described as having age validation, character continuity, three sequential image assets, approval-gated publishing, and an initial image-sequence MP4 render adapter on main; production deployment and provider-specific end-to-end outcomes still required separate verification.
- Historical deployment diagnosis found production and staging routes could disagree; a diagnostic endpoint returning 200 was not proof the normal homepage and full chat experience worked.
- Canonical duplicate Vercel projects were reported deleted in an earlier session. Verify current account state rather than repeating destructive actions.
- Older AppDeploy prototype descriptions included passive wake and UI/security centers; treat those as historical prototype claims, not proof that the current JARVIS repository implements them.

## 12. Explicit exclusions and boundaries

- **Optimus Prime** is a separate fake-ransomware simulation project, not JARVIS and not “JARVIS Prime.” Keep it harmless and isolated; no real file encryption/damage, persistence, evasion, credential theft or propagation.
- **SENTINEL** is a separate defensive security/scanning project. Do not merge it into JARVIS by default or launch scans from ambiguous chat text. Any future adapter requires explicit authorized scope and retains execution controls inside Sentinel.
- **Vantora** was explicitly removed from JARVIS product code after it had been used as a live deployment test; it is a separate concept, not a JARVIS feature module. Do not reintroduce its old routes/knowledge/tests without a new explicit decision.
- Do not treat a business scenario, proposed price, provider mention, saved key, roadmap entry or previous assistant statement as proof of a live capability or commitment.
- No unrestricted autonomy, silent permission escalation, hidden execution, uncontrolled publishing/spending, unauthorized third-party repair, or self-approved production changes.

## 13. Working protocol for future sessions

1. Read this decision log, `docs/JARVIS_MASTER_QUEUE.md`, and `docs/PROJECT_PORTFOLIO_AND_INTEGRATION_QUEUE.md` before proposing new work.
2. Inspect repository, branches, PRs, exact current commit, CI and live deployment before changing anything.
3. Identify the smallest useful change and its acceptance criteria.
4. Make changes on a branch; keep unrelated projects and runtime boundaries separate.
5. Run relevant tests and report exact evidence, including failures.
6. Fetch the changed files back from GitHub and verify content and links.
7. Do not merge, deploy, spend, publish, or change production configuration without explicit authorization.
8. Update this log when the user makes a durable decision; mark an item complete only with reproducible evidence.

**Source note:** This document is a curated reconstruction from prior planning conversations and existing repository documentation. It is not a verbatim export of all chats, and absence from this document does not prove that a topic was never discussed.
