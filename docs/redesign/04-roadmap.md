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
- [x] 0.9 Add `tests/security-*.test.ts` for guards, scope filter and rate limiter. Seven suites: auth-guard, invariants, dashboard-access, login-throttling, scope-filter, secrets, plus the existing rate-limiter suite. The invariant and guard tests were confirmed to **fail on the old code**.

> **Known debt (not Phase 0):** `npm run lint` reports 225 pre-existing errors (mostly `no-explicit-any` in services/repositories), so the CI *Lint* step was already failing on `main`. This branch adds none (verified per file against `main`). They're cleaned up module by module in Phase 4 and finished in Phase 8.

## Phase 1 — Design foundation (global reskin)
Goal: the whole app shifts to the new look with no component rewrites.

- [ ] 1.1 New token set in `app/globals.css` (`:root` + `@theme`), using the **logo forest-green palette and light chrome** from §3 of the design system.
- [ ] 1.2 **Remap Tailwind `zinc-*`, `emerald-*` and `green-*` scales** to the green-tinted neutrals and the forest-green ramp (reskins ~7k usages).
- [ ] 1.3 Switch the font from Poppins to **Inter** via `next/font` (self-hosted). Remove the Google `@import` and `<link>`. Enable tabular numerals.
- [ ] 1.4 Base type scale and density: body 13px, control heights, table header and row rules (remove the `!important` hacks).
- [ ] 1.5 Remove decorative aura/beam animations from app routes (keep them on the marketing page only).
- [ ] 1.6 **S6**: Content-Security-Policy plus header clean-up (now possible because fonts are self-hosted).
- [ ] 1.7 Screenshot tour of every route. **Sign-off.**

## Phase 2 — Application frame (desktop shell)
Goal: the app looks and behaves like installed software.

- [ ] 2.1 Restructure `lib/constants/navigation.ts` into **modules → sections** with icons, shortcuts and permission metadata.
- [ ] 2.2 `TitleBar` (logo mark + wordmark, green→red brand strip, menus, palette trigger, BS/AD, **working period selector (E1)**, FY selector, notifications, user menu).
- [ ] 2.3 `ModuleRail` (dark, `Alt+1…7`) and `SectionNav` (collapsible, counts, recent records).
- [ ] 2.4 `StatusBar` (tenant, branch, FY, BS+AD date, role, connection, version).
- [ ] 2.5 `PageBar` + `CommandToolbar` (declarative actions with shortcuts and permission).
- [ ] 2.6 `CommandPalette` (`Ctrl K`, plus `Alt G` alias for Tally users, E6): pages, employee search, actions.
- [ ] 2.7 Global shortcut manager plus `?` help overlay.
- [ ] 2.8 Idle **session lock** screen (S4 UX part).
- [ ] 2.9 Responsive behaviour (navigator auto-collapse, drawer < 1024px).
- [ ] 2.10 Replace `DashboardShell` and impersonation banner placement. **Sign-off.**

## Phase 3 — Component kit v2
Goal: building blocks so modules don't re-invent tables and forms.

- [ ] 3.1 `DataGrid` (sort, resize, hide columns, persisted widths, selection, keyboard nav, totals footer, states)
- [ ] 3.2 `FilterStrip` + applied chips + saved views (local)
- [ ] 3.3 `SplitView` (master/detail, resizable, stacks on mobile)
- [ ] 3.4 `Window` (dialog v2: focus trap, sizes, sticky footer, dirty guard)
- [ ] 3.5 `PropertyForm`, `FieldRow`, `FieldGroup`, vertical `Tabs`
- [ ] 3.6 `StatusChip`, `Amount`, `DateCell`, `Confirm` (typed confirmation), `Skeleton`, `EmptyState`
- [ ] 3.7 Safe export helper (CSV formula-injection escaping, permission + audit hook)
- [ ] 3.8 `FactBox` context pane (E2), `Worklist` template (E3), density toggle (E5), status-edge rows (E9), layout-matched skeletons (E11)
- [ ] 3.9 Dev-only component gallery route (`/dev/kit`, disabled in production)

## Phase 4 — Module migrations (one branch each)
Every module follows its template from the design system (§5) and the
per-module **definition of done** below.

| Step | Module | Template | Screens |
|---|---|---|---|
| 4.1 | **Home** | F | `/dashboard` (work queues instead of hero) — **sign-off** |
| 4.2 | **Workforce: Employees** | A + B | list + split detail, create flow, edit tabs (`employee-form-tabs` 2k lines) |
| 4.3 | **Workforce: Organization** | A | departments, designations, branches, organization view |
| 4.4 | **Salary structure** | A + B | salary mapping list, mapping editor, bulk actions |
| 4.5 | **Time: Attendance** | A + C | register, bulk entry, lock process |
| 4.6 | **Time: Leaves** | A | applications, approvals, balances drawer |
| 4.7 | **Time: Policies** | A + E | leave types, leave rules, OT rules |
| 4.8 | **Payroll run** | C | generate → pre-flight → calculate → review grid → approve → lock; payslip modal |
| 4.9 | **Leave salary** | C | setup + run table |
| 4.10 | **Loans** | A | register, disbursement, repayment, loan types |
| 4.11 | **Reports** | D | salary sheet, payslip, attendance, tax/IRD, leave, loan + print/PDF styles |
| 4.12 | **Configuration** | E | setup overview, company setup (5 tabs), holidays, payroll rules (fiscal year, tax, pay heads, system control) |
| 4.13 | **Administration** | A + B | users, roles + permission matrix, audit log |

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
See `CHANGELOG.md`. **Phase 0 complete** on branch `redesign/0-security` (not merged or pushed). **Paused before Phase 1** at the user's request; additions to Phase 1 are pending from the user.
