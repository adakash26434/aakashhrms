# 06 — Full-HRMS Gap Analysis (sahakari focus)

Research date: 2026-10-09. `05-functional-research.md` covered **payroll**
depth; this doc covers the rest of a **full HRMS for Nepali cooperatives
(sahakari)** — from employee evaluation to device integration — benchmarked
against the Nepali products cooperatives actually buy and current
international practice. Stack, layering, kit components, form design and the
phase workflow stay exactly as they are; everything below is specified to be
built the way 4.1–4.6 were built.

## 1. Reference products & what we borrow

| Product | Notable features | What we take |
|---|---|---|
| **Nimble OfficeHRM** ([HRMS/payroll](https://nimble.com.np/hrms-payroll-software)) — the de-facto standard in Nepali MFIs, development banks and large sahakari | **Darbandi** (approved-position) tracking + manpower request approval; recruitment with job board and offer letters; service history + letter templates; grievances; training records; **performance appraisal: KPI/goal mapping, custom forms, self + multi-layer review, 360°, outcomes linked to promotion / increment / confirmation**; training automation (TNA → nomination → pre/post assessment); exit with multi-unit clearance and F&F; payroll **provisions** (leave / medical / gratuity); voucher posting to **Pumari, MFin, FinPro** (sahakari core-banking packages); TA-DA; GPS field-staff tracking | The sahakari feature checklist: evaluation tied to promotion/confirmation, darbandi, clearance-based exit, provisions, core-banking vouchers |
| **RigoHR** ([HR software](https://rigohr.com/hr-software/)) | Career progression as **job events**; JD + **KSA** per designation with employee acceptance; disciplinary records; transfer requests; manager journal feeding reviews; 1-on-1s; LMS; maker-checker on data changes; configurable multi-level approval flows with rerouting; ~90% of features on mobile | Lifecycle-as-events model (never edit-in-place), KSA on designations, approval-flow reuse |
| **eHajiri / HajirHR** ([eHajiri](https://ehajiri.com.np/), [HajirHR](https://hajirhr.com/hrms-software-nepal/)) | Real-time **auto-sync of ZKTeco face / fingerprint / palm / card devices**, multi-branch, flexible shifts, dual calendar, auto email alerts | Device integration bar: punches must arrive by themselves; manual import is the fallback, not the product |
| **Nepali civil-service का.स.मू. forms** ([MoHA forms](https://www.moha.gov.np/page/performance-evaluation), [half-yearly form](https://daodarchula.moha.gov.np/post/half-yearly-work-editing-evaluation-form)) | Marks-based evaluation: self → supervisor (सुपरिवेक्षक) → reviewer (पुनरावलोकनकर्ता) → committee, fixed weight split, half-yearly/annual cycles, marks carried into promotion scoring | Sahakari staff bylaws copy this structure almost verbatim; our form templates must express it |
| **ZKTeco ADMS / iclock push** (e.g. [Odoo ADMS module](https://apps.odoo.com/apps/modules/17.0/zkteco_adms_attendance)) | Device pushes `ATTLOG` lines over plain HTTP(S) to `/iclock/cdata?SN=…`; server replies `OK`; a command queue (`getrequest`) lets the server manage users/time | The integration shape that works on cPanel: an inbound route handler, no polling daemon |

## 2. Sahakari context the system must model

These come from how cooperatives are actually run (staff service bylaws —
कर्मचारी सेवा विनियमावली — under the Cooperative Act/[Rules 2075](https://lawcommission.gov.np/content/13046/13046-cooperative-regulation-2075/)):

1. **The bylaws are the configuration.** Each sahakari's board passes its own
   grades, scales, promotion rules, allowances, welfare funds and leave
   extras. Nothing bylaw-shaped may be hardcoded; everything is a company
   setting with an effective date and an approval trail (the 4.6c pattern).
2. **दरबन्दी (approved positions).** The board/AGM approves posts per branch
   and level. Hiring, promotion and transfer all consume or move darbandi.
3. **Promotion is scored**: seniority (ज्येष्ठता) + education + का.स.मू. marks
   + sometimes geographic service. An evaluation module that doesn't output
   **marks usable in a promotion score** misses the point.
4. **Probation → confirmation (स्थायी)** needs an evaluation + a decision
   letter; contract staff need renewal alerts.
5. **Staff credit culture**: subsidized staff loans (exists), welfare fund,
   medical fund, gratuity provisions — funds that accrue per month and pay
   out at events (the leave-ledger pattern fits exactly).
6. **Core banking is the GL.** Pumari / MFin / FinPro import vouchers;
   payroll must export in their formats (extends F12 beyond Tally).
7. **Regulator reporting**: Department of Cooperatives / COPOMIS annual
   returns include staff details; an export that matches saves days.
8. **Field staff** (loan officers, collectors): GPS check-in (4.5c has the
   base), daily task reporting, TA-DA claims.
9. **Language**: committee members and field staff read Nepali. ESS and
   printed letters need Nepali first; the admin side can stay English.
10. **Letters are records.** Appointment, confirmation, promotion, transfer,
    experience letters carry **chalani (dispatch) numbers** and are audited.

## 3. Where AakashHRMS stands (module map)

| HRMS area | Status |
|---|---|
| Core HR: employee record, documents + photo, org structure, grades, employment types | ✅ 4.2/4.2b/4.3 |
| Attendance: day rules, shifts, roster, web check-in with IP/geo | ✅ 4.5a–c |
| Leave: ledger, entitlements, statutory guard-rails, company types | ✅ 4.6a–e |
| Salary structure with dated revisions + approval engine | ✅ 4.4/4.4b |
| Payroll depth (variance, arrears, F&F, off-cycle, statutory files, tax projection…) | 🔜 planned F1–F17 |
| Self-service portal | 🔜 Phase 5 |
| Notification centre, compliance calendar, bilingual payslip | 🔜 F17 / F10 / F11 |
| **Biometric device integration** | ⚠️ named "later" in 4.5, no spec — `attendance_punches` is ready for it |
| **Performance evaluation (का.स.मू. / KPI)** | ❌ missing entirely |
| **Lifecycle events: promotion, transfer, acting, confirmation** (as records, not edits) | ❌ missing (`employee_termination` exists; nothing else) |
| **HR letters with templates + chalani numbers** | ❌ missing |
| **Recruitment & darbandi** | ❌ missing |
| **Training** | ❌ missing |
| **Disciplinary & grievance register** | ❌ missing |
| **Exit workflow: resignation → clearance → F&F** | ❌ missing (F8 covers only the settlement math) |
| **Welfare/medical/gratuity funds & provisions** | ❌ missing |
| **Core-banking voucher formats (Pumari/MFin/FinPro)** | ❌ (F12 is Tally/CSV only) |
| **Scheduled automation** (reminders, expiries, auto-emails) | ❌ no job infrastructure at all |
| **Nepali-language ESS / letters** | ❌ (F11 payslip only) |
| **HR analytics: turnover, leave liability, headcount vs darbandi** | ❌ (dashboard is payroll/attendance-centric) |

## 4. Recommended additions — Phase G (grouped, prioritised)

Same rules as Phase F: one branch per item (`feature/<slug>`), engines pure
and unit-tested first, templates A–F from the design system, kit components
only, approval flows through `approval.engine.ts`, schema per the PG10 rules
with `ensureTenantSchema` mirroring.

### Tier G-A — the sahakari core (do first)

**G1 Performance evaluation (का.स.मू.)** — template A + B + Worklist
- `evaluation_cycles` (period = fiscal year or half-year, opens/closes like
  attendance months), `evaluation_templates` (versioned; sections → criteria
  → max marks; per-level weight split e.g. self 0 / supervisor 60 /
  reviewer 25 / committee 15), `evaluations` (one per employee per cycle,
  status draft → self → supervisor → reviewer → committee → final),
  `evaluation_scores` (per criterion per rater).
- Engine (`evaluation.engine.ts`): weighted totals, rounding rules,
  grade bands (उत्कृष्ट / अति उत्तम / …), validation that raters differ and
  **never rate themselves** (S21 pattern via `isOwnRecord`).
- KPI mode: criteria can be goal rows (target / achieved / weight) for
  manager-level staff; same tables, `kind` column.
- Outputs: marks feed a **promotion score** (G2) and a **confirmation
  recommendation** (probation cycles); printable filled form (bilingual).
- Approval chain reuses `approval.engine.ts` routes; Worklist UI for raters.

**G2 Lifecycle events + HR letters** — template A + B
- `employee_events` (kind: hire, confirmation, promotion, transfer, acting,
  grade change, contract renewal, suspension, separation; effective date,
  from → to values as JSON, reason, approval route, letter id). The employee
  record's "related history" tab reads this; nothing edits designation /
  branch / grade in place any more — a saved event applies the change on its
  effective date (the 4.4 dated-revision pattern).
- `hr_letters` + `letter_templates`: merge-field templates (employee, event,
  company), **chalani number** sequence per fiscal year, issued-by, printable
  (bilingual), stored like 4.2b documents. Appointment / confirmation /
  promotion / transfer / experience / NOC presets.
- Probation: `employees.probation_end` + confirmation event gated on a G1
  evaluation where the template demands it.
- Transfers consume/release **darbandi** (G4 table; nullable until G4 ships).

**G3 Device integration (ZKTeco ADMS push)** — template A + E; promotes the
4.5 "Devices later" line into a spec
- `attendance_devices` (name, branch, serial no, shared secret, last-seen,
  timezone), `device_users` (device user-id ↔ employee).
- Route handlers `app/api/devices/iclock/cdata` + `getrequest` (`proxy.ts`
  already skips `/api`; handlers do their own secret + size checks like
  4.2b file routes): parse `ATTLOG`, insert into **`attendance_punches`**
  (already exists) idempotently, reply `OK`; unknown device-user ids land in
  an exceptions list (the 4.5c `attendance_checkin_exceptions` pattern).
- Punch-file import (xls/csv/dat from device exports) as the offline
  fallback, with the row-level validation-report pattern from F15.
- Device health card (last seen, punch count today) on the attendance page;
  auto shift by first punch stays as roadmapped.

**G4 Recruitment & darbandi** — template A + C
- `approved_positions` (designation × branch × count, board decision ref,
  effective FY) with an occupancy view (filled / vacant / acting);
  `vacancies` → `applicants` (minimal ATS: stages applied → shortlisted →
  exam → interview → selected; exam/interview **marks**, merit order) →
  appointment letter (G2). Manpower request with approval first, as Nimble
  does. No public job-board in v1 — applicants are entered by HR.

**G5 Exit workflow** — template C; pairs with F8
- Resignation request (ESS) → acceptance → **clearance checklist** per unit
  (accounts: loans/advances; IT/admin: assets + device user removal (G3);
  branch; HR) → F8 final settlement → experience letter (G2) → exit survey.
  `employee_termination` grows status + clearance tables; separation becomes
  a G2 event.

**G6 Automation & reminders infrastructure** — enables half of everything
- One `scheduled_jobs` + `job_runs` pair of tables per tenant, a pure
  `scheduler.engine.ts` (due-date math in BS and AD), and a single secured
  route `app/api/jobs/tick` driven by **cPanel cron** (`curl` with a bearer
  secret) — no daemon, fits Passenger. Jobs are idempotent and logged.
- First consumers: compliance calendar emails (F10), probation ending,
  contract/document expiry, birthdays & work anniversaries (dashboard card +
  optional notice), leave-year opening reminder, device-silent alerts (G3),
  payslip publish emails (F3), approval digests (F17).

### Tier G-B — completeness

**G7 Training** — TNA from G1 weak criteria, sessions, nominations with
supervisor approval, attendance, cost, bond/service-agreement tracking,
pre/post assessment, certificate on the employee record.

**G8 Disciplinary & grievance** — case register (confidential permission),
warning levels per Labour Act process, outcomes as G2 events; grievance
intake from ESS with an SLA timer.

**G9 Welfare / medical / gratuity funds** — fund types with contribution
rules (per month, % or fixed, employer/employee), a **fund ledger**
(`leave_ledger` pattern: append-only, `ref` idempotency), payroll head
integration, payout at exit into F8, provision report for the auditor.

**G10 Core-banking vouchers** — extend F12's ledger mapping with export
presets for **Pumari / MFin / FinPro** (CSV layouts behind one
`voucher-format.engine.ts`; formats confirmed against real files from the
customer before building).

**G11 TA-DA & field work** — travel request → advance → settlement with
per-designation rates (Nimble pattern); daily field report (light; feeds
nothing in v1). Reimbursements stay F16.

### Tier G-C — polish

**G12 Nepali-language groundwork** — a tiny `t()` dictionary layer (no
i18n library; stack unchanged) applied to ESS (Phase 5) and all printed
outputs (letters G2, payslip F11, evaluation form G1). Admin UI stays
English.

**G13 HR analytics & regulator export** — turnover by branch/period, leave
liability (balance × last basic per day), headcount vs darbandi, loan
exposure per staff; one "DOC/COPOMIS staff return" export (format verified
against the real portal before building).

**G14 Notice board & asset handover** — company notices (dashboard +
ESS, publish/expire dates); simple asset register whose only job is the G5
clearance hook. Build last; both are small template-A screens.

## 5. How this lands in the roadmap

- **Nothing moves** in Phase 4 (4.7 → 4.13 as planned) or Phase F tiers.
- Phase G Tier A slots **after F Tier 1** (payroll accuracy first — it pays
  salaries; evaluation can't). Suggested order: **G6 → G1 → G2 → G3 → G5 →
  G4**, since G6 unblocks reminder consumers everywhere, and G2 letters are
  needed by G1 (confirmation), G4 (appointment) and G5 (experience).
- Phase 5 (ESS) gains: my evaluation (self-rating + acknowledgement), my
  requests (resignation, grievance, travel), notices, Nepali UI (G12).
- Phase 8 cleanup additionally retires: in-place designation/branch edits
  (replaced by G2 events), and the `employee_termination` free-text columns.
- Every new table: `$defaultFn(() => randomUUID())` ids, mirrored in
  `lib/db/tenant-schema-sync.ts`; every new guard gets a
  `tests/security-*.test.ts` case (raters ≠ subject, clearance ≠ self,
  device secret required, letter issuance audited).

## 6. Sources

- [Nimble OfficeHRM — HRMS & payroll](https://nimble.com.np/hrms-payroll-software)
- [RigoHR — HR software](https://rigohr.com/hr-software/) · [RigoHR payroll](https://rigohr.com/payroll-software-nepal/)
- [eHajiri](https://ehajiri.com.np/) · [HajirHR HRMS](https://hajirhr.com/hrms-software-nepal/)
- [MoHA — कार्यसम्पादन मूल्याङ्कन forms](https://www.moha.gov.np/page/performance-evaluation) · [half-yearly form](https://daodarchula.moha.gov.np/post/half-yearly-work-editing-evaluation-form)
- [Cooperative Rules 2075](https://lawcommission.gov.np/content/13046/13046-cooperative-regulation-2075/)
- [ZKTeco ADMS push integration example](https://apps.odoo.com/apps/modules/17.0/zkteco_adms_attendance)

## Hardening pass (senior review) and next plan

Done on `feature/phase-g-hardening`:
- Exit Complete now deactivates the exited employee's login in the same transaction (before: employee Inactive but the user could still sign in).
- `/iclock` serial lookup keeps a bounded 60 s negative cache, so unauthenticated unknown-serial requests no longer scan every company database.

Still to review/do (ordered by value for a sahakari):
1. Welfare-fund payout at exit (use the exit case facts; Bonus Act 2030 §13 welfare-fund and the Contribution-based Social Security Act are the statutory neighbours — cooperative staff funds follow the bylaw, so keep rates/caps as per-company config).
2. G8 Disciplinary & grievance, G7 Training, G13 HR analytics and COPOMIS/DoC returns.
3. दरबन्दी enforcement in hiring / promotion / transfer; promotion score composite (का.स.मू. + seniority) feeding the बढुवा event.
4. G10 core-banking voucher export — needs real Pumari / MFin / FinPro sample files from the customer.
5. Duplicate device serial across two companies resolves to the first active match; consider a platform-level serial registry.
