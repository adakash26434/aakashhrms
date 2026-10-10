import * as runRepo from "@/lib/repositories/payroll-run.repository";
import * as payrollRepo from "@/lib/repositories/payroll.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as salaryStructureRepository from "@/lib/repositories/salary-structure.repository";
import * as fundRepository from "@/lib/repositories/fund.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as taxRateRepository from "@/lib/repositories/tax-rate.repository";
import * as payrollService from "@/lib/services/payroll.service";
import * as fiscalYearService from "@/lib/services/fiscal-year.service";
import * as openingRepository from "@/lib/repositories/opening-balance.repository";
import * as loanRepository from "@/lib/repositories/loan.repository";
import * as controlService from "@/lib/services/payroll-control.service";
import * as controlRepo from "@/lib/repositories/payroll-control.repository";
import type { WorkingPeriod } from "@/lib/types/payroll-run";
import { overtimeWaitingFor } from "@/lib/services/attendance.service";
import { getDb } from "@/lib/db";
import { leaveApplications } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { applyDecision, availableActions, buildFlow, isCompanyAdministrator, parsePolicy, statusText, validatePolicy, type ApprovalActor, type ApprovalRequest, type ApprovalWording, type Decision } from "@/lib/engines/approval.engine";
import { canTransition, preflight, scopeText, type PreflightEmployee } from "@/lib/engines/payroll-run.engine";
import { runWithinScope } from "@/lib/engines/payroll-control.engine";
import { plainCsvField } from "@/lib/export/csv";
import { asRunType, isOffCycle, RUN_TYPE_LABEL } from "@/lib/constants/run-types";
import { canSwitchCalendar, fiscalMonthIndexFor, parseCalendar, recordMonthOf, runLabel } from "@/lib/engines/pay-calendar.engine";
import { periodFor, periodContaining, shiftPeriod, type PayPeriod, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import { isOwnRecord } from "@/lib/auth/self-action";
import { isFeedHeadCode } from "@/lib/constants/payroll-feeds";
import { isLabelHead } from "@/lib/constants/label-heads";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { adToBS } from "@/lib/utils/bs-calendar";
import type { ApprovalFlow, ApprovalPolicy, ApprovalTimelineEntry } from "@/lib/types/approval";
import type { PayrollRun, PayrollSlip } from "@/lib/types/payroll";
import { RUN_TYPES, type NewRunInput, type PayrollRunView, type PayrollRunsPageData, type PreflightResult, type RunActions, type RunDetail, type RunType, type SlipDetail } from "@/lib/types/payroll-run";

// Payroll run (4.8a): the run workspace. Pre-flight before a month is
// generated or submitted, the variance review against the last locked run,
// the approval step through the approval engine (maker-checker: the
// preparer never approves, administrators included), lock, and the S21
// guard on payslip edits. The calculation itself stays in payroll.service.

/** S21: the acting user's own payslip (a UserFacingError, so its message reaches the screen). */
export class OwnPayslipError extends UserFacingError {
  constructor(message = "This is your own payslip, so someone else has to change it.") {
    super(message);
    this.name = "OwnPayslipError";
  }
}

export class RunValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Some fields need attention.");
    this.name = "RunValidationError";
  }
}

const WORDING: ApprovalWording = {
  ownSubject: "This run includes your own payslip, so someone else has to approve it.",
  noPermission: "Only someone with Payroll review → Approve can approve a run.",
  preparer: "You prepared this run, so someone else has to approve it (maker-checker).",
};

export interface RunCtx {
  scope: ScopeFilter;
  userId: string;
  canApprove: boolean;
  permissions: PayrollRunsPageData["permissions"];
}

const MAX_NOTE = 500;

/** Whether an employee is someone the scope covers (company-wide: everyone). */
function inScopeOf(scope: Pick<ScopeFilter, "scopeType" | "branchIds" | "departmentIds">, e: { branchId: string; departmentId: string }): boolean {
  if (scope.scopeType === "GLOBAL") return true;
  if (scope.scopeType === "BRANCH") return scope.branchIds.includes(e.branchId);
  if (scope.scopeType === "DEPARTMENT") return scope.departmentIds.includes(e.departmentId);
  return false;
}

/** The payslip (to find its run); refused when it is gone. */
export async function slipRun(slipId: string): Promise<PayrollSlip> {
  const slip = await payrollRepo.findSlipById(slipId);
  if (!slip) throw new UserFacingError("That payslip no longer exists. Refresh the page.");
  return slip;
}

