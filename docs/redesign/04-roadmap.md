# 04 — Roadmap

Work proceeds **phase by phase, module by module**. Each step is small enough
to review, ships behind no flags (the reskin is global by design), and leaves
the app working.

## Working agreement

- **Branching:** `redesign/<phase>-<slug>` off `main` (for example
  `redesign/0-security`, `redesign/2-app-frame`,
  `redesign/4.2-employees`). Merge only after verification passes.
- **Never mix** redesign commits with feature work. Commit or stash the
  in-progress payroll/attendance/loan changes **before Phase 0 starts**.
- **No backend behaviour changes** in UI phases. Services, engines,
  repositories and actions change only for the security items in
  `03-security-plan.md`.
- **Every step is logged** in `CHANGELOG.md` in this folder: what changed,
  which files, and how it was verified.
- **Verification gate (every step):**
  1. `npm run type-check`, `npm run lint`, `npm test` all green
  2. Run the app and check affected screens at **1440px, 1024px and 390px**
  3. Log in as a **restricted role** (BRANCH or DEPARTMENT scope) and confirm
     hidden or blocked actions
  4. Check print preview for any screen that prints
  5. Keyboard-only pass: Tab order, Esc, Enter, shortcuts
- **Sign-off points** (you review screenshots before I continue): after
  Phase 1, after Phase 2, and after the first migrated module (4.1).

---

## Phase 0 — Preparation & security hardening
Goal: a safe baseline before any visual work.

- [x] 0.1a Commit current WIP: `9c4b7d5 feat(payroll): sync attendance, unpaid leave, OT and loans into payroll runs` (type-check clean, 192/192 tests pass)
- [x] 0.1b Commit `docs/redesign/`. Create the `redesign/0-security` branch.
- [x] 0.2a **S0 (new, critical)**: tenant DB was a process-wide global → per-request resolution, fail closed
- [x] 0.2 **S1**: fix the impersonation-cookie presence bypass (proxy +
      `authorized()`), redirect in the dashboard layout when there is no
      session, make `getDb()` fail closed in multi-tenant mode, and treat an
      empty `allowedModules` as no access.
- [x] 0.3 **S2**: stop storing plaintext temp passwords. Drop them from
      list/detail queries. Add a migration to null existing values. Show
      temp passwords once only.
- [x] 0.4 **S3 / S8 / S12**: add auth guards to the dashboard, reports index
      and self-service actions, and remove placeholder identity fallbacks.
- [x] 0.5 **S4**: session `maxAge` 8h and `updateAge` 15m.
- [x] 0.6 **S5 / S10**: trusted client IP, IP-level limiter, backoff instead
      of hard lockout, contact form throttling and honeypot.
- [x] 0.7 **S7**: parameterise the scope-filter subqueries.
- [x] 0.8 Secret separation startup check. Add `npm audit` to CI (gate at `critical` until the next-auth → nodemailer chain has a non-breaking fix; then `high`). Next.js patched 16.3.0 → 16.3.8 (critical RCE advisory).
- [x] 0.9 Add `tests/security-*.test.ts` for guards, scope filter and rate limiter. Seven suites: auth-guard, invariants, dashboard-access (replaced in 4.1 by `security-leave-decision`, with the old dashboard), login-throttling, scope-filter, secrets, plus the existing rate-limiter suite. The invariant and guard tests were confirmed to **fail on the old code**.

> **Known debt (not Phase 0):** `npm run lint` reports 225 pre-existing errors (mostly `no-explicit-any` in services/repositories), so the CI *Lint* step was already failing on `main`. This branch adds none (verified per file against `main`). They're cleaned up module by module in Phase 4 and finished in Phase 8.

## Phase 1 — Design foundation (global reskin)
Goal: the whole app shifts to the new look with no component rewrites.

