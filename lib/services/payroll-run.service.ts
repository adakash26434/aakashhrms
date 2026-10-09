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
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as payrollService from "@/lib/services/payroll.service";
import * as arrearsService from "@/lib/services/arrears.service";
import * as settlementService from "@/lib/services/settlement.service";
import * as settlementRepo from "@/lib/repositories/settlement.repository";
import { parseSettlementSettings, validateSettlementSettings } from "@/lib/engines/settlement.engine";
import type { SettlementSettings, WorkingPeriod } from "@/lib/types/payroll-run";
import { overtimeWaitingFor } from "@/lib/services/attendance.service";
import { getDb } from "@/lib/db";
import { leaveApplications } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { applyDecision, availableActions, buildFlow, isCompanyAdministrator, parsePolicy, statusText, validatePolicy, type ApprovalActor, type ApprovalRequest, type ApprovalWording, type Decision } from "@/lib/engines/approval.engine";
import { canTransition, normalizeThreshold, preflight, scopeText, variance, varianceOpen, type PreflightEmployee } from "@/lib/engines/payroll-run.engine";
import { canSwitchCalendar, parseCalendar, runLabel } from "@/lib/engines/pay-calendar.engine";
import { periodFor, periodContaining, shiftPeriod, type PayPeriod, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import { isOwnRecord } from "@/lib/auth/self-action";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { adToBS } from "@/lib/utils/bs-calendar";
import type { ApprovalFlow, ApprovalPolicy, ApprovalTimelineEntry } from "@/lib/types/approval";
import type { PayrollRun, PayrollSlip } from "@/lib/types/payroll";
import { RUN_TYPES, type NewRunInput, type PayrollRunView, type PayrollRunsPageData, type PreflightResult, type RunActions, type RunDetail, type RunType, type RunVariance, type SlipDetail } from "@/lib/types/payroll-run";

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

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const toIso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

function flowOf(run: PayrollRun): ApprovalFlow {
  return run.approvalType === "multi_level" ? { type: "multi_level", levels: run.approvalLevels ?? [] } : { type: "simple", levels: run.approvalLevels ?? [] };
}

/** The run as an approval request. Subject employees are left out on purpose: see S34 in 03. */
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

async function runView(run: PayrollRun, ctx: RunCtx, extras: { approvers: Awaited<ReturnType<typeof runRepo.findApprovers>>; names: Map<string, string>; timeline: Awaited<ReturnType<typeof runRepo.findTimeline>>; branchName: (id: string) => string; branchCount: number; openMonths: string[]; today: string }): Promise<PayrollRunView> {
  const open = varianceOpen(run.variance);
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
    variance: run.variance ?? null,
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
  const [runs, settings, approvers, branches, departments, designations, employees, payHeads, exitCases, settlement] = await Promise.all([
    payrollRepo.findAllPayrollRuns(),
    runRepo.findSettings(),
    runRepo.findApprovers(),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "Active" }),
    payHeadRepository.findAllPayHeads(),
    settlementService.closedCases(ctx.scope),
    settlementRepo.getSettlementSettings(),
  ]);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const timeline = await runRepo.findTimeline(runs.map((r) => r.id));
  const names = await runRepo.findUserNames([...runs.flatMap((r) => [r.generatedBy, r.submittedBy ?? "", r.reviewedBy ?? "", r.approvedBy ?? ""]), ...timeline.flatMap((t) => [t.actorId ?? "", t.onBehalfOf ?? ""]), ...runs.flatMap((r) => (r.variance?.items ?? []).map((i) => i.acknowledgedBy ?? ""))]);
  const sorted = [...runs].sort((a, b) => b.payPeriodYear * 100 + b.payPeriodMonth - (a.payPeriodYear * 100 + a.payPeriodMonth) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const views: PayrollRunView[] = [];
  for (const r of sorted) {
    const openMonths = r.status === "LOCKED" || r.runType !== "REGULAR" ? [] : await openMonthsOf(r, branchName);
    views.push(await runView(r, ctx, { approvers, names, timeline, branchName, branchCount: branches.length, openMonths, today }));
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
    varianceThresholdPct: settings.thresholdPct,
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
    categories: [...new Set(employees.map((e) => e.category))].sort(),
    employees: employees.map((e) => ({ id: e.id, name: e.fullName, employeeCode: e.employeeCode, branchId: e.branchId, departmentId: e.departmentId, designationId: e.designationId, category: e.category })),
    occasionalAllowances: payHeads.filter((h) => h.flags.isFestivalAllowance || h.flags.isRemoteAllowance).map((h) => ({ id: h.id, name: h.name, isFestivalAllowance: !!h.flags.isFestivalAllowance, isRemoteAllowance: !!h.flags.isRemoteAllowance })),
    allPayHeads: payHeads.map((h) => ({ id: h.id, name: h.name, code: h.code, type: h.type as "allowance" | "deduction" })),
    suggested: { year: suggested.year, month: suggested.month },
    exitCases,
    settlement,
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

function cleanInput(raw: unknown, calendar: PeriodCalendar): NewRunInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : []);
  const errors: Record<string, string> = {};
  const year = Number(r.payPeriodYear);
  const month = Number(r.payPeriodMonth);
  const runType: RunType = (RUN_TYPES as readonly string[]).includes(String(r.runType)) ? (r.runType as RunType) : "REGULAR";
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) errors.period = "Choose the month";
  else {
    try {
      periodFor(calendar, year, month);
    } catch {
      errors.period = "That month is outside the calendar";
    }
  }
  const branchIds = ids(r.branchIds);
  if (!branchIds.length && runType !== "FINAL_SETTLEMENT") errors.branchIds = "Choose at least one branch";
  const exitCaseId = typeof r.exitCaseId === "string" && r.exitCaseId ? r.exitCaseId : null;
  if (runType === "FINAL_SETTLEMENT" && !exitCaseId) errors.exitCaseId = "Choose the exit case";
  const notice = Number(r.noticeRecovery ?? 0);
  if (!Number.isFinite(notice) || notice < 0) errors.noticeRecovery = "An amount, 0 or more";
  const payslipDate = typeof r.payslipDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.payslipDate) ? r.payslipDate : null;
  if (Object.keys(errors).length) throw new RunValidationError(errors);
  return {
    runType,
    payPeriodYear: year,
    payPeriodMonth: month,
    branchIds,
    departmentIds: ids(r.departmentIds),
    designationIds: ids(r.designationIds),
    employeeCategories: ids(r.employeeCategories),
    employeeIds: ids(r.employeeIds),
    occasionalAllowanceHeadIds: ids(r.occasionalAllowanceHeadIds),
    payslipDate,
    recreateIfExists: r.recreateIfExists === true,
    exitCaseId,
    noticeRecovery: notice > 0 ? String(notice) : "0",
    picks: Array.isArray(r.picks)
      ? r.picks
          .map((p) => {
            const x = (p && typeof p === "object" ? p : {}) as { employeeId?: unknown; months?: unknown };
            const months = (Array.isArray(x.months) ? x.months : [])
              .map((m) => (m && typeof m === "object" ? m : {}) as { calendar?: unknown; year?: unknown; month?: unknown; kind?: unknown })
              .filter((m) => Number.isInteger(Number(m.year)) && Number.isInteger(Number(m.month)))
              .map((m) => ({ calendar: (m.calendar === "AD" ? "AD" : "BS") as "BS" | "AD", year: Number(m.year), month: Number(m.month), kind: (m.kind === "attendance" ? "attendance" : "salary") as "salary" | "attendance" }));
            return typeof x.employeeId === "string" && months.length ? { employeeId: x.employeeId, months } : null;
          })
          .filter((p): p is NonNullable<typeof p> => !!p)
          .slice(0, 500)
      : undefined,
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

/** Pre-flight for a run that does not exist yet (the New run window's Check). An arrears run also lists its candidates (scope applied). */
export async function checkNewRun(raw: unknown, scope?: ScopeFilter): Promise<PreflightResult> {
  const calendar = (await runRepo.findSettings()).calendar;
  const input = cleanInput(raw, calendar);
  const period = periodFor(calendar, input.payPeriodYear, input.payPeriodMonth);
  const existing = await payrollRepo.findPayrollRunByPeriodAndBranch({ calendar, payPeriodMonth: input.payPeriodMonth, payPeriodYear: input.payPeriodYear, branchIds: input.branchIds, runType: input.runType });
  const arrears = input.runType === "ARREARS" && scope ? await arrearsService.candidates(scope, input) : undefined;
  const settlement = input.runType === "FINAL_SETTLEMENT" && scope ? await settlementService.preview(input.exitCaseId, input.noticeRecovery, { scope, userId: scope.userId }) : undefined;
  const result = await preflightFor(period, input, { existing, settlement: input.runType === "FINAL_SETTLEMENT" ? { ready: !!settlement, blocked: settlement?.blocked ?? null } : null, festivalHeads: await festivalHeadCount(input.occasionalAllowanceHeadIds), arrearsCandidates: arrears ? arrears.filter((c) => !c.blocked).length : null });
  if (settlement) return { ...result, settlement };
  return arrears ? { ...result, arrears } : result;
}

async function festivalHeadCount(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const heads = await payHeadRepository.findAllPayHeads();
  return heads.filter((h) => ids.includes(h.id) && h.flags.isFestivalAllowance).length;
}

async function preflightFor(period: PayPeriod, input: Pick<NewRunInput, "runType" | "branchIds" | "departmentIds" | "designationIds" | "employeeCategories" | "employeeIds">, opts: { existing: PayrollRun[]; ignoreRunId?: string; festivalHeads: number; arrearsCandidates?: number | null; settlement?: { ready: boolean; blocked: string | null } | null }): Promise<PreflightResult> {
  const today = nepalDateIso();
  const full: NewRunInput = { ...input, payPeriodYear: period.year, payPeriodMonth: period.month, occasionalAllowanceHeadIds: [], payslipDate: null };
  const people = await scopedEmployees(full);
  const ids = people.map((e) => e.id);
  const regular = input.runType === "REGULAR";
  const [branches, periods, salaries, batches, activeFy, slabs, overtime, funds, hasFunds, previousRun] = await Promise.all([
    branchRepository.findAllBranches(),
    attendanceRepo.findPeriods(period.calendar, period.year, period.month),
    salaryMappingRepository.findInForceByEmployeeIds(ids, period.end),
    salaryStructureRepository.findBatches(),
    fiscalYearRepository.findFiscalYearForDate(period.end),
    taxRateRepository.findAllSlabs(),
    regular ? overtimeWaitingFor(ids, period) : Promise.resolve(new Map<string, number>()),
    regular && ids.length ? fundRepository.contributionsForMonth(ids, period.year, period.month) : Promise.resolve(new Map()),
    fundRepository.hasActiveFunds(),
    (() => {
      const prev = shiftPeriod(period, -1);
      return runRepo.findRunForPeriod(period.calendar, prev.year, prev.month);
    })(),
  ]);
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
    };
  });
  const prevPeriod = shiftPeriod(period, -1);
  return preflight({
    runType: input.runType,
    festivalHeads: opts.festivalHeads,
    arrearsCandidates: opts.arrearsCandidates ?? null,
    settlement: opts.settlement ?? null,
    period: { year: period.year, month: period.month, label: period.label, start: period.start, end: period.end },
    today,
    branches: input.branchIds.map((id) => ({ id, name: branches.find((b) => b.id === id)?.name ?? id, closed: closed.has(id) })),
    employees,
    pendingLeaves,
    pendingSalaryChanges: batches.filter((b) => b.status === "pending" && String(b.effectiveFrom).slice(0, 10) <= period.end).length,
    activeFiscalYear: activeFy ? { id: activeFy.id, label: activeFy.label } : null,
    slabCount: activeFy ? slabs.filter((s) => s.fiscalYearId === activeFy.id).length : 0,
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
  const input = cleanInput(raw, (await runRepo.findSettings()).calendar);
  const check = await checkNewRun(raw, ctx.scope);
  const blocking = check.problems.filter((p) => p.severity === "blocking" && !(input.recreateIfExists && p.code === "run_exists"));
  if (blocking.length) throw new UserFacingError(blocking.length === 1 ? blocking[0].text : `${blocking.length} problems stop this run. Fix them first (the list is in the window).`);
  if (input.runType === "ARREARS") {
    const run = await arrearsService.generateArrearsRun(input, ctx);
    await refreshVariance(run.id);
    return { run, preflight: check };
  }
  if (input.runType === "FINAL_SETTLEMENT") {
    const run = await settlementService.generateSettlementRun(input, ctx);
    await refreshVariance(run.id);
    return { run, preflight: check };
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
      recreateIfExists: input.recreateIfExists,
    },
    ctx.userId
  );
  await refreshVariance(run.id);
  return { run, preflight: check };
}

