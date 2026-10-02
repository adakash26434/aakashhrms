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

## 2026-10-02 — Phase 2: application frame (sign-off pending)
Branch: `redesign/2-app-frame` (from `redesign/1-foundation` @ `a2fccfc`; not merged or pushed). Phase 1 was signed off by you on this date.

Changed:
- **Frame** (`components/frame/`):
  - title bar with the brand strip, palette trigger, BS/AD, FY, approvals bell, help and user menu
  - module rail (Alt+1…7) and section navigator (active edge, counters, recent pages)
  - status bar (connection, company, FY, BS+AD date, role, version, lock countdown)
  - responsive: docked navigator ≥1280px, floating 1024–1279px, drawer below that
  - skip link and ARIA landmarks
- **Replaced:** `DashboardShell`, `Sidebar`, `TopHeader` and `lib/constants/navigation.ts` are deleted. The impersonation banner is now a slim strip inside the frame.
- **Navigation model** `lib/frame/navigation.ts`: 7 modules, 24 sections, permission metadata, aliases, keywords.
- **Command palette:** pages, recent pages and commands, plus **employee search** checked for permission and scope (`searchEmployeesForPaletteAction`, `quickSearch`: name, code and department only, LIKE wildcards escaped). The Employees register accepts `?q=`.
- **Shortcuts:** one registry drives both the handler and the `?` overlay.
- **`PageBar` + `CommandToolbar`** are ready for Phase 4 and shown in `/dev/kit`.
- **Idle lock (2.8):**
  - 15 minutes without input in any tab, shared through localStorage timestamps.
  - 60-second countdown in the status bar; `Ctrl Shift L` locks straight away.
  - A JWT `locked` flag, enforced by the route guard (`/locked?returnTo=`) and by the permission helpers.
  - Unlocking takes the password: 5 tries, then sign-out. A signed grant then releases that specific lock.
  - `safeReturnTo()` blocks open redirects.
- **Security:**
  - **S14 (Medium, new):** a browser could clear the forced password change via `POST /api/auth/session`. Session updates now accept only server-signed grants, and `assertSessionUsable()` stops actions from locked or password-pending sessions (actions can be POSTed from any page).
  - **S15 (Low, new):** the approvals count is computed only for approvers, within their scope.
- **Version:** shown in the status bar (`NEXT_PUBLIC_APP_VERSION` from package.json).

Verified:
- `tsc` exit 0.
- **294/294 tests**, including 32 new (`frame-navigation`, `security-session-lock`). The S14 and lock tests fail on the old callback.
- No lint errors in new or touched files. The React 19 set-state-in-effect rule is satisfied without suppressions; the only suppressions are for the deliberate full-page navigation in the lock.
- Production build succeeded (`/locked` compiled).
- Live in the browser as Office Administrator:
  - frame at 1440, 1100 and 390px; Ctrl+B, floating navigator and drawer; no horizontal overflow; 0 page errors
  - palette page ranking, employee search → `/workforce/employees?q=EMP-001`, Alt+4, `?` overlay
  - Ctrl+Shift+L locks: `/dashboard`, `/workforce/employees` and `/reports/salary-sheet` all redirect to `/locked`; a wrong password gives "4 attempts left"

Not yet verified:
- Unlocking with the real password (needs you).
- Restricted-role pass.
- Super-admin (impersonation) view of the new frame.

Deployment notes:
1. Users signed in before this deploy get the new frame on their next page load. No new environment variables are needed.
2. Sessions now lock after 15 minutes idle. People must re-enter their password, and 5 wrong tries sign them out.

## 2026-10-02 — Phase 1.7 screenshot tour (signed in) + fixes
Branch: `redesign/1-foundation`

Tour: you signed in to the Playwright browser as Office Administrator.
- 36 routes were checked at 1440px. Dashboard, Employees, Payroll review and Company setup were also checked at 1024 and 390px.
- Salary-sheet print preview was rendered.
- Result: 0 CSP violations, 0 console errors, 0 horizontal page overflow. Screenshots are in `Payroll_System/.playwright-mcp/tour/`.