- [x] 1.1 New token set in `app/globals.css`: ramps (`--forest`, `--neutral`, `--crimson`), semantic variables, and Tailwind utilities (`bg-brand`, `bg-surface`, `text-ink-muted`, `border-line`, status and chart tokens). The logo forest-green palette uses light chrome.
- [x] 1.2 **Remapped** `zinc`/`gray`/`slate`/`neutral`/`stone` → green-tinted neutrals, `emerald`/`green` → forest ramp, `rose`/`red` → one crimson danger hue, and `payroll-*` → semantic tokens (~8.5k usages, no rewrites). *Enhanced:* gray and slate (1.9k usages) were added so neutrals no longer mix cool and warm greys. Rose was unified with red so errors don't clash with the logo red. Radii tightened (4/6/8px) and shadows flattened for a desktop feel.
- [x] 1.3 Poppins → **Inter** via `next/font` (self-hosted). JetBrains Mono kept for codes only, and amounts moved off mono (`NprText`). Google `@import` and `<link>` removed. Tabular numerals are scoped to tables, fields and numbers. Devanagari falls back to the OS font.
- [x] 1.4 Type scale and density: body 13px (`text-sm` 14→13), new `text-2xs` (11) and `text-3xs` (10, badges only). **1,072 arbitrary `text-[Npx]` replaced across 174 files.** Removed every `!important` outside print and reduced motion: the global rules now use cascade layers. One focus style, one table header style. Themed thin scrollbars, brand `accent-color` on native controls, `::selection` and visible `:focus-visible` rings.
- [x] 1.5 Decorative motion: unused aura/beam/glow animations deleted. The remaining ambient glow is limited to the entry pages (login, marketing), and a test keeps it off app screens. Chart colours are centralised (`CHART_THEME`), and hard-coded hex colours were removed from the dashboard charts, error pages, onboarding and date picker.
- [x] 1.6 **S6**: nonce-based CSP plus header clean-up. **S13** (found here): request headers were dropped on NextAuth routes. **S11**: `npm run verify`.
- [x] 1.7 Screenshot tour of every route. **Signed off by you on 2026-10-02.** The restricted-role pass moves to the Phase 2 sign-off, because the frame changes what restricted users see.
  - **Done (signed in as Office Administrator):**
    - All 36 module routes at 1440px. Key screens also at 1024 and 390px.
    - Salary-sheet print preview.
    - 0 CSP violations, 0 console errors, no horizontal page overflow.
  - **Fixes from the tour:**
    - `font-mono` → tabular Inter, so amounts no longer wrap.
    - Pinned sidebar collapses to the icon rail below 1024px (interim, until 2.9).
    - Header company block hidden on phones.
    - Toasts hidden in print.
  - **Remaining:** restricted-role (BRANCH/DEPARTMENT) pass, and your sign-off.

## Phase 2 — Application frame (desktop shell)
Goal: the app looks and behaves like installed software.

- [x] 2.1 Navigation model `lib/frame/navigation.ts`: 7 **modules → sections** with icons, `Alt+1…7`, permission metadata (`requires`, any-of), path aliases, palette keywords and counters. Pure helpers (`visibleModules`, `findActiveLocation`) are unit-tested. A test checks that every section points at a real page.
- [x] 2.2 `TitleBar`:
  - logo mark and Aakash**HRMS** wordmark, plus the green→red brand strip
  - company name and the palette trigger
  - BS/AD switch and FY pill
  - approvals bell, shown only to approvers (S15)
  - shortcut help and the user menu (self-service, profile, shortcuts, lock, sign out)
  - *E1 working-period selector moved to 4.8.* No screen reads it yet, and a selector nobody honours would mislead users.
- [x] 2.3 `ModuleRail` (56px, active tile + green edge, tooltips with hotkeys) and `SectionNav` (224px, module header, active edge, pending-approvals counter, **Recent pages** stored in localStorage as paths and labels only).
- [x] 2.4 `StatusBar`: connection, company (code) · branch, FY, today in BS and AD, role, version, super-admin indicator and a **lock countdown** during the final minute.
- [x] 2.5 `PageBar` + `CommandToolbar`:
  - breadcrumb from the navigation model, plus title, status and actions
  - fixed group order: Create · Selection · Output · Refresh
  - per-action shortcuts, `hidden` and `disabled` with a reason
  - shown in `/dev/kit`; pages adopt them in Phase 4
