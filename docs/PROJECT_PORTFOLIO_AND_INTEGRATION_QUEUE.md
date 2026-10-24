# JARVIS Portfolio & Cross-Project Integration Register

**Last reviewed:** 2026-10-19  
**Purpose:** Keep the known project portfolio, unfinished JARVIS capabilities, cross-project opportunities, and verification rules in one version-controlled place. This is a planning and tracking document, not a claim that every listed capability is implemented. See also the [JARVIS Decision Log & Recovered Backlog](JARVIS_DECISION_LOG_AND_RECOVERED_BACKLOG.md) for durable product decisions, AI repair/alliance requirements, autonomy boundaries, historical incident notes, and recovered priorities.

## Truth labels

- **Verified in repository** — code or documentation exists at a known ref; runtime status still depends on the relevant tests and deployment evidence.
- **Partial / needs verification** — some foundations exist, but the full user-facing workflow has not been verified end to end.
- **Planned** — requested or designed, not yet demonstrated as working.
- **External dependency** — requires a provider account, secret, permission, schema, or deployment change that must be checked separately.

Never promote a planned item to “working” merely because it appears in a roadmap, README, PR description, or generated response.

## Portfolio map

| Project / workstream | Purpose | Relationship to JARVIS | Current planning status |
|---|---|---|---|
| **JARVIS Futuristic** | Unified AI assistant and operating platform for chat, research, memory, missions, tools, content, business, personal workflows, and reliability | Main assistant product and source of truth for its own roadmap | Active repository; use CI, branch and runtime evidence for each capability |
| **Optimus Prime** | Separate fake-ransomware / security-awareness simulation project | Separate project; not JARVIS PRIME and not part of JARVIS's core product identity | Track independently. Keep it a harmless simulation: no real file encryption, destructive behavior, persistence, evasion, credential theft, or uncontrolled propagation |
| **Children Factory / FOREST** | Age-appropriate rhymes, stories, character-consistent images/video/voice, quality checks, approvals, publishing, analytics and learning | First-class JARVIS workflow, not a separate replacement for JARVIS | Foundations and provider adapters exist in the repository; full production loop and provider-specific outcomes must be verified |
| **Kobi & the Singing Bird — Episode 1** | First focused vertical children's story/video production example | Reference workflow for proving Children Factory end to end | Planned execution target: 9:16; keep character/world consistency; do not mark render/publish complete without asset and provider evidence |
| **SENTINEL** | Defensive security/scanning project with bounded scans, protocol-aware results, evidence and reports | Separate specialist product; JARVIS may later help explain reports or coordinate authorized lab workflows through a narrow integration | Separate codebase/workstream; do not merge its code into JARVIS by default or treat JARVIS as a scanner until a reviewed adapter exists |
| **Vantora** | All-in-one fintech/logistics concept covering payments, airtime/data, savings/investment, flights/hotels, logistics and transport | Separate product/business; JARVIS can support planning, customer-service drafts, documentation, operations and analytics | Concept/planning; regulated transactions, balances, bookings and payments are not assumed to exist |
| **Nexora** | Company/brand umbrella for business and product work | Public-facing company/brand identity; use “Nexora” in public-facing JARVIS creator/company wording rather than exposing a personal identity | Brand/portfolio rule; confirm each public page follows it before publishing |
| **Nexora hospitality expansion scenario** | Explore a possible hotel footprint across 36 states, with 50 suites per state as a scenario | JARVIS Business Manager could model assumptions, locations, staffing, unit economics and operations | Scenario only, not an approved commitment or evidence of funded properties |
| **Maverick Legion design workstream** | Distinctive motorcycle/helmet/suit visual-design concept, including the Arctic Phantom styling direction | Creative workspace use case for reference images, design briefs, asset/version management and marketing content | Creative concept; no vehicle purchase, manufacturing, or physical-world action is implied |
| **JARVIS platform and infrastructure** | Vercel frontend, Supabase durable data/auth, Upstash dispatch/queues, media storage and approved worker/provider adapters | Shared operating foundation | Configuration and deployment state must be checked from the connected systems before changes are made |

