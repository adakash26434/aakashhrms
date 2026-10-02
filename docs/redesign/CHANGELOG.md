# Redesign Changelog

Newest first. One entry per completed roadmap step.

Format:
```
## <date> — <step id> <title>
Branch: redesign/...
Changed: files / areas
Verified: type-check · lint · tests · screens checked · roles checked
Notes: follow-ups, decisions
```

---

## 2026-10-02 — Phase 0 complete: preparation & security hardening
Branch: `redesign/0-security` (from `main` @ `2eea440`; not merged or pushed)
Commits:
- `5596a04` **S0 (critical, found during Phase 0)**: the tenant DB was stored on `globalThis`, shared across all requests, so cross-company data was possible under concurrency and tenant-less requests inherited the last tenant. Now resolved per request; `getDb()` is async and fails closed. 294 call sites converted.
- `6acdf02` **S1**: forged impersonation cookie no longer passes the route guard; invalid cookie cleared; empty module list = no access
- `ca27462`, `26e3233` **S2**: plaintext temp passwords no longer stored or exposed (employee panel could reveal/copy them); resend issues a fresh password shown once; existing values purged
- `5fcbc08` **S3/S8/S12**: dashboard auth + permission-based redaction; `self-service.service.ts` was a `'use server'` module exposing 10 public actions; account re-checked on each self-service call; no placeholder identity
- `a33ec01` **S4**: 8h sessions (was 30 days); platform session 24h → 8h
- `068d626` **S5/S10**: trusted client IP, three-layer login throttling, escalating account lock (10+ failures), timing equalisation; **super-admin login had no rate limit** (fixed); company-code enumeration throttled; contact email HTML-escaped (link injection), length caps, IP throttle
- `222a32b` **S7**: scope-filter subqueries parameterised
- `2048652` **0.8**: Next.js 16.3.0 → 16.3.8 (critical RCE advisory), sharp patched; dedicated platform signing secret enforced in production; startup secret validation; CI audit gate
Verified: `tsc` exit 0 · 235/235 tests (43 new security tests; invariant/guard tests fail on old code) · no new lint errors (225 pre-existing) · production build on Next.js 16.3.8 succeeded (all routes compiled, proxy registered, no warnings)
Deployment notes:
1. Set `PLATFORM_SESSION_SECRET` (dedicated, ≥32 chars) or super-admin login and impersonation are refused in production.
2. Set `TRUSTED_PROXY_HOPS` (1 for cPanel Apache/Passenger; 2 if also behind Cloudflare).
3. Everyone is signed out once (session settings changed); super admins sign in again.
4. Temp passwords previously stored are purged on first tenant connection. Employees still pending first login keep their emailed password; HR can issue a new one from the employee panel.
Open: nodemailer/next-auth advisory chain (major upgrade needed); CSP + font self-hosting (S6) and build type-check (S11) are scheduled in Phase 1.

## 2026-10-02 — Research, palette & WIP commit
Branch: main
Changed:
- Committed pending feature work as `9c4b7d5` (payroll attendance/LWOP/OT/loan sync, attendance report fixes). Type-check clean, 192/192 tests pass. Not pushed.
- Added `05-functional-research.md`: references (Business Central, SAP Fiori, TallyPrime, NepalHRM, RigoHR, Hajir), Nepal statutory facts, gap analysis, 17 prioritised functional enhancements (F1–F17).
- Palette switched to the **logo forest green** (`#1E7F12`, AA 5.1:1) with **light chrome** and the logo red as a brand-only accent. Added design enhancements E1–E12 to `02-design-system.md`.
- Roadmap: added Phase F (functional tiers) and wired E1–E12 into Phases 2–3.
- Mockup updated to the light forest-green theme with the logo mark, green→red brand strip and working-period selector.
Verified: mockup rendered in browser; contrast ratios computed for the ramp.
Notes: user approved committing WIP and asked for logo colours + lighter chrome.

## 2026-10-02 — Planning
Branch: (none, docs only)
Changed: added `docs/redesign/` (analysis, design system, security plan, roadmap, this changelog) and `mockups/app-frame.html` (clickable static mockup of the desktop frame on the Employees register)
Verified: n/a (documentation)
Notes: 12 security findings recorded (2 High: S1 impersonation-cookie bypass, S2 plaintext temp passwords). WIP on `main` (18 modified, 2 untracked files) must be committed before Phase 0.
