# JARVIS Controlled Release Runbook

**Purpose:** Keep production stable while allowing fast development without burning deployment capacity.

## Release rule
JARVIS uses a queue-first release model:

**build → test → verify → batch → deploy once → verify production**

Routine Git pushes must not be treated as releases.

## Development
- Work on a branch or PR.
- Run repository tests and gates.
- Fix failures before merging.
- Accumulate related changes into a release candidate instead of repeatedly deploying.
- Do not use Vercel previews as the default test loop.

## Production
- Only the canonical jarvis-futuristic project is allowed.
- Production deployment must be intentional.
- Never create a deployment just to test basic correctness when CI or local verification can answer the question.
- After deployment, verify the production domain and critical health endpoint before calling the release live. A domain returning a Vercel serving/usage pause is a release failure, even when the underlying deployment object is marked READY.

## Quota protection
Deployment capacity is treated as a safety budget. Before release, check that the account/project is not paused and that the required deployment capacity is available. If Vercel reports a quota or spend-management block, stop releases rather than repeatedly retrying.

## Failure handling
A production deployment that is paused, unhealthy, or otherwise unavailable is not a successful release. Preserve the last known-good deployment when possible, diagnose the serving/account condition, and use rollback or a previously verified deployment rather than generating a chain of speculative deployments.

## Scale posture
At higher user counts, JARVIS should keep durable state outside the frontend deployment layer:

**Vercel = web/API delivery**  
**Supabase = durable system of record**  
**Redis = queue/temporary coordination**  
**Workers = long-running/heavy jobs**

A Vercel deployment problem must not erase durable user data or queued mission state.

## Definition of release evidence
A release is not “verified” until the evidence answers:

1. Did the build pass?
2. Did required automated gates pass?
3. Did the intended deployment become available?
4. Did the production domain serve the expected build?
5. Did critical health checks pass?
6. Did runtime logs show no new critical errors?
7. Is rollback/recovery available?

**No evidence = no release claim.**

Updated: 2026-10-06
