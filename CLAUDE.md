# AakashHRMS — Claude Code instructions

Multi-tenant, Nepal-compliant HR & payroll system (Next.js 16 App Router + Drizzle/PostgreSQL + NextAuth v5). One PostgreSQL database per company (tenant) plus a central platform DB. Deployed on cPanel/Passenger.

Stack, PG10 constraints, DB scripts and deploy steps (also read by other agents):
@AGENTS.md

## Commands

```bash
npm run dev                      # dev server (webpack)
npm run type-check               # tsc --noEmit — must exit 0
npm test                         # node --test, all tests/*.test.ts
node --import tsx --test tests/<file>.test.ts   # one test file
npx eslint <changed files>       # lint only what you touched (see "Known debt")
npm run build                    # production build (slow: cpus=1); runs postbuild asset copy
npm run verify                   # local gate: type-check → test → build
```

- Check **exit codes**, not grep output. `tsc ... | grep` hides failures. Use `npx tsc --noEmit > out.txt 2>&1; echo $?`.
- Never run `npm audit fix --omit=dev`; it prunes devDependencies from node_modules. Run `npm install` to restore.
- The shell is Git Bash on Windows. LF→CRLF warnings from git are harmless.

## Architecture (keep the layering)

```
app/**/page.tsx          server component: ensureTenantContext → checkPermission[WithScope] → service → <XxxClient/>
app/actions/*.actions.ts 'use server' boundary: checkPermission → service → { success, data | error }
lib/services/            orchestration, transactions, audit logging
lib/engines/             pure calculation/validation — unit-test these
lib/repositories/        Drizzle queries only
components/<module>/     client UI (XxxClient + table + filters + form modal + detail panel)
components/ui/           shared primitives
```

### Where files go (one domain name, used in every layer)
| Kind | Path | Example (dashboard) |
|---|---|---|
| Route | `app/(dashboard)/<route>/page.tsx` + `loading.tsx` | `app/(dashboard)/dashboard/page.tsx` |
| Server actions | `app/actions/<domain>.actions.ts` | `app/actions/leave.actions.ts` |
| Orchestration | `lib/services/<domain>.service.ts` | `lib/services/dashboard.service.ts` |
| Pure logic (tested) | `lib/engines/<domain>.engine.ts` | `lib/engines/dashboard.engine.ts` |
| Queries | `lib/repositories/<domain>.repository.ts` | `sumSlipsByPeriod` in `payroll.repository.ts` |
| Types | `lib/types/<domain>.ts` (+ `lib/types/index.ts`) | `lib/types/dashboard.ts` |
| Fixed tables / rules | `lib/constants/<topic>.ts` | `lib/constants/statutory-deadlines.ts` |
| Generic helpers | `lib/utils/<topic>.ts` | `lib/utils/nepal-time.ts` |
| Module UI | `components/<domain>/<domain>-<part>.tsx`, entry `<domain>-client.tsx` | `components/dashboard/dashboard-kpi-cards.tsx` |
| Shared UI kit | `components/kit/*`, frame in `components/frame/*` | `components/kit/panel.tsx` |
| Dev preview (sample data only) | `app/dev/<domain>/page.tsx` + `components/dev/<domain>-preview.tsx` | `/dev/dashboard` |
| Tests | `tests/<domain>.test.ts`, security in `tests/security-<topic>.test.ts` | `tests/dashboard.test.ts` |

Do not create new top-level folders under `lib/` or `components/` for a feature; add the file to its layer.

## Security rules (non-negotiable)

These come from Phase 0 (`docs/redesign/03-security-plan.md`). `tests/security-invariants.test.ts` enforces several of them.