/** S58: the run, refused (RunScopeError) unless the user's scope covers everyone it may pay. */
export async function guardRun(runId: string, ctx: Pick<RunCtx, "scope">): Promise<PayrollRun> {
  return controlService.assertRunInScope(runId, ctx.scope);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const toIso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

function flowOf(run: PayrollRun): ApprovalFlow {
  return run.approvalType === "multi_level" ? { type: "multi_level", levels: run.approvalLevels ?? [] } : { type: "simple", levels: run.approvalLevels ?? [] };
}

/** The run as an approval request. Subject employees are left out on purpose: see S55 in 03. */
function requestOf(run: PayrollRun): ApprovalRequest {
  return {
    status: run.status === "UNDER_REVIEW" ? "pending" : run.status === "DRAFT" ? "withdrawn" : "approved",
    preparedById: run.submittedBy ?? run.generatedBy,
    subjectEmployeeIds: [],
    flow: flowOf(run),
    currentLevel: run.currentLevel ?? 0,
  };
}

function actorOf(ctx: RunCtx): ApprovalActor {
  return { userId: ctx.userId, employeeId: ctx.scope.employeeId, canApprove: ctx.canApprove, isAdministrator: isCompanyAdministrator(ctx.scope, ctx.canApprove) };
}

async function runView(run: PayrollRun, ctx: RunCtx, extras: { varianceOpen: number; approvers: Awaited<ReturnType<typeof runRepo.findApprovers>>; names: Map<string, string>; timeline: Awaited<ReturnType<typeof runRepo.findTimeline>>; branchName: (id: string) => string; branchCount: number; openMonths: string[]; today: string }): Promise<PayrollRunView> {
  const open = extras.varianceOpen;
  const request = requestOf(run);
  const actor = actorOf(ctx);
  const can = run.status === "UNDER_REVIEW" ? availableActions(request, actor, { approvers: extras.approvers, today: extras.today, wording: WORDING, preparerMayFinalApprove: false }) : null;
  const p = ctx.permissions;
  const actions: RunActions = {
    edit: p.edit && run.status === "DRAFT",
    submit: p.edit && run.status === "DRAFT" && open === 0 && extras.openMonths.length === 0,
    approve: !!can?.approve,
    finalApprove: !!can && can.finalApprove && !can.approve,
    reject: !!can?.reject,
    lock: p.lock && run.status === "APPROVED",
    discard: p.delete && run.status !== "LOCKED",
    export: p.export && run.status === "LOCKED",
    reason: can?.reason ?? null,
    stuck: can?.stuck ?? null,
  };
  const nameOf = (id: string) => extras.names.get(id) ?? "Unknown user";
  const timeline: ApprovalTimelineEntry[] = extras.timeline
    .filter((t) => t.requestId === run.id)
    .map((t) => ({
      id: t.id,
      level: t.level,
      action: t.action as ApprovalTimelineEntry["action"],
      actorId: t.actorId,
      actorName: t.actorId ? nameOf(t.actorId) : "System",
      onBehalfOfName: t.onBehalfOf ? nameOf(t.onBehalfOf) : null,
      note: t.note,
      at: t.createdAt.toISOString(),
    }));
  return {
    ...run,
    label: runLabel(run),
    calendar: parseCalendar(run.calendar),
    runType: (RUN_TYPES as readonly string[]).includes(run.runType) ? (run.runType as RunType) : "REGULAR",
    scopeText: scopeText(run, extras.branchName, extras.branchCount),
    generatedAt: toIso(run.generatedAt)!,
    reviewedAt: toIso(run.reviewedAt),
    approvedAt: toIso(run.approvedAt),
    lockedAt: toIso(run.lockedAt),
    submittedBy: run.submittedBy ?? null,
    submittedAt: toIso(run.submittedAt),
    preparedByName: nameOf(run.generatedBy),
    approvalType: run.approvalType === "multi_level" ? "multi_level" : run.approvalType === "simple" ? "simple" : null,
    flow: flowOf(run),
    currentLevel: run.currentLevel ?? 0,
    approvalRoute: (run.approvalRoute as PayrollRunView["approvalRoute"]) ?? null,
    variance: null,
    varianceOpen: open,
    timeline,
    statusText: run.status === "UNDER_REVIEW" ? statusText(request, nameOf) : run.status === "LOCKED" ? "Locked" : run.status === "APPROVED" ? "Approved" : open ? `${open} to acknowledge` : "Draft",
    openMonths: extras.openMonths,
    can: actions,
  };
}

/** Branches of a run whose attendance month is not closed (re-checked on every read: a month can be reopened). */
async function openMonthsOf(run: Pick<PayrollRun, "calendar" | "payPeriodYear" | "payPeriodMonth" | "branchIds">, branchName: (id: string) => string): Promise<string[]> {
  const periods = await attendanceRepo.findPeriods(run.calendar, run.payPeriodYear, run.payPeriodMonth);
  const closed = new Set(periods.filter((p) => p.status === "closed").map((p) => p.branchId));
  return run.branchIds.filter((b) => !closed.has(b)).map(branchName);
}

/** Everything the Payroll page shows: the runs, the selected run with its payslips, settings and the lists for a new run. */
export async function pageData(ctx: RunCtx, selectedRunId: string | null, workingPeriod: WorkingPeriod | null = null): Promise<PayrollRunsPageData> {
  const today = nepalDateIso();
  const [allRuns, settings, approvers, branches, departments, designations, allEmployees, payHeads] = await Promise.all([
    payrollRepo.findAllPayrollRuns(),
    runRepo.findSettings(),
    runRepo.findApprovers(),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "Active" }),
    payHeadRepository.findAllPayHeads(),
  ]);
  // A new run is offered for the branches / departments / people the scope covers (cleanInput checks again).
  const scopedBranches = ctx.scope.scopeType === "BRANCH" ? branches.filter((b) => ctx.scope.branchIds.includes(b.id)) : branches;
  const scopedDepartments = ctx.scope.scopeType === "DEPARTMENT" ? departments.filter((d) => ctx.scope.departmentIds.includes(d.id)) : departments;
  const employees = allEmployees.filter((e) => inScopeOf(ctx.scope, e));
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  // S58: only runs the user's scope covers whole (a branch reads its own people's pay in Reports).
  const runs = allRuns.filter((r) => runWithinScope(r, ctx.scope));
  const timeline = await runRepo.findTimeline(runs.map((r) => r.id));
  const names = await runRepo.findUserNames([...runs.flatMap((r) => [r.generatedBy, r.submittedBy ?? "", r.reviewedBy ?? "", r.approvedBy ?? ""]), ...timeline.flatMap((t) => [t.actorId ?? "", t.onBehalfOf ?? ""]), ...runs.flatMap((r) => (r.variance?.items ?? []).map((i) => i.acknowledgedBy ?? ""))]);
  const sorted = [...runs].sort((a, b) => b.payPeriodYear * 100 + b.payPeriodMonth - (a.payPeriodYear * 100 + a.payPeriodMonth) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const views: PayrollRunView[] = [];
  for (const r of sorted) {
    const openMonths = r.status === "LOCKED" || r.runType !== "REGULAR" ? [] : await openMonthsOf(r, branchName);
    const varianceOpen = r.status === "LOCKED" ? 0 : (await controlService.varianceReview(r.id)).unresolved.length;
    views.push(await runView(r, ctx, { varianceOpen, approvers, names, timeline, branchName, branchCount: branches.length, openMonths, today }));
  }
  let selected: RunDetail | null = null;
  const chosen = selectedRunId ? views.find((v) => v.id === selectedRunId) ?? null : null;
  if (chosen) {
    const slips = await payrollRepo.findSlipsByRunId(chosen.id);
    selected = { run: chosen, slips: slips.sort((a, b) => a.employeeName.localeCompare(b.employeeName)), preflight: null };
  }
  const calendar = settings.calendar;
  const latest = sorted.find((r) => r.runType === "REGULAR" && r.calendar === calendar);
  // The working period (title bar) wins; else the month after the last regular run; else last month.
  const suggested =
    workingPeriod && workingPeriod.calendar === calendar
      ? { year: workingPeriod.year, month: workingPeriod.month }
      : latest
        ? shiftPeriod(periodFor(calendar, latest.payPeriodYear, latest.payPeriodMonth), 1)
        : shiftPeriod(periodContaining(calendar, today), -1);
  return {
    calendar,
    runs: views,
    selected,
    policy: settings.policy,
    approvers,
    branches: scopedBranches.map((b) => ({ id: b.id, name: b.name })),
    departments: scopedDepartments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
    categories: [...new Set(employees.map((e) => e.category))].sort(),
    employees: employees.map((e) => ({ id: e.id, name: e.fullName, employeeCode: e.employeeCode, branchId: e.branchId, departmentId: e.departmentId, designationId: e.designationId, category: e.category })),
    occasionalAllowances: payHeads.filter((h) => h.flags.isFestivalAllowance || h.flags.isRemoteAllowance).map((h) => ({ id: h.id, name: h.name, isFestivalAllowance: !!h.flags.isFestivalAllowance, isRemoteAllowance: !!h.flags.isRemoteAllowance })),
    allPayHeads: payHeads.map((h) => ({
      id: h.id,
      name: h.name,
      code: h.code,
      type: h.type as "allowance" | "deduction",
      isTds: !!h.flags.isTdsHead,
      // Statutory heads are worked out by payroll and feed heads come from their records (the server refuses both).
      addable: !isFeedHeadCode(h.code) && !h.flags.isTdsHead && !h.flags.isPfHead && !h.flags.isSsfHead && !h.flags.isSsfEmployerHead && !h.flags.isCitHead,
    })),
    suggested: { year: suggested.year, month: suggested.month },
    today,
    currentUserId: ctx.userId,
    myEmployeeId: ctx.scope.employeeId,
    permissions: ctx.permissions,
  };
}

