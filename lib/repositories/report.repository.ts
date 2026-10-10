import { getDb } from "@/lib/db";
import { branches, departments, designations, employees, fiscalYears, loanRepayments, loans, loanTypes, payrollRuns, payrollSlips } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

// Reports (4.11): Drizzle queries only. Every query about employees takes the viewer's scope
// condition (buildEmployeeScopeCondition) as a required argument — `undefined` only for a
// company-wide viewer — so no report can read outside the branches it was opened for (S48).

export type Scope = SQL | undefined;

export interface NamedRow {
  id: string;
  name: string;
}

export async function branchRows(): Promise<NamedRow[]> {
  return (await getDb()).select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.name));
}

export async function departmentRows(): Promise<NamedRow[]> {
  return (await getDb()).select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name));
}

export async function designationRows(): Promise<NamedRow[]> {
  return (await getDb()).select({ id: designations.id, name: designations.name }).from(designations).orderBy(asc(designations.name));
}

export interface ScopedEmployee {
  id: string;
  code: string;
  name: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  status: string;
}

/** Employees the viewer covers (every status: reports look back). */
export async function employeesInScope(scope: Scope): Promise<ScopedEmployee[]> {
  return (await getDb())
    .select({
      id: employees.id,
      code: employees.employeeCode,
      name: employees.fullName,
      branchId: employees.branchId,
      departmentId: employees.departmentId,
      designationId: employees.designationId,
      status: employees.status,
    })
    .from(employees)
    .where(scope)
    .orderBy(asc(employees.fullName));
}

export interface FiscalYearRow {
  id: string;
  label: string;
  fromMonth: number;
  toMonth: number;
  startDateBS: string;
  endDateBS: string;
  startDateAD: Date;
  endDateAD: Date;
  status: string;
}

export async function fiscalYearRows(): Promise<FiscalYearRow[]> {
  return (await getDb())
    .select({
      id: fiscalYears.id,
      label: fiscalYears.label,
      fromMonth: fiscalYears.fromMonth,
      toMonth: fiscalYears.toMonth,
      startDateBS: fiscalYears.startDateBS,
      endDateBS: fiscalYears.endDateBS,
      startDateAD: fiscalYears.startDateAD,
      endDateAD: fiscalYears.endDateAD,
      status: fiscalYears.status,
    })
    .from(fiscalYears)
    .orderBy(desc(fiscalYears.startDateAD));
}

// ---------------------------------------------------------------------------
// Payroll runs and payslips
// ---------------------------------------------------------------------------

export interface ReportRunRow {
  id: string;
  /** 4.8b: the pay calendar of the run's month ("BS" | "AD"). */
  calendar: string;
  payPeriodYear: number;
  payPeriodMonth: number;
  runType: string;
  status: string;
  branchIds: string[];
  generatedBy: string;
  generatedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  lockedAt: Date | null;
}

const runColumns = {
  id: payrollRuns.id,
  calendar: payrollRuns.calendar,
  payPeriodYear: payrollRuns.payPeriodYear,
  payPeriodMonth: payrollRuns.payPeriodMonth,
  runType: payrollRuns.runType,
  status: payrollRuns.status,
  branchIds: payrollRuns.branchIds,
  generatedBy: payrollRuns.generatedBy,
  generatedAt: payrollRuns.generatedAt,
  reviewedBy: payrollRuns.reviewedBy,
  reviewedAt: payrollRuns.reviewedAt,
  approvedBy: payrollRuns.approvedBy,
  approvedAt: payrollRuns.approvedAt,
  lockedAt: payrollRuns.lockedAt,
};

/** Runs in these statuses with at least one payslip of an employee the viewer covers, newest first. No totals: they are company-wide. */
export async function runsWithSlipsInScope(statuses: ("APPROVED" | "LOCKED")[], scope: Scope): Promise<ReportRunRow[]> {
  const inScope = sql`exists (select 1 from ${payrollSlips} inner join ${employees} on ${employees.id} = ${payrollSlips.employeeId} where ${payrollSlips.payrollRunId} = ${payrollRuns.id}${scope ? sql` and ${scope}` : sql``})`;
  return (await getDb())
    .select(runColumns)
    .from(payrollRuns)
    .where(and(inArray(payrollRuns.status, statuses), inScope))
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth), asc(payrollRuns.runType), desc(payrollRuns.generatedAt));
}

