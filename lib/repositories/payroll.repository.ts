import { getDb } from '@/lib/db';
import { payrollRuns, payrollSlips, payrollSlipHeads } from '@/lib/db/schema';
import { eq, and, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { DepartmentCost, PeriodCostRow } from '@/lib/types/dashboard';
import type { 
  PayrollRun, 
  PayrollSlip, 
  PayrollSlipHead, 
  PayrollRunStatus 
} from '@/lib/types/payroll';

type DBPayrollRun = typeof payrollRuns.$inferSelect;
type DBPayrollSlip = typeof payrollSlips.$inferSelect;
type DBPayrollSlipHead = typeof payrollSlipHeads.$inferSelect;

function mapPayrollRun(row: DBPayrollRun): PayrollRun {
  return {
    ...row,
    status: row.status as PayrollRunStatus,
    departmentIds: row.departmentIds || null,
  };
}

function mapPayrollSlip(row: DBPayrollSlip): PayrollSlip {
  return {
    ...row,
    status: row.status as 'DRAFT' | 'LOCKED',
  };
}

function mapPayrollSlipHead(row: DBPayrollSlipHead): PayrollSlipHead {
  return {
    ...row,
    headType: row.headType as 'allowance' | 'deduction',
  };
}

// -----------------------------------------------------------------------------
// Payroll Runs
// -----------------------------------------------------------------------------

export async function findAllPayrollRuns(): Promise<PayrollRun[]> {
  const rows = await (await getDb()).select().from(payrollRuns).orderBy(payrollRuns.createdAt);
  return rows.map(mapPayrollRun);
}

export async function findPayrollRunById(id: string): Promise<PayrollRun | undefined> {
  const rows = await (await getDb()).select().from(payrollRuns).where(eq(payrollRuns.id, id));
  if (!rows.length) return undefined;
  return mapPayrollRun(rows[0]);
}

export async function findPayrollRunByPeriodAndBranch(args: {
  calendar: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  branchIds: string[];
  /** 4.8b: runs of this kind only (a bonus run may sit beside the regular one). */
  runType: string;
}): Promise<PayrollRun[]> {
  // Query to find existing runs with overlapping branch sets and same month/year
  const allRuns = await (await getDb()).select().from(payrollRuns).where(
    and(
      eq(payrollRuns.calendar, args.calendar),
      eq(payrollRuns.payPeriodMonth, args.payPeriodMonth),
      eq(payrollRuns.payPeriodYear, args.payPeriodYear),
      eq(payrollRuns.runType, args.runType)
    )
  );

  // Return runs that contain any of the selected branches
  return allRuns.filter(run => 
    run.branchIds.some(b => args.branchIds.includes(b))
  ).map(mapPayrollRun);
}

export async function createPayrollRun(data: {
  fiscalYearId: string;
  calendar: string;
  runType: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  payPeriodStartDate: string;
  payPeriodEndDate: string;
  branchIds: string[];
  departmentIds: string[] | null;
  designationIds: string[];
  employeeCategories: string[];
  employeeIds: string[];
  occasionalAllowanceHeadIds: string[];
  payslipMonth: number | null;
  payslipDate: string | null;
  status: PayrollRunStatus;
  totalGross: string;
  totalDeductions: string;
  totalNetPayable: string;
  totalTds: string;
  totalPf: string;
  totalSsf: string;
  employeeCount: number;
  generatedBy: string;
  exitCaseId?: string | null;
}, tx?: any): Promise<PayrollRun> {
  const client = tx || (await getDb());
  const rows = await client.insert(payrollRuns).values({
    fiscalYearId: data.fiscalYearId,
    calendar: data.calendar,
    runType: data.runType,
    payPeriodMonth: data.payPeriodMonth,
    payPeriodYear: data.payPeriodYear,
    payPeriodStartDate: data.payPeriodStartDate,
    payPeriodEndDate: data.payPeriodEndDate,
    branchIds: data.branchIds,
    departmentIds: data.departmentIds,
    designationIds: data.designationIds,
    employeeCategories: data.employeeCategories,
    employeeIds: data.employeeIds,
    occasionalAllowanceHeadIds: data.occasionalAllowanceHeadIds,
    payslipMonth: data.payslipMonth,
    payslipDate: data.payslipDate,
    status: data.status,
    totalGross: data.totalGross,
    totalDeductions: data.totalDeductions,
    totalNetPayable: data.totalNetPayable,
    totalTds: data.totalTds,
    totalPf: data.totalPf,
    totalSsf: data.totalSsf,
    employeeCount: data.employeeCount,
    generatedBy: data.generatedBy,
    exitCaseId: data.exitCaseId ?? null,
  }).returning();
  
  return mapPayrollRun(rows[0]);
}

export async function updatePayrollRunStatus(
  id: string,
  status: PayrollRunStatus,
  actionByUserId: string,
  notes?: string
): Promise<PayrollRun> {
  const updateData: Record<string, any> = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'UNDER_REVIEW') {
    // Note: hr submitted for review
  } else if (status === 'APPROVED') {
    updateData.reviewedBy = actionByUserId;
    updateData.reviewedAt = new Date();
  } else if (status === 'LOCKED') {
    updateData.approvedBy = actionByUserId;
    updateData.approvedAt = new Date();
    updateData.lockedAt = new Date();
  }

  if (notes) {
    updateData.notes = notes;
  }

  const rows = await (await getDb()).update(payrollRuns)
    .set(updateData)
    .where(eq(payrollRuns.id, id))
    .returning();

  return mapPayrollRun(rows[0]);
}