/** One payslip with its heads (the detail pane). */
export async function slipDetail(slipId: string): Promise<SlipDetail> {
  const d = await payrollService.getPayslipWithHeads(slipId);
  return { slip: d.slip, heads: d.heads };
}

// ---------------------------------------------------------------------------
// New run: pre-flight and generation
// ---------------------------------------------------------------------------

function cleanInput(raw: unknown, calendar: PeriodCalendar, scope: Pick<ScopeFilter, "scopeType" | "branchIds" | "departmentIds">): NewRunInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : []);
  const errors: Record<string, string> = {};
  const year = Number(r.payPeriodYear);
  const month = Number(r.payPeriodMonth);
  // F6: the monthly salary, or a festival allowance / arrears run beside it (final settlements are
  // paid from the exit case, F8).
  const runType: RunType = r.runType === undefined || r.runType === null || r.runType === "" ? "REGULAR" : (RUN_TYPES as readonly unknown[]).includes(r.runType) ? (r.runType as RunType) : "REGULAR";
  if (r.runType !== undefined && r.runType !== null && r.runType !== "" && !(RUN_TYPES as readonly unknown[]).includes(r.runType)) errors.runType = "Choose the kind of run";
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) errors.period = "Choose the month";
  else {
    try {
      periodFor(calendar, year, month);
    } catch {
      errors.period = "That month is outside the calendar";
    }
  }
  const branchIds = ids(r.branchIds);
  const departmentIds = ids(r.departmentIds);
  if (!branchIds.length) errors.branchIds = "Choose at least one branch";
  // S58: a run only for the people the scope covers (the same rule as acting on one: runWithinScope).
  if (!runWithinScope({ branchIds, departmentIds }, scope)) {
    if (scope.scopeType === "BRANCH") errors.branchIds = "Choose your own branches only";
    else if (scope.scopeType === "DEPARTMENT") errors.departmentIds = "Choose your own departments (at least one)";
    else throw new UserFacingError("Your role does not cover a pay run.");
  }
  const payslipDate = typeof r.payslipDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.payslipDate) ? r.payslipDate : null;
  if (Object.keys(errors).length) throw new RunValidationError(errors);
  return {
    runType,
    payPeriodYear: year,
    payPeriodMonth: month,
    branchIds,
    departmentIds,
    designationIds: ids(r.designationIds),
    employeeCategories: ids(r.employeeCategories),
    employeeIds: ids(r.employeeIds),
    // An arrears run pays only the ARREARS feed; a festival run only the festival heads chosen.
    occasionalAllowanceHeadIds: runType === "ARREARS" ? [] : ids(r.occasionalAllowanceHeadIds),
    payslipDate,
    recreateIfExists: r.recreateIfExists === true,
    prorateFestival: runType === "FESTIVAL" ? r.prorateFestival !== false : undefined,
  };
}