// ---------------------------------------------------------------------------
// Variance
// ---------------------------------------------------------------------------

/** Works the variance out again (after edits, syncs or recalculations); acknowledgements stand while the flags are the same. */
export async function refreshVariance(runId: string): Promise<RunVariance> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  if (run.status === "LOCKED") return run.variance ?? { baseRunId: null, baseLabel: null, thresholdPct: 0, computedAt: new Date().toISOString(), items: [] };
  // Only a regular run is compared with the month before; bonus, arrears and settlement runs stand alone.
  if (run.runType !== "REGULAR") {
    const empty: RunVariance = { baseRunId: null, baseLabel: null, thresholdPct: 0, computedAt: new Date().toISOString(), items: [] };
    await runRepo.saveVariance(runId, empty);
    return empty;
  }
  const [slips, settings, base] = await Promise.all([payrollRepo.findSlipsByRunId(runId), runRepo.findSettings(), runRepo.findLastLockedRunBefore(run.calendar, run.payPeriodYear, run.payPeriodMonth)]);
  const ids = slips.map((s) => s.employeeId);
  const [previous, people] = await Promise.all([base ? runRepo.findRunSlipsByEmployee(base.id, ids) : Promise.resolve(new Map<string, PayrollSlip>()), attendanceRepo.findEmployeesByIds(ids)]);
  const period = periodFor(parseCalendar(run.calendar), run.payPeriodYear, run.payPeriodMonth);
  const v = variance({
    slips,
    previous,
    employees: new Map(people.map((e) => [e.id, { status: e.status, terminationDate: e.terminationDate }])),
    period: { start: period.start, end: period.end },
    thresholdPct: settings.thresholdPct,
    base: base ? { runId: base.id, label: runLabel(base) } : null,
    computedAt: new Date().toISOString(),
    earlier: run.variance,
  });
  await runRepo.saveVariance(runId, v);
  return v;
}