export async function updatePayrollRunTotals(
  id: string,
  totals: {
    totalGross: string;
    totalDeductions: string;
    totalNetPayable: string;
    totalTds: string;
    totalPf: string;
    totalSsf: string;
  }
): Promise<void> {
  await (await getDb()).update(payrollRuns)
    .set({
      ...totals,
      updatedAt: new Date(),
    })
    .where(eq(payrollRuns.id, id));
}

/**
 * Recomputes a run's stored totals and employee count from its payslips in
 * one statement (4.8 fix). Call it AFTER the transaction that changed the
 * slips has committed: a sum read through another connection inside the
 * transaction saw the old slip and lagged the payslips (Shrawan 2083: run
 * net 62,068.75 vs payslips 68,068.75).
 */
export async function refreshRunTotals(runId: string): Promise<void> {
  await (await getDb()).execute(sql`
    UPDATE ${payrollRuns} r SET
      total_gross = s.gross,
      total_deductions = s.deductions,
      total_net_payable = s.net,
      total_tds = s.tds,
      total_pf = s.pf,
      total_ssf = s.ssf,
      employee_count = s.n,
      updated_at = now()
    FROM (
      SELECT
        COALESCE(sum(gross_earnings), 0) AS gross,
        COALESCE(sum(total_deductions), 0) AS deductions,
        COALESCE(sum(net_payable), 0) AS net,
        COALESCE(sum(tds_this_month), 0) AS tds,
        COALESCE(sum(pf_employee), 0) AS pf,
        COALESCE(sum(ssf_employee), 0) AS ssf,
        count(*)::int AS n
      FROM ${payrollSlips}
      WHERE payroll_run_id = ${runId}
    ) s
    WHERE r.id = ${runId}
  `);
}

// -----------------------------------------------------------------------------
// Payroll Slips & Slip Heads
// -----------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createPayrollSlips(slipsWithHeads: Array<{
  slip: typeof payrollSlips.$inferInsert;
  heads: Array<{
    payHeadId: string;
    payHeadName: string;
    headType: string;
    amount: string;
    calculatedAmount: string;
  }>;
}>, tx?: any): Promise<void> {
  const runInsert = async (client: any) => {
    for (const item of slipsWithHeads) {
      const insertedSlip = await client.insert(payrollSlips).values(item.slip).returning();
      const slipId = insertedSlip[0].id;

      if (item.heads.length > 0) {
        const headValues = item.heads
          .filter(h => UUID_REGEX.test(h.payHeadId))
          .map(h => ({
            payrollSlipId: slipId,
            payHeadId: h.payHeadId,
            payHeadName: h.payHeadName,
            headType: h.headType,
            amount: h.amount,
            calculatedAmount: h.calculatedAmount,
            isManualOverride: false,
            overrideReason: null
          }));
        if (headValues.length > 0) {
          await client.insert(payrollSlipHeads).values(headValues);
        }
      }
    }
  };

  if (tx) {
    await runInsert(tx);
  } else {
    // Wrap in atomic transaction
    await (await getDb()).transaction(async (tx) => {
      await runInsert(tx);
    });
  }
}

/**
 * LOCKED payslips of some employees in a fiscal year, every run type (4.8b: the
 * year to date the tax projection starts from). Nothing unlocked ever counts.
 */
export async function findLockedSlipsForFiscalYear(employeeIds: string[], fiscalYearId: string, excludeRunId?: string): Promise<PayrollSlip[]> {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select({ slip: payrollSlips })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(payrollSlips.employeeId, employeeIds), eq(payrollRuns.fiscalYearId, fiscalYearId), eq(payrollRuns.status, "LOCKED"), excludeRunId ? ne(payrollRuns.id, excludeRunId) : undefined));
  return rows.map((r) => mapPayrollSlip(r.slip));
}

