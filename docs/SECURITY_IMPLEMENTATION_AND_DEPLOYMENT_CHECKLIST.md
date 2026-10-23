# JARVIS Defense-in-Depth Implementation

## Scope of this change

This change adds application-level security headers, request rate limiting, and a bounded request-body parser. It does **not** by itself configure Cloudflare WAF, Vercel project access, Supabase database policies, or provider credentials. Those controls must be configured and verified in their respective dashboards.

## Application controls

- Security headers are applied by the Vercel API handler and the standalone Node server.
- API requests receive a general limit; chat/routing, speech synthesis, and resource-intensive endpoints have stricter buckets.
- When Upstash Redis is configured, rate-limit counters use an atomic Redis script and are shared across instances.
- The in-memory fallback is only a local safety net; it is not a substitute for shared production rate limiting.
- In production, expensive image, video, publishing, factory, and speech operations fail closed if shared rate limiting is unavailable, unless JARVIS_ALLOW_LOCAL_RATE_LIMIT_FALLBACK=true is explicitly set.
- The app trusts Cloudflare or Vercel client-IP headers only when the corresponding trust environment variable is enabled.
- Request bodies are capped at 1 MB by default and 12 MB for image-edit requests. Revisit this only when a feature has a documented need for a larger payload.

## Required deployment configuration

Set these server-side environment variables in Vercel (never with a VITE_ prefix):

- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

Only when the public app is guaranteed to pass through the configured proxy and direct-origin bypass is controlled, set one of:

- JARVIS_TRUST_CLOUDFLARE_HEADERS=true for Cloudflare-proxied traffic
- JARVIS_TRUST_VERCEL_IP_HEADER=true only if the deployment's x-vercel-forwarded-for value is confirmed to be set by Vercel and cannot be supplied by clients

Do not set both proxy-trust variables casually. Confirm the actual request path first. Do not enable JARVIS_ALLOW_LOCAL_RATE_LIMIT_FALLBACK in production merely to silence a missing Redis configuration.

## Cloudflare dashboard checklist — not changed by this code commit

1. Put the public custom domain behind the Cloudflare proxy (orange cloud) if that is the intended edge.
2. Enable managed WAF protections available on the account and apply conservative rate limits to /api/*, with tighter rules for /api/chat, /api/route, /api/image/*, /api/tts/*, /api/video/*, and publishing routes.
3. Keep the origin from being directly reachable where the platform supports it. A Cloudflare rule does not protect requests that bypass Cloudflare.
4. Enable bot/abuse protections that are available on the current plan; verify their impact on legitimate users before enforcing challenges.
5. Create alerts for traffic spikes, repeated 401/403/429/5xx responses, and unusual request rates.

## Vercel dashboard checklist — not changed by this code commit

1. Confirm the production deployment uses the reviewed commit and that the correct environment variables exist in Production, Preview, and Development as appropriate.
2. Restrict team/account access with strong authentication and least privilege.
3. Review deployment protection, logs, function limits, and spend/usage alerts available on the current plan.
4. Do not treat a successful build or a healthy frontend as proof that every API route is protected.

## Supabase checklist — not changed by this code commit

1. Audit every table, view, function, and storage bucket for Row Level Security and least-privilege policies.
2. Treat service-role/secret keys as server-only. They bypass normal RLS checks, so every server query using them must enforce user ownership correctly.
3. Review server-only tables (including OAuth state and provider connections) and verify that browser roles cannot read or mutate them.
4. Verify media access policies and test cross-user reads, updates, deletes, and storage access with two separate test accounts.
5. Rotate any credential that has been exposed; deleting it from the latest commit alone does not revoke it.

## Upstash checklist — not changed by this code commit

1. Use a dedicated database/token for JARVIS where possible and restrict who can view or rotate it.
2. Keep the REST token server-side; do not put it in frontend variables or source control.
3. Verify the EVAL, INCR, and PEXPIRE commands used by the shared limiter are supported by the configured Upstash product.
4. Set budget/usage alerts where available and rotate a token immediately if it leaks.

## Cloudflare R2 and external AI providers — not changed by this code commit

- Use private buckets by default; issue short-lived or narrowly scoped access when sharing is required.
- Keep provider credentials server-side and restrict permissions to the minimum required.
- Set provider-side quotas or spending controls wherever offered.
- Confirm each provider's timeout, retry, and concurrency behavior; application-level request limiting does not replace provider-side budgets.

## Verification gates before production

- [ ] CI tests pass, including security-controls tests.
- [ ] Shared rate limiting is verified against the real Upstash deployment.
- [ ] Security headers are confirmed on both HTML and API responses.
- [ ] Production image/video/speech requests are confirmed to fail safely if Upstash is unavailable.
- [ ] Cross-user authorization and storage access are tested with two accounts.
- [ ] Cloudflare direct-origin bypass and WAF behavior are checked in the real deployment.
- [ ] No secrets are present in the public repository or browser build.
- [ ] A backup restore has been rehearsed.

Until these checks are complete, describe this as a security-hardening change under review—not as proof that JARVIS is fully secure.
