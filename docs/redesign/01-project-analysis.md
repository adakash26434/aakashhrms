# 01 — Project Analysis (baseline as of 2026-10-02)

This is a snapshot of AakashHRMS **before** the redesign. All later work in
this folder is measured against it.

## 1. What the product is

AakashHRMS is a **multi-tenant, Nepal-compliant HR and payroll system**:

- Every company (tenant) gets its **own PostgreSQL database**. A central
  **platform DB** holds companies, policy packs, change requests and the
  platform audit trail.
- Users sign in with **Company Code + email + password**. The company code
  resolves the tenant slug, and the slug is carried in the NextAuth JWT.
- Super admins have a separate **Platform console** (`/platform`). They can
  "View company workspace" (impersonation) through a signed JWT cookie.
- Nepal-specific logic: Bikram Sambat (BS) / AD dual calendar, IRD tax slabs,
  SSF / CIT / insurance deductions, Shreni (grade) levels, 77-district address
  picker, Nepal Labor Act leave rules.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.3 (App Router, Server Actions, `proxy.ts` middleware) | `output: "standalone"`, built with `--webpack` |
| UI | React 19.2, Tailwind CSS v4, lucide-react, recharts | No component library; hand-rolled primitives in `components/ui` |
| Data | Drizzle ORM 0.45 + `postgres` driver | PG 10 compatible (UUIDs generated in app) |
| Auth | NextAuth v5 beta (credentials), bcryptjs, jose (platform/impersonation JWTs) | |
| Hosting | cPanel + Phusion Passenger (`app.js` → `.next/standalone/server.js`) | Low memory, `cpus: 1` build |
| Tests | `node --test` + tsx (20 test files, mostly engine/unit logic) | |
| CI | GitHub Actions: lint → type-check → test → build | |

Size: about **122k lines** of TS/TSX across `app/`, `components/` and `lib/`.

## 3. Architecture (layering)

```
app/(group)/route/page.tsx      Server component: ensureTenantContext → checkPermission → service → <XxxClient/>
app/actions/*.actions.ts        'use server' mutations: checkPermission → service → ActionResponse
lib/services/*.service.ts       Business orchestration (transactions, audit)
lib/engines/*.engine.ts         Pure calculation/validation logic (unit-tested)
lib/repositories/*.repository.ts  Drizzle queries
lib/db/                         Tenant pool manager, AsyncLocalStorage tenant context, schema (37 tables)
lib/platform/                   Platform DB, provisioning, impersonation, policy packs
components/<module>/            Client UI per module (XxxClient + table + filters + form modal + detail panel)
components/ui/                  Shared primitives (button, dialog, tabs, table-shell, side-panel, toast…)
components/layout/              Dashboard shell, sidebar, top header, page frame
```

The layering is clean and consistent. **The redesign touches only
`components/`, `app/**/page.tsx` markup, `app/globals.css` and
`app/layout.tsx`.** Services, engines, repositories and actions stay the same,
apart from the security fixes listed in `03-security-plan.md`.

## 4. Route groups and modules