/** The employees a new run would include (the same rules payroll.service applies). */
async function scopedEmployees(input: NewRunInput) {
  const all = await employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "Active" });
  return all.filter(
    (e) =>
      input.branchIds.includes(e.branchId) &&
      (!input.departmentIds.length || input.departmentIds.includes(e.departmentId)) &&
      (!input.designationIds.length || input.designationIds.includes(e.designationId)) &&
      (!input.employeeCategories.length || input.employeeCategories.includes(e.category)) &&
      (!input.employeeIds.length || input.employeeIds.includes(e.id))
  );
}

/** Pre-flight for a run that does not exist yet (the New run window's Check). */
export async function checkNewRun(raw: unknown, scope: ScopeFilter): Promise<PreflightResult> {
  const calendar = (await runRepo.findSettings()).calendar;
  const input = cleanInput(raw, calendar, scope);
  const period = periodFor(calendar, input.payPeriodYear, input.payPeriodMonth);
  const existing = await payrollRepo.findPayrollRunByPeriodAndBranch({ calendar, payPeriodMonth: input.payPeriodMonth, payPeriodYear: input.payPeriodYear, branchIds: input.branchIds, runType: input.runType });
  return preflightFor(period, input, { existing, festivalHeads: await festivalHeadCount(input.occasionalAllowanceHeadIds) });
}

