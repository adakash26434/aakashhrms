import { getDb } from '@/lib/db';
import { departments, designations, employeeBank, payrollOpeningBalances, payrollRuns, payrollSlips, payrollSlipHeads } from '@/lib/db/schema';
import { eq, and, desc, inArray, lt, ne, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** A transaction on the company database. */
type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0];
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
  /** 4.8b: the pay calendar ("BS" | "AD"); every calendar when absent. */
  calendar?: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  branchIds: string[];
  /** F6: only runs of this type (one of each type per month and branch). */
  runType?: string;
}): Promise<PayrollRun[]> {
  // Query to find existing runs with overlapping branch sets and same month/year
  const allRuns = await (await getDb()).select().from(payrollRuns).where(
    and(
      args.calendar ? eq(payrollRuns.calendar, args.calendar) : undefined,
      eq(payrollRuns.payPeriodMonth, args.payPeriodMonth),
      eq(payrollRuns.payPeriodYear, args.payPeriodYear),
      args.runType ? eq(payrollRuns.runType, args.runType) : undefined
    )
  );

  // Return runs that contain any of the selected branches
  return allRuns.filter(run => 
    run.branchIds.some(b => args.branchIds.includes(b))
  ).map(mapPayrollRun);
}

export async function createPayrollRun(data: {
  fiscalYearId: string;
  /** 4.8b: the pay calendar ("BS" when absent). */
  calendar?: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  /** F6: REGULAR (when absent) | FESTIVAL | ARREARS. */
  runType?: string;
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
}, tx?: any): Promise<PayrollRun> {
  const client = tx || (await getDb());
  const rows = await client.insert(payrollRuns).values({
    fiscalYearId: data.fiscalYearId,
    calendar: data.calendar ?? 'BS',
    payPeriodMonth: data.payPeriodMonth,
    payPeriodYear: data.payPeriodYear,
    runType: data.runType ?? 'REGULAR',
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
  }).returning();
  
  return mapPayrollRun(rows[0]);
}

