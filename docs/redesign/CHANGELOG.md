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

## 2026-10-03 — 4.1 dashboard: equal-height cards, scrolling lists, empty states (sign-off pending)
Branch: `redesign/4.1-home`

Changed (your review: cards in a row had different heights, which looked untidy with little data or long lists):
- **Rows line up:** every card row stretches to its tallest card (department + liabilities, the three attention cards, attendance + leave, headcount + coming up + activity).
- **Height cap with scrolling:** new kit `Panel` option `bodyMaxHeight`.
  - A row grows with its content up to 320px of body; longer lists scroll inside the card.
  - Thin quiet scrollbar (`scroll-thin` utility); the title bar and the department table header stay fixed.
  - The scroll area is focusable and labelled, so PageDown and the arrow keys work.
- **Empty states:** a centred icon, title and line in every list card ("All caught up", "All records ready", "Nothing coming up", "No payroll in this period"…), instead of a sentence at the top of an empty box.
- The deadlines note sits at the bottom of its card, so its height matches its neighbours.
- **Attendance rate** is now present ÷ (present + absent). Approved leave and days off are excused, so a company with only leave recorded shows no rate instead of 0%.

Verified: `tsc` 0, lint clean on touched files, 359/359 tests, build OK. In the browser, cards in each row measured equal on real data (233 / 234 / 275 px rows), the preview (338–362) and the empty company. A 20-row list scrolls inside a 320px body by mouse and keyboard while its neighbour keeps the same height. No overflow at 390px, 0 console errors.

## 2026-10-03 — 4.1 dashboard enhancements: pay run banner, liabilities, coming up (sign-off pending)
Branch: `redesign/4.1-home`

Patterns from payroll and HRMS dashboards, applied with real data only:
- **Current pay run banner** at the top (Zoho "Process pay run", Gusto "Run payroll"): month and status, fiscal-year month (FY 2083/84 · month 3 of 12), a wide progress rail across branch runs, net payable, employees, and the one next action. It replaces the smaller pay run card.
- **Statutory liabilities card** (Zoho "benefits and deductions summary"): TDS, SSF employee 11% / employer 20%, PF both sides and CIT for the selected period, with the total to deposit and each head's share. Real Shrawan 2083: 7,150 + 13,000 + 2,500 = 22,650, matching the salary sheet.
- **Coming up card** (Keka / greytHR): holidays for the user's branches, birthdays and work anniversaries in the next 30 days, by BS date. A day that does not exist in a shorter BS month falls on the month's last day. Birthdays never show year or age, and personal dates need the EMPLOYEES permission. Real data shows Dashain (12 days, in 8 days).
- **KPI polish:** "NPR" label on money, change as a pill, sparklines with a soft area that never bridges a missing month.
- **Cost chart:** dashed 12-month average line, labelled at the right edge.
- **Attendance:** the month's attendance rate in the card header (present ÷ recorded working attendance).
- Engine: `statutorySummary`, `attendanceRate`, `fiscalProgress`, `nextBsAnniversary`, `upcomingEvents` (6 new tests).

Verified: `tsc` 0, no lint errors or warnings in touched files, 359/359 tests, build OK. Browser 1440 / 1024 / 390px with no overflow and 0 console errors. Real-data figures checked before the overnight session expiry. The preview covers every state.

## 2026-10-02 — 4.1 dashboard polish: separation and breathing room (sign-off pending)
Branch: `redesign/4.1-home`

Changed (your review: borders too faint, layout felt congested):
- **Stronger box edges:** the card outline is one step darker (`line-strong`, was the same tone as the row dividers) with a soft `shadow-sm`; dividers inside cards stay light, so edges read clearly without heavy lines. Applied in kit `Panel` (shared) and the KPI cards.
- **Sections:** the page is grouped under labelled headings with a rule: **Payroll** (cost trend + breakdown, cost by department + pay run), **Needs attention** (deadlines, approvals, records to fix), **People** (attendance + leave, headcount + activity). Card titles became level-3 headings under them.
- **Space:**
  - 32px between sections, 20px between cards, 16px inside cards
  - roomier card headers (44px, 13px titles) and list rows
  - the cramped four-across action row is now three cards
- **KPI cards:** icon in a tinted tile, more padding, the hint separated by a hairline, hover lifts the card.
- **Trend chart:** taller to fill its row; the "not locked" note moved from the title into the legend.
- The loading skeleton matches the new outline and spacing.

Verified: `tsc` 0, no lint errors in the touched files, 353/353 tests, build OK; browser at 1440 / 1024 / 390px (preview and signed-in), no overflow, 0 console errors or warnings.

