# JARVIS Futuristic

> An independent AI platform being built by Saviour, with GPT-5.6 Luna as the AI development partner.

JARVIS is being built as a broader AI operating platform — not just a chatbot and not just a content generator. The long-term goal is to bring conversation, memory, business management, specialized offices, missions, automation, image generation, video production, voice, publishing, research, and reliability systems into one product.

## 🚀 What we are building

- 💬 Natural AI conversation and command handling
- 🧠 Persistent memory and personalization
- 🔐 Google sign-in and authenticated user accounts
- 🧭 Intent, context, capability routing, and mission orchestration
- 🎯 Durable missions with checkpoints, approvals, pause/resume, retry, and cancellation
- ⏱️ Recurring routines and background job scheduling
- 🖼️ Image Lab and image generation
- 🎬 Video Studio / Video Engine
- 🎙️ Voice and text-to-speech with connected providers
- 🌲 Forest content-production workflows
- 🏢 Specialized JARVIS offices
- 💼 Business management and Brand Kit
- 🔎 Web intelligence and research
- 🛡️ Security, permissions, health checks, recovery, and observability
- 🎨 User customization and branding
- 📣 Future publishing and analytics integrations
- ☁️ Multi-cloud architecture for scalable production

## 📌 Naming

The canonical project name is **JARVIS Futuristic**.

The canonical GitHub repository is:

`sigigab13-pixel/JARVIS_FUTURISTIC`

Older references may still appear in historical GitHub traffic or redirected URLs. New documentation and code references should use **JARVIS Futuristic** and **JARVIS_FUTURISTIC** only.

## 🧭 Current implementation status

JARVIS is being developed incrementally from verified foundations rather than treating planned features as completed.

Implemented foundations currently include:

- authenticated per-user JARVIS identity
- capability registry and intent/context routing
- durable mission state and mission events
- mission approval and autonomy gates
- mission checkpoints and recovery states
- recurring routines and routine-run tracking
- worker leases, heartbeats, concurrency limits, and workload governance
- fail-closed handling for unsupported worker job types
- persistent video project, character, asset, and scene foundations
- Children Factory v1 backend route with age validation, character continuity, three sequential image assets, approval-gated publishing, and a first image-sequence MP4 render adapter (implemented on `main`, pending production deployment verification)

The mission runtime currently has a real adapter for `routine_fanout`. The Video Engine also has a verified first worker adapter for image-sequence MP4 rendering. Additional production adapters are being added one vertical slice at a time.

Planned or partially connected services must not be described as production-ready until they are verified in the target environment.

## 🏗️ Current architecture

JARVIS is being built around a cloud-first foundation:

```text
GitHub
   │
   ├── Source control
   └── CI / automation
        │
Vercel
   ├── Frontend / web application
   └── API deployment
        │
        ├──────── Supabase
        │          ├── Auth
        │          ├── PostgreSQL
        │          ├── Memory
        │          ├── Missions / events
        │          ├── Routines / runs
        │          └── Durable application state
        │
        ├──────── Upstash Redis
        │          └── Queues / cache / dispatch
        │
        └──────── Cloudflare R2
                   └── Planned media/object storage layer
```

Long-running external compute such as Oracle Cloud workers remains part of the target architecture, but it should not be treated as connected until verified.

## ▶️ YouTube-first publishing

For the current build phase, YouTube is the only publishing and analytics target.

The YouTube path is:

```text
Children Factory
   ↓
Story / characters / assets
   ↓
Video production
   ↓
Quality + approval
   ↓
YouTube upload
   ↓
YouTube Analytics
   ↺
```

The server now contains a YouTube API service and approval-gated publisher UI for:

- Google OAuth with offline access
- user-scoped YouTube connections
- access-token refresh
- channel status
- YouTube Analytics reports
- approval-gated video publishing from a user's stored JARVIS media asset

Publishing is never reported as successful unless YouTube returns a successful video resource. The current publish endpoint defaults to private visibility unless the user explicitly chooses another allowed privacy setting. Unverified YouTube API projects can still be restricted to private uploads by Google's platform rules.

Other social publishing targets are intentionally out of scope for this build phase.

## 🎬 Video Engine

The Video Engine is being built as a real production pipeline rather than a simple slideshow generator.

Its architecture includes:

- Story Director
- Character Bible
- Outfit Engine
- World / Asset Bible
- Scene Director
- Storyboard / Cost Gate
- Visual Generation
- Motion Engine
- Voice / Audio
- Lip-sync
- Editing / transitions
- Localization
- Subtitles
- Preview
- A/B variations
- Continuity and Brand QA
- Repair / recovery
- Change Manager
- Asset cache / reuse
- Prompt memory
- Resource / quota management
- Rendering
- Aspect-ratio adaptation
- Final QA
- Versioning
- Metadata / thumbnails
- Publishing
- Performance memory