export async function updatePayrollRunStatus(
  id: string,
  status: PayrollRunStatus,
  actionByUserId: string,
  notes?: string,
  fromStatus?: PayrollRunStatus,
  tx?: Tx
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

  const rows = await (tx ?? (await getDb())).update(payrollRuns)
    .set(updateData)
    .where(fromStatus ? and(eq(payrollRuns.id, id), eq(payrollRuns.status, fromStatus)) : eq(payrollRuns.id, id))
    .returning();

  if (!rows.length) throw new Error("Someone else already moved this payroll run. Refresh and try again.");
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
}>, tx?: any): Promise<Map<string, string>> {
  // The new payslip of each employee (loan lines and other per-payslip rows are written after it).
  const slipIdByEmployee = new Map<string, string>();
  const runInsert = async (client: any) => {
    for (const item of slipsWithHeads) {
      const insertedSlip = await client.insert(payrollSlips).values(item.slip).returning();
      const slipId = insertedSlip[0].id;
      slipIdByEmployee.set(item.slip.employeeId, slipId);

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
  return slipIdByEmployee;
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

/** One payslip; pass the transaction that changed it to read its own changes. */
export async function findSlipById(id: string, tx?: Tx): Promise<PayrollSlip | undefined> {
  const rows = await (tx ?? (await getDb())).select().from(payrollSlips).where(eq(payrollSlips.id, id));
  if (!rows.length) return undefined;
  return mapPayrollSlip(rows[0]);
}

export async function findSlipHeadsBySlipId(slipId: string, tx?: Tx): Promise<PayrollSlipHead[]> {
  const rows = await (tx ?? (await getDb())).select().from(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId));
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

export async function lockAllSlipsForRun(runId: string, tx?: Tx): Promise<void> {
  await (tx ?? (await getDb())).update(payrollSlips)
    .set({
      status: 'LOCKED',
      updatedAt: new Date(),
    })
    .where(eq(payrollSlips.payrollRunId, runId));
}

export async function deletePayrollRun(id: string, tx?: Tx): Promise<void> {
  // Cascades to slips, slip heads and the arrears the run paid (foreign keys onDelete: cascade)
  await (tx ?? (await getDb())).delete(payrollRuns).where(eq(payrollRuns.id, id));
}

export async function deletePayrollSlip(slipId: string, tx?: Tx): Promise<void> {
  // Cascades to slip heads automatically via DB foreign key onDelete: cascade
  await (tx ?? (await getDb())).delete(payrollSlips).where(eq(payrollSlips.id, slipId));
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


/**
 * F5: the earlier months of a fiscal year for the tax projection — taxable income and TDS of each
 * payslip in an approved / locked run before this fiscal month. F6: a regular run also counts the
 * off-cycle slips (festival, arrears) already paid in its own month (`sameMonth: 'offCycle'`, the
 * default); an off-cycle run counts every other slip of its month (`'all'`). `excludeRunId` keeps
 * the run being recalculated out of its own history. F15: an opening balance of months before
 * this one comes first, as one entry standing for the months it covers.
 */
export async function findEarlierTaxMonths(
  employeeIds: string[],
  fiscalYearId: string,
  fiscalMonthIndex: number,
  opts: {
    excludeRunId?: string;
    /** Same-month slips counted: 'offCycle' (a regular run's default), 'all' (an off-cycle run) or 'none'. */
    sameMonth?: 'none' | 'offCycle' | 'all';
    /** 4.8b: the pay calendar of the runs counted (fiscal months counted in it); BS when absent. */
    calendar?: 'BS' | 'AD';
  } = {},
): Promise<Map<string, { taxableIncome: string; tds: string; months?: number }[]>> {
  const { excludeRunId, sameMonth = 'offCycle', calendar = 'BS' } = opts;
  const out = new Map<string, { taxableIncome: string; tds: string; months?: number }[]>();
  if (!employeeIds.length) return out;
  // F15: what an old system paid before payroll started here counts as the months it covers.
  const openings = await (await getDb())
    .select({
      employeeId: payrollOpeningBalances.employeeId,
      taxableIncome: payrollOpeningBalances.taxableIncome,
      tds: sql<string>`(${payrollOpeningBalances.sst} + ${payrollOpeningBalances.incomeTax})::text`,
      months: payrollOpeningBalances.months,
    })
    .from(payrollOpeningBalances)
    .where(and(inArray(payrollOpeningBalances.employeeId, employeeIds), eq(payrollOpeningBalances.fiscalYearId, fiscalYearId), lt(payrollOpeningBalances.months, fiscalMonthIndex)));
  for (const o of openings) out.set(o.employeeId, [{ taxableIncome: o.taxableIncome, tds: o.tds, months: o.months }]);
  // The run month's place in the fiscal year (Shrawan = 1; with AD months, August = 1: 4.8b).
  const idx =
    calendar === 'AD'
      ? sql`(CASE WHEN ${payrollRuns.payPeriodMonth} >= 8 THEN ${payrollRuns.payPeriodMonth} - 7 ELSE ${payrollRuns.payPeriodMonth} + 5 END)`
      : sql`(CASE WHEN ${payrollRuns.payPeriodMonth} >= 4 THEN ${payrollRuns.payPeriodMonth} - 3 ELSE ${payrollRuns.payPeriodMonth} + 9 END)`;
  const sameMonthRule =
    sameMonth === 'all' ? sql`${idx} = ${fiscalMonthIndex}` : sameMonth === 'offCycle' ? sql`(${idx} = ${fiscalMonthIndex} AND ${payrollRuns.runType} <> 'REGULAR')` : sql`false`;
  const rows = await (await getDb())
    .select({ employeeId: payrollSlips.employeeId, taxableIncome: payrollSlips.taxableIncome, tds: payrollSlips.tdsThisMonth })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(
      and(
        inArray(payrollSlips.employeeId, employeeIds),
        eq(payrollRuns.fiscalYearId, fiscalYearId),
        inArray(payrollRuns.status, ['APPROVED', 'LOCKED']),
        eq(payrollRuns.calendar, calendar),
        sql`(${idx} < ${fiscalMonthIndex} OR ${sameMonthRule})`,
        excludeRunId ? sql`${payrollRuns.id} <> ${excludeRunId}` : undefined,
      ),
    );
  for (const r of rows) out.set(r.employeeId, [...(out.get(r.employeeId) ?? []), { taxableIncome: r.taxableIncome, tds: r.tds }]);
  return out;
}

/**
 * F6: what an off-cycle payslip's marginal tax starts from, per employee: whether this month's
 * regular salary is already final (then it is in the history), and the monthly taxable income of
 * the latest regular payslip of the year up to this month in any state (the best estimate of the
 * months still to come).
 */
export async function offCycleProjectionFacts(
  employeeIds: string[],
  fiscalYearId: string,
  fiscalMonthIndex: number,
  /** 4.8b: the pay calendar of the runs counted (fiscal months counted in it). */
  calendar: 'BS' | 'AD' = 'BS',
): Promise<Map<string, { regularFinalThisMonth: boolean; latestRegularTaxable: string | null }>> {
  const out = new Map<string, { regularFinalThisMonth: boolean; latestRegularTaxable: string | null }>();
  if (!employeeIds.length) return out;
  const idx =
    calendar === 'AD'
      ? sql<number>`(CASE WHEN ${payrollRuns.payPeriodMonth} >= 8 THEN ${payrollRuns.payPeriodMonth} - 7 ELSE ${payrollRuns.payPeriodMonth} + 5 END)`
      : sql<number>`(CASE WHEN ${payrollRuns.payPeriodMonth} >= 4 THEN ${payrollRuns.payPeriodMonth} - 3 ELSE ${payrollRuns.payPeriodMonth} + 9 END)`;
  const rows = await (await getDb())
    .select({ employeeId: payrollSlips.employeeId, taxableIncome: payrollSlips.taxableIncome, status: payrollRuns.status, fiscalIdx: idx })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(
      and(
        inArray(payrollSlips.employeeId, employeeIds),
        eq(payrollRuns.fiscalYearId, fiscalYearId),
        eq(payrollRuns.runType, 'REGULAR'),
        eq(payrollRuns.calendar, calendar),
        sql`${idx} <= ${fiscalMonthIndex}`,
      ),
    )
    .orderBy(desc(idx));
  for (const r of rows) {
    const current = out.get(r.employeeId) ?? { regularFinalThisMonth: false, latestRegularTaxable: null };
    if (current.latestRegularTaxable === null) current.latestRegularTaxable = r.taxableIncome;
    if (Number(r.fiscalIdx) === fiscalMonthIndex && (r.status === 'APPROVED' || r.status === 'LOCKED')) current.regularFinalThisMonth = true;
    out.set(r.employeeId, current);
  }
  return out;
}

/** F6: what a new payslip records about each payee — primary bank account, department and designation names. */
export async function slipPayeeFacts(
  people: readonly { id: string; departmentId: string; designationId: string }[],
): Promise<Map<string, { bankAccountNumber: string; bankName: string; departmentName: string; designationName: string }>> {
  const out = new Map<string, { bankAccountNumber: string; bankName: string; departmentName: string; designationName: string }>();
  if (!people.length) return out;
  const db = await getDb();
  const ids = people.map((p) => p.id);
  const [banks, depts, desigs] = await Promise.all([
    db.select({ employeeId: employeeBank.employeeId, accountNumber: employeeBank.accountNumber, bankName: employeeBank.bankName }).from(employeeBank).where(and(inArray(employeeBank.employeeId, ids), eq(employeeBank.isPrimary, true))),
    db.select({ id: departments.id, name: departments.name }).from(departments),
    db.select({ id: designations.id, name: designations.name }).from(designations),
  ]);
  const bank = new Map(banks.map((b) => [b.employeeId, b]));
  const dept = new Map(depts.map((d) => [d.id, d.name]));
  const desig = new Map(desigs.map((d) => [d.id, d.name]));
  for (const p of people) {
    const b = bank.get(p.id);
    out.set(p.id, {
      bankAccountNumber: b?.accountNumber ?? 'N/A',
      bankName: b?.bankName ?? 'N/A',
      departmentName: dept.get(p.departmentId) ?? 'Unknown Department',
      designationName: desig.get(p.designationId) ?? 'Unknown Designation',
    });
  }
  return out;
}
