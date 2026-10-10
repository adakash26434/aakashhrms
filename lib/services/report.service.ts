import { eq, type SQL } from "drizzle-orm";
import { employees } from "@/lib/db/schema";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import * as repo from "@/lib/repositories/report.repository";
import { sheetHeads, type SheetHeadRow } from "@/lib/repositories/payslip-sheet.repository";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import { findEmployees as findPeople } from "@/lib/repositories/attendance.repository";
import { findLedger, findRequests } from "@/lib/repositories/leave.repository";
import { headFigures, sheetsForRun } from "@/lib/services/payslip-sheet.service";
import { companyLetterhead } from "@/lib/services/letter.service";
import { reportMonth } from "@/lib/services/attendance.service";
import { leaveYears } from "@/lib/services/leave.service";
import { ruleTypes } from "@/lib/services/leave-rule-types.service";
import * as engine from "@/lib/engines/report.engine";
import { periodFor } from "@/lib/engines/pay-period.engine";
import { asRunType, RUN_TYPE_LABEL } from "@/lib/constants/run-types";
import { adToBSString, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { nepalClock, nepalDateIso } from "@/lib/utils/nepal-time";
import type {
  AttendanceReportData,
  CompanySignatory,
  LeaveBalanceRow,
  LeaveMovementRow,
  LeaveReportData,
  LeaveRequestReportRow,
  LoanReportData,
  PayslipReportData,
  ReportCompany,
  ReportContext,
  ReportOption,
  ReportPeriods,
  ReportPlaces,
  ReportRun,
  ReportRunOption,
  RunSignOff,
  SalarySheetData,
} from "@/lib/types/report";

// Reports (4.11, template D; S48). Every report is built here from the same sources as its
// module — payslip statements, the attendance day rules, the leave ledger, the loan register —
// and only for employees the viewer covers. Reports are office screens: a SELF-scoped role is
// refused (its own records are in self-service, where payslips follow publish / hold).

export interface ReportCtx {
  userId: string;
  scope: ScopeFilter;
  /** EXPORT on the report's module (Excel / CSV buttons). */
  canExport: boolean;
}

/** Reports cover other people's records: never a SELF-scoped role (S48). */
export function assertOfficeScope(scope: ScopeFilter): void {
  if (scope.scopeType === "SELF") {
    throw new UserFacingError("Reports are for office roles. Your own payslips, leave and loans are under Self-service.");
  }
}

const scopeCondition = (scope: ScopeFilter): SQL | undefined => buildEmployeeScopeCondition(scope);

// ---------------------------------------------------------------------------
// Shared: letterhead, context, places, dates
// ---------------------------------------------------------------------------

async function letterhead(): Promise<{ company: ReportCompany; signatories: CompanySignatory[] }> {
  // The tenant's own company profile and letter design — never another company's (S48).
  const head = await companyLetterhead().catch(() => null);
  if (!head) return { company: { name: "", address: "", pan: "" }, signatories: [] };
  return {
    company: {
      name: head.name,
      address: head.address,
      pan: head.pan,
      regNo: head.design.showRegNo ? head.regNo : "",
      phone: head.phone,
      email: head.email,
      logoDataUrl: head.design.logoDataUrl,
      headerAlign: head.design.headerAlign,
      ruleStyle: head.design.ruleStyle,
    },
    signatories: [
      { name: head.signatoryName, title: head.signatoryTitle },
      { name: head.signatory2Name, title: head.signatory2Title },
    ].filter((s) => s.name.trim()),
  };
}

interface Names {
  branches: repo.NamedRow[];
  departments: repo.NamedRow[];
  designations: repo.NamedRow[];
  people: repo.ScopedEmployee[];
  branchName: (id: string) => string | undefined;
  departmentName: (id: string) => string | undefined;
  designationName: (id: string) => string | undefined;
  places: ReportPlaces;
}

async function names(scope: ScopeFilter): Promise<Names> {
  const [branches, departments, designations, people] = await Promise.all([repo.branchRows(), repo.departmentRows(), repo.designationRows(), repo.employeesInScope(scopeCondition(scope))]);
  const b = new Map(branches.map((r) => [r.id, r.name]));
  const d = new Map(departments.map((r) => [r.id, r.name]));
  const g = new Map(designations.map((r) => [r.id, r.name]));
  // Only branches and departments where the viewer covers someone, and only those people.
  const inBranches = new Set(people.map((p) => p.branchId));
  const inDepartments = new Set(people.map((p) => p.departmentId));
  return {
    branches,
    departments,
    designations,
    people,
    branchName: (id) => b.get(id),
    departmentName: (id) => d.get(id),
    designationName: (id) => g.get(id),
    places: {
      branches: branches.filter((r) => inBranches.has(r.id)).map((r) => ({ value: r.id, label: r.name })),
      departments: departments.filter((r) => inDepartments.has(r.id)).map((r) => ({ value: r.id, label: r.name })),
      employees: people.map((p) => ({ value: p.id, label: `${p.name} · ${p.code}${p.status === "Active" ? "" : " (left)"}` })),
    },
  };
}

async function context(ctx: ReportCtx, n: Names): Promise<{ context: ReportContext; signatories: CompanySignatory[] }> {
  const [head, users] = await Promise.all([letterhead(), ctx.scope.isImpersonation ? Promise.resolve(new Map<string, string>()) : findUserNames([ctx.userId])]);
  return {
    context: {
      company: head.company,
      generatedBy: ctx.scope.isImpersonation ? "Platform support" : (users.get(ctx.userId) ?? ""),
      generatedOn: `${bsOf(nepalDateIso())} ${nepalClock()}`,
      scopeLabel: engine.scopeLabel(ctx.scope, n.branchName, n.departmentName),
      partialScope: ctx.scope.scopeType !== "GLOBAL",
      canExport: ctx.canExport,
    },
    signatories: head.signatories,
  };
}

/** An AD "YYYY-MM-DD" as a BS "YYYY-MM-DD" ("" when it isn't a date). */
function bsOf(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  try {
    return adToBSString(new Date(`${iso.slice(0, 10)}T00:00:00`));
  } catch {
    return "";
  }
}

/** A moment as its Nepal calendar date in BS. */
const bsOfInstant = (at: Date | null | undefined) => (at ? bsOf(nepalDateIso(new Date(at))) : "");

/** Fiscal years (newest first) and the months of each, with the one holding today as the default. */
async function periods(): Promise<{ years: repo.FiscalYearRow[]; options: ReportOption[]; monthsOf: (id: string) => ReportOption[]; current: string; currentMonth: string }> {
  const years = await repo.fiscalYearRows();
  const today = nepalDateIso();
  const months = new Map(years.map((y) => [y.id, engine.fiscalMonths(y)]));
  const todayBs = bsOf(today).slice(0, 7);
  const current = years.find((y) => (months.get(y.id) ?? []).some((m) => m.value === todayBs)) ?? years.find((y) => y.status.toLowerCase() === "active") ?? years[0];
  return {
    years,
    options: years.map((y) => ({ value: y.id, label: y.label })),
    monthsOf: (id) => months.get(id) ?? [],
    current: current?.id ?? "",
    currentMonth: todayBs,
  };
}

/** First and last AD dates of a BS "YYYY-MM", or null when it isn't a month the calendar knows. */
function monthRange(value: string): { start: string; end: string } | null {
  const [y, m] = value.split("-").map(Number);
  try {
    const p = periodFor("BS", y, m);
    return { start: p.start, end: p.end };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------

async function runChoices(statuses: ("APPROVED" | "LOCKED")[], scope: ScopeFilter, n: Names): Promise<{ rows: repo.ReportRunRow[]; options: ReportRunOption[] }> {
  const rows = await repo.runsWithSlipsInScope(statuses, scopeCondition(scope));
  const all = n.branches.map((b) => b.id);
  return {
    rows,
    options: rows.map((r) => ({ value: r.id, label: engine.runOptionLabel(r, all, n.branchName), status: r.status === "LOCKED" ? "LOCKED" : "APPROVED" })),
  };
}

async function reportRun(run: repo.ReportRunRow, n: Names): Promise<ReportRun> {
  const users = await findUserNames([run.generatedBy, run.reviewedBy ?? "", run.approvedBy ?? ""]);
  const sign = (id: string | null, at: Date | null): RunSignOff | null => (id ? { name: users.get(id) ?? "", on: bsOfInstant(at) } : null);
  return {
    id: run.id,
    period: `${BS_MONTHS_EN[run.payPeriodMonth] ?? run.payPeriodMonth} ${run.payPeriodYear}`,
    kind: RUN_TYPE_LABEL[asRunType(run.runType)].en,
    branches: engine.runBranches(run, n.branches.map((b) => b.id), n.branchName),
    status: run.status === "LOCKED" ? "LOCKED" : "APPROVED",
    prepared: sign(run.generatedBy, run.generatedAt),
    checked: sign(run.reviewedBy, run.reviewedAt),
    approved: sign(run.approvedBy, run.approvedAt),
    lockedOn: run.lockedAt ? bsOfInstant(run.lockedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// Salary sheet
// ---------------------------------------------------------------------------

/**
 * The salary sheet of an approved or locked run (never a draft: its figures still change),
 * for the viewer's employees. Each row is the payslip's own statement, so the sheet and the
 * payslips agree line by line. Only the chosen view is filled; account numbers leave the
 * server only for the bank list.
 */
export async function salarySheet(ctx: ReportCtx, raw: unknown): Promise<SalarySheetData> {
  assertOfficeScope(ctx.scope);
  const n = await names(ctx.scope);
  const [{ context: head, signatories }, runs] = await Promise.all([context(ctx, n), runChoices(["APPROVED", "LOCKED"], ctx.scope, n)]);
  const params = engine.normalizeSalaryParams(raw, runs.options, n.places);
  const empty: SalarySheetData = { context: head, params, runs: runs.options, places: n.places, run: null, employees: 0, columns: [], rows: [], lines: [], bank: [], signatories };
  const runRow = runs.rows.find((r) => r.id === params.runId);
  if (!runRow) return empty;

  const slips = await repo.runSlips(runRow.id, scopeCondition(ctx.scope), params);
  const heads = await sheetHeads(slips.map((s) => s.slip.id));
  const bySlip = new Map<string, SheetHeadRow[]>();
  for (const h of heads) bySlip.set(h.head.payrollSlipId, [...(bySlip.get(h.head.payrollSlipId) ?? []), h]);
  const items: engine.SlipItem[] = slips.map(({ slip, branchName }) => ({
    slipId: slip.id,
    code: slip.employeeCode,
    name: slip.employeeName,
    designation: slip.designationName,
    department: slip.departmentName,
    branch: branchName ?? "",
    bankName: slip.bankName,
    bankAccount: slip.bankAccountNumber,
    figures: slip,
    heads: headFigures(bySlip.get(slip.id) ?? []),
  }));

  const view = params.view;
  return {
    ...empty,
    run: await reportRun(runRow, n),
    employees: items.length,
    columns: view === "sheet" ? engine.salaryColumns(items) : [],
    rows: view === "sheet" || view === "summary" ? engine.salaryRows(items) : [],
    lines: view === "lines" ? engine.salaryLines(items) : [],
    bank: view === "bank" ? engine.bankRows(items) : [],
  };
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

/** Printable payslips of a locked run for the viewer's employees (F11 sheets). */
export async function payslipReport(ctx: ReportCtx, raw: unknown): Promise<PayslipReportData> {
  assertOfficeScope(ctx.scope);
  const n = await names(ctx.scope);
  const [{ context: head }, runs] = await Promise.all([context(ctx, n), runChoices(["LOCKED"], ctx.scope, n)]);
  const params = engine.normalizePayslipParams(raw, runs.options, n.places);
  const runRow = runs.rows.find((r) => r.id === params.runId);
  const base: PayslipReportData = { context: head, params, runs: runs.options, places: n.places, run: null, sheets: [] };
  if (!runRow) return base;
  const extra = [params.branchId ? eq(employees.branchId, params.branchId) : undefined, params.departmentId ? eq(employees.departmentId, params.departmentId) : undefined].filter((c): c is SQL => !!c);
  const { items } = await sheetsForRun(runRow.id, { scope: scopeCondition(ctx.scope), employeeId: params.employeeId || undefined, extra });
  return { ...base, run: await reportRun(runRow, n), sheets: items.map((i) => i.sheet) };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/**
 * A BS month from the attendance rules (punches, leave, holidays, shifts, HR overrides) for the
 * viewer's employees. OT pay and the absence deduction are pay: shown only when the viewer can
 * see the salary sheet (`showAmounts`).
 */
export async function attendanceReport(ctx: ReportCtx, raw: unknown, options: { showAmounts: boolean }): Promise<AttendanceReportData> {
  assertOfficeScope(ctx.scope);
  const n = await names(ctx.scope);
  const [{ context: head }, p] = await Promise.all([context(ctx, n), periods()]);
  const params = engine.normalizeAttendanceParams(raw, p.options, p.monthsOf, { fiscalYearId: p.current, month: p.currentMonth }, n.places);
  const base: AttendanceReportData = {
    context: head,
    params,
    periods: { fiscalYears: p.options, months: Object.fromEntries(p.years.map((y) => [y.id, p.monthsOf(y.id)])) },
    places: n.places,
    monthLabel: engine.monthLabel(params.month),
    dayHeads: [],
    rows: [],
    closed: false,
    showAmounts: options.showAmounts,
  };
  const [y, m] = params.month.split("-").map(Number);
  if (!y || !m || !monthRange(params.month)) return base;

  const { period, people } = await reportMonth(ctx.scope, y, m, { branchId: params.branchId || undefined, departmentId: params.departmentId || undefined, employeeId: params.employeeId || undefined });
  const dayHeads = Array.from({ length: period.days }, (_, i) => {
    const ad = new Date(`${period.start}T00:00:00`);
    ad.setDate(ad.getDate() + i);
    return { day: i + 1, weekday: ad.toLocaleDateString("en-US", { weekday: "short" }), ad: `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}-${String(ad.getDate()).padStart(2, "0")}` };
  });
  const rows = people.map((person) =>
    engine.attendanceRow(
      {
        id: person.id,
        employeeCode: person.employeeCode,
        fullName: person.fullName,
        designation: n.designationName(person.designationId) ?? "",
        department: n.departmentName(person.departmentId) ?? "",
        branch: n.branchName(person.branchId) ?? "",
        days: person.days,
        summary: person.summary,
        amounts: person.amounts,
      },
      options.showAmounts
    )
  );
  return { ...base, dayHeads, rows, closed: people.length > 0 && people.every((x) => x.amounts.closed) };
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

/**
 * A leave year from the ledger: balances (as the leave screens show them), each type's
 * movement, leave taken and requests — for the viewer's employees. Reasons are personal and
 * appear only when asked for.
 */
export async function leaveReport(ctx: ReportCtx, raw: unknown): Promise<LeaveReportData> {
  assertOfficeScope(ctx.scope);
  const n = await names(ctx.scope);
  const [{ context: head }, years, types, people] = await Promise.all([context(ctx, n), leaveYears(), ruleTypes(), findPeople(scopeCondition(ctx.scope))]);
  const today = nepalDateIso();
  const yearOptions = [...years].reverse().map((y) => ({ value: y.id, label: y.label }));
  const current = years.find((y) => today >= y.start && today <= y.end) ?? years.at(-1);
  const typeOptions = types.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }));
  const params = engine.normalizeLeaveParams(raw, yearOptions, typeOptions, current?.id ?? "", n.places);
  const year = years.find((y) => y.id === params.fiscalYearId);
  const base: LeaveReportData = { context: head, params, years: yearOptions, types: typeOptions, places: n.places, yearLabel: year?.label ?? "", asOf: "", balanceTypes: [], balances: [], movements: [], requests: [] };
  if (!year) return base;

  const asOf = today < year.start ? year.start : today > year.end ? year.end : today;
  const chosen = people.filter((e) => (!params.branchId || e.branchId === params.branchId) && (!params.departmentId || e.departmentId === params.departmentId) && (!params.employeeId || e.id === params.employeeId));
  const ids = chosen.map((e) => e.id);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const balanceTypes = types.filter((t) => t.kind === "balance" && t.isActive && (!params.leaveTypeId || t.id === params.leaveTypeId));

  if (params.view === "balances" || params.view === "movements") {
    const ledger = await findLedger(ids, year.id);
    const linesOf = new Map<string, typeof ledger>();
    for (const l of ledger) {
      const key = `${l.employeeId}:${l.leaveTypeId}`;
      linesOf.set(key, [...(linesOf.get(key) ?? []), l]);
    }
    const applies = (t: (typeof types)[number], gender: string) => t.genderApplicable === "All" || t.genderApplicable === gender;
    // People employed now, or with anything in the year's ledger (leavers of the year stay in).
    const listed = chosen.filter((e) => e.status === "Active" || balanceTypes.some((t) => linesOf.has(`${e.id}:${t.id}`)));
    const balances: LeaveBalanceRow[] = listed.map((e) => ({
      employeeId: e.id,
      code: e.employeeCode,
      name: e.fullName,
      department: n.departmentName(e.departmentId) ?? "",
      branch: n.branchName(e.branchId) ?? "",
      balances: Object.fromEntries(balanceTypes.filter((t) => applies(t, e.gender) || linesOf.has(`${e.id}:${t.id}`)).map((t) => [t.id, engine.leaveMovement(linesOf.get(`${e.id}:${t.id}`) ?? [], asOf).available])),
    }));
    const movements: LeaveMovementRow[] = listed.flatMap((e) =>
      balanceTypes
        .filter((t) => linesOf.has(`${e.id}:${t.id}`))
        .map((t) => ({ key: `${e.id}:${t.id}`, code: e.employeeCode, name: e.fullName, leaveType: t.name, ...engine.leaveMovement(linesOf.get(`${e.id}:${t.id}`) ?? [], asOf) }))
    );
    return { ...base, asOf: bsOf(asOf), balanceTypes: balanceTypes.map((t) => ({ id: t.id, name: t.name })), balances: params.view === "balances" ? balances : [], movements: params.view === "movements" ? movements : [] };
  }

  const statuses = params.view === "taken" ? (["Approved"] as const) : params.status === "all" ? undefined : ([params.status] as const);
  const requests = (await findRequests({ employeeIds: ids, from: year.start, to: year.end, statuses: statuses ? [...statuses] : undefined })).filter((r) => !params.leaveTypeId || r.leaveTypeId === params.leaveTypeId);
  const deciders = await findUserNames(requests.map((r) => r.reviewedById ?? ""));
  const person = new Map(chosen.map((e) => [e.id, e]));
  const rows: LeaveRequestReportRow[] = requests
    .map((r) => {
      const e = person.get(r.employeeId);
      return {
        id: r.id,
        code: e?.employeeCode ?? "",
        name: e?.fullName ?? "",
        leaveType: typeName.get(r.leaveTypeId) ?? "Leave",
        applied: bsOf(String(r.appliedDate)),
        from: bsOf(String(r.effectiveFrom)),
        to: bsOf(String(r.effectiveTo)),
        days: Number(r.noOfDays) || 0,
        paidDays: r.paidDays !== null ? Number(r.paidDays) : Number(r.noOfDays) || 0,
        unpaidDays: r.unpaidDays !== null ? Number(r.unpaidDays) : 0,
        status: r.status,
        decidedBy: r.reviewedById ? (deciders.get(r.reviewedById) ?? "") : "",
        reason: params.reasons ? r.reason : null,
      };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.code.localeCompare(b.code));
  return { ...base, asOf: bsOf(asOf), requests: rows };
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

/** The loan register, repayments and loans given — for the viewer's employees (4.10 register). */
export async function loanReport(ctx: ReportCtx, raw: unknown): Promise<LoanReportData> {
  assertOfficeScope(ctx.scope);
  const n = await names(ctx.scope);
  const [{ context: head }, p, typeRows] = await Promise.all([context(ctx, n), periods(), repo.loanTypeRows()]);
  const types = typeRows.map((t) => ({ value: t.id, label: t.name }));
  const params = engine.normalizeLoanParams(raw, p.options, p.monthsOf, p.current, types, n.places);
  const months = p.monthsOf(params.fiscalYearId);
  const fy = p.years.find((y) => y.id === params.fiscalYearId);
  const periodsOut: ReportPeriods = { fiscalYears: p.options, months: Object.fromEntries(p.years.map((y) => [y.id, p.monthsOf(y.id)])) };
  const range = params.month ? monthRange(params.month) : months.length ? { start: monthRange(months[0].value)?.start ?? "", end: monthRange(months.at(-1)!.value)?.end ?? "" } : null;
  const base: LoanReportData = { context: head, params, periods: periodsOut, types, places: n.places, periodLabel: params.month ? engine.monthLabel(params.month) : (fy?.label ?? ""), loans: [], repayments: [] };
  const filter = { loanTypeId: params.loanTypeId || undefined, branchId: params.branchId || undefined, departmentId: params.departmentId || undefined, employeeId: params.employeeId || undefined };
  const scope = scopeCondition(ctx.scope);

  if (params.view === "repayments") {
    if (!range?.start || !range.end) return base;
    const rows = await repo.repaymentsInScope(scope, { ...filter, from: range.start, to: range.end });
    return {
      ...base,
      repayments: rows.map((r) => ({
        id: r.repayment.id,
        date: bsOf(String(r.repayment.repaymentDate)),
        code: r.code,
        name: r.name,
        loanType: r.loanType,
        amount: String(r.repayment.amountPaid),
        how: engine.repaymentHow(r.repayment.paymentMethod, r.runMonth && r.runYear ? { month: r.runMonth, year: r.runYear } : null),
        note: r.repayment.note ?? "",
      })),
    };
  }

  const given = params.view === "given";
  if (given && (!range?.start || !range.end)) return base;
  const rows = await repo.loansInScope(scope, {
    ...filter,
    status: given || params.status === "all" ? undefined : params.status === "running" ? "ACTIVE" : "CLOSED",
    givenFrom: given ? range!.start : undefined,
    givenTo: given ? range!.end : undefined,
  });
  return {
    ...base,
    periodLabel: given ? base.periodLabel : "",
    loans: rows.map(({ loan, code, name, loanType }) => ({
      loanId: loan.id,
      code,
      name,
      loanType,
      given: bsOf(String(loan.givenDate)),
      amount: String(loan.loanAmount),
      interest: engine.loanInterest(loan),
      totalPayable: String(loan.totalPayable),
      repaid: String(loan.totalReturned),
      writtenOff: String(loan.writtenOffAmount),
      balance: String(loan.remainingAmount),
      installment: String(loan.installmentAmount),
      installmentsLeft: engine.loanInstallmentsLeft(loan),
      status: engine.loanStatusLabel(loan),
      paidVia: loan.source === "opening" ? "Before this system" : engine.paidViaLabel(loan.paidVia),
      reference: loan.paymentRef ?? "",
      source: loan.source === "opening" ? "opening" : "disbursed",
    })),
  };
}