The repository contains the foundation for persistent video projects, characters, assets and scenes, plus a real first render path: stored images can be queued to the worker, rendered by FFmpeg into a 16:9 MP4, stored with a SHA-256 identifier, and handed to the YouTube publisher. Full AI motion, voice, lip-sync, editing, and advanced rendering remain future adapters.

## 💼 Business platform

JARVIS is also being designed to help users manage businesses:

- Business profile
- Products and services
- Customers
- Projects and tasks
- Documents
- Business knowledge
- Brand Kit
- Marketing workflows
- Content calendars
- Reports and analytics
- Automation
- Specialized AI offices

The Brand Kit is intended to become a shared source of truth for generated images, videos, documents, and marketing content.

## 👧🏽 Children's Content Factory

Children's rhymes, stories, educational content, and other age-appropriate media are a flagship JARVIS workflow.

The planned content loop is:

```text
Idea / Trend
    ↓
Age-appropriate research
    ↓
Story / rhyme / script
    ↓
Character + world consistency
    ↓
Image / video / voice production
    ↓
Quality + continuity checks
    ↓
Approval
    ↓
Publishing
    ↓
Analytics
    ↓
Learning
    ↺
```

Production claims should reflect only the providers and adapters that are actually connected and verified.

## 🌲 Forest

Forest sits above the production engines as an autonomous content/business workflow.

The planned loop is:

```text
Research
  ↓
Trend detection
  ↓
Story / content planning
  ↓
Production
  ↓
Quality control
  ↓
Approval
  ↓
Publishing
  ↓
Analytics
  ↓
Learning
  ↺
```

Forest is one part of JARVIS, not the entire product.

## 💰 Product direction

The intended business model includes free and paid plans with different access levels, generation allowances, and advanced capabilities.

Planned premium capabilities may include advanced video, larger image allowances, advanced offices, automation, customization, API access, team features, and other business capabilities.

Prices and limits are subject to change as real operating costs and user demand become clearer.

## 🔐 Security and trust

Security is a product requirement, not an afterthought.

JARVIS is designed around:

- per-user and workspace data isolation
- least-privilege access
- explicit permission scopes
- approval gates for consequential actions
- mission checkpoints and audit events
- fail-closed behavior when an adapter is unavailable
- evidence-backed completion rather than model-declared success
- secure deployment-side secrets

Never commit:

- API keys
- OAuth client secrets
- access/refresh tokens
- passwords
- private keys
- database secrets

The public repository should contain source code and documentation, not private credentials.

## 📖 Build in public

This project is being built publicly so people can follow the real journey.

Major milestones can become:

- a development journal entry
- a technical write-up
- a social-media update
- a short-video script
- a GitHub milestone
- a launch/update announcement

The goal is to document what was actually built, what failed, what was fixed, and what comes next.

See [docs/JOURNEY.md](docs/JOURNEY.md).

## 🤝 Support JARVIS

You can support the project without spending money:

- ⭐ Star the repository
- Share the project
- Test features
- Report bugs
- Suggest improvements
- Review the architecture
- Contribute documentation or code

Development is being done with limited hardware, so legitimate support such as development hardware, cloud resources, storage, or AI/API credits can also help the project progress.

## 🛡️ Future security roadmap

Two active backlog tracks are now recorded in GitHub:

- **Future-Ready Cryptography** — crypto-agility, NIST post-quantum standards, hybrid support where providers allow it, security readiness checks, and provider compatibility reviews.
- **Simple Custom Domain + Search Discovery** — a short memorable public address, canonical URL handling, SEO metadata, and a simple Share JARVIS experience.

These are roadmap items, not claims that the features are already production-complete. Vercel currently supports post-quantum cryptography for HTTPS connections to its network, while JARVIS still needs its own application-level crypto inventory and migration plan.

See the active queues: [#17 Future-Ready Cryptography](https://github.com/sigigab13-pixel/JARVIS_FUTURISTIC/issues/17) and [#18 Simple Custom Domain + Search Discovery](https://github.com/sigigab13-pixel/JARVIS_FUTURISTIC/issues/18).

## 👤 Creator

**Saviour** — Creator and developer of JARVIS.

**GPT-5.6 Luna** — AI development partner helping build, debug, document, and evolve the platform.

> **JARVIS Futuristic is being built in public — one verified capability at a time.**


## 📈 Content Trend & Idea Discovery Office

Phase 3D adds an isolated trend-ranking layer. JARVIS can normalize supplied platform signals, rank opportunities, and describe a six-hour collection plan. It requires fresh evidence and never claims automatic publishing or live trend data without a real data source.

Endpoints: `GET /api/content/trends/config`, `POST /api/content/trends/rank`, and `POST /api/content/trends/check-plan`.