| Group | Routes | Permission modules |
|---|---|---|
| `(auth)` | `/login`, `/change-password` | — |
| Public | `/` (marketing home, `home-page-client.tsx` 1.7k lines), `/onboarding`, `/tenant-not-found` | — |
| `(dashboard)` **Overview** | `/dashboard` | (none — see security S3) |
| **Configuration** | `/setup` (overview), `/setup/company-setup`, `/setup/holidays`, `/setup/payroll-rules` (tabs: fiscal-year, tax-rates, pay-heads, rules-defaults), `/setup/fiscal-year`, `/setup/tax-rates`, `/setup/pay-heads`, `/setup/system-control` | ORG_STRUCTURE, HOLIDAYS, FISCAL_YEAR, TAX_RATES, PAY_HEADS, SYSTEM_CONTROL |
| **Workforce** | `/workforce/employees` (+ `new`, `[id]/edit`), `/workforce/organization`, `/workforce/departments`, `/workforce/salary-mapping` | EMPLOYEES, ORG_STRUCTURE, SALARY_MAPPING |
| **Time & Leave** | `/timeAndLeave/attendance`, `leaves` (hub), `applications`, `approvals`, `policies` (hub), `leave-types`, `leave-rules`, `ot-rules` | ATTENDANCE, LEAVE_*, OT_RULES |
| **Payroll & Finance** | `/payroll/generate`, `/payroll/review`, `/payroll/leave-salary`, `/loans` | PAYROLL_GENERATE, PAYROLL_REVIEW, LEAVE_SALARY, LOANS |
| **Reports** | `/reports` + salary-sheet, payslip, attendance, tax-ird, leave, loan | REPORTS_* |
| **Administration** | `/admin/users`, `/admin/roles`, `/admin/audit-log` | USERS_ROLES, AUDIT_LOG |
| `(self-service)` | `/self-service` + my-profile, my-payslips, my-leave, my-attendance, my-loans | SELF_SERVICE (SELF scope) |
| `(platform)` | `/platform` dashboard, companies (list / new / `[id]`), change-requests, policies, audit, login | platform session |
| `api/platform/*` | 15 route handlers (companies CRUD, provision, credentials, impersonate, health, policies sync) | platform session |

RBAC: 27 modules × 7 actions (VIEW / ADD / EDIT / DELETE / APPROVE / EXPORT /
LOCK) and 7 preset roles. Data scope is GLOBAL, BRANCH, DEPARTMENT or SELF
(`lib/auth/scope-filter.ts`).

## 5. Current UI audit

### Shell
- `DashboardShell`: a 256px white sidebar that collapses to 72px with
  pin/hover, a 56px white top header, and a `<main>` with `p-6` on white.
- Sidebar: brand row, an "Active company" pill, accordion nav groups with
  uppercase 10px labels, and a solid emerald active item.
- Header: company breadcrumb, a **non-functional** search box showing a `⌘K`
  hint (no command palette exists), BS/AD toggle, FY pill, approvals bell, and
  a user dropdown.
- No status bar, no keyboard shortcuts, no breadcrumbs and no per-page
  toolbar convention.

### Visual language
- Font: **Poppins**. It is geometric and marketing-oriented, and it is loaded
  **twice** (CSS `@import` plus a `<link>`) and a third time through
  `next/font`.
- Colour: emerald brand `#1B6B54` on zinc neutrals. Defined as
  `--payroll-*` tokens, but the components mostly ignore them:

  | Pattern | Occurrences |
  |---|---|
  | Raw `zinc/gray/slate-NNN` classes | **~6,060** |
  | Raw `emerald-NNN` classes | ~995 |
  | `payroll-*` token classes | ~2,760 |
  | Arbitrary font sizes `text-[10.5px]` etc. | **~1,125** |
  | Raw `<button>` vs `<Button>` | 441 raw vs 108 files using `Button` |
  | Files with hand-written `<table>` | 46 |
  | Custom `fixed inset-0` modals (not `Dialog`) | 10 |

- Pages are "web dashboard" style: hero banners, KPI card grids and large
  rounded cards. Decorative "aura/beam/glow" animations sit in globals.css.
- Detail views use slide-over side panels or modals. There is no
  master-detail split view.
- Tables: global `thead` styling forced with `!important`. Each module
  builds its own table, filter bar and pagination.

### Consequences for the redesign
1. **Retheme lever:** Tailwind v4 lets us **remap the `zinc` and `emerald`
   scales in `@theme`**. One edit to `globals.css` reskins about 7,000 usages
   immediately, before any component rewrite. Phase 1 uses this.
2. A real **component kit** (DataGrid, Toolbar, PropertyForm, Window/Dialog,
   SplitView, StatusBar, CommandPalette) has to come before module work.
   Otherwise each module re-invents its own.
3. Modules follow one pattern (`XxxClient` → filters + KPI + table + form
   modal + detail panel). That makes a **module-by-module template migration**
   practical.

## 6. Work-in-progress at analysis time

At the time of analysis, `main` had 18 modified and 2 untracked files across
payroll, attendance, loans, reports and salary-mapping. **They must be
committed (or stashed) before redesign work starts.** Redesign commits must not
mix with that feature work.