export async function findSlipsByRunId(runId: string): Promise<PayrollSlip[]> {
  const rows = await (await getDb()).select().from(payrollSlips).where(eq(payrollSlips.payrollRunId, runId));
  return rows.map(mapPayrollSlip);
}

export async function findSlipById(id: string): Promise<PayrollSlip | undefined> {
  const rows = await (await getDb()).select().from(payrollSlips).where(eq(payrollSlips.id, id));
  if (!rows.length) return undefined;
  return mapPayrollSlip(rows[0]);
}

export async function findSlipHeadsBySlipId(slipId: string): Promise<PayrollSlipHead[]> {
  const rows = await (await getDb()).select().from(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId));
  return rows.map(mapPayrollSlipHead);
}

export async function updateSlipOverrideAndRecalculate(
  slipId: string,
  slipUpdate: {
    grossEarnings: string;
    totalDeductions: string;
    netPayable: string;
    tdsThisMonth: string;
    pfEmployee: string;
    ssfEmployee: string;
    citDeduction: string;
    loanDeduction: string;
    absentDeduction: string;
    otAmount: string;
  },
  headUpdate: {
    payHeadId: string;
    amount: string; // The manual override amount
    reason: string;
  }
): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    // 1. Update the main slip values
    await tx.update(payrollSlips)
      .set({
        ...slipUpdate,
        updatedAt: new Date()
      })
      .where(eq(payrollSlips.id, slipId));

    // 2. Mark the specific head as overridden
    await tx.update(payrollSlipHeads)
      .set({
        amount: headUpdate.amount,
        isManualOverride: true,
        overrideReason: headUpdate.reason
      })
      .where(
        and(
          eq(payrollSlipHeads.payrollSlipId, slipId),
          eq(payrollSlipHeads.payHeadId, headUpdate.payHeadId)
        )
      );
  });
}

export async function lockAllSlipsForRun(runId: string): Promise<void> {
  await (await getDb()).update(payrollSlips)
    .set({
      status: 'LOCKED',
      updatedAt: new Date(),
    })
    .where(eq(payrollSlips.payrollRunId, runId));
}

export async function deletePayrollRun(id: string): Promise<void> {
  // Cascades to slips and slip heads automatically via DB foreign key onDelete: cascade
  await (await getDb()).delete(payrollRuns).where(eq(payrollRuns.id, id));
}

export async function deletePayrollSlip(slipId: string): Promise<void> {
  // Cascades to slip heads automatically via DB foreign key onDelete: cascade
  await (await getDb()).delete(payrollSlips).where(eq(payrollSlips.id, slipId));
}

export async function replaceSlipHeads(
  slipId: string,
  heads: Array<{
    payHeadId: string;
    payHeadName: string;
    headType: 'allowance' | 'deduction';
    amount: string;
    calculatedAmount: string;
    isManualOverride?: boolean;
    overrideReason?: string | null;
  }>
): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    await tx.delete(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId));
    const validHeads = heads
      .filter((h) => UUID_REGEX.test(h.payHeadId))
      .map((h) => ({
        payrollSlipId: slipId,
        payHeadId: h.payHeadId,
        payHeadName: h.payHeadName,
        headType: h.headType,
        amount: h.amount,
        calculatedAmount: h.calculatedAmount,
        isManualOverride: !!h.isManualOverride,
        overrideReason: h.overrideReason || null,
      }));
    if (validHeads.length > 0) {
      await tx.insert(payrollSlipHeads).values(validHeads);
    }
  });
}

export async function addSlipHead(
  slipId: string,
  head: {
    payHeadId: string;
    payHeadName: string;
    headType: 'allowance' | 'deduction';
    amount: string;
    calculatedAmount: string;
    isManualOverride?: boolean;
    overrideReason?: string | null;
  }
): Promise<void> {
  if (!UUID_REGEX.test(head.payHeadId)) {
    throw new Error(`Cannot add slip head with non-UUID payHeadId: ${head.payHeadId}`);
  }
  await (await getDb()).insert(payrollSlipHeads).values({
    payrollSlipId: slipId,
    payHeadId: head.payHeadId,
    payHeadName: head.payHeadName,
    headType: head.headType,
    amount: head.amount,
    calculatedAmount: head.calculatedAmount,
    isManualOverride: head.isManualOverride ?? true,
    overrideReason: head.overrideReason || null,
  });
}

// ---------------------------------------------------------------------------
// Dashboard aggregates (4.1). Read-only SQL SUMs over payslips, grouped in
// the database; `employeeCondition` carries the caller's branch / department
// scope and branch filter (built with buildEmployeeIdScopeCondition).
// ---------------------------------------------------------------------------

