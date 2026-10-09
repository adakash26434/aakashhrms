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

## 2026-10-09 — G9: welfare / medical / gratuity funds — ledger, monthly contributions, payouts
Branch: `feature/welfare-funds` (stacked on `feature/exit-workflow`) — first Phase G **Tier B** item.

Changed:
- **Schema (migration `0054_welfare_funds`, mirrored in `tenant-schema-sync.ts`):** `fund_types` (contribution rule: fixed per month or percent of basic, employee + employer shares; a fund's **code never changes** — refs embed it) and `fund_ledger` — **append-only like `leave_ledger`**: never update or delete a line, mistakes are corrected by adjustment lines, and `ref` is unique per employee + fund (`contrib:<fund>:<bsYear>-<bsMonth>`, `opening:…`, `payout:…`, `adjust:…`) so nothing posts twice. New `WELFARE_FUNDS` permission module (System Administrator all; HR Manager and **Payroll Controller** VIEW/ADD/EDIT; Roles matrix now 30).
- **Engine (`fund.engine.ts`, 8 suites):** all arithmetic in **paisa** (the kit's no-float-drift discipline); fixed and percent-of-basic contributions (half-up to the paisa; zero basic contributes nothing); balances; posting rules — openings non-negative, **payouts entered positive, capped per share, stored negative** (a fund never goes below zero on either side), adjustments need a note and can't cross zero either.
- **Automation:** a fifth job, `fund-contributions` (BS day 1), posts the previous BS month's contributions for every active fund × active employee through the same claim-first, idempotent job machinery (G6). No browser action can run it.
- **Service / actions / UI (`/payroll/funds`, template A):** Balances tab (per member per fund, share columns with footer totals, row-open → the member's ledger lines), Funds tab (rule, members, **provision total** per fund for the auditor), posting window (payout भुक्तानी / opening / adjustment), fund editor. **S33**: nobody posts to their own fund (audited `DENIED_SELF`); employee scope on every read. Navigation: Payroll → Welfare funds.

Verified: `tsc` exit 0 · 944/944 tests (16 new: `fund.engine`, `security-funds`; role matrix count now 30) · lint clean on touched files.
Notes: payout-at-exit lands on the exit case's facts next (G5 hook); gratuity provision for non-SSF staff per the bylaws is a rule the fixed/percent modes already express; payroll-slip visibility of fund deductions joins 4.8.

## 2026-10-09 — G4: recruitment & दरबन्दी — approved positions, vacancies, merit list
Branch: `feature/exit-workflow` (stacked) — **completes Phase G Tier A** (G1 · G2 · G3 · G4 · G5 · G6 all built this cycle).

Changed:
- **Schema (migration `0053_recruitment`, mirrored in `tenant-schema-sync.ts`):** `approved_positions` (**दरबन्दी**: the board/AGM-approved post count per designation × branch, decision ref, one row per pair — saving the pair again updates it), `vacancies` (openings, deadline, open → closed / cancelled) and `applicants` (contact, education note, stage, exam / interview marks, link to the employee once hired). New `RECRUITMENT` permission module (seeded md5-id rows; System Administrator all, HR Manager VIEW/ADD/EDIT/DELETE; "HR" preset; Roles matrix — now 29 modules on the screen).
- **Engine (`recruitment.engine.ts`, 8 suites):** stage pipeline (forward freely, one step back as a correction, rejected from anywhere but hired, re-considered → back to applied; **hired never moves** — the employee record is the truth from there), **occupancy** (vacant never negative; over-darbandi shown in red), form rules, marks 0–100 in halves, **merit order** = exam + interview descending with exam breaking ties, computed never stored; incomplete and rejected sit outside the ranking.
- **Service / actions:** branch-scoped users see their branches' दरबन्दी and vacancies only; applicants join open vacancies only; stage moves validated server-side; **applicant personal data stays inside the module** (S32 suite checks no cross-module copies).
- **UI (`/workforce/recruitment`, template A):** दरबन्दी tab (live filled / vacant / over per post, over-filled rows red), Vacancies tab (applicant and selected counts, close with confirm), applicant window — merit table with inline exam / अन्तर्वार्ता marks (save on blur) and a stage dropdown, add-applicant inline form. Navigation: Workforce → Recruitment.

Verified: `tsc` exit 0 · 928/928 tests (15 new: `recruitment.engine`, `security-recruitment`; role matrix count now 29) · lint clean on touched files.
Notes: hiring stays with the employee form (a selected applicant is marked hired and linked by hand); wiring दरबन्दी enforcement into hiring / promotion / transfer, the manpower-request approval in front of a vacancy, and a public job-board intake are follow-ups the schema already supports.

## 2026-10-09 — G5: exit workflow — clearance by unit, completion, experience letter
Branch: `feature/exit-workflow` (stacked on `feature/performance-evaluation`)

The exit half of the gap analysis's lifecycle: a resignation stops being a free-text row and becomes a case with a checklist.

Changed:
- **Schema (migration `0052_exit_workflow`, mirrored in `tenant-schema-sync.ts`):** `exit_cases` (kind — राजीनामा / अवकाश / करार समाप्त / termination / death — notice date, last working day BS+AD, status open → closed, or cancelled with a reason) and `exit_clearances` (one row per unit — Accounts · IT/Admin · Branch · HR — seeded when the case opens).
- **Engine (`exit.engine.ts`, 8 suites):** form rules (active employee, one open case, notice ≤ last working day, ≤ a year ahead), clearance progress, **completion blockers** (every unit cleared + the day arrived — an employee is never switched off while still serving or still owing), blocked-needs-a-note, the `employee_termination` mirror row.
- **Service / actions (EMPLOYEES RBAC):** Complete is the only step that touches the employee record — **one claim-first transaction**: case closed, employee → Inactive, termination mirror written (older readers and 4.8's settlement keep working). The case window shows **facts before clearing**: active staff loans with the outstanding sum, and the employee's device PINs (G3) to unmap. Experience letter (कार्य अनुभव पत्र) issued on Complete — rendered **before** the employee goes Inactive — gated by HR_LETTERS ADD; the exit stands with a warning if the letter fails. **S31**: nobody opens, clears, completes or cancels their own exit case (audited `DENIED_SELF`).
- **UI (`/workforce/exit`, template A + C):** register (clearance progress chips, blocked rows tinted), New exit window, case window with the per-unit checklist (Clear / Block with note), blockers list, letter option (नेपाली default) and cancel-with-reason. Navigation: Workforce → Exit.

Verified: `tsc` exit 0 · 913/913 tests (17 new: `exit.engine`, `security-exit`; the workforce navigation expectation now includes Exit) · lint clean on touched files.
Notes: F8 (settlement maths: pro-rata salary, leave encashment, gratuity, loan close-out) remains payroll Tier 2 and reads the mirror this writes; the self-service resignation request arrives with Phase 5; a separation event kind on `employee_events` can follow once modules read events everywhere.

## 2026-10-09 — G3: attendance devices — ZKTeco ADMS push, PIN mapping, punch import
Branch: `feature/performance-evaluation` (stacked)

The 4.5 "Devices later" step, specified in the gap analysis: terminals push punches themselves; the day engine and HR review stay the only things that decide attendance.

Changed:
- **Schema (migration `0051_attendance_devices`, mirrored in `tenant-schema-sync.ts`):** `attendance_devices` (name, branch, **serial number as the trust anchor**, enabled, device tz offset — ATTLOG carries the device's local clock — last seen / last punch), `device_users` (PIN ↔ employee per device) and `device_unmatched_punches` (unknown PINs wait here). Matched punches land in **`attendance_punches` (source `device`)** — already unique on (employee, instant, source), so resends are free idempotency.
- **Engine (`device.engine.ts`, 6 suites):** iclock handshake block (TimeZone 5.75, Realtime), ATTLOG parsing (malformed lines counted, never fatal; reset clocks refused), device-local → instant conversion, batch de-duplication, serial validation, health grading (online ≤15 min · quiet ≤24 h · silent · never).
- **Endpoints:** `app/iclock/cdata` (GET handshake, POST ATTLOG with declared-and-actual body caps) and `app/iclock/getrequest` (command poll) — the paths ZKTeco firmware actually calls, so `proxy.ts` now skips `/iclock` like `/api` and the handlers own their checks: **registered + enabled serial or a bare 404**, no sessions anywhere near them. Multi-tenant: the serial finds its company across ACTIVE tenants (cached ~10 min, **re-verified inside the tenant on every request**, stale entries re-resolve once).
- **UI (`/timeAndLeave/devices`, ATTENDANCE module):** device register with health chips, Add/Edit window (with the terminal-side setup line), **PIN mapping window** (mapping claims waiting punches in one transaction), unknown-PIN list with "Map PIN", and **paste-import** of USB-export (.dat) lines through the same pipeline as a push. Navigation: Time & Leave → Devices.

Verified: `tsc` exit 0 · 896/896 tests (17 new: `device.engine`, `security-devices`) · lint clean on touched files. `proxy.ts` changed (matcher), so the next deploy's build + a signed-in pass matter (the gate's shell-change rule).
Notes: auto shift by first punch stays with 4.5's roadmap line (the day engine already reads these punches); per-device comm-key auth can be added when a customer's fleet supports it; device user sync (pushing names to terminals) would use the getrequest command queue — not needed for punches.

## 2026-10-09 — G6: automation & reminders — jobs tick, compliance/probation/birthday emails
Branch: `feature/performance-evaluation` (stacked)

The infrastructure half of the gap analysis's automation ask: no daemon (cPanel/Passenger), just cron hitting a secret-gated endpoint; everything else is jobs.

Changed:
- **Schema (migration `0050_scheduled_jobs`, mirrored in `tenant-schema-sync.ts`):** `scheduled_jobs` (per-job state; `last_run_day` is the once-per-Nepal-day claim) and `job_runs` (log).
- **Engine (`scheduler.engine.ts`, 8 tests):** cadences (daily · BS-month days · weekday), due rules (once per day, disabled never runs, missed days skip — reminders repeat on the next due day), and pure reminder builders: SSF deposit (BS 10 → due by the 15th) and IRD eTDS (BS 20 → due by the 25th) wording, probation-due list (active, not Permanent, unconfirmed, ≥183 days served), birthdays (Feb 29 → Feb 28 on non-leap years).
- **Four jobs:** apply scheduled lifecycle events (so G2 events apply even when nobody opens the register) · compliance reminders · weekly confirmations-due digest (points at Lifecycle events) · birthdays today. Emails go to active system/office admin, HR manager and payroll controller accounts through a new `sendNoticeEmail` (every line HTML-escaped; **names and dates only, never pay figures**).
- **Tick:** `app/api/jobs/tick` (GET/POST) — constant-time bearer check against `JOBS_TICK_SECRET` (≥24 chars; bare 404 otherwise), then every due job for every ACTIVE company, each tenant inside `runWithTenantContext` and its own try/catch; the JSON response is counts only. Claim-first per job, so overlapping ticks never double-run (S29 suite).
- **UI:** `/admin/jobs` under SYSTEM_CONTROL — job status with on/off (EDIT), recent runs, and a warning when the secret is missing. Navigation: Administration → Scheduled jobs.

Verified: `tsc` exit 0 · 879/879 tests (16 new: `scheduler`, `security-jobs`) · lint clean on touched files.
Deployment notes:
1. Set `JOBS_TICK_SECRET` (≥24 random chars) in the server environment.
2. Add the cron entry (cPanel → Cron Jobs), e.g. every 30 minutes:
   `*/30 * * * * curl -fsS -H "Authorization: Bearer $JOBS_TICK_SECRET" https://<host>/api/jobs/tick >/dev/null`
3. SMTP (`SMTP_HOST/USER/PASS`) must be set for the reminder emails; without it, jobs still run and log, and the email step prints a console preview.
Notes: F10's compliance calendar card on Home and F17's notification centre read the same job outputs later; device-silent alerts join when G3 lands; contract-expiry reminders need an end-date field on employees (future).

## 2026-10-09 — G1: performance evaluation (का.स.मू.) — cycles, stage marks, grades
Branch: `feature/performance-evaluation` (stacked on `feature/hr-letters`)

The sahakari core from the gap analysis (06): marks-based evaluation whose output is usable in promotion scoring and probation confirmation.

Changed:
- **Schema (migration `0049_performance_evaluation`, mirrored in `tenant-schema-sync.ts`):** `evaluation_templates` (the company form: sections → criteria with max marks, stage weights, grade bands — a का.स.मू.-style default seeded per company: 10 criteria / 100 raw marks, supervisor 50% / reviewer 30% / committee 20%, उत्कृष्ट … सुधार आवश्यक bands), `evaluation_cycles` (per fiscal-year period, open → closed), `evaluations` (**the form frozen per evaluation at start** — template edits never touch in-flight evaluations; raters fixed at start, supervisor stage defaulting to each employee's own supervisor's account), `evaluation_scores` (one row per criterion per stage). New `PERFORMANCE` permission module (seeded md5-id rows; System Administrator all, HR Manager VIEW/ADD/EDIT/APPROVE/LOCK; "HR" preset; Roles matrix).
- **Engine (`evaluation.engine.ts`, 8 suites):** form validation (weights sum 100, 1–100 maxima, duplicate ids, a 0-floor band), stage order from weights (a 0-weight stage is skipped), marks validation (whole/half marks, 0..max, all criteria), stage % = marks ÷ max × 100, weighted total + band, **S28 rater rules** — every active stage its own rater, never the subject's user, no double stages.
- **Service / repository / actions:** scope-checked throughout; starting skips (and lists) employees whose raters can't be worked out; **rating**: only the stage's assigned rater, or APPROVE acting for an absent rater (**audited `actedForRater`**); the last stage computes totals and finalizes in a claim-first transaction (stale windows change nothing); a final evaluation and a closed cycle take no more marks; own-record refusals audited `DENIED_SELF` on start and rate.
- **UI (`/workforce/evaluation`, template A):** register with **"Waiting for me"** (count on the page bar, filter, tinted rows), scoring window (earlier stages read-only with %, the current stage's marks column live, warning banner when acting for an absent rater), Cycles tab (open with fiscal year + period, close with typed CLOSE), Form tab (weights / sections / criteria / bands editor — saving warns that started evaluations keep their frozen form), **printable bilingual का.स.मू. form** (letterhead, criteria × stages, weighted total, grade, three signature blocks). Navigation: Workforce → Performance.

Verified: `tsc` exit 0 · 863/863 tests (19 new: `evaluation`, `security-evaluation`; role matrix count now 28) · lint clean on touched files.
Notes: promotion scoring (seniority + education + का.स.मू. marks composite feeding a G2 promotion event) and probation-confirmation gating are the follow-up; self-rating arrives with ESS (Phase 5); KPI/goal-row criteria are a template extension the schema already allows.

## 2026-10-09 — G2 (events): employee lifecycle events — बढुवा, सरुवा, स्थायी नियुक्ति
Branch: `feature/hr-letters` (stacked on the letters commit)

The other half of G2: promotions, transfers and confirmations stop being silent in-place edits and become **dated records with before/after snapshots** that drive the employee row and the matching letter.

Changed:
- **Schema (migration `0048_employee_events`, mirrored in `tenant-schema-sync.ts`):** `employee_events` — kind (promotion | transfer | confirmation), effective date BS+AD, `from_values` / `to_values` (ids and display names), status (`applied` | `scheduled` | `cancelled`), optional link to the HR letter issued for it. An event due today or earlier **applies to the employee row in the same transaction**; a future-dated one is scheduled and applied on read once due (claim-first update, so two readers never apply twice); a scheduled event is cancelled with a reason, an applied one is corrected by a new event — history is never rewritten, nothing is deleted.
- **Engine (`employee-event.engine.ts`, 15 tests):** kind rules (promotion needs a different designation; a transfer changes branch, department or both; confirmation refused for already-permanent or inactive staff), back-dating allowed, scheduling up to one year, snapshot/patch builders, letter-input mapping, register text.
- **Service / actions:** RBAC under **EMPLOYEES** (VIEW list, EDIT record/cancel; no new module); scope-checked subject lookup; **S27** (S21 pattern): nobody records or cancels an event about their own record (audited `DENIED_SELF`); confirmation sets `confirmation_date` and category → Permanent; promotion changes the designation only (pay goes through Salary structure as its own revision); **letter ride-along** — tick "Issue letter" and the matching template (बढुवा पत्र, सरुवा पत्र, स्थायी नियुक्ति पत्र) is issued at once in the chosen language with the event's own values filled in ({{previous_designation}} → {{new_designation}}, effective date BS, reason as remarks), gated by HR_LETTERS ADD; if the letter fails the event still stands with a warning.
- **UI (`/workforce/lifecycle`, template A):** register (DataGrid: effective date, employee, event, change "from → to", status, letter link; scheduled rows tinted, cancelled rows red), FilterStrip, detail window with Cancel-with-reason for scheduled events, New event window with kind-specific fields and the letter option (नेपाली default). Navigation: Workforce → Lifecycle events.

Verified: `tsc` exit 0 · 844/844 tests (25 new: `employee-event`, `security-lifecycle`; the navigation visibility expectation now includes the lifecycle section) · lint clean on touched files.
Notes: the employee form still edits designation/branch in place — Phase 8 retires that once modules read events everywhere; the employee record page's history tab should read these events (small follow-up); separation events arrive with G5 (exit workflow).

## 2026-10-09 — G2 (letters): HR letters module — appointment, confirmation, promotion, transfer, experience, NOC
Branch: `feature/hr-letters` (from `main` @ `73e27a6`, after `docs/redesign/06-hrms-gap-analysis.md`)

First Phase G item from the gap analysis (06): formal letters issued to employees, bilingual with a designed printable sheet and a per-fiscal-year chalani register.

Changed:
- **Schema (migration `0047_hr_letters`, mirrored in `tenant-schema-sync.ts`):** `letter_templates` (bilingual bodies with `{{merge_field}}` placeholders; six system templates seeded per company on first read, editable, never deletable), `letter_sequences` (chalani: one row per fiscal year, bumped with a single `UPDATE … RETURNING` in the issue transaction, so numbers are unique and never reused), `hr_letters` (rendered subject and body **frozen at issue**; wrong letters are voided with a reason, never edited or deleted). New `HR_LETTERS` permission module (enum value + rows seeded with PG10-safe md5 ids; granted to System Administrator and HR Manager; in the "HR" role preset; in the Roles screen matrix).
- **Engine (`letter.engine.ts`, 27 tests):** placeholder extraction and rendering; **condition blocks `{{#if field}}…{{/if}}`** so a clause (probation sentence, remarks) appears only when its field is filled — fields inside a skipped block are not required; unknown-field and unbalanced-block errors at template save; chalani formatting (`12/2082-83`); issue/void validation. Auto-filled fields (employee, company, chalani, dates) can never be overridden from the form.
- **Service / repository / actions:** issue renders employee facts (name, code, designation, department, branch, joining date BS+AD), company letterhead (name, address, PAN, signatory) and typed inputs; scope-checked employee lookup; **S26** (S21 pattern): nobody issues or voids a letter about their own record (audited `DENIED_SELF`); all exports through the audited grid export (`HR_LETTERS` added to exportable modules).
- **UI (`/workforce/letters`, template A):** register (DataGrid, FilterStrip, saved views) + Templates tab (editor with merge-field reference and condition hint; custom templates can be added; system codes locked); Issue window (employee combobox, template, English/नेपाली, only the fields that template uses, server-rendered preview); letter page with the **designed A4 sheet** — brand green→red rule, company letterhead, च.नं./Ref and मिति/Date row, recipient block for addressed letters, underlined विषय/subject, signature and received-by blocks, VOIDED watermark — printing like the salary revision letter. Navigation: Workforce → HR letters.
- Default templates (`lib/constants/letter-templates.ts`): नियुक्ति, स्थायी नियुक्ति, बढुवा, सरुवा, कार्य अनुभव, सहमति — each English + Nepali in common sahakari office wording.

Verified: `tsc` exit 0 · 819/819 tests (40 new: `letter.engine`, `security-letters`; role matrix count updated to 27) · lint clean on touched files (pre-existing `seed-rbac` errors untouched). The production build could not run where this was built (the sandbox blocks the Google Fonts fetch `next/font` makes; it failed on that, not on code) — CI's build is the check for this entry.
Notes: screens not yet walked at 1440/1024/390 with a restricted role (needs a signed-in browser pass); letters list caps at the latest 1000 — paging if a register outgrows it; employee-facing copies in self-service are Phase 5; lifecycle events (promotion/transfer as dated records feeding these letters) are the rest of G2.

## 2026-10-07 — 4.4b Salary structure: clear breakdown, new hires set up in Salary structure
Branch: `redesign/4.4b-salary-structure` (from `main` = v0.2.0)

**Your decisions:**
- The employee form stays as it is (basic + grade).
- The full salary is set up in Salary structure, one by one or in bulk, as a salary sheet.
- SSF is shown payslip-style (+20% in earnings, −31% deducted).
- An income tax estimate gives Net payable.
- Setting up a new hire follows the approval settings.
- Research (Zoho Payroll, greytHR, Keka, NepalHRM, SSF guides): components → templates → per-employee dated salary (single or bulk, with approval) → a salary register of earnings, deductions and net.

**Changed:**
- **Engine** (`salary-structure.engine.ts`):
  - `estimatePay` calls payroll's `calculatePayslip`, so the preview and payroll can't drift;
  - `payrollHeadsFor` builds the heads payroll uses (TDS always, both SSF heads with SSF);
  - `structureTotals` gives the payslip-style breakdown without tax;
  - `needsSetup`, `setupLines`, `setupEffectiveFrom`, `templatesFor`, `headAppliesTo`.
- **`StructureTotals`** now has basic, grade, allowances, total salary, employer in earnings, gross earnings, retirement deduction, other deductions, income tax, total deductions, net payable, cost to company and named items; `gross` / `employerCost` are gone.
- **Service:**
  - the totals are estimated with each employee's tax profile and the active fiscal year's slabs;
  - row status `setup` and `ssfExpected` (company has SSF + employment type eligible);
  - batch kind `setup` (only for those rows; may be unchanged);
  - `employeesNeedingSetup()` in the repository feeds Records to fix ("Salary structure not set up", Fix → Salary structure).
- **Screens:**
  - new `SalaryBreakdown` component;
  - register as a salary sheet, with the set-up banner;
  - detail pane: Total salary / Net payable (est.) / Cost to company, plus the breakdown;
  - Revise / Set-up window: template picker, set-up defaults, the live breakdown;
  - Bulk edit: "Set up in bulk" mode, and Total salary / Total deductions / Net payable (est.) columns;
  - Approvals: Total salary / Net payable / Cost to company; "Salary structure set up" kind;
  - the letter shows the breakdown (previous / revised);
  - the record's Pay card says "Basic + grade" and points to Salary structure.
- **Pay heads limited to departments / designations** are offered only there.
- **Employee form:**
  - the "Re-enter account no." field is removed (your decision: only a hassle); the account number is typed once;
  - with "Create a login" set to No, its hint now says no login is made (it used to keep saying a password is emailed).
- **No migration.**

**Verified:**
- tsc 0, 773/773 tests:
  - `estimatePay` equal to a pay run for SSF, PF, none, married, contract and trainee;
  - the breakdown adds up;
  - a problem message when deductions exceed earnings;
  - set-up rules;
  - two older tests now read files with LF line endings (git on Windows had checked them out as CRLF).
- eslint clean on the touched files (`employee.repository.ts` has its 5 older errors, unchanged).
- `npm run build` OK.
- **Browser (Goodlife finance, read-only):**
  - the register's salary-sheet columns and totals;
  - Sumina's breakdown (total salary 45,166.67, SSF employer 7,233.33, gross earnings 52,400, SSF 31% 11,211.66, tax 0, net payable 41,188.34), the same layout as her Shrawan payslip (gross with the 20%, SSF 31%, TDS 0);
  - the Revise window's live breakdown;
  - the Approvals detail (Kushal's CIT change: net payable −1,500);
  - the letter.
  - Console 0 errors.

- **TEST ONLY run (your OK), on Goodlife finance:**
  - Two TEST ONLY hires were added through the employee form; the Bank tab had no re-enter field.
  - **Register:** each showed "Basic + grade only", the banner and "N to set up". The record showed "Salary structure not set up" under Records to fix.
  - **Set up one by one:**
    - the window opened with the joining date, reason "Salary structure set up" and SSF chosen (company has SSF, Permanent eligible);
    - adding a 3,000 allowance updated the breakdown as typed (total salary 35,000, gross earnings 41,400, SSF 31% 9,920, net payable 31,480);
    - Submit for approval → "Change waiting";
    - Approvals showed +3,000 total salary, −200 net payable (SSF 11% replaces the 1% tax of 320) and +9,400 cost to company;
    - after Final approve: "Current", banner gone.
  - **Set up in bulk:** only the new hire, SSF filled, date = joining date; review "Scheme None → SSF"; Save and approve → "Current".
  - **Clean-up:** both employees, their 6 batches, 12 approval steps and the one test login were then removed (`scratch/cleanup-test-only.ts`, a dry run first). Audit entries are kept.
- **Fixed on the way:** after a Bulk edit save, Next.js reloaded the whole page, so the "Saved …" message never showed. This happened in 4.4 too. The cause was changing the address and refreshing while the save's own page update was being applied. The tab now changes at once and the address just after; the save already sends the fresh page. Checked: no reload, and the message shows.

**Add new / Bulk add buttons (your request):**
- **Toolbar:** Add new (primary, Ctrl+N) · Bulk add · Revise salary (F2) · Bulk edit. Add new / Bulk add are for employees with no structure or only basic + grade; Revise salary / Bulk edit for those with one. Revise salary no longer turns into "Set up" / "New structure"; for someone without a structure it is disabled with "use Add new".
- **Add new** opens a picker of the employees needing a structure (new `salary-structure-add-window.tsx`), then the Add salary structure window.
- **Bulk add** opens the bulk table with all of them pre-filled (template, SSF); rows can be removed or added (only those needing a structure).
- **Employees with no structure at all** (e.g. saved with basic 0) are now covered too: the server accepts a `setup` batch for them (`needsStructure` in the engine; a full structure is still refused, "already has a salary structure").
- The banner and the detail pane use the same names (Add new, Bulk add, Add salary structure).
- **Fixed:** the toolbar read the selected row as it was when clicked, so after a save Revise salary could stay disabled; the selection is now kept by id and read from the fresh data.
- **Checked (TEST ONLY, your earlier OK):** two copies of an employee with no structure (`scratch/make-test-only.ts`). Add new → picker → window (SSF chosen, live breakdown: total salary 34,000, net payable 30,480) → Save and approve → Current. Bulk add → only the other one → basic 25,000 → review "1 salary structure to add" → Submit for approval (no page reload) → Final approve → Current. Add new / Bulk add then disabled. Console 0 errors. Both removed afterwards (2 employees, 2 batches, 4 approval steps). Tests 774/774, tsc 0, eslint clean on salary-mapping.

**Templates review and the fixes from it (your go-ahead):**
- **Fixed:**
  - **Level matching:** an employee's saved level now matches a level by code or by name (`resolveLevelCode`). Pramod (EMP-002) has "Level 7: Deputy / Assistant Manager (तह ७: …)", which matches neither: his detail pane now says "Level not in the level list" with a link to correct it; templates by level and the level's scale do not apply until it is corrected. **His record was not changed** (real data).
  - **Add new with a template for someone with no salary:** the template's basic now applies (its amount, or the level's starting salary). Basic + grade from the employee form are still kept.
  - **Pay heads limited to other departments / designations** are left out when a template is applied to that person (Add new, Revise, Bulk edit, Apply to employees).
  - **"Make inactive"** now reports a failure instead of ignoring it.
  - **"Sent for approval…" message:** hidden once that change has been approved or rejected (it stayed on screen before).
- **Templates tab:**
  - list: **Employees** column (how many it fits, "overlaps" when another active template fits some of the same people); a warning on "Level's starting salary" when a level has none (only S1 and S2 have one at Goodlife); Pay heads count hidden by default; columns narrowed so Actions fit;
  - **Apply to employees:** opens Bulk edit with everyone it fits (those with a change waiting are left out), the template applied and the reason filled in, ready to review and send through approval;
  - editor (full-size): levels with their names; pay heads under Allowances / Deductions / Worked out by payroll; "limited" only when Pay heads really leaves some department or designation out (Goodlife's heads have all ticked = everyone); warnings for overlaps and missing starting salaries; **live Preview** of the breakdown for an employee it fits; "Fits N employees now"; the text now says a template fills a salary once and editing it changes nobody.
- **Bulk edit:** applying a template says it replaces the allowances and deductions and how many rows it did not fit; **Undo template** puts the rows back.
- **Print wording and layout (your request):**
  - "letter" is gone from the screens: the toolbar reads **Print salary revision**, the history link and the print page's button read **Print**, the browser tab "Salary revision".
  - On the printed page the line closing Earnings (Gross earnings, or Total salary without SSF), the one closing Deductions (Total deductions) and the one under Net payable are darker and 2 px thick, so the parts stand apart.
  - Someone's first salary (nothing before it) prints as "Salary structure … Your salary is set with effect from …" instead of "has been revised", with the amount column headed "Amount" and without "All other terms … remain unchanged".
  - Checked in the browser (print view) on Kushal's two revisions: the revision (previous / revised / change, CIT +1,500, net payable −1,500) and his first salary; the three dark rules show; console 0 errors.
- **Delete template (your request):** a Delete action in the Templates list, with a confirmation that says salaries already filled from it do not change (each revision keeps its own amounts; nothing points at a template), how many employees it fits now, and that Make inactive keeps it instead. Needs the **Delete** permission on Salary structure (the HR preset has View / Add / Edit / Export, so HR users see Make inactive but not Delete unless a role grants it); audited as DELETE with the template's code and name. Checked: a TEST ONLY template created and deleted through the screen; the list fits without sideways scrolling. Tests 779/779.
- **Checked (TEST ONLY):** a "TEST ONLY template" (level S2, basic from level, fuel 1,500) showed the preview for Kushal (total salary 23,500, net payable 21,080, his CIT dropped as a template replaces deductions) and "Fits 1"; Apply to employees opened Bulk edit with Kushal and the template applied (not sent); in Bulk edit, Apply then Undo template brought back his CIT 1,500. Pramod's pane showed the level notice. The template was then deleted (`scratch/delete-test-template.ts`); nothing was saved for Kushal. Console 0 errors. Tests 778/778, tsc 0, eslint clean on salary-mapping, `npm run build` OK.

**Notes:**
- **Found:** payroll loads tax slabs of every fiscal year (`taxRateRepository.findAllSlabs()` in `payroll.service.ts`); the estimate uses the active year's. Fix in 4.8.

---

## 2026-10-07 — Deploy result (v0.2.0 live)
Branch: `redesign/4.4b-salary-structure`

**v0.2.0 is live on Yeti Cloud** (`56314a9`, tag `deploy-2026-10-07`).
- All 4 company databases synced; build and start were clean.
- `docs/deployment/yeti-cloud.md` now records:
  - the result in the release log;
  - the server's PostgreSQL 16.15;
  - the backup method that worked: `pg_dump` through the database host name as `webadmin`, one line at a time.

**Follow-ups:**
- change the database password (it was shown in a screenshot);
- set `FORCE_SSL=true`;
- quieten the "column already exists" notices.

---

## 2026-10-07 — Deploy to Yeti Cloud (first redesign release, v0.2.0)
Branch: `redesign/4.4b-salary-structure` → fast-forwarded into `main`, tagged `deploy-2026-10-07`

Your decision: put everything signed off so far live before the Salary structure change. Leave unneeded-file clean-up until after the redesign.

Changed:
- New `docs/deployment/yeti-cloud.md`:
  - how the server is set up;
  - `.env` variable names, and how to check them without showing values;
  - the branch and release model;
  - a pre-deploy checklist;
  - the server runbook (S1–S9) and rollback;
  - troubleshooting, scripts never to run on the server, clean-up candidates;
  - the release log.
  - It is based on the Yeti Cloud guide you wrote.
- `CLAUDE.md`: a Deployment section pointing to it.
- `.env.example`: Yeti line for `TRUSTED_PROXY_HOPS`.
- `package.json` version 0.2.0. The status bar shows it, so the live build can be recognised.
- Tag `pre-redesign` on `7f20aaf` (GitHub `main` before this release) as the rollback point.

What goes live:
- the new environment variable `PLATFORM_SESSION_SECRET` (required);
- `npm ci`;
- migrations 0035–0046 and the platform leave-exception tables, through `sync-schema.ts`;
- a database backup first, because 0038, 0039, 0042, 0044 and 0046 change existing data.

---

## 2026-10-07 — 4.4 fix: duplicate approval steps removed (migration 0046)
Branch: `redesign/4.4b-salary-structure` (from `redesign/4.2b-employee-documents`)

Your decision: remove the duplicate timeline steps left by the earlier back-fill, before the Salary structure change.

Changed:
- Migration `0046_salary_timeline_cleanup` (and the same two statements in `ensureTenantSchema`, after the back-fill; restart needed).
- It deletes only the back-filled copies (ids `md5(<change>:submitted / :decided)`):
  - the Submitted copy, where the change has its own Submitted step;
  - the decision copy, where it has its own decision.
- Changes with no steps of their own keep the back-filled ones. Nothing the app wrote itself is touched.
- The cause was fixed in the 4.6e follow-up: the back-fill now fills only changes without steps.

Verified:
- tsc 0
- 756/756 tests (a test that both deletes touch only back-filled ids, only where an own matching step exists, and run after the back-fill)
- Browser: before the restart, the bulk edit of 2026-10-04 showed Submitted ×2 and Final approved ×2; after it, Submitted and Final approved once each (with the note), and the single-employee change of the same day is also clean. Console 0 errors.

---

## 2026-10-07 — 4.2b Employee form: tabs, identity documents, photo
Branch: `redesign/4.2b-employee-documents` (from `redesign/4.6-leaves`)

Your decisions:
- Documents become a list. Citizenship or NID is required. PAN stays a plain number.
- Scans are kept in the company database, PDF / JPG / PNG, up to 3 MB.
- A new Citizenship / NID needs a scan; older records without one can still be saved and show under Records to fix.
- Types: Citizenship, NID, Passport, Driving licence, Voter ID.
- After the first look, you asked for:
  - tabs instead of the section sidebar;
  - better field widths;
  - an issuing office;
  - one scan holding both sides, with a note;
  - row icons for documents;
  - a window for adding and editing;
  - a profile photo.
- Issuing office: pre-filled from the type and district.
- The photo is cropped to a square and shown on the record, the quick view and self-service.
- Enter on a tab's last field opens the next tab.

Changed:
- **Data:** migration `0045_employee_documents` (and its `ensureTenantSchema` block; restart needed).
  - `employee_documents` (with `issuing_office`), `employee_document_files` (one scan per document, `bytea`) and `employee_photos`.
  - The old citizenship / NID / passport / voter columns are copied once and kept as a mirror (dropped in Phase 8).
- **Rules** (`lib/engines/employee-document.engine.ts`):
  - Citizenship or NID required, each type once.
  - Numbers checked by type (new driving licence check).
  - One of the 77 districts.
  - New documents need an issuing office and an issued date (never in the future or before birth).
  - A new Citizenship / NID needs its scan.
  - The file type is taken from the content; safe file names.
  - `suggestedIssuingOffice`.
- **Form:**
  - Tabs above the form with badges; F6 switches tabs; Enter flows into the next tab; Save opens the tab with the first error; `#section-…` links open their tab.
  - Fields sized to their content (new `sm` size).
- **Documents tab:** a table with View / Edit / Delete on each row; Add / Edit in a window with one scan and the note about both sides; Delete asks first.
- **Photo:** General tab field with a crop window (512 × 512 JPG). New kit `Avatar` and `ImageCropWindow`. Photo shown on the record header, quick view, form header and self-service My profile (initials fixed there too: "RS", not "RA").
- **Routes:** `/api/employees/documents/files` and `/[id]`, `/api/employees/photos` and `/[id]`. Uploads are attached when the employee is saved, in the same transaction.
- **Records to fix:** new "ID scan or issue date missing" (not on payroll readiness). "Fix" links open the right tab.
- **Audit:** "Identity documents" and "Photo" as changed fields (names only). Uploads and scan opens are logged with ids and sizes.
- **Security S25.**
- **Fixed (4.2):** the record Overview's "Leave left" tile showed float noise ("12.3999999999…"): the per-type balances were added as plain numbers. The sum is now rounded to the ledger's 2 decimals, and the tile, the record's Leave tab and the self-service "Leave left" tile show days like the leave module (`fmt`: at most one decimal, no trailing .0; Kushal: 12.4 days).

Verified:
- tsc 0
- eslint clean on the touched files (the 5 `any` errors in `employee.repository.ts` and the 6 in self-service My profile were already there)
- 754/754 tests, including `tests/employee-documents.test.ts` and `tests/security-employee-documents.test.ts`
- `next build` OK
- Browser (after the restart, 1920 / 390): tabs, badges, F6, Enter into the next tab, a refused save opening the first tab with errors; Add document window (pre-filled office, scan required, a renamed text file and a 4 MB file refused, PDF viewer); row icons and delete confirm; photo crop; Kushal's copied documents and Records to fix. Fixed on the way: the crop window failing on its first open in dev, the office not pre-filled for older documents, focus on Document for a second document. Checked by you on real data (Kushal Pokhrel); signed off 2026-10-07.

Notes: deploy needs the restart (tables created and old documents copied on the first pool open). Existing employees' documents have no issuing office, issued date or scan until someone adds them, so they show under Records to fix.

---

## 2026-10-06 — One detail pane layout on every register
Branch: `redesign/4.6-leaves`

Your decision: move all registers to the new pane layout in one pass.

Changed:
- **Pane kit** (`components/kit/pane.tsx`, moved out of `split-view.tsx`): `PaneActions`, `PaneSection`, `PaneFields` (`columns` for words, `figures` for amounts), `PaneFigures`, `useShowAll`, and one approval timeline (`PaneTimeline` + `approvalSteps`; it replaces three copies). The default pane width is now a third of the area (380–560px), so registers like Leave balances fit without scrolling sideways.
- **Every register** now reads the same way: buttons on top (with the reason when one is missing), a summary, sections divided by lines (no boxes inside the pane), long lists cut with "Show all", the approval timeline or history last: Employees, Organization (all five kinds), Salary structure, Salary approvals, Attendance adjustments, Leave requests, Leave balances (ledger per type: the latest lines first, earlier ones on request), Leave types.
- **Fixed (4.4)**: the restart-time schema sync back-filled a "Submitted" and a decision step for every salary change, also for changes that already had their own, so after a restart a change could show its steps twice (seen on the Approvals tab: Submitted ×2, Final approved ×2). It now fills only changes without steps of their own. The copies already made are still in the database (see below). Timelines also always put "Submitted" first.

Verified: tsc 0 · eslint clean on the touched files · 728/728 tests (a test that the back-fill never fills a change that has its own steps) · `next build` OK · browser at 1920px, every pane opened: Leave requests, Leave balances (Kushal), Employees (Kushal), Organization → Departments (Finance & Accounts), Salary structure (Kushal), Salary approvals (the bulk edit of 2026-10-04), Attendance adjustments (clock-out outside the office), Leave types; Organization at 390px (full-screen pane, labels above values). Nothing saved.

Open: the duplicate steps already written for salary changes saved before this fix stay until removed; a one-off migration can delete the back-filled copy wherever the change has its own step (asked before adding it).

---

## 2026-10-06 — 4.6e follow-up: an easier detail pane
Branch: `redesign/4.6-leaves`

Your decision: improve the shared pane for every register, and rework the Leave types panes.

Changed:
- **Shared pane** (`components/kit/split-view.tsx`, used by 9 registers): default width about a third of the area (400–600px) instead of a fixed 420px; the register always keeps at least 520px, so its columns no longer scroll sideways when a record is open; **Expand** shows the record across the whole area (**Show the list** or Esc goes back, the list keeps its place). New pane blocks: `PaneSection` (title, count, folded sections), `PaneFields` (label and value side by side, stacked when narrow, with a note line), `useShowAll` ("Show all (n)").
- **Statutory leave pane**: buttons at the top; each setting shows yours with "Law: …" under it (and "under an exception"); a waiting change is highlighted; an exception in force is a short notice (what, dates, days left, directive); ended and withdrawn exceptions fold into **Past exceptions**; exception requests and history show the latest few with "Show all"; date ranges no longer break inside a date.
- **Company leave type pane**: the same layout (Edit at the top, what it is, settings, history).

Verified: tsc 0 · eslint clean on the touched files · 727/727 tests · `next build` OK · browser at 1920px: Home Leave with the grid's columns all visible beside the pane, Expand / Show the list, Past exceptions folded; Leave requests still opens its pane (wider, with Expand). Test data, with your permission: **TEST ONLY Study leave** (10 days, 7 days' notice, after 180 days, carried over up to 20, Finance & Accounts only) added, changed to 12 days with a note, switched off and on; its history showed all 4 versions; a request preview for Kushal Pokhrel (not sent) showed "can be taken after 180 days of service: from 2027-01-23", no balance (this year's days were not given) and the HR note about notice; then the type was deleted (never used). The audit log keeps its add, edit, switch and delete entries. 0 console errors.

---

## 2026-10-06 — 4.6e Company leave types; Leave rules retired
Branch: `redesign/4.6-leaves`

Changed:
- **Policies → Leave types → Company leave types**: a grid (days in words, year end, rules, who, status) with a pane (the type in one sentence, its settings, its history). The **New / Edit** window has every rule the leave engine uses: how days are given (a balance a year, a set number each time, or no balance), at the start of the year or month by month, what joiners get, working or calendar days, half days, most days a request / a year / over the whole service, year end with carry-over, cap and payout (basic salary or a fixed amount per day, never below basic), notice before leave, available after N days of service, certificate, gender, departments and designations. "Give this year's days now" / "Also change this year's balances" shows who is affected before saving. Each save is kept in the type's history with an optional note.
- **Requests** (`checkRequest`, company types only, never statutory leave or rights): notice (self-service is refused, HR gets a note; counted from the day asked, also at approval), service needed, yearly and whole-service limits (waiting and approved requests count). Self-service lists only types for the person's gender, department and designation.
- **Crediting**: types given month by month get days ÷ 12 at each attendance month close (for the days employed; posted once, taken back on reopen; not for someone already given this year's days at the year start). The year opening and new joiners skip types not for the person, and a type that gives joiners the whole year does so (the old "share for joiners" switch was saved but never used).
- **Leave rules retired**: the tab is gone, `/timeAndLeave/leave-rules`, `/leave-rules` and `/leave-types` open Policies → Leave types, Leave Rules is no longer on the Roles screen or in the menu's requirements. Provisioning and tenant onboarding no longer write `leave_rules` (onboarding now adds only the Labour Act's own types, never below the law). The table stays until Phase 8.
- **Leave salary** reads the payout rate from the leave type (statutory leave always basic salary per day); a fixed amount never pays below basic. Old types without a rate fall back to their leave rule.
- **Fixed (4.6b)**: reopening an attendance month matched its ledger lines by prefix, so reopening month 1 would also have taken back the home leave of months 10–12 of that BS year. Reopen now matches its own month only; the month close compares home leave per leave type.
- Removed dead code: the old leave types and leave rules screens (`components/leave-types/*`, `components/leave-rules/*`), `app/actions/leave-rule.actions.ts`, `lib/services/leave-rule.service.ts`.
- Files: `lib/engines/leave-type.engine.ts`, `lib/engines/leave.engine.ts`, `lib/engines/leave-salary.engine.ts`, `lib/types/leave-type.ts`, `lib/types/leave.ts`, `lib/services/leave-type.service.ts`, `lib/services/leave.service.ts`, `lib/services/leave-entitlement.service.ts`, `lib/services/leave-salary.service.ts`, `lib/services/employee.service.ts`, `lib/repositories/leave-policy.repository.ts`, `lib/repositories/leave.repository.ts`, `lib/repositories/onboarding.repository.ts`, `lib/platform/provisioning/seed-tenant.ts`, `app/actions/leave-type.actions.ts`, `app/(dashboard)/timeAndLeave/policies/page.tsx`, `app/(dashboard)/timeAndLeave/leave-rules/page.tsx`, `components/leave-policy/company-leave-types.tsx`, `components/time-and-leave/policies-hub-client.tsx`, `lib/types/role.ts`, `lib/frame/navigation.ts`, `next.config.ts`. No migration (0044 added the columns).

Verified: tsc 0 · eslint: nothing new (onboarding and provisioning keep their old warnings) · 727/727 tests (`tests/leave-type.engine.test.ts` new; 4.6e rules in `tests/leave.engine.test.ts`; S24 4.6e in `tests/security-leave.test.ts`; the Roles screen now lists 26 modules) · `next build` OK · browser (nothing saved): the grid, pane and Edit window of Unpaid Leave; a new type filled in shows its sentence and the this-year preview (FY 2083/84: 3 people, 29.7 days, Kushal +9.7 pro-rata), Save with no code is refused before anything is sent, Discard closes; the old Leave rules link opens Leave types; 390 px; 0 console errors. After the check, the toolbar keeps its buttons on one line, half days reads "Half days allowed: Yes / No", and the note field sits in the form grid.

---

## 2026-10-06 — 4.6d Leave exceptions
Branch: `redesign/4.6-leaves`

Your decisions: the company asks and the platform grants (or the platform grants directly); when an exception ends, the setting goes back to the law by itself.

Changed:
- **Company (Policies → Leave types):** **Ask for an exception…** next to Propose (company-wide Leave types → Edit, never support view): setting (only those the law sets a minimum for), "Down to" with the law beside it (starts at the law's value), directive or law, number and date, from / until (an end is required, at most five years), why; checked as you type with the platform's own rules. The pane lists **Exception requests** (Waiting for the platform / Granted, with the dates granted when the platform changed them / Rejected with the reason / Withdrawn; Withdraw while waiting) and each exception (directive, "down to", dates, days left, "withdrawn by the platform: reason"); the Minimum column says "under an exception". From 30 days before an exception ends, a warning on the tab and in the bell ("Leave policies").
- **Platform → Leave exceptions** (new page, kit grid and windows): requests from companies (Grant… with the value and dates adjustable, Reject… with a reason the company sees), exceptions granted (In force / Starts later / Ended / Revoked, when copied to the company; Revoke… with a reason), **New exception…** for a chosen company. Every grant, reject and revoke is in the platform audit (`LEAVE_EXCEPTION_GRANTED` / `_REQUEST_REJECTED` / `_REVOKED`).
- **Rules** (`lib/engines/leave-policy.engine.ts`): `exceptionErrors` (a lower value than the law for a setting the law sets, a named directive, dates with an end), `overlapping` (no two for the same setting at once), `endingSoon`, `exceptionState`. The copy in the company is written only by `lib/platform/leave-exceptions.ts` (`pushToCompany`: on grant, revoke and every policy sync).
- Platform DB: `company_leave_exceptions`, `company_change_requests.kind`. Company-details change requests are kept apart (list, review and Company setup check the kind).
- Files: `lib/platform/leave-exceptions.ts`, `lib/platform/schema.ts`, `lib/platform/db.ts`, `app/api/platform/leave-exceptions/*`, `app/(platform)/platform/(admin)/leave-exceptions/page.tsx`, `components/platform/leave-exceptions-client.tsx`, `components/platform/platform-nav.tsx`, `app/api/platform/change-requests/*`, `app/api/platform/policies/sync/route.ts`, `app/actions/company-setup.actions.ts`, `lib/engines/leave-policy.engine.ts`, `lib/services/leave-policy.service.ts`, `lib/repositories/leave-policy.repository.ts`, `lib/types/leave-policy.ts`, `app/actions/leave-policy.actions.ts`, `components/leave-policy/leave-policy.tsx`, `lib/services/workspace-context.service.ts`, `components/frame/title-bar.tsx`.

Verified: tsc 0 · eslint: nothing new (the change-requests routes keep their old `any`s) · 706/706 tests (exception rules in `tests/leave-policy.engine.test.ts`; S24 4.6d in `tests/security-leave.test.ts`, including a scan that only the platform module writes the company copy) · `next build` OK · browser, with your permission (all marked TEST ONLY, company settings never changed): request 1 (Home leave, can be saved up to 0) → a second request for the same setting refused → rejected on the platform with a reason → the company sees "Rejected" and the reason; request 2 → granted with the end shortened to 2026-10-20 → copied at once → the company shows the exception, "under an exception" minimum 0, the 30-day warning and the bell (1), Propose accepts 0 (cancelled) → revoked with a reason → the company's minimum is back to 90, warning and bell gone, "withdrawn by the platform: reason"; three platform audit entries; 0 console errors apart from the screenshot `caret-color` artefact. After the test the window starts at the law's value (it first showed an error before anything was typed) and the wording was tidied.

---

## 2026-10-06 — 4.6c Statutory leave settings
Branch: `redesign/4.6-leaves`

Plan (your decisions): companies change statutory leave **only in the employees' favour**, every change approved by **a second person** (strict: a company with nobody else waits and is told how to add one); exceptions come from the platform (4.6d); company leave types and the end of Leave rules move here from 4.7 (4.6e), so 4.7 becomes Overtime policies.

Changed:
- **Policies → Leave types** redesigned (Leaves layout: page bar, folder tabs, Guide, Notices). Statutory leave: a grid of the six types with their settings in words, against the law, and waiting / scheduled changes; the pane shows yours vs the minimum, exceptions, the waiting change (Approve / Final approve / Reject / Withdraw, timeline) and the history. **Propose a change…**: only the type's settings, the minimum beside each, the reason, a live preview from the server; a value below the minimum is refused and Send disabled; sick leave's days a year from the next leave year or now with a pro-rata top-up.
- **Second person:** proposed with Leave types → Edit (company-wide, never support view), approved with Leave types → Approve (company-wide) or an administrator's Final approve, **never by the proposer** (new approval-engine option `preparerMayFinalApprove: false`; salary changes unchanged). Roles & permissions now offers Leave types → Approve. The bell counts leave policy changes waiting for you.
- **Applying:** on approval in one transaction (status still pending, settings, top-up ledger lines with ref `policy:<change>`, replaced scheduled changes); days a year for the next leave year apply on its first day, once. Before leave types are read (`ruleTypes()`), due changes are applied and anything below the Labour Act is raised back to it as a recorded system change.
- **Company leave types** in the same desktop style: kit grid with Edit / Switch off / Delete and a New / Edit window (page bar **New leave type**); unpaid leave can be saved with 0 days (the old form refused it); a used type can't be deleted (switch it off; the database error no longer shows); saves, deletes and switches are audited with safe errors.
- **Platform fixes:** the policy sync no longer overwrites a company's days, caps or paid days (an approved 15 sick days would have gone back to 12); "Edit Leaves & OT" shows statutory leave read-only for existing companies and only adds missing types; sync, console and provisioning never create a statutory type below the law, and a blank cap is the law's cap, not 0 (`lawfulPreset`).
- Bell link "Leave requests" went to a tab that doesn't exist; it opens Requests.
- Migration `0044_leave_policy` (+ `ensureTenantSchema`): `leave_type_changes`, `leave_policy_exceptions`, and the 4.6e leave type columns (copied once from `leave_rules`); statutory types apply to everyone.
- Files: `lib/engines/leave-policy.engine.ts`, `lib/types/leave-policy.ts`, `lib/repositories/leave-policy.repository.ts`, `lib/services/leave-policy.service.ts`, `lib/services/leave-rule-types.service.ts`, `app/actions/leave-policy.actions.ts`, `components/leave-policy/leave-policy.tsx`, `components/leave-policy/company-leave-types.tsx`, `components/time-and-leave/policies-hub-client.tsx`, `app/(dashboard)/timeAndLeave/policies/page.tsx`, `lib/engines/approval.engine.ts`, `lib/types/role.ts`, `lib/services/workspace-context.service.ts`, `components/frame/title-bar.tsx`, `app/actions/leave-type.actions.ts`, `lib/services/leave-type.service.ts`, `lib/engines/leave-type.engine.ts`, `app/api/platform/policies/sync/route.ts`, `app/api/platform/companies/[id]/route.ts`, `lib/platform/provisioning/seed-tenant.ts`, `components/platform/edit-company-modal.tsx`.

Verified: tsc 0 · eslint: nothing new (the platform files keep their old `any` counts) · 696/696 tests (`tests/leave-policy.engine.test.ts` new; S24 4.6c in `tests/security-leave.test.ts`; proposer rule in `tests/approval-engine.test.ts`) · `next build` OK · browser after the restart (nothing saved): Leave types at 1366 and 390 px; Sick leave pane; Propose window: 12 → 15 days a year previews "from 2027-07-17", home leave 1 per 25 days refused with the law and Send disabled, "nobody else can approve" shown (this company has one administrator), cancelled and discarded; Unpaid leave in the new Edit window, cancelled; 0 console errors. Approving needs a second login (not tried).

---

## 2026-10-06 — 4.6b Leaves: design and ease-of-use pass
Branch: `redesign/4.6-leaves`

Changed (screens only; no rules or data changed):
- **One layout, as in Attendance.** The page bar holds New request · Starting balances · Open leave year · Refresh (Starting balances moved up from the Balances tab). A **context strip** under it has the branch (filters every tab, kept in the URL) and one line: the leave year with its dates, the month leave is kept from, and that weekly offs and holidays inside a leave aren't counted. The branch pickers inside Requests, Balances, Substitute and Calendar are gone.
- **FilterStrip on every list** (search "Name or code", saved views): Requests (leave type, status), Balances (department), Substitute (search).
- **Requests grid:** employee first (sticky), one **Dates** column ("from – to" in the chosen date format, a single day once) instead of From / To, reason on one line with the full text on hover, raised by and department under Columns.
- **New kit `Notice`** (success / info / warning / danger: icon + words, optional title, action and Dismiss) replaces the hand-built tinted boxes: the success message, errors, the home leave switch banner (warning, with the Switch button), months not closed (info, with Go to month close), the substitute switch-window warnings and the given-up-front note in Home leave this year.
- **Guide is compact:** light tint, one-sentence steps, four in a row on wide screens, **Got it** instead of Hide.
- **Calendar:** month navigator in one bordered group like Attendance's, AD date under each BS day; month changes keep the branch.
- **Home leave this year** uses the standard status chips (Added, Waiting for month close, This month, To come, In the starting balance, Not employed). Balances' home cell reads "0.5 · up to 15.8 this year".
- `/dev/kit` shows Notice and Guide. Removed an unused import in `leave-applications-table.tsx` (old lint warning).
- Files: `components/kit/notice.tsx` (new), `components/kit/guide.tsx`, `components/leave/leave-client.tsx`, `leave-requests.tsx`, `leave-balances.tsx`, `leave-entitlements.tsx`, `leave-calendar.tsx`, `home-leave-year.tsx`, `app/(dashboard)/timeAndLeave/leaves/page.tsx` (`?branch=`), `lib/types/leave.ts` (`branchFilter`), `components/dev/kit-v2-gallery.tsx`; `02-design-system.md` (leaves layout, Guide, Notice).

Verified: tsc 0 · eslint on the leave files and kit: 0 problems · 668/668 tests · `next build` OK · browser: Requests at 1366 px (page bar, context strip, guide, FilterStrip, grid; the Dates column was widened after it cut off a range) and Notice / Guide in `/dev/kit`. The other tabs at 1366 / 390 px are checked after sign-in (the test browser was signed out).

Browser pass after sign-in (1366 and 390 px, nothing saved), fixed in a follow-up commit:
- Requests: New request appeared twice (page bar and tab), now only in the page bar (an empty list offers it); the grid scrolled sideways at 1366 (Status cut off), now fits (employee 170, reason 190); the detail pane shows the status chip.
- Balances pane: ledger rows of different leave types didn't line up (auto-width table), now fixed columns; Adjust balance no longer sits in a card of its own.
- Substitute leave: the search squeezed into a narrow box pushed Views onto a second line, now the same full-width FilterStrip row as Requests; shorter empty-list text.
- Calendar: a 32-day month scrolled at 1366, now fits (24 px days); the empty month said "Nobody in your scope" when a branch was chosen, now "Nobody in this branch this month · Choose All branches above".
- Checked: branch kept in the URL across month changes, This month, Balances notices, the home leave panel chips, phone layout. Console: 0 errors apart from the screenshot `caret-color` artefact.
- Re-verified: tsc 0 · eslint 0 · 668/668 tests · `next build` OK.

**No roadmap numbers on screens** (you asked what "Balance before 4.6" meant). The 4.6 migration wrote the notes "Balance before 4.6" / "Taken before 4.6" on the lines it carried over from the old leave screens; "4.6" is our roadmap step, meaningless to users. The ledger is never edited, so the Balances history now shows them as "Balance from the old system" / "Taken in the old system" (`plainLedgerNote` in `lib/engines/leave.engine.ts`, used by `ledgerFor`; test in `tests/leave.engine.test.ts`), as attendance already does for "Recorded before 4.5" ("Entered in the old attendance screen"). A search of every screen found no other step numbers in text users see ("Opened by 4.6" on leave year openings is stored but never shown). Rule added to `02-design-system.md` §7.

---

## 2026-10-05 — 4.6b Leave entitlements
Branch: `redesign/4.6-leaves`

Changed:
- **Leave year = fiscal year (§50), opened once.** `leave_year_openings` (migration `0043_leave_entitlements`; years with ledger lines when it arrives count as opened). **Open leave year** previews and posts, per employee and balance type: the old year's usable balance carried up to the cap (home 90, sick 45, a company type's own cap if it carries over), the excess marked **to be paid out** at basic salary (statutory and encashable types; paid by leave salary, 4.9) or **lapsed**, substitute grants still valid with their own expiry, and the year's credits (sick 12; company types; pro-rata for joiners, not twice if credited at hire). Blocked while old-year requests wait or attendance months of the old year are open. Requests and decisions in a year that has been carried over are refused for balance types.
- **Home leave earned at month close (§43):** paid days ÷ 20 per employee, posted in the close transaction; reopening takes it back, closing again posts only the difference (ledger `ref` per month). For the year when 4.6 arrived, home leave was already given in full up front (the 4.6a opening lines), so nothing more is earned that year.
- **Substitute leave (§42):** a new tab lists days worked on a weekly off or holiday in the last 21 days, with a suggestion from the hours worked; HR grants a full or half day (expires 21 days after the day worked) or records why not. Balances use the grant that expires first; expired days stop counting and are written off at the next month close.
- **Joining:** sick leave and company types are credited pro-rata from joining; home leave starts at 0 (earned), substitute at 0 (granted).
- **Leave calendar tab:** a BS month of who is on leave, waiting leave lighter, weekly offs and holidays shaded.
- **Employee record:** the Leave tab and fact box read the ledger; **Payable on leaving** shows home / sick days due at the last basic salary.
- Files: `lib/engines/leave.engine.ts` (`balanceOn`, `homeLeaveEarned`, `carryOver`, `proRata`, `capOf`, `planOpening`), `lib/services/leave-entitlement.service.ts` (new), `lib/services/leave.service.ts` (month close / reopen lines, joining credit, payable on leaving), `lib/services/attendance.service.ts` + `lib/repositories/attendance.repository.ts` (ledger lines in the close / reopen transaction), `lib/repositories/leave.repository.ts` (`ref`, openings), `app/actions/leave.actions.ts`, `components/leave/leave-entitlements.tsx`, `components/leave/leave-calendar.tsx`, `components/employee/employee-record-leave.tsx`.

Verified: tsc 0 · eslint: nothing new (two old items in `leave.repository.ts` and `leave-applications-table.tsx`) · 661/661 tests (`tests/leave.engine.test.ts`: expiry and oldest-first, home leave and its month view, caps, pro-rata, the opening plan; `tests/security-leave.test.ts`: S24 4.6b, opening blocked exactly by the checklist, the home leave switch) · `next build` OK.

Easy to understand (after the first browser check): every leave tab opens with a **"How … works" guide** (new kit `Guide`: numbered plain steps, Hide / "How does this work?", remembered per browser). **Open leave year** was rebuilt around a one-line status, a **Before you can open** checklist (each unmet item says what to do; dates in words, "1 Shrawan 2084 (17 Jul 2027)") and **What opening does** with the company's own limits; it no longer said "into no year to open" or "ended" for a year still running. Substitute leave has **Grant 1 day / ½ day** and **Not granted** on each row (ticking rows still works for many) and empty-list text that says what will appear and when. The calendar is full width, today's date is readable, weekly offs are visible. The employee record's balances show leave type, taken and balance (credited / carried in under Columns).

Browser (after the restart, nothing saved): Balances, Requests, Substitute (hide and bring back the guide), Calendar (Aswin 2083: weekly offs, Dashain shaded, today), Open leave year (FY 2083/84 open; FY 2084/85 not set up yet, so "no next leave year", checklist with the fix), Pramod's record (Home 18, Sick 12, Substitute 0; payable on leaving 18 + 12), 390 px; 0 console errors apart from the screenshot `caret-color` artefact.

**Home leave earned month by month (your choice: option B).** The old system gave each year's home leave up front (18 days); the law gives it as it is earned (§43). New `lib/services/home-leave.service.ts`:
- **Switch to earned home leave** (Balances banner → window, company-wide role, typed SWITCH, audited, once per person and year): the up-front days are taken off with a ledger line that says why, closed attendance months add their days, open months add theirs when closed. Until someone is switched, the month close adds nothing on top of the up-front days. *Made for FY 2083/84 on 5 Oct 2026 by Goodlife finance Admin (3 employees).*
- **Home leave this year** panel (Balances pane, employee record, self-service My leave): brought forward, earned so far, taken, balance now, **up to this year**, and month by month what each month added or is earning (open months from attendance so far, worked out for everyone in one pass, nothing written). The Balances grid shows "earned X of up to Y".
- Engine: `homeLeaveMonths` (statuses added / waiting for close / this month / to come / not employed; joiners and leavers; the company's rate). Attendance: `paidDaysSoFar` (same rules as the register, nothing written).
- Verified in the browser: after the switch and Shrawan's close, Pramod: Shrawan 10 paid days → +0.5 (added), Bhadra 9 (waiting for month close), Aswin 12 so far (this month), up to 15.8; grid and pane agree; employee record shows the same and payable on leaving 0.5. Self-service shows the same panel (not opened in the browser: needs an employee login).

**Ready for real companies (month by month from day one).** A company that starts using AakashHRMS during a leave year now has a proper start:
- **Starting balances** (Balances → Starting balances…): pick the month leave is kept here from, enter each person's balances on its first day from the old records (type or paste from Excel). Only the difference is recorded, so saving the same figures again changes nothing; the month is fixed by the first save (`leave_start` in `system_config`, no migration). Months before it are "In the starting balance": closing or reopening them adds or takes back no home leave, and they don't block opening the next year. Starting balances (`start:<year>` ref) are never mistaken for the old system's up-front days, so new companies never see the switch.
- **Why balances aren't growing yet** is now said everywhere: the Balances tab lists months that have ended but aren't closed (with Go to month close); month close reports the home leave it added; a home leave request that is short says which months haven't been added; the employee record's payable on leaving adds "plus about X days earned in months not closed yet".
- The switch from up-front home leave stays for data from the old system.
- Engine `balanceAtStart` (lines that set up the year count whatever their date: openings, the first-day credit and carry-over, the switch, starting balances); `homeLeaveMonths` "before" status. 668/668 tests.

Notes: the payout itself (excess each year, everything on leaving) is leave salary, 4.9. Company types' carry-over and encashment settings get their editor in 4.7.

---

## 2026-10-05 — 4.6a Leaves foundation signed off
4.6a (leave ledger, rules engine, requests and approvals, balances, self-service, S24) and the fixes found while checking it (grid column menu, English leave names, roster rotations) are signed off. 4.6b Entitlements starts on the same branch.

---

## 2026-10-05 — Roster rotations keep weekly offs (found in 4.6a)
Branch: `redesign/4.6-leaves`

**Why Saturdays were counted as leave days.** The roster had a rotation over 5–17 Oct (GEN → NGT, a week each; the Rotate window's defaults: first open day to month end). A rotation wrote a shift on **every** day, and a rostered shift is worked even on its usual off day (that is how a manual swap onto a weekend works), so the rotation silently turned Saturdays and Sundays into working days. Leave then counted them, and once those days passed, attendance would have marked them **absent** instead of weekly off.

Fixed: `rotate()` takes each step's shift's own week (`weeklyOffOf`); its weekly offs are written as OFF, and OFF steps still give rotating days off. The Rotate window previews the same rule and warns when the result has 7 or more working days in a row (Labour Act §40). A rotation's audit line now records its dates, steps and step length. A shift typed in the grid on a weekly off is still worked (swaps, weekend duty).

Verified: tsc 0 · eslint clean · 633/633 tests (`tests/shift.engine.test.ts`: the 5–17 Oct case, OFF steps, the §40 run; `tests/security-attendance.test.ts`: the service passes the shifts' weeks) · browser: Rotate window with its defaults previews GEN Mon–Fri, OFF Sat / Sun, NGT, OFF (not saved); Pramod's sick leave 5–12 Oct counts 5 days, Sat 10 Oct "Weekly off", Sun 11 / Mon 12 Dashain; 0 console errors. The roster for 5–17 Oct was corrected by hand (Sat / Sun OFF).

Also: the EditGrid choice list is now as wide as its longest label (in 50 px roster columns "USUAL (back to the usual shift)" wrapped one word per line).

---

## 2026-10-05 — Kit: grid column menu no longer clipped
Branch: `redesign/4.6-leaves`

The DataGrid **Columns** menu was drawn inside the grid's rounded frame (`overflow-hidden`), so on short grids most of the list was cut off (every module's tables). It is now placed on the screen like the other kit pop-ups (`usePopupPosition`): it opens upwards near the bottom of the screen, stays inside the screen at 390 px, scrolls when the list is long, and closes on Escape.

Verified: Leaves → Balances at 390 / 1366 / 1920 (whole list visible, no sideways scroll), 0 console errors.

---

## 2026-10-05 — 4.6a Leaves foundation
Branch: `redesign/4.6-leaves`

Research: Labour Act 2074 chapter 9 (§40–51), SSF maternity / sickness benefits, Zoho People / Keka leave types, comp-off and ledgers (see the plan in the roadmap row).

- **Rules** (`lib/engines/leave.engine.ts`): three layers (calendar = weekly offs + holidays, never leave types; statutory types; company types); kinds balance / event / none; working-day counting skips the person's weekly offs and branch holidays and says why, calendar-day counting for maternity, maternity care and mourning; half days (first / second); pay per day (maternity 60 paid + 38 unpaid, +30 unpaid with a doctor's note); refusals (type not for the person, short balance, overlap, HR-set days, closed attendance month, outside employment, across the leave year, more than the event's days); §51 rights; the statutory floor (`statutoryFloorProblems`); ledger sums.
- **Requests and approvals** (`lib/services/leave.service.ts`, `app/actions/leave.actions.ts`): the server counts every request; approve / Final approve / reject / withdraw / cancel through the approval engine (supervisor or Leave approvals → Approve; company administrators Final approve; never your own); approval re-checks balance, overlaps and closed months; rights can be rejected only for a missing condition; cancelling approved leave returns the days and is refused in a closed month.
- **Balances**: append-only `leave_ledger` (opening, accrual, grant, taken, returned, adjusted, carried forward, paid out, expired); Adjust balance with a reason, never your own.
- **Screens**: `/timeAndLeave/leaves` with Requests (Waiting for me / All / My leave, filters, bulk approve / reject, detail pane with days, balance, §51 note and timeline) and Balances (employee × balance types, ledger pane); New request window with a live server preview; Adjust balance window. Old Applications / Approvals pages redirect here. Self-service Apply for leave uses the same preview and service; waiting requests can be withdrawn.
- **Attendance** reads approved leave day by day (weekly offs inside leave stay weekly offs; maternity's unpaid days are deducted).
- **Statutory types** are locked in the old leave-type editor until 4.6c. Public & festival holidays is no longer a leave type (new and existing companies); Substitute and Unpaid leave added. Statutory names are English only (the Nepali in brackets is dropped from the seeds, the platform sync and existing companies, for the later translation pass).
- **Bell** counts only leave the user can decide.
- **Data** (migration 0042): leave type behaviour columns, request detail / approval columns, `leave_ledger` with the old balances backfilled (home / sick opening and taken lines; event and public-holiday "balances" left out).
- **Security S24** (see 03): scope on every action, server-side day count, own-record rules, audit, safe errors, immutable ledger, closed-month guard, balance re-check, statutory floor, bell scope.

Verified: tsc 0 · eslint nothing new · 631/631 tests · `next build` · browser as the company administrator: Requests and Balances tabs, ledger pane (Pramod: home 18 + sick 12 + substitute 0, no longer 72), New request preview (Pramod, sick, 5–12 Oct: 6 days, Dashain days not counted, balance 12 → 6, §51 note, maternity not offered to a man), Adjust balance window opened and cancelled, 390 / 1366 / 1920 without sideways scroll, 0 console errors. Nothing was saved.

Notes: the roster has everyone on GEN every day from 5 to 17 Oct (weekends included), apparently left from shift testing, so leave in that span counts Saturdays; self-service My leave needs an employee sign-in to check; after the restart the existing statutory names read in English only (Leaves, Leave types), with no sync errors. 4.6b (entitlements) and 4.6c (statutory leave settings) follow.

---

## 2026-10-05 — 4.5 Attendance signed off
4.5a (day rules, register, adjustments, month close), 4.5b (shifts, roster) and 4.5c (web clock-in) are signed off on `redesign/4.5-attendance`. 4.6 Leaves starts on `redesign/4.6-leaves`, stacked on 4.5.

---

## 2026-10-05 — 4.5c checked as an HR manager
Branch: `redesign/4.5-attendance`

Signed in as Sumina Shrestha (HR Manager, company-wide, linked to EMP-001): the **Clock** button in the top bar clocked her in and out at the office point (web punches, "0 m from Head Office"); Today showed her as At work; her own Register row is read-only; the allowed-anywhere list does not offer herself; she can change web clock-in settings (company-wide role). Head Office set back to Off afterwards.

Fixed: the top-bar button now loads today's state with the page ("In 12:00" / "Out 12:03", not "Clock in" until opened); a locked grid cell now says why when someone types into it (your own row, closed month, future day, no Edit permission) instead of doing nothing; the Today hint describes Not in yet / At work; worked time under an hour reads "2m", not "0h 2m".

Role review (HR Manager, 46 of 189): sensible overall. Suggested: add **Attendance → Lock** (closing the month is HR's job before payroll); remove **Employees → Delete** (terminate, never delete), **Pay Heads → Add / Edit** (payroll's or the admin's), and probably **Roles & users → View**. Payroll stays with payroll / finance.

---

## 2026-10-05 — 4.5c Web clock-in
Branch: `redesign/4.5-attendance`

Research: Zoho People (web / mobile check-in, IP and geo restrictions per location), Keka (web clock-in limited to office IP ranges; remote clock-in outside the office with location and approval), greytHR (web sign-in with IP restriction, geofencing), browser location (precise on phones, rough on desktops; can be faked, so the server works the distance out and checks accuracy; HTTPS only), Nepal Privacy Act 2075 (location is personal data: purpose, scope and who sees it must be told; used only for that purpose).

- **Rules** (`lib/engines/checkin.engine.ts`): company switch (off by default) and a rule per branch: off, anywhere, office network (IPv4 / IPv6 addresses and ranges), office location (point + radius, accuracy allowance 50 m, too rough over 500 m), network or location, network and location. People can be allowed to clock in from anywhere (reason, until a date).
- **Clocking** (`lib/services/checkin.service.ts`): the signed-in employee only, server time, in / out decided by the server, one punch a minute, rate limit; inside → web punch with IP, location and a note; outside → the reason is shown and the employee may **send it for approval** (remote clock-in adjustment; the supervisor or Attendance → Approve decides; approval adds the web punch). Night shifts clock out on the day they started.
- **Screens**: Clock card on the self-service home (replaces the disabled placeholder) and a **Clock** button in the main app's title bar; **Web clock-in** tab in Attendance (company switch, branch rules with "Add this network" / "Use my current location", allowed-anywhere list); remote clock-ins in Adjustments show distance, accuracy and IP; the title-bar bell counts attendance adjustments waiting for you; **My attendance** shows the month's days with the same rules (it showed only closed months before).
- **Data** (migration 0041): branch check-in columns, remote place on adjustments, `attendance_checkin_exceptions`.
- **Security S23** and privacy notice.

Found and fixed in the browser test:
- **Location was blocked everywhere**: the security headers had `Permissions-Policy: geolocation=()`; now `geolocation=(self)` (our own pages only, never third-party frames).
- **After signing in, self-service users were stuck on the `/dashboard` address** (two redirects in a row after a server-action redirect: the page showed self-service but every later request went to `/dashboard` and failed with "An unexpected response was received from the server"). Sign-in now finishes and the form loads the workspace as a full page, so the server's redirects set the address.
- A query compared a computed time with an untyped date parameter (the clock card failed with a reference); it now casts explicitly. Server error logs now include the cause in the log line (users still see only the reference).
- **A day in progress**: one punch today before the shift ends showed Missing punch (counted absent); it now shows **At work** and is not counted until the shift ends (Today counts it under In).
- My attendance crashed calling a browser-only helper on the server (moved to the engine). The self-service logo was hidden under the top bar (the bar now starts after the sidebar). Small: the reason box gets focus, "Web clock-in" as the punch source, wider Correction column, a double-click no longer selects a word in grids.

Verified: tsc 0 · eslint: nothing new · 600/600 tests (new `tests/checkin.engine.test.ts`, `tests/security-checkin.test.ts`; at-work case in `tests/attendance-day.test.ts`) · `next build` · Browser with your permission: HR set Head Office to Office location with "Use my current location" and switched web clock-in on; as Pramod Sharma (EMP-002, simulated location): clock-in at the office → web punch "0 m from Head Office"; an immediate second tap refused; clock-out 2.2 km away → "You are 2.2 km from Head Office (allowed 150 m)", sent for approval with a reason; My attendance showed the request and "At work"; 390 px fits. As admin: sign-in landed on the right address; the bell showed 1 attendance adjustment; the request showed 2.2 km, ±15 m, IP; approved → the web punch was added. Afterwards the two test punches were voided ("Test of web clock-in") and web clock-in set back to Off (company and Head Office). 0 console errors.

---

## 2026-10-05 — 4.5b UI / UX pass (your feedback)
Branch: `redesign/4.5-attendance`

- **Windows close after saving**: Assign shift and Rotate stayed open after a save; they now close (and the roster reloads).
- **Typing numbers**: the season day boxes were browser number inputs (spinner arrows, a cleared box became 0); they are `NumberField`s now, with a maximum (32) and the contents selected on click so typing replaces them. The rotation's "each step lasts" no longer jumps back to 1 while you type.
- **Cancel asks before discarding**: footer Cancel buttons closed windows without the "Discard changes?" question (only Esc and × asked). New kit `WindowCancel` used in every redesigned window (attendance, organization, salary structure, employee status); Add punch, New adjustment, Assign shift and Rotate now also tell the window when something was typed.
- **Shift window**: row checks (week, seasons) show after a save attempt, not as soon as a season row is added.
- **Attendance rules**: the first field gets focus; the late-day count is greyed out while the late rule is off.
- **Register**: today before the shift ends reads "Not in yet" (not "Upcoming"); the legend explains "·"; the status line shows the date and weekday once.
- **Punch log**: column widths rebalanced so "In / out" and Void fit at 1366 px.
- **Grids**: "1 row" instead of "1 rows".
- **Date format (whole app)**: the BS / AD choice was read only in the browser, so every page drew BS first and switched to AD a moment later. It is now also kept in a cookie and the server draws the chosen format straight away.

Verified: tsc 0 · eslint: nothing new · 578/578 tests · `next build` · Browser (nothing saved): typing in shift numbers and season days, Cancel → "Discard changes?", rules window focus, register day pane, Punch log at 1366, BS / AD rendered by the server, 0 console errors (the one hydration message seen comes from the test tool hiding the caret during screenshots).

Not changed now: leave, loan, payroll and platform screens still use browser number inputs; they are fixed when those modules are redesigned (4.6 onwards).

---

## 2026-10-05 — 4.5b Shifts and roster
Branch: `redesign/4.5-attendance`

Research: Zoho People (shift hours, breaks, per-shift weekends incl. half working days, default shift and mapping, rotations, the shift window that splits the gap between shifts), Keka / greytHR (fixed, rotating, flexible and night shifts; roster grid; rotations; shift allowance as a pay item), Nepal (government hours 09:00–17:00 and 09:00–16:00 from Kartik 16 to Magh 15, Saturday + Sunday off; shorter Fridays and Saturday mornings in many offices), Labour Act 2074 (8 h a day / 48 a week, rest after 5 hours, a weekly holiday, transport for women outside daylight). Device integration and punch file import moved to their own later step, as asked.

- **Shifts each company defines** (`lib/engines/shift.engine.ts`): hours, break, grace, full / half day, OT minimum; a week (each day working or off, with its own hours); seasons by BS date that come back every year; fixed or flexible; night shifts. Labour Act reminders (not blocks).
- **Which shift applies**: roster day → dated assignment → branch default → company default. Rostered shift on an off day = working day; rostered OFF = day off; holidays still win.
- **Day rules** use the day's shift: weekly off from the shift, shorter days need their own planned hours, flexible shifts have no late / early; a punch belongs to the nearest shift (gap split in the middle) instead of a fixed −4 h / +20 h window. Closed days store their shift.
- **Screens**: Roster tab (EditGrid, Assign shift, Rotate with preview), Shifts tab (list, branch defaults, Shift window with live checks), shift on Today and in the register's day pane. Attendance rules keep the company-wide rules only.
- **One source**: the General shift is created from Company setup's work schedule (nothing changes until shifts are added); Company setup → Work schedule is now read-only and copied from the default shift. The saved winter time is offered as a season ("Add winter hours"), not switched on by itself.
- **Data** (migration 0040): `shifts`, `shift_assignments`, `shift_roster` (unique per employee-day), `branches.default_shift_id`, `attendance_records.shift_id`.
- **Security S22 (shifts)**: defining is company-wide only; assigning is scoped; never your own shift; closed months refused; audited; batch limits.

- **Today, before the shift ends**: a working day with nothing recorded shows **Not in yet** (counted with Not in, not deducted) until the shift's end, then Absent. Found in the browser check: on a Monday morning everyone showed Absent (4.5a was checked on a Sunday).

Verified: tsc 0 · eslint: nothing new · 578/578 tests (new `tests/shift.engine.test.ts`; shift and not-in-yet cases in `tests/attendance-day.test.ts`; shift block in `tests/security-attendance.test.ts`) · `next build` · Browser after the restart (nothing saved): General shift created from Company setup (09:00–17:00, Sat + Sun off, 36h 15m a week, same thresholds as before); Shift window opened, winter season added and cancelled; Roster grid; Assign shift and Rotate windows with preview, cancelled; Today with the shift column; Company setup → Work schedule read-only; 390 / 1366 widths, no page overflow, 0 console errors. Fixed in the check: Not in yet (above), cut-off column headers, narrow time boxes, rotation preview labels (BS day + weekday), branch default alignment on phones.

---

## 2026-10-04 — 4.5a signed off
Final check before sign-off: tsc 0 · 556/556 tests · lint clean on the attendance files · every attendance tab, the dashboard, employee list, payroll, leaves, self-service and the attendance report load without errors · the attendance report agrees with the register for Aswin 2083 (Kushal 5 present / 7 absent, Pramod 6 / 6, Sumina 6 / 6).
Fixed: a closed month's payroll "unpaid days" now also counts days before joining / after leaving, as an open month does (the deduction amount was already the same); the attendance report's "Working days" column, slip and CSV header renamed "Days employed" (it is the days of the month while employed).

---

## 2026-10-04 — 4.5a Attendance foundation
Branch: `redesign/4.5-attendance` (stacked on 4.4)

Research: Nepal Labour Act 2074 (8 h a day / 48 a week, rest after 5 hours, one weekly holiday, OT at most 4 h a day / 24 a week at 1.5×, 13 public holidays and 14 for women, substitute leave, home leave by days worked); HR software practice (punches → daily status, regularization approved by the reporting manager, grace and half-day thresholds, loss-of-pay days, web check-in with IP / geofence, device push over ZKTeco ADMS).

**What was wrong before:** absent and half days were never deducted; approved leave never reached attendance (unpaid leave paid in full); a day with no record meant full pay; the daily rate divided by the number of rows typed in; holidays and the weekly off were not used (four different weekly-off rules); office time and grace settings were ignored (late fixed at 9:00 + 40 min); payroll's Sync unlocked sealed months and wrote draft rows; no scope, audit or unique day (S22).

- **Day rules** (`lib/engines/attendance-day.engine.ts`): not employed → HR override → holiday → weekly off → approved leave → punches (full / half / absent; half-day leave covers half) → missing punch → nothing recorded (absent, company setting). Late, early, overtime (OT-eligible types only; over 4 h / 24 h flagged), night shifts kept on the day they start.
- **Attendance months** (`lib/engines/pay-period.engine.ts`): BS months now; the AD option is built and switches on with payroll runs in AD months (4.8). Every date shows BS and AD.
- **Pay**: unpaid days (absent, unpaid leave, unpaid halves, late rule when on) and days before joining / after leaving are deducted: (basic + grade in force for the month) ÷ days in the month × days. **This changes payslips:** absences and half days now cost money, approved unpaid leave is deducted, joiners and leavers are prorated. OT keeps today's formula (unified in 4.7).
- **Screens** (`/timeAndLeave/attendance`): Today, Register (EditGrid with HR overrides and a day pane), Adjustments (approval with timeline, bulk), Month close (per branch), Punch log (void with reason); windows for Add punch, New adjustment and Attendance rules. The old attendance screens are removed.
- **Payroll** reads closed summaries or works days out on the spot without writing; it never unlocks. The dashboard, employee record and attendance report use the same rules (the report no longer makes up 09:00–17:00 times).
- **Data** (migration 0039): punches, adjustments, attendance months, day results and overrides (one row per employee-day), summary columns. Days typed before 4.5 keep their meaning (they became HR overrides, their times punches).
- **Security S22**: scope everywhere, own attendance refused (S21), audit, safe errors, unique day, server-side close, scoped and audited report export. Attendance → Approve added to roles.

Found in the browser check and fixed: days still to come counted as absent (now **Upcoming**, not counted); a month can be closed only after its last day; old entries read "Entered in the old attendance screen"; Month close columns widened; no roadmap numbers in screen text.

Verified: tsc 0 · eslint: nothing new · 556/556 tests (new `tests/attendance-day.test.ts`, `tests/pay-period.test.ts`, `tests/security-attendance.test.ts`) · `next build` · Playwright on your data after migration 0039 (**nothing saved, approved or closed**): Today (Sunday: everyone on weekly off); Register for Aswin 2083 (old entries kept as HR settings with their times: 09:00–18:00 → 8h 15m worked, 1h overtime; Dashain holidays from the calendar as HO; empty working days absent; upcoming days not counted; a day changed to ½ and discarded; Save needs a reason); day pane; Adjustments, Month close (close disabled until the month ends), Punch log (34 punches carried over); Attendance rules and Add punch windows opened and cancelled; 390 / 1366 / 1920 no page overflow; 0 console errors.

---

## 2026-10-04 — 4.3 and 4.4 signed off
You signed off 4.3 Organization and 4.4 Salary structure (with its approvals follow-up). Work continues with 4.5 Attendance on `redesign/4.5-attendance`, stacked on 4.4. Nothing is merged to main or pushed.

---

## 2026-10-04 — 4.4 follow-up: Zoho-style approvals, never your own salary (S21)
Branch: `redesign/4.4-salary-structure`

You asked for a proper approval system like Zoho Payroll. Research: [Zoho Payroll approvals](https://www.zoho.com/en-ae/payroll/help/employer/settings/approvals.html) (simple, multi-level and custom approval per module; levels in order; admins Final approve), [salary revision approvals](https://www.zoho.com/in/payroll/help/employer/approvals/salary-revision.html) (Approvals module, bulk approve / reject); maker-checker guidance (the person a request is about never approves it).

- **Approval settings** (company administrators; Approvals tab → Approval settings): **No approval / Simple / Multi-level** with named approvers in order (up to 5, move up / down). Validated (active approvers with Approve, no repeats) and audited. Changes already waiting keep their approvers (the flow is copied onto each change when saved). Custom rules come with Configuration (4.12).
- **Final approve:** company administrators (Approve, company-wide, not platform support) approve at any stage, including their own change, recorded as *Final approved*; the Revise and Review windows offer **Save and approve**.
- **Never your own salary (S21):** a change that includes your own salary always needs someone else (even with approval off); levels whose approver prepared the change or is in it are skipped and recorded, falling back to Simple when all are skipped.
- **Approvals tab** (was Changes): **Waiting for me** (count on the tab and in the title-bar bell, now a menu with leave requests and salary changes) and **All changes**; bulk Approve / Reject; the **approval timeline** per change; buttons from the same engine as the server (Approve Level n, Approve for X as a delegate, Final approve, Reject with reason, Withdraw) or the plain reason.
- **Delegation:** a user's existing "delegate to … until" lets the delegate act for a level approver, recorded *on behalf of*.
- **Safety:** a decision applies only while the change is still at the level you saw (no double decisions); a stuck level (approver left or lost Approve) says so and can be Final approved; the paid-month guard and old → new details from the previous step stay.
- **Code:** generic `lib/engines/approval.engine.ts` + `lib/types/approval.ts` (reused by pay runs 4.8 and loans 4.10); `lib/auth/self-action.ts` shared with leave approvals; migration 0038 (flow columns on batches, `approval_actions` timeline, backfill of earlier batches).
- Bulk edit: the Change details strip is top-aligned (date, reason and buttons on one line).

Verified: tsc 0 · eslint: nothing new · 517/517 tests (new `tests/approval-engine.test.ts`: settings parsing and validation, administrator definition, submission with skips and fall-back, level order, Final approve, delegation in and out of date, stuck level, own salary for every role, preparer rules, withdraw; S20 / S21 server-path checks) · `next build` · Playwright on your data after migration 0038 (**nothing saved or approved by the checks**): Approvals tab and timeline (Pramod's change shows Submitted → Final approved, approved from your session earlier; gross 0.00, net −385.00, employer cost +700.00 because grade is in the SSF base); Approval settings window (multi-level picker lists the users who can approve; cancelled); Revise footer for an administrator ("Waits for anyone who can approve (not you)", Submit for approval + Save and approve; closed unsaved); bell menu (leave requests, salary changes); 390 / 1366 / 1920 no overflow; 0 console errors. Fixed during the check: the timeline always lists Submitted first (older rows mix database and app clocks).

---

## 2026-10-04 — 4.4 Salary structure
Branch: `redesign/4.4-salary-structure` (stacked on 4.3)

`/workforce/salary-mapping` rebuilt as **Salary structure** (templates A + B and the new kit `EditGrid`), after Zoho Payroll and greytHR / Keka (dated revisions, bulk revise by spreadsheet), TallyPrime (pay heads as a table per employee) and SAP IT0008 (one record per validity period).

- **Revisions, not edits.** Each change is a revision with an effective date and a reason, kept in the history; approved revisions are never edited or deleted. Payroll now uses the approved revision **in force at the end of the period**, not "the active row".
- **Tabs:** Structures (register, breakdown FactBox, history with % change and letter links; Revise window by Enter) · **Bulk edit** · Changes · Templates. `?employee=<id>` opens with that person selected (linked from the employee record and form).
- **Bulk edit:** a spreadsheet table (`components/kit/edit-grid.tsx`): rows from filters or picked employees, columns for basic, grades, scheme, every fixed-amount allowance and deduction, worked-out heads (Yes/No), gross, net and change; Excel keys (arrows, Tab, type to replace, F2, Ctrl+D fill down, Ctrl+C / Ctrl+V blocks with Excel incl. "1,20,000", Delete, Ctrl+Z / Ctrl+Y), mouse range selection, changed cells marked with the old value, errors in red, level-start warnings; column chooser; apply a template to selected rows; CSV template download and import (matched by employee code and header; unknown codes / columns listed); totals footer; Review window before Submit.
- **Second-person approval** (setting on by default): changes wait in **Changes** until someone else with the new Salary structure → **Approve** accepts them (typed `APPROVE`) or rejects them with a reason; the preparer can withdraw. A starting salary on hire and grade-policy syncs are approved at once and recorded as batches.
- **Templates** by level and / or designation; **revision letter** (A4 print page, English, previous / revised / change).
- **One owner for pay:** the employee form sets only the starting structure on hire; afterwards the Pay section is read-only with "Revise in Salary structure". The grade-policy re-sync creates a revision batch instead of editing rows.
- **Security S20:** View with employee scope on every read (the old data action had no check), Edit / Approve on writes, never approving your own change (`DENIED_SELF`), out-of-scope requests audited `DENIED_SCOPE`, no delete, every submit / decision / template / setting audited, `toActionError`, server-side reshaping (2,000 rows max, 2 MB CSV).
- **Database:** migration `0037_salary_revisions` (revision columns on `employee_salary_map`; `salary_change_batches`; `salary_templates`), applied to company databases by `ensureTenantSchema` on restart. Existing rows become approved revisions.
- Removed: the old salary-mapping screens (hero, KPI cards, 972-line modal, bulk form, delete dialog), `salary-mapping.actions.ts`, `salary-mapping.service.ts` and the mock data.

**Your review on the running app (fixes):** register headers no longer cut off (wider columns, "Gross"); text dates follow the BS/AD switch (new kit `useDateText()`), and the letter prints both calendars; history marks salaries recorded before revisions; onboarding's "Basic Salary" / "Grade Amount" label heads are no longer offered as allowances, but an amount already stored on one is shown with a warning (payroll pays it: Pramod's 3,500 keeps his net at 27,700, matching his payslip); Revise window: Save disabled until something changes, errors in the footer; Bulk edit: numbered "1 Employees / 2 Change details" strips, date line no longer spills, Code and Employee left-aligned with a pinned edge, Gross / Net grouped as money, "Pasted n cells" message, why Review is disabled, a typo guard for basic changes over 50%, review lines with old → new values and the employer cost change, amber (not red) import notes; Changes: "All statuses" filter label; Templates: basic shown as "level starting salary" instead of a disabled 0; letter: the company block printed (print styles hide header elements).

Verified: tsc 0 · eslint: nothing new · 494/494 tests (new `tests/edit-grid.test.ts`: Excel moves, ranges, TSV paste with quotes / CRLF, single-value fill, fill down, undo / redo, lakh-comma numbers, Excel CSV; `tests/salary-structure.test.ts`: head kinds, store / read back, totals with SSF on basic + grade and PF, grade policy vs by hand, validation, changed lines, batch sums, revision in force by month, approval rules, templates, CSV matching, S20 action checks, `DENIED_SCOPE`, payroll in-force read, server reshaping) · `next build` · Playwright on your data after the restart (migration 0037 applied; **nothing saved**: one accidental Enter on "Send for approval" with no changes was refused by the server, "Nothing changed"): Structures register, detail and history; Revise window by F2 and Enter (reason required stops Enter); Bulk edit by keyboard (type, Enter, "1,20,000", Ctrl+D fill down, Ctrl+Z, a 2 × 2 Excel paste), grade recalculation, CSV download and re-import (unknown code and column listed), Review window opened and closed; Changes and Templates tabs; letter on screen and in print preview; 1920 / 1366 / 1024 / 390 with no page overflow; 0 console errors on fresh loads. Known: at 390 px the date field's BS line runs ~25 px past the field (kit `DateField`, all forms).

Notes: arrears for back-dated revisions come with 4.8 (Payroll run). Import is CSV only (no `.xlsx` library added).

---

## 2026-10-03 — SSF on basic + grade (company setting)
Branch: `redesign/4.4-salary-structure` (first commit of 4.4)

Your rule (confirmed with seniors): SSF's 11% (employee) and 20% (employer), 31% deposited, are worked out on **basic + grade**, not basic only.

- **Where:** SSF is calculated in one place, the payroll engine; payslips, TDS (SSF retirement deduction), dashboard liabilities and reports all follow it. It is not stored in the salary structure.
- **Change:** new company setting **SSF contribution base** (Rules & controls → statutory limits): *Basic + grade (default)* or *Basic only*. The engine uses it for every employee (`ssfContribution()`), replacing the per-pay-head base. The fixed-amount SSF path is unchanged.
- **Effect:** new and draft payroll runs only; locked runs and issued payslips are never recalculated. Example: basic 30,000 + grade 3,000 gives employee SSF 3,630 and employer 6,600 (was 3,300 / 6,000); net pay falls by the extra 11%.
- The older hard-coded "basic × 20% / 31%" copies (employee save, old salary-mapping modal) are removed with the 4.4 rebuild.

Verified: tsc 0 · 460/460 tests (new: default basic + grade 4,950 / 9,000 on 40,000 + 5,000; basic-only option; pay head base no longer decides; helper).

---

## 2026-10-03 — Employee form: codes on one row; clearer "No"
Branch: `redesign/4.3-organization`

- General section: Full name has its own row, so Employee code and Attendance code always share the next row (2 or 3 columns); Gender moves after the codes. Enter order: name → employee code → attendance code → gender → date of birth.
- Yes / No fields: the chosen "No" is now a solid mid-grey with white text (`--switch-off`, 5:1) instead of a faint tint, so it reads as clearly as the green "Yes".

Verified: 456/456 tests · Playwright at 1536 (2 columns) and 1920 (3 columns): both codes on one row; Enter order as above.

---

## 2026-10-03 — Frame and forms: rail opens page lists; layout follows the space it has
Branch: `redesign/4.3-organization`

Your review: with the side panel open the employee form broke (codes and placeholders cut off, footer crowded); rail icons jumped to a fixed page (Workforce always opened Employees) instead of letting you choose.

- **Fixed in the design, not by hiding the panel:** forms now size by the width they actually have (container queries). `FormGrid` gives 2 columns from 50rem and 3 from 76rem of its own width; the section index sits beside the editor only from 66rem, otherwise it becomes "Jump to section"; the editor footer drops the key hints and field hint when narrow; code boxes keep their width with "Next free" beside them. Result: 3 columns at 1920, 2 columns at 1536 / 1366 / 1280 / 1024 with the panel docked, 1 on phones; no cut-off fields.
- **Rail:** an icon lists the module's pages to choose from (docked navigator switches module without leaving the page; otherwise a flyout over the page, closing on a choice, Esc, a click elsewhere or the same icon). Home opens directly. Alt+1…7 does the same and puts focus on the first page.
- **Organization windows** are wide enough for two columns (xl).
- **Language rule** confirmed: Nepali only where genuinely required, after asking.

Verified: tsc 0 · eslint: nothing new · 456/456 tests · `next build` · Playwright: form columns and cut-off check at 1920 / 1536 / 1366 / 1280 / 1024 / 390 with the panel docked; rail docked (Time & Leave listed without leaving Organization, choosing Leaves navigates, Alt+2 focuses Employees) and undocked (flyout, outside click and same icon close it); 0 console errors.

---

## 2026-10-03 — 4.3 Organization: review fixes (pop-ups, layout, English only)
Branch: `redesign/4.3-organization`

Your review: the Province list was cut off inside the New branch window; check the whole module for other UI / UX issues; no Nepali text for now (recorded as a design rule).

- **Pop-ups never clipped (kit-wide):** Combobox, SelectField, PhoneField and DateField lists are placed on the screen (`lib/kit/popup.ts`, `usePopupPosition`) instead of inside the field, so a Window's scrolling body or a grid can't cut them off. They open upwards when they don't fit below, sit right on the field, are at least as wide as the field (wider for long names such as "Sudurpashchim Province"), and line up with the field's right edge near the right side of the screen.
- **Windows:** the white strip between the title and the grey form panel is gone; the department Head shows a typed older name as the placeholder ("Chief Accountant (typed) – pick an employee") instead of a wrapping note; the Level window pairs Code / Level number, Name across, Starting / Maximum salary; the Employment type window groups SSF / PF / festival / leave / OT under "Eligible for" and notice / probation / order under "Terms", and shows 0 instead of an empty box (`NumberField showZero`).
- **Detail pane:** the record's name was shown twice; once now.
- **English only (design system §7 "Language"):** no Nepali on screens: removed the Nepali label / Nepali name columns, fields and facts from Levels and Employment types, Nepali hints from province / district / level pickers (a district now shows its province), and Devanagari from remote-area categories. Stored Nepali values are kept for the later translation pass. Other modules drop theirs when they are migrated; Nepali is added only where required, after asking.

Verified: tsc 0 · eslint: nothing new · 453/453 tests (new: pop-up placement below / above / right edge, every kit pop-up uses it, no Devanagari in the Organization and Employee screens) · `next build` · Playwright at 1300×560 (your screen): Province, Remote area and country lists fully visible from the New branch window; Level, Employment type and Department windows checked; employee form lists and calendar placed correctly; 0 console errors on a fresh load.

---

## 2026-10-03 — 4.3 Workforce: Organization
Branch: `redesign/4.3-organization` (stacked on `redesign/4.2-employees`)

Your decisions: departments are company-wide (optionally limited to some branches); both a structure view and a reporting chart; grade levels and employment types move into Organization; the department head is picked from employees.

- **One module, seven tabs:** Structure (branch × department headcount, department → designation tree), Reporting (who reports to whom), and registers for Branches, Departments, Designations, Levels, Employment types, each with a FactBox detail pane and a Window editor (Enter to next, unsaved-changes guard). The old hub (hero, KPI cards, modals) is gone, and Company setup's branches / departments / designations / Shreni / employment types now open these tabs.
- **Never deleted while in use:** delete only for unused records; otherwise Make inactive (kept on records, hidden from new choices). Renames of levels and employment types move the employees holding them.
- **Department model (migration `0036`, also applied by the company-database schema sync):** `branch_ids` (empty = all branches) and `head_employee_id`; existing departments become company-wide; typed head names matching exactly one employee are linked. The employee form lists Branch first and offers only departments open to it; the save checks placement.
- **Security S19:** company-wide role required for changes; audit of every change; no raw errors; no writes on page load (the name-guessing designation sync and the level-name reset are removed).

Also: the status bar named whichever branch the database returned first; it now names the head office.

Verified: tsc 0 · eslint: nothing new · 448/448 tests (new `tests/organization.test.ts`: delete blockers, company-wide departments and placement checks, matrix totals, reporting tree with loops / inactive supervisors / unassigned, validation for all five masters, server-side input reshaping, rename cascades in a transaction, one head office, S19 authorisation / audit / no raw errors, no writes on read) · `next build` · Playwright on your data (nothing saved or deleted):
- Structure: Finance & Accounts 2 and Human Resources 1 at Head Office, total 3 (matches the employee register)
- Reporting: Kushal under Pramod; Sumina flagged as having no supervisor and no team
- Branches: Pokhara Side Branch shows "Not used anywhere yet", so Delete is offered; Head Office keeps Delete and Make inactive off
- New department Window by Enter only: code (DEPT-001 suggested) → name → head → All branches → branch boxes → description → Save; Esc asks to discard
- Branch Window: address row fits (two rows inside the Window, one row on the employee form)
- Employee form: Branch → Department → Designation; departments offered for the chosen branch
- old links (`/workforce/departments`, Company setup Shreni) open the right tab; no page overflow at 390 / 1024 / 1440 px; 0 console errors

---

## 2026-10-03 — 4.2 Employees: country code, province, permission-controlled grade, "Is supervisor"
Branch: `redesign/4.2-employees`

Your review: the original form had a country-code drop-down on the mobile, a Province field in the address, a fully dynamic grade with manual control by permission, and "Is supervisor" (more than approving leave).

- **Mobile and home phone:** kit `PhoneField`: a country button (`NP +977`) with a searchable list of every country (Nepal first), joined to the number; typing `+91…` switches the country. Mobile must be a real mobile (Nepal: 10 digits starting 96/97/98; other countries by the phone library's mobile rules); landlines go in Home phone. Records show numbers formatted (`+977 984 1234567`).
- **Address:** Province is back first; District is narrowed to it; picking a district first still fills the province; ward 1–35.
- **Grade:** the Pay section needs **Salary mapping → Edit** (checked on the server); without it pay is read-only. The server works the grade out from the company grade policy (`resolvePay`) unless "Grade by hand" is Yes, stored in the new `employees.grade_manual` column (migration `0035`, also added by the company-database schema sync). A calculation strip shows policy, one grade, grades paid (cap warning), formula and total base. Policy re-syncs skip hand-typed grades and no longer zero grades under the "typed in" policy; the salary-mapping form no longer recalculates a hand-typed grade and names the real policy instead of "Basic / 30 rule". The record's Pay card says how the grade is worked out.
- **Supervisor:** "Is supervisor" (supervisor / line manager) replaces "Approves leave"; the supervisor field reads "Reports to".
- **Not done (your choice):** no new employee fields this round. Not kept from the plan: the form does not fall back to the level's starting salary for the grade when basic is 0; it says "Enter the basic salary first", matching what the server saves.

Verified: tsc 0 · eslint: nothing new · 425/425 tests (new: Nepal mobile rule and landline refusal, other countries' mobile rules, split/join of stored numbers, country list and search, province cascade, ward 1–35, grade breakdown per policy and cap, `resolvePay` incl. a hostile browser without pay permission, re-sync skipping hand-typed grades, labels) · `next build` · Playwright on your data:
- Pramod's Pay: 3 grades → `30,000 ÷ 30 = 1,000 × 3 = 3,000`, total 33,000; 12 grades → "only 10 are paid"; by hand 4,500 → "Policy would give NPR 10,000" (nothing saved)
- phone: country search "india" + Enter returns to the number; typing `+61 412…` switches to AU; `01-4412345` refused on Enter with the 96/97/98 message; a valid mobile moves on to Home phone
- province: Bagmati clears Kaski and lists Bagmati's 13 districts
- record: mobile shown `+977 987 4562125`, Pay card "Grade worked out", "Supervisor: Yes", no "Approves leave"
- no page overflow at 390 / 1024 / 1440 px; 0 console errors
- not checked in the browser: a login without Salary mapping → Edit (covered by tests)

---

## 2026-10-03 — 4.2 Employees: legibility, original date picker, payroll-style record page
Branch: `redesign/4.2-employees`

Your review: bring back your original date picker; make label vs field clear at first glance; research a better, eye-catching detail layout like payroll software.

- **Why fields were hard to see:** their outline was `#C6D0C2` on white, about 1.5:1, under WCAG 1.4.11's 3:1, and labels were small grey text close in weight to values.
- **Desktop-dialog legibility (your choice):** labels right-aligned, darker, medium weight, on a grey panel; white fields with a `#7F8A79` outline (3.6:1 on white, 3.3:1 on the panel); brand outline and ring on focus; 30px rows; current row tinted with a left marker. The read-only style no longer hits drop-downs (buttons match `:read-only`).
- **Original date picker restored:** eraser, "AD Equivalent … B.S. CALENDAR" line, green-header calendar with Month / Year drop-downs; opens left near the edge; keyboard behaviour kept. Age and service moved to the form's record card so date rows stay one line.
- **Record page:** identity column (BambooHR / greytHR), Overview tab with headline tiles (Zoho Payroll), Profile tab as topic cards with bold values under small labels (Keka / greytHR), Edit link per card opening the editor at that section. Header strip and FactBox pane removed (content moved).

Verified: tsc 0 · eslint clean · 406/406 tests (new: outline contrast computed from the tokens, read-only scoping, date field tree) · `next build` · Playwright on your data:
- the full keyboard flow from Full name to Save
- date picker by mouse (click opens, Month drop-down to September keeps focus, day click then Enter moves on, eraser clears)
- Overview tiles (Pramod: base 30,000, last net 27,700, leave left 72 days)
- Profile cards
- Bank card "Edit" opens the form at Bank with the field focused
- no overflow at 390 / 1024 / 1440 px; 0 console errors

---

## 2026-10-03 — 4.2 Employees: card-page polish (form and record page)
Branch: `redesign/4.2-employees`

Your ask: make the form and the full-page record more like desktop software, more structured, with proper design concepts.

Patterns applied (desktop ERP card pages, Business Central / SAP Business One):
- **View mode mirrors edit mode:** the Profile tab now uses the editor's numbered group boxes, columns and field widths, with values in read-only boxes, so every field sits in the same place when reading and editing.
- **Numbered group boxes with progress** ("2 Job & placement · 1 of 6 required"), repeated in the section index.
- **Record header:** the record page shows key facts (no repeated name) and a **record navigator** "◀ 2 of 3 ▶" (Alt+PgUp / Alt+PgDn, keeps the tab); the editor shows a live card (initials, name as typed, codes, placement) with a required-fields meter.
- **Folder tabs** joined to the content frame.
- **FactBox pane** beside every tab: records to fix, last payslip, attendance this month, leave left, loans, login; each permission-gated, each links to its tab.
- **Status bar** in the editor footer: field hint · required left · save state · keys. **Current-row highlight.** **F6 / Shift+F6** between sections.

Kit: `FormGroup`, `ViewField`, `StatusBar` + `Kbd`, `RecordNavigator`, `Tabs variant="folder"`, SectionIndex counts and F6. Server: register-order ids within scope for the navigator; FactBox summaries loaded with the page.

Verified: tsc 0 · eslint clean on new code · 403/403 tests · `next build` · Playwright on your data: Profile view matches the editor; FactBox figures (Pramod: last payslip Shrawan 2083 net 27,700, attendance 6 present / 11 no entry, leave left 72 days); Alt+PgDn moved to the next employee on the same tab; Enter flow, F6 / Shift+F6 and the row highlight on the form; no overflow at 390 / 768 / 1024 / 1280 / 1440 px; 0 console errors.

---

## 2026-10-03 — 4.2 Employees: review round (no delete, status switch, compact form, Enter fixes)
Branch: `redesign/4.2-employees`

Your review: table good, but add View / Edit / Active-Inactive actions and never allow deleting an employee; the form wastes space on the right and its fields are too wide; Enter does not work properly on drop-downs, dates and checkboxes.

Research: SAP Fiori form layout (responsive 12-column form grid, label/field ratio, empty columns so inputs do not stretch) and Business Central FastTabs (fields flow into two or more columns, captions left). The banking form you shared (multi-column label/field pairs, Yes/No drop-downs, tabs) informed the density and the Yes/No answers; the section index stays instead of tabs so Enter can run through the whole record.

Changed:
- **No delete, status switch:** the Actions column (View, Edit, Active/Inactive switch) and the toolbar / record page "Make inactive / Make active" open a status window. Inactive records the separation and switches the login off; active clears it and switches the login on. Delete is gone from the UI, action, service and repository. Status left the edit form (S18 updated).
- **Compact form:** `FormGrid` / `GridField` (1-2-3 columns, captions left, 28px rows, widths by data), documents as a small table, the address on one row (two below 1280px), help in the footer status line, live hints beside fields (age, service length, below-scale salary), "Grade by hand" and "Temporary address: Same / Different" as Yes/No.
- **Enter fixes (reproduced first):**
  - a valid date made "Age 31" appear, which remounted the date input and dropped focus, so the next Enter went nowhere: GridField now keeps one element tree;
  - typing some dates crashed the whole form (the BS library throws outside its range): conversions are guarded and typing is limited to BS 1976–2099 / AD 1920–2042;
  - native drop-downs opened with the mouse swallowed Enter: replaced by the kit `SelectField`;
  - clicking an empty searchable list and pressing Enter silently picked the first option: now it only highlights the current value;
  - clicking a calendar day lost focus: focus returns to the field;
  - checkboxes replaced by `YesNoField`;
  - Enter on a half-typed date now says "Finish the date" instead of moving on with the old value; opening the calendar and pressing Enter no longer fills in today.

Verified: tsc 0 · eslint clean on new code · 403/403 tests (new: no-delete and status-action invariants, separation rules, type-ahead, out-of-range dates, stable grid tree) · `next build` · Playwright on your data: the whole new-employee form by keyboard from Full name to Save, all sections ticked; mouse-then-Enter on every control type; the status window by keyboard (opened and cancelled, not submitted); no overflow at 390 / 1024 / 1280 / 1440 px; 0 console errors.

Not done (needs you): actually making someone inactive and active again, and saving a new employee (both change your real data; a login email is sent unless "Create a login" is No).

---

## 2026-10-03 — 4.2 Employees: register, record page, full-page editor (sign-off pending)
Branch: `redesign/4.2-employees` (stacked on `redesign/4.1-home`)

Decisions (your answers): quick view beside the list **and** a full record page; one scrolling form with a section index; read-only related-history tabs; Enter moves to the next field once the current one is complete.

Security (S18, step 1): scoped loader for every employee read/write (out of scope = "not found", audited), placement checked on create and update, audit of create / update (field names only) / delete / credential resets, escaped search, slim list rows with masked bank account, no PII in browser storage, `toActionError` everywhere.

Changed:
- **Kit (step 2):** Enter-to-next for `PropertyForm`, `Combobox`, `DateField`, `NumberField`, `SectionIndex`, `useUnsavedGuard` + `DiscardBar` (Window reuses it), `scrollIntoContainer`; FilterStrip `/` focuses search; Confirm keeps line breaks in errors; `/dev/kit` demo.
- **Register (step 3):** server-rendered `EmployeeListRow` grid, URL filters, quick view, Records column and amber edge, typed delete confirmation. KPI cards, the fake Import button and 7 old components are gone. The command palette and the dashboard's "Records to fix" open the record page.
- **Record page (step 4):** summary strip with tenure; Profile / Leave / Attendance / Payslips / Loans / History tabs, each permission-gated and loaded on its own; in-frame "Employee not found".
- **Editor (step 5):** one form replaces the 5-step wizard (≈3,000 lines): sections in Enter order, error summary, Save & add another (keeps branch, department, category, joining date), company-wide duplicate-code check, shreni starting salary, automatic grade amount, district-first address with the province filled in, "same as permanent", account number typed twice when new or changed, phones saved as E.164.

Verified: tsc 0 · eslint clean on new code (remaining findings are pre-existing `any`s in repositories) · 396/396 tests (new: `security-employee-access`, `employee`, `kit-form-nav`) · `next build` · Playwright, signed in, on real data:
- Register: filters, URL filter restore, `/` search, quick view, Enter opens the record; the browser never receives PAN, citizenship, family, address or full account number.
- Record: every tab; Shrawan 2083 payslip (gross 39,500, SSF 9,300, deductions 11,800, net 27,700); attendance 17 days to 17 Aswin (6 present, 11 not recorded); unknown and malformed ids show "Employee not found".
- Editor, keyboard only: every field from code to role. Empty required, bad PAN, bad email, missing district and a mistyped account number each block Enter with their message. Comboboxes pick and move on, Shift+Enter goes back, the last field lands on Save, Ctrl+S lists what is missing and focuses it. The leave guard holds a link click.
- Edit form loads the real record (legacy shreni kept), is not "Unsaved" until something changes.
- No overflow at 390 / 1024 px; 0 console errors.

Not done here (needs you): saving a test employee and deleting it (it writes to your database and would email a login unless "Create a login" is off); a branch-scoped login check.

Fixed along the way: `scrollIntoView` scrolled the whole app frame when jumping to a section; the sticky footer let content show beneath it.

---

## 2026-10-03 — 4.1 dashboard: page scroll fix, latest-only cards, framed cards (sign-off pending)
Branch: `redesign/4.1-home`

Fixed (your review: the page scrollbar stopped working with the mouse over a card):
- **Cause:** the card scroll areas used `overscroll-behavior: contain`. An `overflow:auto` box is a scroll container even when nothing overflows, so the wheel was swallowed and the page never moved.
- **Fix:** dashboard cards no longer scroll inside. Each shows the latest items that fit, with a link to the full list:
  - activity 6 (was 8) and upcoming 6 (was 8)
  - departments top 6 + "Other" (was 8), headcount 6, leave types 5, on leave today 4
  - approvals 5, unchanged
  
  The kit `Panel` scroll option keeps no wheel containment, for registers that need it later. The department table header is no longer sticky.
- **Verified:** the wheel over every card scrolls the page (activity, coming up, approvals, department cost, both charts); 0 inner scroll areas on the dashboard.

Changed (darker separation):
- **New token `--border-card` (#ADB8A8)**, used via `border-line-card`. It sits between `line-strong` and `neutral-400` and outlines every card, KPI card and the pay run banner.
- **Card title bars** are tinted (`bg-canvas/70`) with a `line-strong` rule underneath. Like a desktop window, each card reads as a framed unit; the dividers inside stay light.
- The thin scrollbar uses the card outline colour. The loading skeleton matches.

Verified: `tsc` 0, lint clean on touched files, 359/359 tests, build OK. Rows equal on real data (233 / 234 / 352 / 218 px) and the preview. No overflow at 390px, 0 console errors.

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

## Phase G hardening (senior review)
- Exit Complete deactivates the employee's user login (`completeCaseTx`); `/iclock` negative serial cache. Tests in `security-exit` / `security-devices`. Verification: tsc 0, touched tests pass, lint clean. No migration.

- Exit case shows welfare-fund balances held (`exitFacts.funds`, read-only; payout stays under Funds). Verification: tsc 0, 947/947 tests, lint clean. No migration.
- Exit Complete is blocked while a welfare-fund balance is held (`completionBlockers` fundsHeld). tsc 0, tests pass.

## G8 Disciplinary & grievance
- Migration `0055_discipline` (`hr_cases`, append-only `hr_case_events`, DISCIPLINE permission module; mirrored in `ensureTenantSchema`; restart the dev server). Engine `case.engine.ts`, service/repository/actions, `/workforce/discipline`. S34: nobody works or even sees a case about their own record (audited `DENIED_SELF`); status changes claim-first; termination only recommended. Verification: tsc 0, 966/966 tests, lint clean on touched files. Build: CI.

## G7 Training
- Migration `0056_training` (`training_programs`, `training_participants`, TRAINING permission module; mirrored in `ensureTenantSchema`; restart the dev server). Engine `training.engine.ts` (planned → running → completed / cancelled; attended / absent / completed with score 0–100 and certificate; service bond end date derived with day clamping), service/repository/actions, `/workforce/training`. S35: nobody nominates themselves or marks their own record (`DENIED_SELF`); scope on every participant read. Exit case now lists running training bonds (read-only, not a blocker). Verification: tsc 0, 980/980 tests, lint clean on touched files. Build: CI.

## G13 HR analytics
- `/reports/hr-analytics`: headcount by branch / department / designation / category / age band with gender split, movement (joined, left, turnover on average headcount), tenure, leave usage, case counts (DISCIPLINE VIEW only), and the DoC / COPOMIS staff return (कर्मचारी विवरण) with gated CSV export. Engine `hr-analytics.engine.ts`; every query scoped; no pay columns (S36 test). No migration. Verification: tsc 0, 991/991 tests, lint clean on touched files. Build: CI.

## G14 Assets & notice board
- Migration `0057_assets_notices` (`assets`, `asset_handovers`, `notices`, ASSETS + NOTICE_BOARD permission modules; mirrored in `ensureTenantSchema`; restart the dev server). Assets: register, claim-first issue / return (lost retires), handover history, exit facts + Complete blocker. Notices: company / branch audience, publish window, pinned, withdraw (never delete); the Home dashboard shows each reader their board (`boardFor`). Verification: tsc 0, 1005/1005 tests, lint clean on touched files. Build: CI.

## G11 Travel / TA-DA
- Migration `0058_travel` (`travel_rates`, `travel_claims`, TRAVEL permission module — HR Manager VIEW/ADD/EDIT/APPROVE, Payroll Controller VIEW/LOCK; mirrored in `ensureTenantSchema`; restart the dev server). Engine `travel.engine.ts` (inclusive days, days × DA, lodging capped at nights × ceiling, fare or km × rate, minus advance; paisa arithmetic), amounts frozen on the claim; draft → submitted → approved / rejected / returned → settled, claim-first. S38: nobody decides or settles their own claim. Screen `/payroll/travel` with live preview. Verification: tsc 0, 1017/1017 tests, lint clean on new files (seed-rbac has pre-existing `any` errors). Build: CI.

## Darbandi enforcement (G4 follow-up)
- `lib/services/darbandi.service.ts` (`checkPlacement`) runs before the employee save and before a lifecycle event is written; `system_config` key `darbandi.enforce` = off | warn | block (default warn), changed on the Recruitment → दरबन्दी tab (RECRUITMENT EDIT, audited). Warnings ride along with the save result (`darbandiWarning` / event `letterWarning`). No migration. Verification: tsc 0, 1022/1022 tests, lint clean (one pre-existing unused-import warning).

## Promotion ranking (G1 / G2 follow-up)
- `lib/engines/promotion.engine.ts`: composite = का.स.मू. average of the latest N finals × share + seniority in post (since the last applied promotion, else joining; capped) × share + completed training hours (capped) × share − penalty per disciplinary outcome (24 months); weights per company in `system_config` `promotion.weights` (sum 100, default 60/30/10). Ranked per designation, computed on read. Screen `/workforce/promotion` (PERFORMANCE VIEW; weights PERFORMANCE LOCK, audited); "Record promotion" deep-links to `/workforce/lifecycle?new=promotion&employee=…` (EMPLOYEES EDIT; S27 and darbandi apply there). No migration. Verification: tsc 0, 1032/1032 tests, lint clean.

## Payroll accuracy (4.8, two known bugs)
- Run totals: `payroll.repository.refreshRunTotals(runId)` recomputes `total_*` and `employee_count` from the payslips in one SQL statement, called AFTER each slip-changing transaction commits (`overridePayslipAllowanceDeduction`, `deleteEmployeePayslip`, `recalculateEmployeePayslip`, hence also attendance sync). Before, the sum ran through a second connection inside the transaction and missed the slip being changed (Shrawan 2083: 62,068.75 vs 68,068.75). Hand-summed `updatePayrollRunTotals` calls removed.
- Tax slabs: payroll now loads `findSlabsByFiscalYear(run's year)` instead of every year's slabs (`findAllSlabs`), in generation, override and recalculation. `tests/payroll-run-totals.test.ts` guards both. Verification: tsc 0, 1035/1035 tests; payroll.service lint count unchanged (pre-existing `any`s).

## Probation gating (G1 / G2 follow-up)
- `confirmationGate` in `employee-event.engine.ts`: a confirmation (स्थायी) cannot take effect before the employment type's `probationMonths` from joining (blocked, field error); a missing final का.स.मू. evaluation only warns. Wired into `createEvent`. tsc 0, 1038/1038 tests, lint clean.

## Phase G screen verification (local PostgreSQL 16, seeded demo company)
- Signed-in pass at 1440 / 1024 / 390 over discipline, training, assets, notices, promotion, travel, HR analytics, exit and the dashboard: every page 200, no runtime errors, no horizontal scroll. Interactive flows exercised against the database: notice → dashboard board; asset register → hand over (claim-first); TA-DA rate card → claim (preview and stored amounts 9,400 gross / 6,400 payable) → approve; disciplinary case → decision; training programme → nomination; promotion ranking and analytics case count; exit case facts (asset out, bonds, funds). Fix from the pass: opener / author / actor names fall back to the email when `users.name` is empty (exit, cases, notices, travel). Restricted-role pass done with a BRANCH-scoped HR login (Lekhnath, whose own employee record is in scope): discipline, promotion, training, travel and exit show only Lekhnath staff; the case about the login's own record is invisible and the person cannot be chosen as a subject; training nominees exclude head-office staff; HR analytics answers Access Denied without EMPLOYEES VIEW.

## Payroll feeds (4.8): TA-DA and welfare fund on the payslip
- Migration `0059_payroll_feeds`: `travel_claims.payroll_run_id` and two system pay heads `TADA` (allowance, not taxable) and `WELFARE_FUND` (deduction), mirrored in `ensureTenantSchema`. `lib/repositories/payroll-feeds.repository.ts` picks approved, unpaid claims whose trip ended by the period end (summed per employee) and the month's fund employee contributions (exact `contrib:<code>:<yyyy>-<mm>` ref); generation adds them as manual-override heads, settles the claims **after** the run commits (claim-first), and deleting a draft run releases them. `tests/payroll-feeds.test.ts`. Verified the feed queries against the demo database (12,800 picked for Aswin, none for Bhadra). tsc 0, 1042/1042 tests.

## G12 Self-service in Nepali + new portal pages
- `lib/i18n/ess.ts` (EN/NP dictionary, `t(lang, key)`), cookie `ess_lang` read by `essLang()`; toggle in the portal nav. Home, nav and the new pages read it; office screens stay English. New pages: `/self-service/my-notices` (the board), `/self-service/my-training` (own nominations, score, certificate, bond end), `/self-service/my-claims` (own TA-DA claims; submit → the office approves; amounts from the card). `lib/services/ess-extras.service.ts` pins everything to the session employee (S40 test). Travel rule added from the portal pass: a claim is made within a year of the trip. Verified live at 1440 / 390 in both languages, including a claim submitted from the portal. tsc 0, 1047/1047 tests, lint clean.

## Phase G hardening — final gate
- `npm run build` (webpack, cpus 1) compiles clean with every new route (`/workforce/discipline`, `/workforce/training`, `/workforce/assets`, `/workforce/notices`, `/workforce/promotion`, `/payroll/travel`, `/reports/hr-analytics`, `/self-service/my-*`) and the postbuild standalone copy; the sandbox needed Google Fonts stubbed (network), which CI does not. tsc 0, 1047/1047 tests. Deploy: `scripts/sync-schema.ts` applies migrations 0055–0059 per company; set nothing new in `.env`.

## Login only, employee dossier, notice audiences (branch `feature/employee-dossier-letters`)
- Home page removed: `/` redirects to `/login` (or the signed-in landing); the login page is one clean card.
- 4.2c Dossier — migration `0060_employee_dossier`: `employee_qualifications`, `employee_work_history`, `employee_attachments` (+ `employee_document_files.attached_to`), saved inside the employee transaction with the form's new "Qualifications & history" tab; scans use the same upload route and are claimed on save. `tests/employee-dossier.test.ts`.
- Notice audiences — migration `0061_notice_audience`: `notices.audience` (company | branch | department | employees), `notices.department_id`, `notice_recipients`. Named recipients must be active employees in the poster's scope (S41); a reader sees company notices, their branch / department notices and notices that name them — an administrator does not see other people's individual notices. Form: "Send to" + picker. Verified live: department notice not shown to another department, individual notice only to the named employee (self-service and Home). tsc 0, 1058/1058 tests.