- **Tenant DB:** always `await getDb()` / `await getDbAsync(slug?)` from `@/lib/db`. They resolve the tenant **per request** and throw `TenantContextError` when none. Never cache a tenant DB in module scope or on `globalThis`. Never fall back to the primary `db` export in request code (scripts only).
- **Authorization lives on the server.** Every page and server action calls `checkPermission` / `checkPermissionWithScope`. Use `requireAuthenticatedUser()` when there is no single module. Hiding UI is never access control.
- **No `'use server'` in `lib/` or `components/`.** Every export of such a file becomes a public endpoint. Server actions live only in `app/actions/`.
- **Session updates:** the browser can trigger NextAuth JWT updates with any payload. Anything that relaxes a restriction must use a server-signed grant (`signSessionGrant` in `lib/auth/session-updates.ts`). New auth helpers must call `assertSessionUsable()`, because actions can be POSTed from `/locked` and `/change-password`.
- **Never persist or return plaintext passwords.** A temporary password may appear once in the response that issued it; `users.temp_password` is always NULL.
- **Client IP:** use `getClientIp()` (`lib/auth/client-ip.ts`), never `x-forwarded-for.split(',')[0]`.
- **Raw SQL:** no `sql.raw()` with interpolated values; use Drizzle operators (`inArray`, `eq`) or `sql` template params.
- **HTML from user input** (emails, print views): escape with `escapeHtml()`; no `dangerouslySetInnerHTML`.
- **Secrets:** `AUTH_SECRET`, `PLATFORM_SESSION_SECRET` and `PLATFORM_SECRETS_KEY` are distinct (see `lib/security/secrets.ts`). Never read, print or commit `.env`.
- **Never your own pay record (S21):** approvals and corrections about the acting user's own employee record need someone else. Use `isOwnRecord` / `includesOwnRecord` (`lib/auth/self-action.ts`, on `ScopeFilter.employeeId`) and audit refusals as `DENIED_SELF`. A platform impersonation (`ScopeFilter.isImpersonation`) never counts as a company administrator.
- Add a `tests/security-*.test.ts` case for any new guard. Where practical, confirm it fails on the old code.

## Next.js 16 specifics

- Middleware is `proxy.ts`. It sets the per-request nonce CSP (`lib/security/csp.ts`). Never add a page CSP in `next.config.ts`: two policies would void the nonce. Every pass-through must go through `continueWith()` so request headers survive NextAuth. `instrumentation.ts` validates security config at server start.
- APIs differ from older Next.js. Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- `next.config.ts` has `typescript.ignoreBuildErrors: true` (cPanel memory), so `npm run type-check` is the real type gate.

## Redesign programme (in progress)

`docs/redesign/` is the source of truth. **Read `04-roadmap.md` and `CHANGELOG.md` before starting work.**

| File | Contents |
|---|---|
| `01-project-analysis.md` | Modules, routes, UI audit |
| `02-design-system.md` | Desktop-style frame, logo forest-green palette (`#1E7F12`), light chrome, templates A–F, shortcuts |
| `03-security-plan.md` | Findings S0–S12 + standing rules |
| `05-functional-research.md` | Payroll features F1–F17 |

Workflow:
- One branch per phase or module: `redesign/<phase>-<slug>` (features: `feature/<slug>`). Never mix with unrelated work.
- Run a verification gate after every step: type-check exit 0, tests pass, no new lint errors in touched files, build for shell/config changes. Then check screens at 1440 / 1024 / 390 px with a restricted (BRANCH/DEPARTMENT) role.
- After each completed step: tick the roadmap box and add a `CHANGELOG.md` entry (commits, verification, deployment notes).
- **Stop at phase boundaries and at the sign-off points** (after Phase 1, Phase 2 and module 4.1). The user adds requirements between phases.
- UI phases change no backend behaviour, except for items in the security plan.