This register captures known project context from prior planning. **Optimus Prime is the fake-ransomware project; it is not JARVIS PRIME.** Add additional projects here when they are identified; do not invent project status or imply that separate systems are already connected.

## JARVIS capability backlog — one unified assistant

The central chat should remain the front door. Users describe an outcome; JARVIS identifies suitable capabilities and tools, explains meaningful uncertainty, requests approval when needed, executes within permission boundaries, and verifies the result.

### P0 — Reliability and trustworthy execution

- [ ] Maintain one authoritative capability registry with explicit states: planned, available, unavailable, experimental, and verified.
- [ ] Ensure server-authoritative intent/context routing; test ambiguous, multi-step, and follow-up prompts against real supported tools.
- [ ] Show the difference between a plan, a tool call, a successful tool result, and a verified real-world outcome.
- [ ] Preserve structured error details instead of rendering `[object Object]`; provide safe, readable failures with correlation IDs.
- [ ] Make worker jobs idempotent with leases, heartbeats, bounded retries, dead-letter handling and observable recovery.
- [ ] Enforce per-user/workspace authorization at each tool and data boundary.
- [ ] Add a mission receipt with requested goal, permissions, actions attempted, evidence, costs where available, unresolved work, and rollback/recovery details.
- [ ] Keep database truth in its designated durable store; queues are dispatch mechanisms, not a second source of truth.
- [ ] Keep tests and verification in branches/CI; batch changes and deploy deliberately under the existing deployment-quota rules.
- [ ] Preserve a clean rollback path for every consequential code/configuration/schema change.

### P0 — Self-knowledge, evidence and controlled repair

- [ ] Reconcile the capability registry with actual server routes, provider adapters, credentials/configuration presence (never values), tests, and current deployment status.
- [ ] Use source provenance and citation tracing for research-derived claims.
- [ ] Surface uncertainty and distinguish facts, estimates, hypotheses and missing evidence.
- [ ] Store decision rationale and durable user corrections with appropriate privacy and true-forget controls.
- [ ] Detect contradictions in memory and ask a focused clarification when the conflict materially changes the action.
- [ ] Use dry-run/workflow simulation before side effects; include permission, dependency, risk and cost checks.
- [ ] Repair Office should detect, diagnose, propose a bounded fix, test it, verify the result and stop if authority or evidence is insufficient.
- [ ] Never let an agent silently grant itself permissions, edit production data, expose secrets, or claim its own success without independent evidence.

### P0 — Central multimodal and language experience

- [ ] Support authorized image, screenshot and PDF inputs in the main chat with page-aware document extraction and visual inspection.
- [ ] Keep follow-up context for uploaded files while respecting user/workspace boundaries and retention settings.
- [ ] Add speech-to-text, text-to-speech, interruption handling and a shared text/voice tool-routing path.
- [ ] Support language detection, user language preferences, multilingual responses and graceful disclosure when a provider lacks language support.
- [ ] Add safe live screen/computer-use workflows only with explicit session controls, least privilege, previews and approval gates.
- [ ] Keep the interface readable and lightweight, with clear listening/working/approval/success/error states and the existing dark navy/cyan/violet/teal visual direction.

### P0 — Children Factory / FOREST proof chain