/** Acknowledges one employee's flags with a note (who and when are kept with it; audited by the action). */
export async function acknowledge(runId: string, employeeId: string, noteRaw: unknown, ctx: RunCtx): Promise<{ open: number }> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  if (run.status !== "DRAFT") throw new UserFacingError("Only a draft run's variance can be acknowledged.");
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, MAX_NOTE) : "";
  if (note.length < 3) throw new RunValidationError({ note: "Say why this is right" });
  const v = run.variance ?? (await refreshVariance(runId));
  const item = v.items.find((i) => i.employeeId === employeeId);
  if (!item) throw new UserFacingError("Nothing is flagged for that employee any more.");
  if (isOwnRecord(ctx.scope.employeeId, employeeId)) throw new OwnPayslipError("This is your own payslip: someone else has to acknowledge its variance.");
  const names = await runRepo.findUserNames([ctx.userId]);
  item.acknowledgedBy = ctx.userId;
  item.acknowledgedByName = names.get(ctx.userId) ?? null;
  item.acknowledgedAt = new Date().toISOString();
  item.note = note;
  await runRepo.saveVariance(runId, v);
  return { open: varianceOpen(v) };
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
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  if (run.status !== "DRAFT") throw new UserFacingError(`This run is ${run.status.toLowerCase().replace("_", " ")} already.`);
  const check = await checkRun(runId);
  const blocking = check.problems.filter((p) => p.severity === "blocking");
  if (blocking.length) throw new UserFacingError(blocking[0].text);
  const v = await refreshVariance(runId);
  const open = varianceOpen(v);
  if (open) throw new UserFacingError(`${open} employee${open === 1 ? "" : "s"} still ${open === 1 ? "has" : "have"} unacknowledged changes. Review the Variance step first.`);
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
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
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
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  if (run.status !== "APPROVED") throw new UserFacingError("Only an approved run can be locked.");
  return payrollService.transitionPayrollRun(runId, "LOCKED", ctx.userId);
}