- [x] 2.6 `CommandPalette` (`Ctrl K`, `Alt G`):
  - ranked page search, plus recent pages
  - permission- and scope-checked **employee search** (display fields only), which opens the register filtered by `?q=`
  - commands: BS/AD, navigator, shortcuts, lock, self-service, sign out
  - full keyboard and ARIA combobox behaviour
- [x] 2.7 Shortcut registry `lib/frame/shortcuts.ts`, which drives both the key handler and the `?` help overlay. Plain keys never fire while typing.
- [x] 2.8 **Idle session lock, enforced on the server**:
  - After **30 minutes** without input in any tab, plus a 2-minute countdown, the session is locked (duration chosen from research, see the security plan).
  - `Ctrl Shift L` and the user menu lock it straight away.
  - The lock is a flag in the signed JWT. The route guard sends every page and action to `/locked`, and the permission helpers refuse locked sessions.
  - Unlocking needs the password: 5 tries, then sign-out. A server-signed grant then releases that specific lock.
  - It is not a client overlay that can be bypassed.
- [x] 2.9 Responsive:
  - ≥1280px: docked navigator.
  - 1024–1279px: the navigator floats on demand.
  - <1024px: rail and navigator move into a drawer.
  - The status bar condenses, and pages have no horizontal overflow.
- [x] 2.10 `AppFrame` replaces `DashboardShell`, `Sidebar` and `TopHeader` (deleted). The impersonation banner is a slim strip inside the frame. **Signed off by you on 2026-10-02**, after the real-password unlock worked. The restricted-role and super-admin-view passes carry over to the 4.1 sign-off.

## Phase 3 — Component kit v2
Goal: building blocks so modules don't re-invent tables and forms. The code is in `components/kit/` (UI) and `lib/kit/` (pure, unit-tested logic). Everything is shown in `/dev/kit`.

- [x] 3.1 `DataGrid`:
  - sort (numeric- and date-aware, empties last)
  - resize by drag or keyboard, hide columns, widths and visibility remembered per grid
  - **pinned leading columns**
  - selection with Shift-range and Ctrl+A
  - full keyboard navigation, Enter to open
  - totals footer computed in paisa (no float drift)
  - paging, density, and loading, empty and error states
  - **Ctrl+C copies rows Excel-ready** (formula-safe)
  - **built-in audited CSV export**
  - ARIA grid semantics
- [x] 3.2 `FilterStrip`: search, inline filters, applied chips with remove and clear-all, **saved views** (filter choices only, never search text).
- [x] 3.3 `SplitView`: resizable by drag or keyboard, width remembered, a full-screen panel with Back on phones.
- [x] 3.4 `Window`:
  - sizes sm to full, title bar, sticky footer
  - focus trap, focus restore, Esc
  - **unsaved-changes guard**
  - portal, plus standard `WindowButton`s
- [x] 3.5 `PropertyForm`, `FieldGroup`, `FieldRow` (label-left; automatic id, aria-describedby, aria-invalid and aria-required wiring; read-only variant) and `Tabs` (horizontal or vertical, roving focus, ARIA tabs).
- [x] 3.6 Display components:
  - `StatusChip`: 12-term vocabulary, alias mapping, icon and label (never colour alone)
  - `Amount`: lakh grouping, negatives, accounting style, KPI lakh and crore compact
  - `DateCell`: BS first, other calendar on hover
  - `Confirm`: **typed confirmation**
  - `Skeleton`, `GridSkeleton`, `FormSkeleton`, `EmptyState`, `ErrorState`
- [x] 3.7 Safe export (`lib/export/csv.ts`, `authorizeExportAction`): formula neutralising, BOM for Excel, the EXPORT permission check and an audit entry. **Every existing CSV export migrated (S16)**, including the bank file.
- [x] 3.8 `FactBox` (E2), `Worklist` (E3: J/K/A/R scoped to the focused worklist, reason required to reject), density toggle (E5, in the user menu and palette), status-edge rows (E9), layout-matched skeletons (E11).
- [x] 3.9 `/dev/kit` gallery with realistic sample data for every component (dev only).
- [x] 3.10 Hands-on browser pass of `/dev/kit` before Phase 4: 4 defects fixed (worklist keys leaking page-wide, frozen column lost on flagged rows, focus escaping Window during async actions, Confirm failing silently). Details in the CHANGELOG.
- [x] Extra: `toActionError()` / `UserFacingError` (S9 helper; modules adopt it in Phase 4).

