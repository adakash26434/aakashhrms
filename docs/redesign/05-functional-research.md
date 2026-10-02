# 05 — Functional Research & Enhancement Proposals

Research date: 2026-10-02. This doc covers how established payroll and
finance software behaves, what Nepal-specific payroll products offer, where
AakashHRMS stands today, and what to add.

## 1. Reference products & what we borrow

### UX / interaction references ("desktop-class software on the web")

| Product | Pattern | How we use it |
|---|---|---|
| **Microsoft Dynamics 365 Business Central** | Page types: **Role Center** (home with KPIs, cues, headlines), **List** pages, **Card** pages with FastTabs, an **action bar** at the top of each page, and a **FactBox** pane on the right showing facts about the selected record ([page types](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-page-types-and-layouts), [FactBoxes](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-designing-parts)) | Our Home = Role Center (work queues + cues). Register = List + **FactBox detail pane**. Record editor = Card with collapsible sections. CommandToolbar = action bar. |
| **SAP Fiori** | Floorplans: **List Report** (filter bar + big list + actions), **Worklist** (small set of items processed one by one, no filter bar), **Object Page**, **Wizard** ([floorplan overview](https://www.sap.com/design-system/fiori-design-web/v1-38/page-types/floorplan-overview), [when to use which](https://www.sap.com/design-system/fiori-design-web/v1-136/page-types/floorplans/when-to-use-which-floorplan)) | Template A = List Report. **Approvals and payroll exceptions = Worklist** (a new variant: process items one by one with Approve/Reject and next-item focus). Payroll run = Wizard. |
| **TallyPrime** (widely used in Nepal) | Keyboard-first: **Alt+G "Go To"** jumps to any report or screen by typing its name, **F3 switches company**, a current period is always visible, and function-key actions ([shortcut reference](https://tallymantra.com/tally-prime-shortcut-keys-complete-2026-reference-guide/)) | Ctrl+K palette = our "Go To". Add **Alt+G as an alias** so Tally users feel at home. A **working period** is always shown in the title bar. |

### Nepal payroll competitors (functional benchmark)

| Product | Notable features |
|---|---|
| **NepalHRM** ([payroll](https://nepalhrm.com/payroll/)) | Payroll **preview** before generation, **review queue** for exceptions, **payroll lock**, **payslip hold/release**, **export logs** (who exported which salary sheet or bank file), **CIT optimizer** (plan CIT before close), working-day / calendar-day / fixed **day-rate methods**, mid-month joiner/leaver proration, reimbursements, increment requests with approval, deadline reminders, multi-company consolidated reporting |
| **RigoHR** ([payroll](https://rigohr.com/payroll-software-nepal/)) | **Mini pay periods / off-cycle runs** for Dashain bonus, OT and profit bonus. **Arrears with tax adjustment** for back-dated increments. **Mass increment**. **Maker-checker for all critical changes**. Accounting vouchers for ERP/SAP. Core-banking upload files. Tax certificates for IRD clearance. Employee **tax planning** in self-service (insurance, retirement fund). |
| **Hajir HRMS**, **Agile HRMS**, **HR Khata**, **Pace Infosys** ([Hajir](https://hajirhr.com/payroll-software-in-nepal/), [Agile](https://agile.com.np/best-payroll-software-in-nepal-agile-hrms/), [HR Khata](https://hrkhata.com/cloud-payroll-software-nepal/), [Pace](https://www.thepaceinfosys.com/blog/automated-salary-processing-software-in-nepal)) | Biometric attendance sync, mobile approvals, payslips in **Nepali or English**, IRD-ready eTDS, SSF contribution statements |

### Payroll control best practice

- **Variance review before approval:** compare each employee's gross and net
  with the previous run and flag anything outside a threshold (commonly
  ±5%). Also flag: active employees with no pay, terminated employees still
  paid, new or changed deductions, and **bank-detail changes since the last
  run** ([Netchex](https://netchex.com/blog/the-pre-payroll-review-that-catches-errors-before-the-money-leaves/)).
- **Maker-checker:** the person who prepares a run cannot approve it. Use a
  hard **data cut-off** before calculation
  ([Teamed](https://www.teamed.global/insights/how-to-achieve-payroll-processing-accuracy-guide),
  [Wurk](https://enjoywurk.com/human-resources/payroll-audit-checklist-internal-controls-tax-compliance-templates/)).

### Nepal statutory facts the system must model (verify each FY)

- **SSF = 31% of basic salary.** Employee 11% (PF 10% + 1% social security
  tax). Employer 20% (PF 10% + gratuity 8.33% + 1.67%). SSF members are
  exempt from the separate 1% SST. **Deposit within 15 days of month-end**
  (10% annual interest on late deposits). Enrol new hires within 3 months
  ([HajirHR SSF](https://hajirhr.com/blog/ssf-calculation-in-nepal/),
  [Frontline](https://frontline.com.np/blog/payroll-in-nepal-is-more-complicated-than-you-think-heres-how-to-get-it-right/)).
- **TDS is deposited through IRD eTDS by the 25th of the following Nepali
  month.** Monthly TDS = projected annual tax ÷ remaining months. It
  **must be re-projected on mid-year increments and Dashain bonus**, which is
  a common error source (Frontline).
- **FY 2082/83 individual slabs** (single): 1% up to 5,00,000 · 10% next
  2,00,000 · 20% next 3,00,000 · 30% next 10,00,000 · 36% next 20,00,000 ·
  39% above. Married couples get a higher first slab
  ([Mero Dafa calculator](https://merodafa.com/tools/salary-tax-calculator)).
  Slabs are already configurable in `/setup/tax-rates`.
- **Dashain (festival) allowance:** one month's basic salary, taxable. Annual
  returns are due by the end of Ashwin.

## 2. Where AakashHRMS stands (from code)

| Area | Status |
|---|---|
| Run lifecycle DRAFT → UNDER_REVIEW → APPROVED → LOCKED, reviewer/approver stamps | ✅ exists |
| SSF / PF / CIT / TDS, insurance, female rebate, remote allowance, festival allowance as occasional head | ✅ exists |
| Pre-flight checklist, exceptions card, attendance sync into run (just committed) | ✅ exists |
| Salary map with `effectiveFrom`, Shreni grade progression | ✅ exists (no arrears engine) |
| Loans with EMI deduction, leave encashment / leave salary run | ✅ exists |
| Bank export, TDS/IRD report, salary sheet, payslip report | ✅ exists |
| **Variance vs previous run** | ❌ missing |
| **Off-cycle runs** (Dashain bonus, profit bonus, arrears, final settlement) | ❌ only one regular monthly run type |
| **Arrears** for back-dated salary changes | ❌ |
| **Full & final settlement** (gratuity, leave encashment, notice recovery, loan close-out) | ❌ |
| **Annual tax projection / computation sheet** per employee, re-projection on change | ❌ |
| **Payslip publish / hold / release**, email delivery, Nepali-language payslip | ❌ |
| **Accounting journal export** (Tally XML / CSV voucher) | ❌ |
| **Statutory deposit files**: SSF contribution schedule, CIT statement, eTDS upload format | ⚠️ partial (TDS report only) |
| **Compliance calendar** (SSF 15th, TDS 25th, annual return Ashwin-end) with reminders | ❌ |
| **Maker-checker on master data** (salary, bank account, tax status changes) | ❌ (audit log only) |
| **Export log** (who exported what, when) | ❌ |
| Mass increment, Excel import templates | ❌ |
| Reimbursements / expense claims, salary advance | ❌ |

## 3. Recommended functional changes (prioritised)

Each item gets its own branch and tests (engines are pure and unit-tested
today, so keep that). The UI for each item uses the new templates.

### Tier 1 — Accuracy & control (do with or right after the Payroll module redesign)

1. **Variance review step in the payroll run.** Add a "Variance" tab between
   Calculate and Approve. It compares per employee against the last LOCKED
   run: gross, net, TDS, SSF. Flag beyond a configurable ±% threshold. Also
   flag new joiners, leavers still paid, zero-pay actives, and bank changes
   since the last run. **Approval is blocked until every flag is
   acknowledged** (an acknowledgement note is stored and audited).
2. **Enforce maker-checker.** The user who generated or last edited a run
   cannot approve it (server-side rule in `transitionPayrollRun`). Add an
   optional "two approvers above amount X" setting.
3. **Payslip publish / hold / release.** Payslips are visible in
   self-service only after LOCK + Publish. Individual slips can be **held**
   (disputes) and released later. Optional email notification with **no
   salary in the email body**; the employee signs in to view.
4. **Export log + safe exports.** Every salary sheet, bank file and
   statutory export writes an audit row (user, time, run, file type, record
   count). This ties into security standing rule 5.
5. **Tax projection engine.** Show a per-employee annual computation sheet
   (projected income, retirement contributions, insurance, rebates, slab
   breakdown, tax already deducted, remaining months). Re-project
   automatically on increments, bonus and arrears. Show it in the payslip
   detail and in self-service ("My tax").

### Tier 2 — Nepal completeness

6. **Run types:** `REGULAR` | `FESTIVAL_BONUS` | `PROFIT_BONUS` | `ARREARS` |
   `FINAL_SETTLEMENT` | `OFF_CYCLE`. Same lifecycle, separate numbering,
   and all feed YTD tax.
7. **Arrears engine:** when a salary map has a back-dated `effectiveFrom`,
   compute per-month differences against locked runs and propose an arrears
   run with the tax adjustment.
8. **Full & final settlement** from employee termination: pro-rata salary,
   leave encashment, gratuity (non-SSF employees), notice-period
   recovery, loan close-out, final TDS. Produce a printable settlement
   statement.
9. **Statutory outputs:** SSF monthly contribution schedule (portal upload
   format), CIT deposit statement, IRD **eTDS** upload file, annual
   employee tax certificate.
10. **Compliance calendar** on Home: SSF due (15th), TDS due (25th), annual
    return (Ashwin-end), FY close, with overdue states. Include optional
    reminder emails to payroll admins.
11. **Bilingual payslip** (English / नेपाली) with BS dates by default.

### Tier 3 — Productivity

12. **Accounting journal export** (salary expense, payable, TDS, SSF, CIT,
    loans) as a Tally-compatible XML voucher and generic CSV, with a
    configurable ledger mapping.
13. **Maker-checker for sensitive master data:** changes to salary
    structure, bank account, PAN or tax status create a *pending change*
    that another user approves. Bank changes are highlighted in the next
    run's variance view.
14. **Mass increment** (by grade, department or %) with preview and an
    effective date, which generates salary-map revisions.
15. **Excel import templates** (employees, opening YTD, attendance, loans)
    with a row-level validation report before commit.
16. **Reimbursements & salary advance** requests flowing into payroll as
    heads.
17. **Notification centre** (bell): approvals waiting, runs needing action,
    deadlines, held payslips.

## 4. How functionality maps onto the new UI

- **Home (Role Center):** cues for approvals waiting, current run status,
  compliance deadlines and attendance exceptions. Each cue opens a filtered
  Worklist.
- **Payroll run (Wizard):** Setup → Pre-flight → Calculate → **Variance** →
  Review → Approve (checker) → Lock → **Publish**. A docked "Problems"
  panel (like an IDE error list) shows blocking issues with jump-to-record.
- **Approvals (Worklist):** one item at a time, `A` approve / `R` reject /
  `J`/`K` next/previous, with a FactBox showing leave balance and team
  calendar.
- **Employee (Card):** FactBox with YTD gross/TDS/SSF, leave balance,
  active loans, and pending changes.