async function festivalHeadCount(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const heads = await payHeadRepository.findAllPayHeads();
  return heads.filter((h) => ids.includes(h.id) && h.flags.isFestivalAllowance).length;
}

async function preflightFor(period: PayPeriod, input: Pick<NewRunInput, "runType" | "branchIds" | "departmentIds" | "designationIds" | "employeeCategories" | "employeeIds">, opts: { existing: PayrollRun[]; ignoreRunId?: string; festivalHeads: number }): Promise<PreflightResult> {
  // The year the month belongs to (4.12a), as the run itself will use: not simply the current one.
  const [controls, statutoryHeads, year] = await Promise.all([controlService.readSettings(), controlRepo.statutoryHeadsPresent(), fiscalYearService.periodFiscalYear(period)]);
  const runYear = year.fiscalYear;
  const today = nepalDateIso();
  const full: NewRunInput = { ...input, payPeriodYear: period.year, payPeriodMonth: period.month, occasionalAllowanceHeadIds: [], payslipDate: null };
  const people = await scopedEmployees(full);
  const ids = people.map((e) => e.id);
  const regular = input.runType === "REGULAR";
  const [branches, periods, salaries, batches, slabs, overtime, funds, hasFunds, previousRun, covered, heads] = await Promise.all([
    branchRepository.findAllBranches(),
    attendanceRepo.findPeriods(period.calendar, period.year, period.month),
    salaryMappingRepository.findInForceByEmployeeIds(ids, period.end),
    salaryStructureRepository.findBatches(),
    runYear ? taxRateRepository.findSlabsByFiscalYear(runYear.id) : Promise.resolve([]),
    regular ? overtimeWaitingFor(ids, period) : Promise.resolve(new Map<string, number>()),
    // Fund contributions are posted by BS month (the one the pay month's last day falls in).
    regular && ids.length ? fundRepository.contributionsForMonth(ids, recordMonthOf(period).year, recordMonthOf(period).month) : Promise.resolve(new Map()),
    fundRepository.hasActiveFunds(),
    (() => {
      const prev = shiftPeriod(period, -1);
      return runRepo.findRunForPeriod(period.calendar, prev.year, prev.month);
    })(),
    // F15: a month an opening balance covers was paid by the old system.
    runYear ? openingRepository.openingsCovering(ids, runYear.id, fiscalMonthIndexFor(period.calendar, period.month)) : Promise.resolve([]),
    payHeadRepository.findAllPayHeads(),
  ]);
  const coveredCodes = new Set(covered.map((c) => c.employeeCode));
  // 4.12e: an amount on a label head (Basic Salary / Grade Amount) is paid on top of basic / grade.
  const labelHeads = new Set(heads.filter((h) => isLabelHead(h)).map((h) => h.id));
  const hasLabelAmount = (employeeId: string) => (salaries.get(employeeId)?.salaryHeads ?? []).some((h) => labelHeads.has(h.payHeadId) && Number(h.amount) > 0);
  // 4.10: payroll deducts recorded loans only; an amount left on a salary structure is not deducted.
  const withLoanAmount = regular ? people.filter((e) => { const m = salaries.get(e.id); return !!m && Number(m.loan1Deduction || 0) + Number(m.loan2Deduction || 0) > 0; }).map((e) => e.id) : [];
  const recordedLoans = new Set((await loanRepository.runningLoansFor(withLoanAmount)).map((l) => l.employeeId));
  const closed = new Set(periods.filter((p) => p.status === "closed").map((p) => p.branchId));
  const pendingLeaves = ids.length
    ? Number(
        (
          await (await getDb())
            .select({ n: sql<number>`count(*)::int` })
            .from(leaveApplications)
            .where(and(inArray(leaveApplications.employeeId, ids), eq(leaveApplications.status, "Pending"), sql`${leaveApplications.effectiveFrom} <= ${period.end}::date`, sql`${leaveApplications.effectiveTo} >= ${period.start}::date`))
        )[0]?.n ?? 0
      )
    : 0;
  const employees: PreflightEmployee[] = people.map((e) => {
    const map = salaries.get(e.id);
    return {
      id: e.id,
      name: e.fullName,
      code: e.employeeCode,
      branchId: e.branchId,
      status: e.status,
      joiningDate: typeof e.joiningDate === "string" ? e.joiningDate : new Date(e.joiningDate).toISOString().slice(0, 10),
      terminationDate: null,
      salary: !map ? "none" : map.salaryHeads.length === 0 ? "setup" : "current",
      hasBank: !!(e.bankAccountNumber && e.bankAccountNumber.trim()),
      hasPan: !!(e.panNumber && String(e.panNumber).trim()),
      overtimeWaiting: overtime.get(e.id) ?? 0,
      coveredByOpening: coveredCodes.has(e.employeeCode),
      loanOnStructure: withLoanAmount.includes(e.id) && !recordedLoans.has(e.id),
      labelAmount: regular && hasLabelAmount(e.id),
    };
  });
  const prevPeriod = shiftPeriod(period, -1);
  return preflight({
    runType: input.runType,
    festivalHeads: opts.festivalHeads,
    requireClosedAttendance: controls.requireClosedAttendance,
    statutoryHeads,
    period: { year: period.year, month: period.month, label: period.label, start: period.start, end: period.end },
    today,
    branches: input.branchIds.map((id) => ({ id, name: branches.find((b) => b.id === id)?.name ?? id, closed: closed.has(id) })),
    employees,
    pendingLeaves,
    pendingSalaryChanges: batches.filter((b) => b.status === "pending" && String(b.effectiveFrom).slice(0, 10) <= period.end).length,
    activeFiscalYear: runYear ? { id: runYear.id, label: runYear.label } : null,
    slabCount: slabs.length,
    fiscalYearProblem: year.problem,
    existingRuns: opts.existing.filter((r) => r.id !== opts.ignoreRunId).map((r) => ({ id: r.id, status: r.status })),
    previousRun: previousRun ? { status: previousRun.status, label: prevPeriod.label } : null,
    fundsPosted: regular && hasFunds ? (ids.length ? ids.some((id) => (funds.get(id) ?? []).length > 0) : null) : null,
    checkedAt: new Date().toISOString(),
  });
}