const periodKeySql = sql<number>`(${payrollRuns.payPeriodYear} * 100 + ${payrollRuns.payPeriodMonth})`;
const money = (column: AnyPgColumn) => sql<string>`coalesce(sum(${column}), 0)`;

/** One row per pay month (company calendar) between the two period keys (yyyymm), inclusive; every run type added up. */
export async function sumSlipsByPeriod(args: { calendar: string; fromKey: number; toKey: number; employeeCondition?: SQL }): Promise<PeriodCostRow[]> {
  const where = and(eq(payrollRuns.calendar, args.calendar), sql`${periodKeySql} between ${args.fromKey} and ${args.toKey}`, args.employeeCondition);
  const rows = await (await getDb())
    .select({
      year: payrollRuns.payPeriodYear,
      month: payrollRuns.payPeriodMonth,
      gross: money(payrollSlips.grossEarnings),
      net: money(payrollSlips.netPayable),
      totalDeductions: money(payrollSlips.totalDeductions),
      tds: money(payrollSlips.tdsThisMonth),
      pfEmployee: money(payrollSlips.pfEmployee),
      pfEmployer: money(payrollSlips.pfEmployer),
      ssfEmployee: money(payrollSlips.ssfEmployee),
      ssfEmployer: money(payrollSlips.ssfEmployer),
      cit: money(payrollSlips.citDeduction),
      loan: money(payrollSlips.loanDeduction),
      ot: money(payrollSlips.otAmount),
      employees: sql<number>`count(distinct ${payrollSlips.employeeId})::int`,
      unlockedRuns: sql<number>`count(distinct case when ${payrollRuns.status} <> 'LOCKED' and ${payrollRuns.runType} = 'REGULAR' then ${payrollRuns.id} end)::int`,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(where)
    .groupBy(payrollRuns.payPeriodYear, payrollRuns.payPeriodMonth);

  return rows.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    gross: Number(r.gross),
    net: Number(r.net),
    totalDeductions: Number(r.totalDeductions),
    tds: Number(r.tds),
    pfEmployee: Number(r.pfEmployee),
    pfEmployer: Number(r.pfEmployer),
    ssfEmployee: Number(r.ssfEmployee),
    ssfEmployer: Number(r.ssfEmployer),
    cit: Number(r.cit),
    loan: Number(r.loan),
    ot: Number(r.ot),
    employees: Number(r.employees),
    locked: Number(r.unlockedRuns) === 0,
  }));
}

/** Employer cost (gross + employer PF) and paid employees per department over the period keys. */
export async function sumSlipsByDepartment(args: { calendar: string; fromKey: number; toKey: number; employeeCondition?: SQL }): Promise<DepartmentCost[]> {
  const where = and(eq(payrollRuns.calendar, args.calendar), sql`${periodKeySql} between ${args.fromKey} and ${args.toKey}`, args.employeeCondition);
  const rows = await (await getDb())
    .select({
      name: payrollSlips.departmentName,
      cost: sql<string>`coalesce(sum(${payrollSlips.grossEarnings}), 0) + coalesce(sum(${payrollSlips.pfEmployer}), 0)`,
      employees: sql<number>`count(distinct ${payrollSlips.employeeId})::int`,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(where)
    .groupBy(payrollSlips.departmentName);
  return rows.map((r) => ({ name: r.name || "Unassigned", cost: Number(r.cost), employees: Number(r.employees) }));
}

/** One employee's payslips, newest first (record page, 4.2). Bank details are not selected. */
export async function findSlipsByEmployee(employeeId: string, limit = 12) {
  const rows = await (await getDb())
    .select({
      id: payrollSlips.id,
      year: payrollRuns.payPeriodYear,
      month: payrollRuns.payPeriodMonth,
      gross: payrollSlips.grossEarnings,
      deductions: payrollSlips.totalDeductions,
      tds: payrollSlips.tdsThisMonth,
      ssfEmployee: payrollSlips.ssfEmployee,
      ssfEmployer: payrollSlips.ssfEmployer,
      net: payrollSlips.netPayable,
      runStatus: payrollRuns.status,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payrollSlips.payrollRunId))
    .where(eq(payrollSlips.employeeId, employeeId))
    .orderBy(sql`${payrollRuns.payPeriodYear} desc, ${payrollRuns.payPeriodMonth} desc`)
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    gross: Number(r.gross),
    deductions: Number(r.deductions),
    tds: Number(r.tds),
    ssf: Number(r.ssfEmployee) + Number(r.ssfEmployer),
    net: Number(r.net),
    status: String(r.runStatus),
  }));
}