UI conventions for new code:
- Use semantic tokens: `bg-brand`, `bg-surface`, `bg-canvas`, `text-ink` / `text-ink-muted` / `text-ink-faint`, `border-line`, `text-danger`, and so on. The full map is in `02-design-system.md` §3. No raw hex, no new `zinc-NNN`, no arbitrary `text-[Npx]` (use `text-2xs`/`xs`/`sm`). `tests/design-foundation.test.ts` enforces this outside the entry pages.
- Preview components at `/dev/kit` (dev only; 404 in production).
- App frame: `components/frame/`. Navigation lives in `lib/frame/navigation.ts`: add a section there, never in a component. Shortcuts live in `lib/frame/shortcuts.ts`, which also feeds the `?` overlay. New pages use `PageBar` + `CommandToolbar`.
- Lists use `DataGrid`, dialogs `Window`, confirmations `Confirm`, forms `PropertyForm` + `FieldRow`, money `Amount`, dates `DateCell`, statuses `StatusChip` (all in `components/kit/`, logic in `lib/kit/`). The table of when to use each is in design system §4.
- **Exports:** never hand-build CSV. Use `lib/export/csv.ts`; browser exports call `authorizeExportAction` first (EXPORT permission + audit). A test fails on `csv +=` style code.
- **Action errors (Phase 4+):** return `toActionError(err, "context")` (`lib/errors/action-error.ts`), and throw `UserFacingError` for messages meant for users.
- Money is right-aligned with tabular numerals and lakh grouping; dates are BS-first.

## Known debt