/** Pre-flight for an existing draft (before submitting, or on demand). */
export async function checkRun(runId: string): Promise<PreflightResult> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  const period = periodFor(parseCalendar(run.calendar), run.payPeriodYear, run.payPeriodMonth);
  const runType = (RUN_TYPES as readonly string[]).includes(run.runType) ? (run.runType as RunType) : "REGULAR";
  return preflightFor(period, { runType, branchIds: run.branchIds, departmentIds: run.departmentIds ?? [], designationIds: run.designationIds, employeeCategories: run.employeeCategories, employeeIds: run.employeeIds }, { existing: [], ignoreRunId: run.id, festivalHeads: await festivalHeadCount(run.occasionalAllowanceHeadIds) });
}

/**
 * Generates a run after pre-flight: blocking problems refuse it. The
 * payslips are calculated by payroll.service; the variance review is
 * computed right away.
 */
export async function generate(raw: unknown, ctx: RunCtx): Promise<{ run: PayrollRun; preflight: PreflightResult }> {
  const calendar = (await runRepo.findSettings()).calendar;
  const input = cleanInput(raw, calendar, ctx.scope);
  const check = await checkNewRun(raw, ctx.scope);
  const blocking = check.problems.filter((p) => p.severity === "blocking" && !(input.recreateIfExists && p.code === "run_exists"));
  if (blocking.length) throw new UserFacingError(blocking.length === 1 ? blocking[0].text : `${blocking.length} problems stop this run. Fix them first (the list is in the window).`);
  // S58: generating again replaces the drafts it overlaps, so each must be one the scope covers whole.
  if (input.recreateIfExists) {
    const existing = await payrollRepo.findPayrollRunByPeriodAndBranch({ calendar, payPeriodMonth: input.payPeriodMonth, payPeriodYear: input.payPeriodYear, branchIds: input.branchIds, runType: input.runType });
    if (existing.some((r) => !runWithinScope(r, ctx.scope))) throw new controlService.RunScopeError();
  }
  const run = await payrollService.generatePayrollRun(
    {
      payPeriodMonth: input.payPeriodMonth,
      payPeriodYear: input.payPeriodYear,
      branchIds: input.branchIds,
      departmentIds: input.departmentIds,
      designationIds: input.designationIds,
      employeeCategories: input.employeeCategories,
      employeeIds: input.employeeIds,
      occasionalAllowanceHeadIds: input.occasionalAllowanceHeadIds,
      payslipMonth: input.payPeriodMonth,
      payslipDate: input.payslipDate,
      runType: input.runType,
      prorateFestival: input.prorateFestival,
      recreateIfExists: input.recreateIfExists,
    },
    ctx.userId
  );
  return { run, preflight: check };
}

// ---------------------------------------------------------------------------
// Variance
// ---------------------------------------------------------------------------