export interface ReportSlipRow {
  slip: typeof payrollSlips.$inferSelect;
  branchName: string | null;
}

/** A run's payslips for employees the viewer covers, narrowed by branch / department / employee. */
export async function runSlips(runId: string, scope: Scope, filter: { branchId?: string; departmentId?: string; employeeId?: string }): Promise<ReportSlipRow[]> {
  return (await getDb())
    .select({ slip: payrollSlips, branchName: branches.name })
    .from(payrollSlips)
    .innerJoin(employees, eq(employees.id, payrollSlips.employeeId))
    .leftJoin(branches, eq(branches.id, employees.branchId))
    .where(
      and(
        eq(payrollSlips.payrollRunId, runId),
        scope,
        filter.branchId ? eq(employees.branchId, filter.branchId) : undefined,
        filter.departmentId ? eq(employees.departmentId, filter.departmentId) : undefined,
        filter.employeeId ? eq(payrollSlips.employeeId, filter.employeeId) : undefined
      )
    )
    .orderBy(asc(payrollSlips.employeeCode));
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export async function loanTypeRows(): Promise<NamedRow[]> {
  return (await getDb()).select({ id: loanTypes.id, name: loanTypes.name }).from(loanTypes).orderBy(asc(loanTypes.name));
}

export interface LoanFilter {
  loanTypeId?: string;
  branchId?: string;
  departmentId?: string;
  employeeId?: string;
  status?: "ACTIVE" | "CLOSED";
  /** Loans given in this AD date range (inclusive). */
  givenFrom?: string;
  givenTo?: string;
}

const employeeFilter = (f: { branchId?: string; departmentId?: string; employeeId?: string }) => [
  f.branchId ? eq(employees.branchId, f.branchId) : undefined,
  f.departmentId ? eq(employees.departmentId, f.departmentId) : undefined,
  f.employeeId ? eq(employees.id, f.employeeId) : undefined,
];

export async function loansInScope(scope: Scope, f: LoanFilter) {
  return (await getDb())
    .select({ loan: loans, code: employees.employeeCode, name: employees.fullName, loanType: loanTypes.name })
    .from(loans)
    .innerJoin(employees, eq(employees.id, loans.employeeId))
    .innerJoin(loanTypes, eq(loanTypes.id, loans.loanTypeId))
    .where(
      and(
        scope,
        ...employeeFilter(f),
        f.loanTypeId ? eq(loans.loanTypeId, f.loanTypeId) : undefined,
        f.status ? eq(loans.status, f.status) : undefined,
        f.givenFrom ? gte(loans.givenDate, f.givenFrom) : undefined,
        f.givenTo ? lte(loans.givenDate, f.givenTo) : undefined
      )
    )
    .orderBy(asc(employees.employeeCode), asc(loans.givenDate));
}

/** Repayments in an AD date range (inclusive) for employees the viewer covers, with the pay run that deducted them. */
export async function repaymentsInScope(scope: Scope, f: { from: string; to: string; loanTypeId?: string; branchId?: string; departmentId?: string; employeeId?: string }) {
  return (await getDb())
    .select({
      repayment: loanRepayments,
      code: employees.employeeCode,
      name: employees.fullName,
      loanType: loanTypes.name,
      runMonth: payrollRuns.payPeriodMonth,
      runYear: payrollRuns.payPeriodYear,
    })
    .from(loanRepayments)
    .innerJoin(loans, eq(loans.id, loanRepayments.loanId))
    .innerJoin(employees, eq(employees.id, loanRepayments.employeeId))
    .innerJoin(loanTypes, eq(loanTypes.id, loans.loanTypeId))
    .leftJoin(payrollSlips, eq(payrollSlips.id, loanRepayments.payrollSlipId))
    .leftJoin(payrollRuns, eq(payrollRuns.id, payrollSlips.payrollRunId))
    .where(and(scope, ...employeeFilter(f), f.loanTypeId ? eq(loans.loanTypeId, f.loanTypeId) : undefined, gte(loanRepayments.repaymentDate, f.from), lte(loanRepayments.repaymentDate, f.to)))
    .orderBy(asc(loanRepayments.repaymentDate), asc(employees.employeeCode));
}