- `npm run lint` has ~225 **pre-existing** errors (mostly `no-explicit-any`), so CI lint fails on `main`. Don't add new ones; clean up as modules are migrated (Phases 4/8).
- `npm audit`: the nodemailer advisory via next-auth needs a major upgrade, so CI gates on `critical` for now.
- Employees: there is no bulk import yet (the old Import button only showed a message and was removed in 4.2). The old `components/ui` pickers (`NepaliDatePicker`, `BSDatePicker`, district / bank / shreni comboboxes, address picker, phone input) are still used by other modules; replace them with the kit `DateField` / `Combobox` as those modules are migrated.
- Migration `0035_grade_manual` adds `employees.grade_manual`; company databases get it from `ensureTenantSchema` when a pool opens (restart the dev server after pulling). The app reads the column, so the employee screens need it before they load.
- Organization (4.3): `departments.employee_count` / `designation_count` and `departments.branch_id` are no longer used (counts are live; departments use `branch_ids`); drop them in Phase 8. Employment-type eligibility (PF / SSF / festival / leave / OT) and the branch remote-area category are stored but not yet used by payroll (4.8).
- Salary structure (4.4): migration `0037_salary_revisions` adds revision columns to `employee_salary_map` (`status`, `batch_id`, `reason`, `approved_by`, `approved_at`, `grade_manual`) and the tables `salary_change_batches` and `salary_templates`; company databases get them from `ensureTenantSchema` (restart the dev server). Migration `0038_salary_approval_route` adds the approval flow to `salary_change_batches` (`approval_route`, `approval_type`, `approval_levels`, `current_level`) and the `approval_actions` timeline table (backfilled once). Approval rules live in `lib/engines/approval.engine.ts` (reuse it for pay runs and loans); the setting is `system_config` key `approvals.salaryRevision`. Back-dated revisions do not yet create **arrears** (4.8), so changes into approved / locked payroll months are refused. Import is CSV only (no `.xlsx` library). `loan.service` (`syncActiveLoansToSalaryMapping`) still writes the derived loan-deduction and net fields onto the current revision in place (no pay changes); revisit in 4.10. Leave salary still reads the current (`is_active`) revision, not the one in force for its period (4.9).
- Attendance (4.5a): migration `0039_attendance_foundation` adds `attendance_punches`, `attendance_adjustments`, `attendance_periods`, day-result and override columns on `attendance_records` (unique per employee-day; duplicates merged; days typed before 4.5 became HR overrides plus punches) and summary columns on `leave_ot_calculations` (restart the dev server). Day rules: `lib/engines/attendance-day.engine.ts`; months: `lib/engines/pay-period.engine.ts`. Payroll reads `attendanceForPayroll()`. Open debt: the payroll run's `payPeriodStartDate` is built with `toISOString()` from a local-midnight date (can be a day early; attendance uses the BS month itself); self-service "My attendance" still shows only closed months (4.5c); a holiday named "Women's Day" applies to women only until holidays get an "applies to" field (4.12).
- Shifts (4.5b): migration `0040_attendance_shifts` adds `shifts`, `shift_assignments`, `shift_roster`, `branches.default_shift_id`, `attendance_records.shift_id` (restart the dev server). The General shift is created from Company setup's work schedule on first read (`ensureDefaultShift`); afterwards Company setup → Work schedule is read-only and copied from the default shift. Shift rules: `lib/engines/shift.engine.ts`; which shift applies: `shiftService.shiftOn`. Debt: punch file import and devices are a later step; shift allowance is 4.12.
- Web clock-in (4.5c): migration `0041_web_checkin` adds branch check-in columns (`checkin_rule` default off, `checkin_networks`, `latitude`, `longitude`, `checkin_radius_m`), remote place columns on `attendance_adjustments`, and `attendance_checkin_exceptions` (restart the dev server). Rules: `lib/engines/checkin.engine.ts`; clocking: `lib/services/checkin.service.ts` (employee from the session only). The office-network rule can't be tried on localhost (no proxy IP: `getClientIp` returns "unknown"); location works on localhost and HTTPS only.
- Leaves (4.6a): migration `0042_leave_ledger` adds `leave_ledger` (append-only; never update or delete), leave type behaviour columns (`kind`, `day_basis`, `paid_days_per_event`, `max_days_per_request`, `allow_half_day`, `is_right`, `accrual_every_days`, `expiry_days`), request columns on `leave_applications` (half, days detail, paid / unpaid days, source, prepared by, approval route, cancel reason, certificate note, SSF claim), adds Substitute and Unpaid leave, deactivates PUBLIC (holidays are the Holiday calendar) and turns home / sick balances and approved leave into ledger lines (restart the dev server). Rules: `lib/engines/leave.engine.ts`; requests and approvals: `lib/services/leave.service.ts` (the server counts days). `employee_leave_balances` is now a summary the ledger keeps for older readers (reports, dashboard); write balances only through `postLedgerLines`. It also drops the Nepali in brackets from statutory type names (English-only screens; the policy sync strips it too).
- Leave entitlements (4.6b): migration `0043_leave_entitlements` adds `leave_ledger.ref` (what a line is for: `accrual:<cal>-<y>-<m>`, `substitute:<date>`, `opening:<year>`, `expiry:<grant>`, `credit:<year>`; check it before posting so nothing is posted twice) and `leave_year_openings` (one per fiscal year; years with ledger lines when the table is created count as opened) (restart the dev server). Opening a year, substitute grants and the leave calendar: `lib/services/leave-entitlement.service.ts`. Home leave is posted by the attendance month close / reopen inside their transaction (`monthCloseLines` / `monthReopenLines`). Use `balanceOn(lines, date)` for a balance in force (substitute grants expire), not the plain ledger sum. A year that has been carried over is closed for balance-type leave; lines for its dates go to the next year (`postingYear`). Home leave is earned month by month; a year the old system gave up front is switched once per person (`home-earned:<year>` ref, `lib/services/home-leave.service.ts`, which also builds the month-by-month view). Starting balances (`start:<year>` ref) and the month leave is kept from (`system_config` key `leave_start`, fixed once) are there too: months before the start post no home leave on close or reopen. The old system's opening lines are the ones with no ref.
- Leave policies (4.6c): migration `0044_leave_policy` adds `leave_type_changes` (every change to a leave type's settings as a version: before / after, reason, `applies`, `effective_from`, status, approval columns, `applied_at`; one pending per type), `leave_policy_exceptions` (platform exceptions, read-only in the company: only platform routes write it) and the 4.6e leave type columns (`notice_days`, `eligible_after_days`, `credit_mode`, `max_days_per_year`, `max_days_in_service`, `payout_fixed_amount`) (restart the dev server). Statutory types change only through `lib/services/leave-policy.service.ts` (rules: `lib/engines/leave-policy.engine.ts`); read leave types for the rules through `ruleTypes()` (`lib/services/leave-rule-types.service.ts`), never `repo.findRuleTypes()` in services: it applies due changes and raises anything below the Labour Act first. The Labour Act's minimum is `STATUTORY_FLOOR` in `lib/engines/leave.engine.ts`; when the law changes, change it there (companies are raised to it on the next read). The platform policy pack's numbers only seed new companies (`lawfulPreset`); the sync never changes a company's numbers.
- Leave exceptions (4.6d): the platform tables `company_leave_exceptions` and `company_change_requests.kind` (`company_details` | `leave_exception`) are created by `ensurePlatformTablesExist` (restart the dev server). Everything about exceptions is in `lib/platform/leave-exceptions.ts`: the company's request, grant / reject / revoke (super admin, platform audit) and `pushToCompany`, the only writer of the company's `leave_policy_exceptions` (also run by the policy sync). Company-details code must filter `kind = 'company_details'`. The company side is in `leave-policy.service.ts` (`requestException`, company from the session).
- Company leave types (4.6e): saved only through `lib/services/leave-type.service.ts` → `saveCompanyType` in `lib/repositories/leave-policy.repository.ts` (one transaction: the type, a `leave_type_changes` row with source company, and any "also this year" ledger lines, ref `policy:<change>`). The form is cleaned and checked by `lib/engines/leave-type.engine.ts` (`normalizeLeaveTypeForm`, `validateLeaveTypeForm`); notice, eligibility after N days and yearly / whole-service limits are checked in `checkRequest` (company types only). Types given month by month (`credit_mode = 'monthly'`) are credited in `monthCloseLines` with the month's `accrual:` ref (kind `credit`), so anything reading `accrual:` lines must filter by leave type and exact ref. Leave rules are retired: no screen, nothing writes `leave_rules`; leave salary reads the payout rate from the leave type and falls back to `leave_rules` only for old types without one (the table is dropped in Phase 8).
- Employee documents and photo (4.2b): migration `0045_employee_documents` adds `employee_documents` (one row per type per employee: number, issuing district, issuing office, issued date), `employee_document_files` (one scan per document, front and back in one file, `side` always `scan`, as `bytea` in the company database; `document_id` null = uploaded in a form not saved yet, deleted after a day) and `employee_photos` (512 × 512 JPG; `employee_id` null = not saved yet), copying the old `employee_personal` document columns once (restart the dev server). Those columns stay as a **mirror** written on every save (`legacyDocumentColumns`; citizenship `''` when only an NID) for older readers such as self-service, and are dropped in Phase 8. Rules: `lib/engines/employee-document.engine.ts`; uploads and opening: `app/api/employees/documents/files/*` → `employee-document.service.ts` (route handlers do their own same-origin, size and permission checks: `proxy.ts` skips `/api`); scans and the photo are saved with the employee in `saveDocumentsTx` / `savePhotoTx` (inside the employee transaction); photos are served by `app/api/employees/photos/[id]` (scope, or the signed-in employee's own). Never select `employee_document_files.content` / `employee_photos.content` outside `findFileContent` / `findPhotoContent` (a test checks).
- Salary breakdown (4.4b):
  - **Pay previews:** always call `estimatePay` (`lib/engines/salary-structure.engine.ts`), which runs payroll's own `calculatePayslip` with the heads from `payrollHeadsFor`. Never re-implement pay maths in a screen.
  - **`StructureTotals`** is payslip-style: total salary → + SSF employer 20% = gross earnings → − (SSF 31% / PF + other deductions + income tax) = net payable; cost to company. The wording is in `components/salary-mapping/salary-breakdown.tsx` (02 → Salary breakdown).
  - **New hires:**
    - the employee form saves only basic + grade (a `hire` batch);
    - a current hire revision with no pay heads is status `setup` (`needsSetup`; repository `employeesNeedingSetup` for Records to fix);
    - it is completed with a `setup` batch (approval applies; may be unchanged).
  - **Payroll bug (4.8):** payroll loads tax slabs of every fiscal year (`findAllSlabs()` in `payroll.service.ts`), while the estimate uses the active year's.
- HR letters (G2, letters part): migration `0047_hr_letters` adds `letter_templates` (six system templates seeded per company on first read — editable, never deletable), `letter_sequences` (chalani: one row per fiscal year, bumped transactionally; numbers never reused) and `hr_letters` (subject/body rendered and **frozen at issue**; void with a reason, never edit or delete), plus the `HR_LETTERS` permission module (enum value + permission rows seeded in `ensureTenantSchema` with md5 ids; restart the dev server). Templates are plain text with `{{merge_field}}` placeholders and `{{#if field}}…{{/if}}` optional clauses (`lib/engines/letter.engine.ts`). S26: nobody issues or voids a letter about their own record (`isOwnRecord`, audited `DENIED_SELF`). The rest of G2 (lifecycle events: promotion / transfer / confirmation as dated records that feed these letters) is still open — see `docs/redesign/06-hrms-gap-analysis.md`.
- Lifecycle events (G2, events part): migration `0048_employee_events` adds `employee_events` (promotion / transfer / confirmation with before/after snapshots; mirrored in `ensureTenantSchema`; restart the dev server). A due event applies to the employee row in the same transaction; scheduled ones are applied on read (`applyDueEvents`, claim-first). RBAC under EMPLOYEES; S27: nobody records or cancels an event about their own record. The event window can issue the matching letter (needs HR_LETTERS ADD). Debt: the employee form still edits designation/branch in place (retire in Phase 8); the employee record's history tab doesn't read `employee_events` yet; separation events come with G5.
- Performance evaluation (G1): migration `0049_performance_evaluation` adds `evaluation_templates` (default का.स.मू. form seeded per company), `evaluation_cycles`, `evaluations` (form + raters **frozen per evaluation at start**), `evaluation_scores`, plus the `PERFORMANCE` permission module (seeded in `ensureTenantSchema`; restart the dev server). Rules in `lib/engines/evaluation.engine.ts` (weights sum 100; stage % → weighted total → band). S28: the subject's user never rates and nobody acts on their own evaluation; only the assigned rater marks a stage (APPROVE may act for an absent rater, audited `actedForRater`); finalize is claim-first. Debt: promotion scoring composite (का.स.मू. marks + seniority feeding G2 promotion) and probation gating are follow-ups; self-rating comes with ESS (Phase 5).
- Stored payroll run totals (`payroll_runs.total_*`) can lag behind the payslips (Shrawan 2083: run net 62,068.75 vs payslips and salary sheet 68,068.75). Reports and the dashboard read the payslips; fix the run-total update in 4.8 (Payroll run).

## Deployment

- Live on Yeti Cloud (Jelastic): PM2 runs `app.js` (port 8080 bridge) in front of the Next.js standalone server; one PostgreSQL platform database plus one database per company.
- The guide, checklist, server runbook, rollback and release log are in `docs/deployment/yeti-cloud.md`. Read it before any deploy, and add a release-log line after each one.
- Database changes reach the server only through `scripts/sync-schema.ts` (platform tables + `ensureTenantSchema` per company), so every migration must be mirrored in `lib/db/tenant-schema-sync.ts`, and platform tables in `ensurePlatformTablesExist`.
- The server follows `main`: a deploy fast-forwards `main` to the signed-off tip, tags `deploy-YYYY-MM-DD` and pushes (only when the user asks).

## Git

- Commit only when asked or when completing an agreed roadmap step. Prefer new commits over amending. Do not push or merge without being asked.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