## 2026-10-02 — 4.1 revised: analytics dashboard + file structure (sign-off pending)
Branch: `redesign/4.1-home` (on top of `2bf5363`; not merged or pushed)

Why: on review you wanted the dashboard to look like a dashboard (figures and charts), with the desktop-app style kept for the table and report modules, and the files to follow the project's layer and naming conventions.

Research (summarised in `02-design-system.md`):
- **Zoho Payroll:** pay run card, to-do, statutory summary, payroll cost summary with a period filter.
- **Keka and Rippling:** cost by department and variance tracking.
- **Dribbble / Behance payroll dashboards:** KPI cards, monthly trend, department breakdown.
- **Best practice:** 5–7 KPIs with change and a sparkline; insight in about 10 seconds.

Changed:
- **Layout** (your choices: analytics-first, compact approvals, latest pay month by default):
  - page bar, then filters (period: latest month / fiscal year to date / last 12 months; branch for company-wide users; both kept in the URL)
  - **5 KPI cards**: payroll cost, net pay, statutory, active employees, cost per employee. Each has its change against the comparison period, a 12-month sparkline and amber for ±10% swings.
  - **charts**: payroll cost by month (12 BS months, stacked net / deductions / employer PF, unlocked months lighter, swings flagged); where the money went (donut + table); cost by department; attendance this month (daily present / leave / absent / off / not recorded)
  - **action cards**: pay run, statutory deadlines, pending approvals (5 oldest, linking to the Approvals page), records to fix
  - **workforce**: leave by type this FY + on leave today, headcount, recent activity
- **Data:** new read-only SQL aggregates, all scoped to the user and the branch filter:
  - `sumSlipsByPeriod`, `sumSlipsByDepartment` (payroll)
  - `findAttendanceMarksInRange` (attendance)
  - `countJoinersLeavers` (employee)
  - `sumApprovedLeaveDaysByType` (leave)
- **Cost model** (verified against the payroll engine): employer SSF 20% is inside gross and the 31% is deducted, so payroll cost = gross + employer PF, and the breakdown segments add up exactly to it.
- **File structure:**
  - `lib/home/*` → `lib/engines/dashboard.engine.ts`, `lib/constants/statutory-deadlines.ts`, `lib/utils/nepal-time.ts`, `lib/types/dashboard.ts`
  - `lib/leave/decision.ts` → `lib/engines/leave.engine.ts`
  - `home.service.ts` → `dashboard.service.ts`
  - `components/workspace-home/` → `components/dashboard/dashboard-*.tsx`
  - `/dev/home` → `/dev/dashboard`
  - Conventions written into `CLAUDE.md` ("Where files go") and design-system §7.
- The worklist and inline approve/reject left the dashboard. The secure S17 leave action is unchanged and still used by the Approvals page.