## Phase 4 — Module migrations (one branch each)
Every module follows its template from the design system (§5) and the
per-module **definition of done** below.

| Step | Module | Template | Screens |
|---|---|---|---|
| 4.1 | **Dashboard** | F | `/dashboard` analytics dashboard (KPIs, cost charts, attendance, action cards), revised after your review of the work-queue version. **Signed off by you on 2026-10-03** (`redesign/4.1-home`) |
| 4.2 | **Workforce: Employees** | A + B | Register + quick view, full record page with related-history tabs, full-page editor with Enter-to-next; security S18. **Signed off by you on 2026-10-03** (`redesign/4.2-employees`) |
| 4.3 | **Workforce: Organization** | A | Branches, departments (company-wide), designations, grade levels, employment types, structure matrix and reporting chart; security S19. **Signed off by you on 2026-10-04** (`redesign/4.3-organization`) |
| 4.4 | **Salary structure** | A + B | Dated salary revisions with history, Revise window, spreadsheet Bulk edit (EditGrid, Excel paste, CSV import), Zoho-style approvals (none / simple / multi-level, Final approve, timeline, Waiting for me, bulk decide, delegation; never your own salary), templates, revision letter; SSF on basic + grade (company setting); security S20, S21. Later: `.xlsx` import (CSV and paste from Excel today); email notifications for approvals. **Signed off by you on 2026-10-04** (`redesign/4.4-salary-structure`) |
| 4.5 | **Time: Attendance** | A + C | Day rules engine (BS / AD months), Today, monthly register (EditGrid, HR overrides), adjustments with supervisor approval, month close per branch for payroll, punch log; security S22. Then 4.5b shifts (company-defined: week with off days and own hours, BS seasons such as winter, fixed / flexible, night) with assignments, a day roster and rotations; 4.5c web check-in with IP / location limits; **Devices** later (device table and secret, ZKTeco ADMS push, punch file import from device exports, auto shift by first punch, device health). **4.5 signed off (a, b, c) on `redesign/4.5-attendance`** |
| 4.6 | **Time: Leaves** | A | applications, approvals, balances drawer; S21 already applied to leave approvals (keep the shared check); leave day count from the attendance calendar (weekly off, holidays); home leave accrual by days worked; substitute leave for work on a weekly / public holiday (Labour Act, within 21 days) |
| 4.7 | **Time: Policies** | A + E | leave types, leave rules, OT rules; one OT formula for payroll (today basic ÷ 240 × multiplier from system control; `ot_rules` not yet used) |
| 4.8 | **Payroll run** | C | generate → pre-flight → calculate → review grid → approve → lock; payslip modal; **E1 working-period selector** (first consumer); **arrears** for back-dated salary revisions (4.4 stores them dated; payroll already picks the revision in force; SSF on basic + grade is in place; until then 4.4 refuses changes into approved / locked months); S21: no manual edits to your own payslip; payroll runs in **AD months** (switches the attendance month option on); arrears for attendance corrected after close; pre-flight requires closed attendance months (4.5 warns only); **pay-run approval** reuses the approval engine (none / simple / multi-level, Final approve, timeline) |
| 4.9 | **Leave salary** | C | setup + run table; S21: no approving your own encashment |
| 4.10 | **Loans** | A | register, disbursement, repayment, loan types; S21: no approving your own loan |
| 4.11 | **Reports** | D | salary sheet, payslip, attendance, tax/IRD, leave, loan + print/PDF styles |
| 4.12 | **Configuration** | E | setup overview, company setup (5 tabs), holidays, payroll rules (fiscal year, tax, pay heads, system control); **Approvals** settings page (moved from Salary structure) with **Custom approval rules** (route by % increase, monthly change, new gross, branch / department); **shift allowance** (per night / shift day worked, from the attendance month); pay heads: onboarding's "Basic Salary" / "Grade Amount" become fixed label heads that cannot hold amounts, with a list of employees who still have one (e.g. Pramod Sharma's 3,500 before 4.4) |
| 4.13 | **Administration** | A + B | users, roles + permission matrix, audit log; S21: no changing your own role or permissions; show which users are linked to employees |