/** Flags still to acknowledge on a run (the team's variance review, F1; they stop approval in assertCanMove). */
export async function varianceOpenCount(runId: string): Promise<number> {
  return (await controlService.varianceReview(runId)).unresolved.length;
}



// ---------------------------------------------------------------------------
// Submit, decide, lock, discard
// ---------------------------------------------------------------------------

/**
 * Submits a draft for approval: pre-flight again (closed months, no waiting
 * work), every variance flag acknowledged, then the approval flow is copied
 * on. With approval "none" the run is approved at once, except that the
 * preparer still cannot be the one to move money alone: "none" is refused
 * for pay runs (the settings window does not offer it).
 */
export async function submit(runId: string, noteRaw: unknown, ctx: RunCtx): Promise<{ status: string }> {
  const run = await guardRun(runId, ctx);
  if (run.status !== "DRAFT") throw new UserFacingError(`This run is ${run.status.toLowerCase().replace("_", " ")} already.`);
  const check = await checkRun(runId);
  const blocking = check.problems.filter((p) => p.severity === "blocking");
  if (blocking.length) throw new UserFacingError(blocking[0].text);
  const open = await varianceOpenCount(runId);
  if (open) throw new UserFacingError(`${open} variance flag${open === 1 ? "" : "s"} still need${open === 1 ? "s" : ""} acknowledging. Review the Variance step first.`);
  const [settings, approvers] = await Promise.all([runRepo.findSettings(), runRepo.findApprovers()]);
  const policy: ApprovalPolicy = settings.policy.type === "none" ? { type: "simple", levels: [] } : settings.policy;
  const outcome = buildFlow(policy, { preparerId: ctx.userId, preparerEmployeeId: ctx.scope.employeeId, subjectEmployeeIds: [], approvers });
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, MAX_NOTE) || null : null;
  const ok = await runRepo.submit({ runId, userId: ctx.userId, approvalType: outcome.flow.type, levels: outcome.flow.levels, currentLevel: outcome.approvedAtOnce ? 0 : outcome.currentLevel, note });
  if (!ok) throw new UserFacingError("Someone else moved this run a moment ago. Refresh the page.");
  return { status: "UNDER_REVIEW" };
}

/**
 * Approve (a level, or the run), Final approve (administrators) or reject
 * (back to draft with a reason). The preparer never approves (maker-checker),
 * administrators included.
 */
export async function decide(runId: string, decision: Decision, noteRaw: unknown, ctx: RunCtx): Promise<{ status: string }> {
  if (decision === "withdraw") throw new UserFacingError("A submitted run is rejected back to draft, not withdrawn.");
  const run = await guardRun(runId, ctx);
  if (run.status !== "UNDER_REVIEW") throw new UserFacingError(`This run is not waiting for approval (it is ${run.status.toLowerCase().replace("_", " ")}).`);
  const approvers = await runRepo.findApprovers();
  const request = requestOf(run);
  const actor = actorOf(ctx);
  const can = availableActions(request, actor, { approvers, today: nepalDateIso(), wording: WORDING, preparerMayFinalApprove: false });
  if (decision === "approve" && !can.approve) throw new UserFacingError(can.reason ?? "You cannot approve this run.");
  if (decision === "final_approve" && !can.finalApprove) throw new UserFacingError(can.reason ?? "Only a company administrator can Final approve.");
  if (decision === "reject" && !can.reject) throw new UserFacingError(request.preparedById === ctx.userId ? "You prepared this run: ask an approver to reject it, or wait for their decision." : can.reason ?? "You cannot reject this run.");
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, MAX_NOTE) || null : null;
  if (decision === "reject" && (!note || note.length < 3)) throw new RunValidationError({ note: "Give a reason for rejecting" });
  const next = applyDecision(request, decision);
  const status = next.status === "approved" ? "APPROVED" : next.status === "rejected" ? "DRAFT" : "UNDER_REVIEW";
  if (!canTransition(run.status, status) && status !== "UNDER_REVIEW") throw new UserFacingError("That decision is not possible from this state.");
  const ok = await runRepo.decide({
    runId,
    expectedLevel: request.currentLevel,
    status,
    currentLevel: next.currentLevel,
    route: next.route,
    actorId: ctx.userId,
    onBehalfOf: decision === "approve" ? can.approve!.onBehalfOf : null,
    level: decision === "approve" ? can.approve!.level : 0,
    action: decision === "approve" ? "approved" : decision === "final_approve" ? "final_approved" : "rejected",
    note,
  });
  if (!ok) throw new UserFacingError("Someone else decided this run a moment ago. Refresh the page.");
  return { status };
}