- [ ] Track the full identity chain: `trendId → strategyId → contentId → assetId → approvalId → publishId → analyticsId → revenueId`.
- [ ] Build a character bible and reference set before scene production; check continuity between scenes.
- [ ] Keep production states explicit: Draft → Render requested → Render verified → QA → Approval → Published → Analytics available.
- [ ] Use provider capability contracts and check required credentials/permissions without printing secret values.
- [ ] Record generation/provider/model/version, costs when available, asset hashes, QA findings and approval evidence.
- [ ] Make child-safety, rights, content-quality and human approval gates mandatory before public distribution.
- [ ] Complete Kobi & the Singing Bird Episode 1 as the first narrow end-to-end proof; do not expand to unattended publishing before the chain is reliable.
- [ ] Distinguish the existing FFmpeg assembly path from any provider capability that has not been tested (AI motion, voice, lip-sync, or advanced editing).
- [ ] Keep YouTube publishing, analytics and revenue reporting as separate verified stages; do not infer revenue from views.

### P1 — Business Manager and Personal Assistant

- [ ] Workspace-scoped businesses, projects, customers, tasks, documents, brand kits, calendars, KPIs and audit history.
- [ ] Personal tasks, routines, reminders, daily briefs and study/focus workflows with quiet hours and clear user controls.
- [ ] Research, report, proposal, SOP, content-calendar and spreadsheet-style artifact generation with provenance.
- [ ] Approved integrations for email, calendar, publishing, CRM and other tools; no assumed connector availability.
- [ ] Team roles, permissions, plan entitlements and per-user cost accounting before opening shared workspaces or paid features.
- [ ] Business analytics that separate observed data from forecasts and estimates.

### P1 — Long-running intelligence and workspace continuity

- [ ] Persistent mission state that survives browser/device changes and resumes only with valid authorization.
- [ ] Standing goals and scheduled routines with explicit scope, notification controls, quiet hours and emergency stop.
- [ ] Early-warning/watchlist workflows for approved public sources and user-selected topics.
- [ ] Context compiler, temporal reasoning, relationship/knowledge lineage and change-impact analysis.
- [ ] Specialist agents with explicit contracts, bounded delegation, shared mission identity and an independent policy judge.
- [ ] Interactive artifacts and saved workspaces with versioning, export, provenance and clear ownership.

### P1 — Cost, plans and commercial readiness

- [ ] Measure provider, storage, compute, queue, publishing and support costs before promising plan limits or margins.
- [ ] Keep free/pro/premium entitlements enforced server-side and avoid duplicate plan/price sources of truth.
- [ ] Keep Saviour's own access and the agreed family access separate from public commercial pricing without hard-coding assumptions into user-facing copy.
- [ ] Region-based pricing remains a business proposal until payment, tax, entitlement, abuse-prevention and support behavior are reviewed.
- [ ] Do not deploy for every documentation or small code change; preserve the deliberate release queue and current deployment quota.

## Cross-project integration boundaries

### Optimus Prime — fake-ransomware simulation

Optimus Prime is a separate project intended as a fake-ransomware simulation. Keep its scope clearly separated from JARVIS Futuristic and from real ransomware. Any future implementation should be a harmless, clearly labelled demonstration in an isolated test directory or disposable lab, using simulated events or reversible dummy artifacts only. It must not encrypt or damage real files, persist, evade detection, steal credentials, spread, or run against other people's systems. Verify the simulation's boundaries and cleanup behavior before calling it complete.

### SENTINEL → JARVIS

Potential integration: JARVIS may explain a Sentinel report, summarize evidence, create remediation checklists, and track authorized follow-up work. Any future adapter must:

- Require an explicitly authorized target and bounded lab/assessment scope.
- Default to report analysis or safe lab workflows; never launch scans merely because a chat mentions a host or IP.
- Display the exact scope, profile, timeout and intended side effects before an authorized scan.
- Preserve Sentinel's raw evidence and clearly separate observation from inference.
- Keep network execution, credentials and scanning controls in Sentinel's own trust boundary.
- Add tests for out-of-scope requests, timeout behavior, result collection and safe failure before enabling the adapter.

### Vantora → JARVIS

Potential integration: JARVIS Business Manager can help draft workflows, support documentation, compare business scenarios, summarize authorized operations data and produce reports. Before any live integration:

- Treat payments, transfers, savings/investment actions, airtime/data purchases, travel bookings and logistics dispatch as consequential actions.
- Require verified provider APIs, authenticated user permissions, idempotency keys, explicit confirmation and receipts.
- Never invent balances, rates, transaction status, flight/hotel availability, or successful dispatch.
- Keep regulated financial decisions and execution behind approved providers and appropriate compliance review.
- Do not put financial secrets or payment credentials into prompts, source control or browser-visible code.

### Nexora and hospitality planning → JARVIS

Potential integration: business workspaces, brand kits, operating procedures, staffing plans, customer support drafts, marketing, scenario models and KPI dashboards. The 36-states × 50-suites idea must remain a clearly labelled scenario until the user confirms real assumptions, locations, funding and rollout decisions. JARVIS may model scenarios but must not represent the scenario as an approved business commitment.

### Maverick Legion creative work → JARVIS

Potential integration: maintain a creative brief, approved reference images, design variants, color/finish specifications, asset versions and promotional copy. Preserve the chosen design as a creative reference; do not imply a product has been manufactured, purchased or road-tested.

## Shared technical and operational constraints

- **Repository:** `sigigab13-pixel/JARVIS_FUTURISTIC` is the source of truth for JARVIS development. Keep the private placeholder repository separate unless a distinct reason and verified migration plan exist.
- **Development:** prefer small reversible branches/PRs, inspect current state before editing, and follow **fix → test → verify → next**.
- **Tests:** report the exact workflow/run and commit tested. Existing historic green runs do not prove a new commit is green.
- **Deployment:** Vercel production deployment quota has previously been constrained. Queue changes, run the required checks, deploy once deliberately, then verify the actual deployment/domain.
- **Secrets:** never copy real credentials into docs, source files, issues, logs or public prompts. Check for accidental exposure across history and branches as a separate security task.
- **Supabase:** verify the live schema, RLS policies, and authorization contracts before relying on them. Do not use production as an unreviewed test environment.
- **Redis/queues:** dispatch and lease work only; durable mission, asset and transaction truth belongs in the designated database.
- **Providers:** Viewmax, Higgsfield and ElevenLabs have been discussed/connected at different stages, but connection, API key, voice ID, permissions, quota and real output must each be verified independently before describing a feature as available.
- **Cost:** prefer free/low-cost paths, bounded retries/concurrency/payloads and no new paid dependency without a measured reason.
- **Public identity:** public-facing company/creator wording for JARVIS should use **Nexora**, not a personal identity. Private greetings and public attribution are separate concerns.

## Execution order

1. **Inventory & truth:** reconcile this register and the capability registry with the real code, PRs, workflow results, provider configuration and current deployment. Label unknowns honestly.
2. **Reliability blockers:** prioritize chat error rendering, authoritative routing, worker idempotency/leases, user isolation, secret exposure checks, and repair/verification behavior.
3. **Children Factory proof:** complete Kobi Episode 1 through a verified asset and QA/approval stage before widening the pipeline.
4. **Safe cross-project groundwork:** document adapter contracts and report formats for Sentinel; document non-transactional business workflows for Vantora/Nexora. No live external actions yet.
5. **Business/personal foundations:** scoped workspaces, tasks, documents, brand kits, and measured costs.
6. **Long-horizon features:** voice, broader multimodal use, computer-use boundaries, proactive routines and cross-device continuity after core safety/reliability gates.
7. **Release:** tests → evidence review → batch → intentional deployment → production verification.

## Definition of done for every item

An item is not complete until its record says:

1. What changed and where.
2. What evidence proves the behavior (test/run ID, tested commit, or reproducible manual check).
3. What remains untested or unavailable.
4. What can fail and how failure is detected.
5. How to recover or roll back.
6. What permissions, secrets, providers, costs and quotas it depends on.
7. Whether it is safe to deploy and how production will be verified.

**Rule:** this register is the portfolio index, not a substitute for implementation, tests, approval, or runtime evidence.