Found while verifying:
- **Stored run totals disagree with payslips.** Shrawan 2083: the run says net 62,068.75 and gross 84,718.75; the payslips and salary sheet say 68,068.75 and 90,718.75 (one employee's employer SSF). The old dashboard showed the wrong run totals. The dashboard now reads payslips like the salary sheet. The run-total bug is logged under Known debt for 4.8.
- The attendance chart labelled days by AD date; it now uses the BS day number.

Verified:
- `tsc` 0; no new lint errors (the 13 in the touched repositories are pre-existing).
- **353/353 tests** (`dashboard`: 22, `security-dashboard-access`: 5, `security-leave-decision`).
- Production build OK.
- Browser, signed in (1440, 1024, 390px; 0 console errors or warnings; no overflow):
  - every period option; the branch filter (Head Office = all three employees, Pokhara = none); bogus `?period` and `?branch` fall back safely
  - KPI figures cross-checked against the salary sheet for Shrawan 2083
- `/dev/dashboard`: admin, branch manager, employee, failed sections and new-company states.

## 2026-10-02 — 4.1 Home: work queues (superseded by the revision above)
Branch: `redesign/4.1-home` (from `redesign/3-component-kit` @ `d78817c`; not merged or pushed)

Changed:
- **`/dashboard` rebuilt as Home (template F).** The hero, KPI cards and the 13 old `components/dashboard/*` files are gone, with `dashboard.service`, `dashboard-access`, `types/dashboard` and the mock data. New: `components/workspace-home/*`, `lib/services/home.service.ts`, pure logic in `lib/home/*`, kit `Panel`, layout-matched `loading.tsx`.
- Layout: page bar (greeting, BS date, updated time, scope badge, permission-aware toolbar) → **cue strip** → leave approvals worklist + payroll + trend + activity | today, deadlines, readiness, headcount.
- **Data fixed while rebuilding** (the old Home showed wrong numbers):
  - every *active loan* was listed as a "pending approval"; loans are now a cue with the outstanding total;
  - "Compliance 100%" was hard-coded; replaced by real statutory deadlines;
  - the attendance chart repeated today's numbers for Mon–Fri, and "present" was guessed when nothing was recorded; Home now says "not recorded yet";
  - "latest run" was the newest-created branch run; Home now combines every branch run of the latest BS period (status = slowest branch, decimal-safe totals);
  - "today" now follows Kathmandu time, not the server's (cPanel runs UTC).
- **S17 (Medium, new): leave decisions.** Scope, self-approval, transition rules, a server-side rejection reason, an atomic status change (no double deduction), an audit entry for every decision and denial, scoped leave lists, impersonation scope. Details in the security plan.
- Nav: the Home section is labelled "Home"; the page bar drops a crumb that only repeats the title. `getWorkspaceContext()` is cached per request (the layout called it twice; Home reuses it).

Enhanced (beyond the plan):
- Approval context in the queue: balance before → after (red if over balance), "waiting N days", unpaid-leave flag ("reduces salary"), colleagues in the same department off on overlapping days.
- Payroll: one next action per status, "Start <next month>" once the last period is locked and the month has begun, branch progress ("1 in review, 1 approved").
- Net pay trend with ±10% swing flags (an early look at F1 variance review).
- Statutory deadlines (TDS 25 days, SSF 15 days after BS month end) with the withheld amount; a passed deadline stays for 7 days as "was due · check it was deposited".
- Payroll readiness: missing or invalid PAN (9 digits), no bank account, zero basic, each with the first five employees linked to their record.
- Sections that fail stay in place as error panels with Try again; users with no queues get a pointer to self-service; support view is read-only.
- `/dev/home`: sample-data preview of every state (admin, branch manager, employee, failed), with a switch to send decisions to the real server.

Verified:
- `tsc` exit 0; no new lint errors (the 4 in `leave.repository.ts` are pre-existing).
- **343/343 tests** (24 new: `home-logic`, `security-leave-decision`; the old `security-dashboard-access` suite went with the old dashboard).
- Production build OK.
- Browser, signed in (1440, 1024, 390px), 0 console errors, no horizontal overflow:
  - real data: greeting, cues, the passed SSF deposit, "Start Bhadra 2083", locked Shrawan, readiness clean;
  - the leave tabs still load through the scoped lists;
  - `/dev/home`: stray A does nothing; J / A / R / Ctrl+Enter work; toast and count update; the real server refuses sample ids with "Leave request not found."; branch, employee and failed variants checked.

Notes:
- The deadline rules are the common defaults. Confirm them with your tax advisor; they become company settings with F10.
- Self-approval is now blocked for everyone, admins included. A company with a single approver needs a second person (or an admin) to decide that approver's own leave.
- Rejecting now requires a reason on the server too (the Approvals modal already asked for one).
- Not yet checked on real data: approving a real pending request (none exist), and a real branch-scoped login. See the 4.1 sign-off notes.

## 2026-10-02 — Phase 3 hands-on pass of `/dev/kit` (gate before Phase 4)
Branch: `redesign/3-component-kit` (not merged or pushed)

Every interaction was driven in a real browser (Playwright, 1440 and 390px): row clicks, grid keyboard, column drag, the employee window and dirty guard, typed confirmation, and the approval queue.

Fixed (found by the pass):
- **Worklist shortcuts leaked page-wide (safety, High for 4.1):** with a grid row focused, pressing A approved a leave request in another panel. Keys now act only while focus is inside that worklist (scoped `onKeyDown` on a focusable region with a visible focus ring). Focus stays in the queue after each decision.
- **Frozen column dropped on flagged rows:** `cn()` (tailwind-merge) keeps the last position class, and the row-tone `relative` came after `sticky`. Rows with an orange or red edge lost their pinned Code cell when scrolled sideways, and amounts showed through. Sticky is now applied last.
- **Focus escaped Window during async actions:** a focused button that disables itself while running dropped focus to `<body>`, so Esc did nothing and Tab left the dialog. Window now catches Esc and Tab for the topmost dialog when focus has fallen out. Every Phase 4 Save button needs this.
- **Confirm threw on failure:** a failed action was an unhandled rejection with no message. It now stays open, shows the error inline (`role="alert"`) and puts focus back in the field.
- Worklist: a queue that empties and refills starts again at item 1.
- Gallery: the employee window showed a hardcoded `EMP-001`, PAN and department; it now uses the selected row.

Enhanced:
- Freeze-pane divider on the last pinned grid column.
- Double-click a column edge to reset its width; the resize handle announces min/max to screen readers.
- An "Unsaved" marker appears in the window title bar as soon as a field changes.
- Worklist reason box: Ctrl+Enter confirms the rejection, Esc cancels; the key hint switches to match.
- Gallery: "Simulate a server refusal" switch to exercise the Confirm error path.

Verified:
- `tsc` exit 0 and eslint clean on `components/kit` and `components/dev`.
- **325/325 tests** (5 new in `kit-hands-on-regressions`).
- Production build OK.
- Browser:
  - 0 console errors or warnings, no horizontal overflow at 390px.
  - Every scenario above re-run after the fixes.

## 2026-10-02 — Phase 3: component kit v2
Branch: `redesign/3-component-kit` (from `redesign/2-app-frame` @ `7f61f53`; not merged or pushed)

Changed:
- **Kit** (`components/kit/`):
  - `DataGrid`, `FilterStrip`, `SplitView`, `Window`/`WindowButton`, `Confirm`
  - `PropertyForm`/`FieldGroup`/`FieldRow`, `Tabs`
  - `StatusChip`, `Amount`, `DateCell`
  - `FactBox`, `Worklist`, skeletons, `EmptyState`/`ErrorState`
- **Logic** (`lib/kit/`, unit-tested):
  - grid sort, selection, keyboard movement, prefs and paisa totals
  - amount format and parse (lakh, crore, accounting)
  - status vocabulary and aliases; focus-trap index; density preference
- **Enhancements beyond the plan:**
  - pinned columns
  - Ctrl+C copies grid rows into Excel safely
  - audited CSV export built into the grid
  - saved views store filter choices only
  - typed confirmation for destructive actions
  - unsaved-changes guard on windows
  - required rejection reason in the worklist
  - KPI compact amounts (L / Cr)
  - accounting-style negatives
  - density toggle in the user menu and command palette
- **S16 (Medium, new):**
  - 10 browser-built CSV exports had no formula neutralising and no EXPORT check or audit; all now go through `lib/export/csv.ts` + `authorizeExportAction`.
  - The bank transfer file quotes and cleans fields (a comma in a name shifted columns) and is audited.
  - The server report CSVs share the same escaper, which now also leaves plain negative amounts as numbers.
- **S9:** `toActionError()` / `UserFacingError` helper (modules adopt it in Phase 4).
- `/dev/kit` gallery with 60 synthetic employees, leave requests and forms exercising every component.

Verified:
- `tsc` exit 0.
- **320/320 tests** (25 new: `kit-logic`, `security-export`).
- No new lint errors in touched files. The one error in `components/reports/` is pre-existing, in the untouched `attendance-report-table.tsx`.
- Browser (dev, 1440 and 390px), 0 page errors:
  - keyboard selection (Space, Shift+↓ = 3 rows)
  - sort (aria-sort), filter + chips (Finance → 12 rows), status edges
  - SplitView detail and FactBox
  - Window focus trap (15 Tabs stayed inside) and dirty guard
  - typed confirm (disabled until "UNLOCK")
  - worklist A/R (3 → 1)
  - phone: icon toolbar, full-screen detail with Back, no overflow

Notes:
- The browser CSV exports now ask the server for permission first. Users without EXPORT on a module (for example a role with VIEW only) can no longer download that CSV. This is intended (standing measure 5); grant EXPORT where it is needed.
- Bank file: names keep their text but lose leading `= + - @`, and commas are quoted. Check one file against your bank's upload screen after deploying.

## 2026-10-02 — Phase 2 signed off
Branch: `redesign/2-app-frame`

You unlocked the locked session with your password in the browser. Afterwards:
- `/dashboard` and `/payroll/review` load normally.
- `/locked` redirects back to `/dashboard`.

That closes the last unverified item in the lock flow.

Carried over to the 4.1 sign-off: the restricted-role (BRANCH/DEPARTMENT) pass and the super-admin (impersonation) view of the frame.

## 2026-10-02 — 2.8 idle lock: 15 → 30 minutes
Branch: `redesign/2-app-frame`

You asked for 30 minutes or for research on real-world values. I researched NIST 800-63B-4, OWASP, PCI DSS, the CIS benchmark, Dynamics 365 F&O, Workday, Xero and QuickBooks Online (table in `03-security-plan.md` → "Idle lock duration").
- The lock is now **30 minutes**, with a **2-minute** status-bar countdown.
- The policy lives in one place: `lib/frame/session-policy.ts`.
- A test keeps it at or under NIST AAL2's one-hour ceiling.

Verified: `tsc` exit 0 · tests pass.

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
  - 15 minutes without input in any tab, shared through localStorage timestamps (now 30 minutes, see the entry above).
  - 60-second countdown in the status bar (now 2 minutes); `Ctrl Shift L` locks straight away.
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
2. Sessions now lock after 30 minutes idle. People must re-enter their password, and 5 wrong tries sign them out.

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
