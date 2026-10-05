# JARVIS Architecture — Phase 3

## The five-minute map

JARVIS Phase 3 is a set of focused offices, not one giant feature.

```text
Discover
   ↓
Plan
   ↓
Produce
   ↓
Monetize
   ↓
Publish
   ↓
Measure
   ↺
```

### Offices

**3A — Children Factory**

Turns an approved content idea into a controlled media-production workflow.

**3B — Media Provider Office**

Chooses an internal or optional external media provider by capability. It is a provider seam, not a provider SDK.

**3C — Content Strategy Office**

Packages a topic for a target series, format, platform, audience, title, thumbnail, and safety review.

**3D — Content Trend & Idea Discovery Office**

Ranks supplied trend signals and prepares fresh-signal collection plans. It does not pretend to have live trend data until a real data adapter exists.

**3E — Monetization Office**

Estimates potential platform revenue and prepares non-transactional IP export packages. It does not charge, order, submit, or auto-publish.

**3F — Publishing & Analytics**

Reserved for the publishing/measurement loop. It should consume the shared content identity chain rather than invent separate identifiers.

## Shared Phase 3 identity

The canonical chain is:

```text
strategyId
   ↓
contentId
   ↓
assetId
   ↓
providerId (when an external/provider choice exists)
   ↓
publishId (when publication exists)
```

The source of truth is `types/phase3-contracts.mjs`, with a TypeScript facade at `types/phase3-contracts.ts`.

Offices must pass these identifiers through their contracts instead of inventing incompatible names.

## Safety boundaries

Consequential actions remain gated.

```text
Generate
  ↓
Validate
  ↓
Verify
  ↓
Approval
  ↓
Publish
```

In particular, Children Factory publishing requires a completed verified video and approval.

Monetization is estimator/export-only until a separate, reviewed transaction design exists.

## Integration rule

Each office should stay independently testable, but Phase 3 acceptance is not complete until the identity chain and handoff contracts are exercised together.

The next integration test target is:

```text
Strategy
  ↓
Children Factory
  ↓
Media Provider selection
  ↓
Asset identity
```

A future publishing/analytics layer can then continue the same identity chain.

## Source-of-truth rule

Do not duplicate:

- authentication
- entitlements/pricing
- provider credential storage
- publish approval rules
- content identifiers

A new office should consume an existing platform contract when one already exists.

## Verification rule

A feature is not called production-complete merely because its pure functions work.

Release evidence should distinguish:

1. unit tests
2. integration tests
3. build success
4. deployment success
5. real external-provider success

Only verified evidence should be described as production-ready.