/** Locks an approved run (payroll.service seals attendance and amortises loans). */
export async function lock(runId: string, ctx: RunCtx): Promise<PayrollRun> {
  const run = await guardRun(runId, ctx);
  if (run.status !== "APPROVED") throw new UserFacingError("Only an approved run can be locked.");
  return payrollService.transitionPayrollRun(runId, "LOCKED", ctx.userId);
}

/** Discards a run that is not locked (its payslips go with it). */
export async function discard(runId: string, ctx: RunCtx): Promise<void> {
  const run = await guardRun(runId, ctx);
  if (run.status === "LOCKED") throw new UserFacingError("A locked run cannot be discarded.");
  await payrollService.deletePayrollRun(runId, ctx.userId);
}

/**
 * The bank transfer file of a locked run (Nepal commercial bank bulk format: SN, AccountNumber,
 * AccountName, Amount, Remarks). S16: fields are cleaned and quoted when needed (a comma in a name
 * used to shift every later column in the file sent to the bank). S58: a run the scope covers whole.
 * F6: an off-cycle run's transfers say what they pay.
 */
export async function bankFile(runId: string, ctx: Pick<RunCtx, "scope">): Promise<{ csv: string; rows: number; run: PayrollRun }> {
  const run = await guardRun(runId, ctx);
  if (run.status !== "LOCKED") throw new UserFacingError("The bank file is made from a locked run.");
  const slips = (await payrollRepo.findSlipsByRunId(run.id)).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  const what = isOffCycle(run.runType) ? RUN_TYPE_LABEL[asRunType(run.runType)].en : "Salary";
  const remarks = `${what} ${runLabel({ calendar: run.calendar, payPeriodYear: run.payPeriodYear, payPeriodMonth: run.payPeriodMonth })}`;
  const lines = ["SN,AccountNumber,AccountName,Amount,Remarks"];
  slips.forEach((slip, idx) => lines.push([idx + 1, slip.bankAccountNumber, slip.employeeName, slip.netPayable, remarks].map(plainCsvField).join(",")));
  return { csv: `${lines.join("\n")}\n`, rows: slips.length, run };
}

// ---------------------------------------------------------------------------
// Payslip edits (S21: never your own)
// ---------------------------------------------------------------------------

/** The slip's employee must not be the acting user (S21); the run must be a draft the scope covers whole (S58). */
export async function guardSlip(slipId: string, ctx: RunCtx): Promise<PayrollSlip> {
  const slip = await payrollRepo.findSlipById(slipId);
  if (!slip) throw new UserFacingError("That payslip no longer exists. Refresh the page.");
  if (isOwnRecord(ctx.scope.employeeId, slip.employeeId)) throw new OwnPayslipError();
  const run = await guardRun(slip.payrollRunId, ctx);
  if (run.status !== "DRAFT") throw new UserFacingError("Payslips change only while the run is a draft. Reject it back to draft first.");
  return slip;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Approval policy for pay runs (simple or multi-level; never none) and the pay calendar. The variance threshold and maker-checker mode are the team's Payroll controls (/payroll/controls). */
export async function saveSettings(raw: unknown): Promise<{ policy: ApprovalPolicy; calendar: PeriodCalendar }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { policy?: unknown; calendar?: unknown };
  const policy = parsePolicy(r.policy);
  const requested = r.policy && typeof r.policy === "object" ? (r.policy as { type?: unknown }).type : undefined;
  const errors: Record<string, string> = {};
  if (requested === "none") errors.type = "Pay runs always need a second person: choose Simple or Multi-level";
  if (requested === "multi_level" && policy.type !== "multi_level") errors.levels = "Add at least one approver";
  const approvers = await runRepo.findApprovers();
  Object.assign(errors, validatePolicy(policy, approvers));
  const current = await runRepo.findSettings();
  const calendar = r.calendar === undefined ? current.calendar : parseCalendar(r.calendar);
  if (calendar !== current.calendar) {
    // The pay calendar changes only between months: nothing open in attendance, nothing unlocked in payroll.
    const reason = canSwitchCalendar({ openPeriods: await attendanceRepo.countOpenPeriods(current.calendar), unlockedRuns: await runRepo.countUnlockedRuns() });
    if (reason) errors.calendar = reason;
  }
  if (Object.keys(errors).length) throw new RunValidationError(errors);
  await Promise.all([runRepo.setApprovalPolicy(policy.type === "none" ? { type: "simple", levels: [] } : policy), calendar !== current.calendar ? runRepo.setCalendar(calendar) : Promise.resolve()]);
  return { policy, calendar };
}

/** The current BS month (for the New run window's year list). */
export function currentBsYear(): number {
  return adToBS(new Date()).year;
}
