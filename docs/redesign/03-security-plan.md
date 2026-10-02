# 03 — Security Plan

The baseline is already reasonable:
- Server-side `checkPermission()` runs on almost every action and page, with
  a fresh DB lookup and an `isActive` re-check.
- Passwords are hashed with bcrypt (cost 12).
- Login rate limiting and account lockout exist.
- Tenant slugs are carried in a signed JWT, and the client `x-tenant-slug`
  header is stripped.
- Platform and impersonation cookies are httpOnly JWTs.
- Baseline security headers are set.
- `.env` is git-ignored.

The items below are the gaps found during the analysis. Each one gets fixed
in the phase noted, with a regression test where practical.

## Findings

| ID | Severity | Finding | Where | Fix | Phase |
|---|---|---|---|---|---|
| **S0** | **Critical** | *Found while starting Phase 0.* The "request-scope" tenant DB (`setRequestScopeTenantDb`) was stored on **`globalThis`**, which is shared by every request in the Node process. Concurrent requests from different companies could read or write through each other's database. A request with no tenant of its own (anonymous, or the S1 bypass) inherited **the last tenant used by anyone**. `ensureTenantContext()` returned early whenever that global was set, without looking at the session. | `lib/db/tenant-context.ts`, `lib/db/index.ts`, ~294 `getDb()` call sites | **Fixed (0.2a).** Tenant is now resolved per request from the verified impersonation token or the session JWT, memoised in a `WeakMap` keyed on the request's cookie store. `getDb()` is async and **throws `TenantContextError`** in multi-tenant mode when there's no tenant (no primary-DB fallback). The global store is deleted, and all call sites are converted to `await getDb()`. | 0 ✅ |
| **S1** | **High** | Route guard trusts the *presence* of the `platform_impersonation` cookie. A forged or expired cookie fails verification in `proxy.ts`, falls through to NextAuth, and `authorized()` then returns `true` just because the cookie exists. An anonymous visitor can then render the `(dashboard)` layout. Pages without their own permission check, such as `/dashboard`, run queries. With no session and no tenant, `getDb()` **falls back to the primary DB**, and `allowedModules=[]` shows the full sidebar. | `lib/auth/auth.config.ts` `authorized()`, `app/(dashboard)/layout.tsx`, `lib/db/index.ts` | (a) In `proxy.ts`, delete an invalid impersonation cookie and never let presence alone authorize. (b) `authorized()` must not treat cookie presence as auth. (c) The dashboard layout redirects to `/login` when there is neither a valid impersonation nor a session. (d) In multi-tenant mode, `getDb()`/`getDbAsync()` **fail closed** (throw) instead of returning the primary DB when no tenant is resolved. (e) Sidebar: an empty module list means *no* access, not full access, unless impersonating. **Fixed (0.2a + 0.2b)**; regression test `tests/security-auth-guard.test.ts` fails on the old code. | 0 ✅ |
| **S2** | **High** | Temporary passwords are stored **in plaintext** (`users.temp_password`). They are selected by the user-list and detail repository queries, so they can reach admin browsers and logs. | `lib/db/schema.ts:305`, `lib/repositories/user.repository.ts` | Stop persisting plaintext. Show the temp password once in the create/reset response, deliver it by email, then forget it. Remove it from list/detail selects and null out existing values in a migration. A resend generates a *new* temp password. **Fixed (0.3).** The employee panel previously let anyone with Employees VIEW reveal and copy the stored password; it now shows only *Pending first sign-in*, and a newly issued password appears once. Existing values are purged by the tenant schema sync. | 0 ✅ |
| **S3** | Medium | `/dashboard` and `/reports` (index) pages, and `getDashboardSnapshot()`, perform no permission check. | `app/(dashboard)/dashboard/page.tsx`, `reports/page.tsx` | Require an authenticated, active tenant user and filter widgets by module permission and scope. **Fixed (0.4).** `requireAuthenticatedUser()` + `redactDashboardForAccess()` strip payroll figures, approvals, loans and audit activity by VIEW permission before serialising to the browser. The reports index is static links (each report checks its own permission). | 0 ✅ |
| **S4** | Medium | JWT session lifetime is the NextAuth default of **30 days**, with no idle timeout. That is too long for payroll data. | `lib/auth/index.ts` | `session.maxAge = 8h`, `updateAge = 15m`. Add a client idle lock after 15 min ("Session locked", password to resume), which fits the desktop design. **Server part fixed (0.5):** tenant sessions are 8h sliding (15m refresh), and the platform super-admin session is cut from 24h to 8h. The idle lock UI comes in Phase 2.8. | 0 ✅ / 2 |
| **S5** | Medium | Rate limiting keys on `X-Forwarded-For`, which the client can spoof. It is in-memory only. The DB lockout after 4 failures lets anyone who knows an email lock that user out. | `lib/auth/index.ts`, `rate-limiter.ts` | Use the proxy-trusted IP (rightmost trusted hop / Passenger `REMOTE_ADDR`). Add an IP-only global limiter. Use exponential backoff instead of a hard 15-min lock, and audit-log and notify on lockout. Keep generic error messages. **Fixed (0.6).** `getClientIp()` reads the N-th entry from the right (`TRUSTED_PROXY_HOPS`). Three layers: IP+account (5/15m), IP-wide (30/15m), and an account-wide DB lock from 10 failures escalating 1→15 min. A dummy bcrypt check removes user-enumeration timing. **Also found:** the super-admin platform login had *no* rate limiting (now throttled the same way), and the public company-code lookup allowed unlimited enumeration (now 10 failed lookups / 15 min per IP). Login emails are not sent yet; that comes with the F17 notification centre. | 0 ✅ |
| **S6** | Medium | No `Content-Security-Policy`. Fonts load from Google at runtime (CSS `@import` plus `<link>`). `X-XSS-Protection` is deprecated. | `next.config.ts`, `app/globals.css`, `app/layout.tsx` | Self-host fonts with `next/font` only, then add a CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`). Drop X-XSS-Protection. Turn HSTS on by default in production. **Fixed (1.6).** Inter and JetBrains Mono are self-hosted by `next/font`, and the Google `@import` and `<link>` are gone. `proxy.ts` issues a **per-request nonce CSP** (`lib/security/csp.ts`): `script-src 'self' 'nonce-…' 'strict-dynamic'`, with no inline or eval in production, plus `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` and `form-action 'self'`. `style-src` keeps `'unsafe-inline'` because React style attributes can't carry a nonce. API routes get `default-src 'none'` and `Cache-Control: no-store`. HSTS is on in production (1 year), adding `includeSubDomains; preload` when `FORCE_SSL=true`. Also added COOP `same-origin` and `X-Permitted-Cross-Domain-Policies: none`, widened Permissions-Policy, and set `poweredByHeader: false`. Verified in the browser: pages hydrate with no CSP violations. | 1 ✅ |
| **S7** | Low | `sql.raw()` with string-concatenated IDs in the scope filter. The IDs come from the DB, but it is a latent injection pattern. | `lib/auth/scope-filter.ts:170-177` | Replace with `inArray()` in a parameterised subquery. **Fixed (0.7)**; test asserts ids are bound as `$n` parameters. | 0 ✅ |
| **S8** | Medium | Self-service actions do not re-check that the user is active or holds SELF_SERVICE. They rely only on a JWT `employeeId`. | `app/actions/self-service.actions.ts` | Add a `requireSelfService()` guard that re-checks `isActive` and the employee link on every call. **Fixed (0.4).** The account and employee link are re-read from the DB on every call. Also found `lib/services/self-service.service.ts` marked `'use server'`, which exposed all 10 exports as public actions; removed it, and an invariant test now forbids `'use server'` in `lib/` and `components/`. The layout redirects when there's no session. | 0 ✅ |
| **S9** | Low | Actions return raw `error.message` to the client. That can leak DB or constraint details. | `app/actions/*` | Add a central `toActionError()`: known domain errors pass through, anything else becomes "Something went wrong (ref XYZ)" and is logged server-side with the ref. | 3 (per module) |
| **S10** | Low | The public `contact.actions` demo-request form has no rate limit or bot protection. | `app/actions/contact.actions.ts` | IP rate limit, honeypot field, input length caps. **Fixed (0.6).** 5 submissions per IP per hour, server-side length caps, and **HTML escaping of every visitor value in the notification email**. Previously a visitor could inject links or markup into an email sent to the company inbox, a phishing risk. The honeypot already existed. The timing and maths checks are client-supplied, so the rate limit is the real control. | 0 ✅ |
| **S11** | Low | `typescript.ignoreBuildErrors: true`. CI runs `type-check`, but local and cPanel builds can ship type errors. | `next.config.ts` | Keep it (cPanel OOM), but make `npm run build` locally run `type-check` first. CI already enforces it. **Mitigated (1.6).** `npm run verify` = type-check → tests → build is the local gate (in CLAUDE.md). `build` itself is unchanged so cPanel deploys don't run `tsc` and OOM. | 1 ✅ |
| **S13** | Low | *Found in Phase 1.* For tenant routes, `proxy.ts` handed its modified request headers to NextAuth's `auth()` handler, which ignores them and returns a bare `NextResponse.next()`. So stripping a client-supplied `x-tenant-slug`, and setting `x-pathname`, never took effect on those routes. Nothing reads `x-tenant-slug` today, so it wasn't exploitable, but the documented defence was silently off, and a CSP nonce would also have been lost (pages would break). | `proxy.ts` | **Fixed (1.6).** A NextAuth pass-through is rebuilt with `NextResponse.next({ request: { headers } })`, and its Set-Cookie headers are carried over. `tests/security-csp.test.ts` covers this and fails on the old proxy. | 1 ✅ |
| **S12** | Info | `getWorkspaceContext()` falls back to `admin@aakashhrms.com` and placeholder company data when no session exists. | `lib/services/workspace-context.service.ts` | Remove the placeholders. No session means redirect (covered by S1). **Fixed (0.4).** User is resolved by id, not email, with no placeholder email. | 0 ✅ |

## Dependency audit (step 0.8, 2026-10-02)

`npm audit --omit=dev` found 9 advisories (1 critical, 4 high, 4 moderate).

| Package | Severity | Issue | Action |
|---|---|---|---|
| `next` 16.3.0 | **Critical** | Unauthenticated remote code execution (Windows-hosted servers; image optimiser) | **Fixed:** upgraded to **16.3.8** (patch release), with `eslint-config-next` 16.3.8 to match |
| `sharp` (via next) | High | libheif vulnerabilities | **Fixed:** 0.35.5 via `npm audit fix` |
| `nodemailer` 8.0.11 (direct, and via `next-auth` → `@auth/core`) | High | `raw` message option bypasses file/URL access limits; address-parser ReDoS | **Open.** The fix is nodemailer 10 (major), and next-auth beta still pins the old range. Exposure is limited: we never use the `raw` option, and the only user-supplied address (contact form `replyTo`) is now regex-validated and capped at 254 chars before reaching nodemailer. Revisit when next-auth publishes a compatible release. Then raise the CI gate to `high`. |
| `drizzle-kit` / `esbuild` / `@esbuild-kit/*` | Moderate | esbuild dev-server request issue | **Accepted.** CLI tooling only (migrations); never runs as a server in production. |

CI now runs `npm audit --omit=dev --audit-level=critical` after install.

## Secret separation (step 0.8)

- `lib/security/secrets.ts` → `getPlatformSigningSecret()`. In production, platform session and impersonation tokens are signed **only** with `PLATFORM_SESSION_SECRET`, which must differ from `AUTH_SECRET` and `PLATFORM_SECRETS_KEY`. Production refuses to sign rather than fall back. Development falls back with a warning.
- `instrumentation.ts` runs `validateSecurityConfig()` at server start and logs missing, short (<32 chars) or shared secrets, and `FORCE_SSL` being off in production.
- **Deployment action required:** set a dedicated `PLATFORM_SESSION_SECRET` on the server (`openssl rand -base64 48`) before deploying this branch. Without it, super-admin login and impersonation are refused in production. Existing platform sessions are invalidated once and admins sign in again.

## Standing measures (apply throughout the redesign)

1. **The UI never decides access.** Hiding a button is UX only. Every server
   action and page keeps its `checkPermission()`. The new `CommandToolbar`
   and `CommandPalette` take permission metadata, but enforcement stays on
   the server.
2. **No sensitive data in URLs.** Filters may go in query strings. Employee
   PII, salary figures and tokens may not.
3. **Client storage holds only UI preferences** (column widths, collapsed
   navigator, BS/AD), never data or tokens.
4. **No `dangerouslySetInnerHTML`.** There are none today; keep it that way.
   Use printable/PDF views through React.
5. **Exports** (CSV/Excel/PDF) require the `EXPORT` permission on the
   server, escape CSV formula injection (`= + - @` prefixes), and write an
   audit-log entry.
6. **Destructive actions** need typed confirmation for bulk delete, payroll
   unlock and fiscal-year unlock, plus an audit-log entry.
7. **Dependencies:** run `npm audit` in CI (fail on high), pin
   `next-auth` beta versions, and review Next.js security releases monthly.
8. **Secrets:** `AUTH_SECRET`, `PLATFORM_SESSION_SECRET` and
   `PLATFORM_SECRETS_KEY` must be distinct, 32+ bytes, and never fall back
   to each other in production (the impersonation key currently falls back to
   `AUTH_SECRET`). Add a startup check.
9. **Tests:** each fix above gets a `tests/security-*.test.ts` case where it
   can be unit tested (guards, CSV escaping, scope filter, rate limiter).