/** Discards a run that is not locked (its payslips go with it). */
export async function discard(runId: string, ctx: RunCtx): Promise<void> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  if (run.status === "LOCKED") throw new UserFacingError("A locked run cannot be discarded.");
  await payrollService.deletePayrollRun(runId, ctx.userId);
}

// ---------------------------------------------------------------------------
// Payslip edits (S21: never your own)
// ---------------------------------------------------------------------------

/** The slip's employee must not be the acting user (S21); the run must be a draft. */
export async function guardSlip(slipId: string, ctx: RunCtx): Promise<PayrollSlip> {
  const slip = await payrollRepo.findSlipById(slipId);
  if (!slip) throw new UserFacingError("That payslip no longer exists. Refresh the page.");
  if (isOwnRecord(ctx.scope.employeeId, slip.employeeId)) throw new OwnPayslipError();
  const run = await payrollRepo.findPayrollRunById(slip.payrollRunId);
  if (!run) throw new UserFacingError("That run no longer exists. Refresh the page.");
  if (run.status !== "DRAFT") throw new UserFacingError("Payslips change only while the run is a draft. Reject it back to draft first.");
  return slip;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Approval policy for pay runs (simple or multi-level; never none), the variance threshold and the pay calendar. */
export async function saveSettings(raw: unknown): Promise<{ policy: ApprovalPolicy; thresholdPct: number; calendar: PeriodCalendar; settlement: SettlementSettings }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { policy?: unknown; thresholdPct?: unknown; calendar?: unknown; settlement?: unknown };
  const settlement = r.settlement === undefined ? await settlementRepo.getSettlementSettings() : parseSettlementSettings(r.settlement);
  const policy = parsePolicy(r.policy);
  const requested = r.policy && typeof r.policy === "object" ? (r.policy as { type?: unknown }).type : undefined;
  const errors: Record<string, string> = {};
  if (requested === "none") errors.type = "Pay runs always need a second person: choose Simple or Multi-level";
  if (requested === "multi_level" && policy.type !== "multi_level") errors.levels = "Add at least one approver";
  const approvers = await runRepo.findApprovers();
  Object.assign(errors, validatePolicy(policy, approvers));
  const n = Number(r.thresholdPct);
  if (!Number.isFinite(n) || n < 1 || n > 50) errors.thresholdPct = "Between 1 and 50 percent";
  const current = await runRepo.findSettings();
  const calendar = r.calendar === undefined ? current.calendar : parseCalendar(r.calendar);
  if (calendar !== current.calendar) {
    // The pay calendar changes only between months: nothing open in attendance, nothing unlocked in payroll.
    const reason = canSwitchCalendar({ openPeriods: await attendanceRepo.countOpenPeriods(current.calendar), unlockedRuns: await runRepo.countUnlockedRuns() });
    if (reason) errors.calendar = reason;
  }
  Object.assign(errors, validateSettlementSettings(settlement));
  if (Object.keys(errors).length) throw new RunValidationError(errors);
  const thresholdPct = normalizeThreshold(n);
  await settlementRepo.setSettlementSettings(settlement);
  await Promise.all([runRepo.setApprovalPolicy(policy.type === "none" ? { type: "simple", levels: [] } : policy), runRepo.setThreshold(thresholdPct), calendar !== current.calendar ? runRepo.setCalendar(calendar) : Promise.resolve()]);
  return { policy, thresholdPct, calendar, settlement };
}

/** The current BS month (for the New run window's year list). */
export function currentBsYear(): number {
  return adToBS(new Date()).year;
}