**Definition of done (per module)**
- Uses only kit components and semantic tokens (no raw `zinc-NNN` or arbitrary `text-[Npx]` left in the module folder)
- Toolbar actions declare permissions. Shortcuts work.
- Loading, empty and error states exist. Errors go through `toActionError()` (S9).
- Exports go through the safe export helper.
- Verification gate passed. CHANGELOG entry written.

## Phase F — Functional enhancements (from `05-functional-research.md`)
Separate branches (`feature/<slug>`). Engines get unit tests first. Each item
uses the new templates. Tier 1 runs alongside module 4.8 (Payroll run);
Tiers 2–3 follow Phase 4.

| Tier | Items |
|---|---|
| **1 — Accuracy & control** | F1 Variance review step (blocks approval until flags are acknowledged) · F2 Enforced maker-checker on runs · F3 Payslip publish / hold / release + notification email · F4 Export log · F5 Tax projection engine + computation sheet |
| **2 — Nepal completeness** | F6 Run types (regular, festival bonus, profit bonus, arrears, final settlement, off-cycle) · F7 Arrears engine for back-dated salary changes · F8 Full & final settlement · F9 SSF schedule, CIT statement, IRD eTDS file, tax certificate · F10 Compliance calendar + reminders · F11 Bilingual payslip |
| **3 — Productivity** | F12 Accounting journal export (Tally XML / CSV) · F13 Maker-checker on salary, bank and PAN changes · F14 Mass increment · F15 Excel import templates · F16 Reimbursements & salary advance · F17 Notification centre |

Schema changes (run type enum, pending-change table, export log, payslip
publish state) follow the PG10 rules in `AGENTS.md` (`$defaultFn` UUIDs) and
need tenant-schema sync for existing tenants.

## Phase 5 — Employee self-service portal
A lighter variant of the frame: no module rail, a top bar plus bottom tabs
on phone, and a mobile-first layout. Covers profile, payslips, leave,
attendance and loans.

## Phase 6 — Entry experience
Login (company code, email, password; split brand panel), change password,
onboarding wizard (template C), tenant-not-found, error pages. The marketing
homepage `/` **keeps its website style** but adopts the new tokens and font.

## Phase 7 — Platform console (super admin)
Same frame with platform modules: Companies, Change requests, Policy packs,
Audit, Health. Covers the large screens (`companies/new` 1.4k lines,
`edit-company-modal` 1.7k, `policy-pack-manager` 1.8k).

## Phase 8 — Hardening & cleanup
- Delete superseded components (`side-panel`, `drawer-shell`, `table-shell`, `page-header`, per-module confirm dialogs, unused `lib/data/mock-*`), legacy `--payroll-*` tokens, and dead CSS.
- Accessibility audit (WCAG 2.1 AA) on all templates.
- Performance: bundle check, virtualise long grids, keep dynamic imports.
- Final security review of the whole diff against `03-security-plan.md`.
- Update `AGENTS.md` / README with the new conventions.

## Phase 9 — Optional enhancements
Dark theme, multi-tab document workspace (open several employees or runs as
tabs), server-persisted grid views, and Excel-like inline editing for the
attendance and review grids.

---

## Current status
See `CHANGELOG.md`.
- **Phase 0** is complete on `redesign/0-security`.
- **Phase 1** is complete and signed off on `redesign/1-foundation`.
- **Phase 2** is complete on `redesign/2-app-frame`, which is stacked on Phase 1. None of these branches is merged or pushed.
- **Phase 2 is signed off.**
- **Phase 3 is complete** on `redesign/3-component-kit`, which is stacked on Phase 2.
- Phases 4.1 (Dashboard), 4.2 (Employees), 4.3 (Organization), 4.4 (Salary structure) and 4.5 (Attendance: day rules, shifts and roster, web clock-in) are signed off. 4.6 Leaves is in progress on `redesign/4.6-leaves`, stacked on 4.5: 4.6a foundation, 4.6b entitlements, 4.6c statutory leave settings. Device integration (and punch file import) is its own later step; the full self-service redesign is Phase 5.