Fixes:
- `font-mono` now renders as Inter with tabular figures and a slashed zero. Large amounts had wrapped onto two lines (for example "NPR / 84,718.75"). True monospace is the new `font-code`.
- Below 1024px a pinned sidebar shows as the 72px icon rail; the stored preference is unchanged. Before this, 390px phones got a ~120px-wide workspace. This is interim until Phase 2.9.
- Workspace padding is 16px on small screens. The header company block is hidden on phones, where it overlapped the BS/AD switch.
- Toasts are hidden in print; one had printed over the salary sheet.

Logged for Phase 4 (pre-existing, not caused by the reskin):
- "NPR" repeated in every grid cell and big KPI amounts wrapping (Salary Structure).
- Narrow code columns wrap (`EMP-` / `002`).
- Heavy dark permission chips (Roles).
- Wide salary-sheet grid needs a sticky first column.

Not yet verified: restricted-role pass (sign in as a BRANCH or DEPARTMENT scoped user).

## 2026-10-02 — Phase 1 steps 1.1–1.6: design foundation (sign-off 1.7 pending)
Branch: `redesign/1-foundation` (from `redesign/0-security` @ `d47fcb2`; not merged or pushed)
Commits:
- `f7e9cde` **1.1–1.5 design foundation**
  - Token layers: forest / neutral / crimson ramps, semantic variables and utilities.
  - Global remap of zinc/gray/slate/neutral/stone, emerald/green, rose/red and `payroll-*`.
  - Radii tightened to 4/6/8px and in-page shadows flattened.
  - Inter self-hosted; amounts no longer monospace; tabular numerals scoped.
  - Body 13px; 1,072 arbitrary font sizes replaced in 174 files.
  - `!important` hacks replaced by cascade layers.
  - Chart theme centralised; hex removed from app screens.
  - Hero headline re-fitted after the font change.
  - Dev-only `/dev/kit` gallery added.
- `7c509c6` **1.6 security**
  - S6 nonce CSP plus header clean-up.
  - **S13 (new):** NextAuth dropped the proxy's request-header overrides, so the `x-tenant-slug` strip never ran on tenant routes. Not exploitable, since nothing reads it, but now fixed.
  - S11 `npm run verify`.

Enhancements beyond the original Phase 1 scope:
- gray, slate and rose remapped.
- Radius and shadow retune.
- Scoped tabular numerals (Inter's `tnum` widened hyphens in prose).
- Chart tokens.
- `/dev/kit` started early (roadmap 3.9).
- COOP and Permissions-Policy hardening.
- API deny-all CSP and no-store.
- Guard tests for every new rule.

Verified:
- `tsc` exit 0.
- 262/262 tests (27 new: `security-csp`, `design-foundation`). The S13 header tests fail on the old proxy.
- Lint: 215 errors in the linted folders before and after, so none added.
- Production build succeeded.
- Standalone production server:
  - All 14 page scripts carry the nonce.
  - React hydrates.
  - Zero console errors and zero off-site requests.
  - `/dev/kit` is redirected or 404.
  - API responses carry the deny-all CSP.
- Dev: `/login`, `/` and `/dev/kit` checked at 1440 and 390px with no CSP violations.

Not yet verified: signed-in screens (dashboard, registers, payroll, reports, print preview) and restricted-role checks. They need a sign-in with your credentials, which stay in `.env`. That is the 1.7 sign-off tour.

Deployment notes:
1. The CSP is enforcing. A page that loads an off-site script, font or image will be blocked. None exist today; add a source in `lib/security/csp.ts` if one is ever needed.
2. HSTS is now on in production (1 year). It adds `includeSubDomains; preload` only with `FORCE_SSL=true`.
3. `upgrade-insecure-requests` is sent only when `FORCE_SSL=true`. Leave it unset on HTTP-only test hosts.

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
