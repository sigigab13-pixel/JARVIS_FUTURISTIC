# JARVIS Lifecycle

JARVIS Phase 3 is designed as one disciplined lifecycle, with each office owning
one responsibility and handing a stable identity to the next office.

```text
Discover
  ↓
Plan
  ↓
Produce
  ↓
QA + Approval
  ↓
Publish
  ↓
Measure
  ↓
Monetize
  ↓
Feedback to Discover
  ↺
```

## Phase map

- **3A — Children Factory:** produce age-appropriate content assets.
- **3B — Media Provider Office:** select the media provider by capability.
- **3C — Content Strategy Office:** turn an idea into platform-ready strategy.
- **3D — Content Trend & Idea Discovery Office:** rank supplied signals and plan fresh discovery.
- **3E — Monetization Office:** estimate revenue and prepare non-transactional IP exports.
- **3F — Publishing & Analytics:** future publishing, history, measurement, and feedback loop.

## Identity rule

Every content item should maintain one identity chain:

```text
strategyId
   ↓
contentId
   ↓
assetId
   ↓
publishId
```

Supporting context may include `trendId` and `providerId`.

No office should invent a competing identifier vocabulary.

## Safety rule

These boundaries remain mandatory during Phase 3:

- no automatic publishing
- no automatic charging
- no automatic merch ordering
- no KDP submission
- publishing requires a verified asset and explicit approval
- external providers remain optional until their adapters are verified

## Source-of-truth rule

Authentication, entitlements, pricing, provider credentials, and approval
semantics must be consumed from the existing JARVIS systems rather than
duplicated inside a Phase 3 office.

## Integration gate

A Phase 3 office is not considered production-ready merely because its unit
tests pass.

The release gate should distinguish:

1. unit tests
2. integration tests
3. frontend build
4. deployment verification
5. real external-provider verification

No Phase 3 office merges to `main` until the combined integration gate passes.
