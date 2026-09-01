import { getDb } from '@/lib/db';
import { payrollRuns, payrollSlips, payrollSlipHeads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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
  const rows = await getDb().select().from(payrollRuns).orderBy(payrollRuns.createdAt);
  return rows.map(mapPayrollRun);
}

export async function findPayrollRunById(id: string): Promise<PayrollRun | undefined> {
  const rows = await getDb().select().from(payrollRuns).where(eq(payrollRuns.id, id));
  if (!rows.length) return undefined;
  return mapPayrollRun(rows[0]);
}

export async function findPayrollRunByPeriodAndBranch(args: {
  payPeriodMonth: number;
  payPeriodYear: number;
  branchIds: string[];
}): Promise<PayrollRun[]> {
  // Query to find existing runs with overlapping branch sets and same month/year
  const allRuns = await getDb().select().from(payrollRuns).where(
    and(
      eq(payrollRuns.payPeriodMonth, args.payPeriodMonth),
      eq(payrollRuns.payPeriodYear, args.payPeriodYear)
    )
  );

  // Return runs that contain any of the selected branches
  return allRuns.filter(run => 
    run.branchIds.some(b => args.branchIds.includes(b))
  ).map(mapPayrollRun);
}

export async function createPayrollRun(data: {
  fiscalYearId: string;
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
}, tx?: any): Promise<PayrollRun> {
  const client = tx || getDb();
  const rows = await client.insert(payrollRuns).values({
    fiscalYearId: data.fiscalYearId,
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

  const rows = await getDb().update(payrollRuns)
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
  await getDb().update(payrollRuns)
    .set({
      ...totals,
      updatedAt: new Date(),
    })
    .where(eq(payrollRuns.id, id));
}

// -----------------------------------------------------------------------------
// Payroll Slips & Slip Heads
// -----------------------------------------------------------------------------

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
        const headValues = item.heads.map(h => ({
          payrollSlipId: slipId,
          payHeadId: h.payHeadId,
          payHeadName: h.payHeadName,
          headType: h.headType,
          amount: h.amount,
          calculatedAmount: h.calculatedAmount,
          isManualOverride: false,
          overrideReason: null
        }));
        await client.insert(payrollSlipHeads).values(headValues);
      }
    }
  };

  if (tx) {
    await runInsert(tx);
  } else {
    // Wrap in atomic transaction
    await getDb().transaction(async (tx) => {
      await runInsert(tx);
    });
  }
}

export async function findSlipsByRunId(runId: string): Promise<PayrollSlip[]> {
  const rows = await getDb().select().from(payrollSlips).where(eq(payrollSlips.payrollRunId, runId));
  return rows.map(mapPayrollSlip);
}

export async function findSlipById(id: string): Promise<PayrollSlip | undefined> {
  const rows = await getDb().select().from(payrollSlips).where(eq(payrollSlips.id, id));
  if (!rows.length) return undefined;
  return mapPayrollSlip(rows[0]);
}

export async function findSlipHeadsBySlipId(slipId: string): Promise<PayrollSlipHead[]> {
  const rows = await getDb().select().from(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId));
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
  await getDb().transaction(async (tx) => {
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
  await getDb().update(payrollSlips)
    .set({
      status: 'LOCKED',
      updatedAt: new Date(),
    })
    .where(eq(payrollSlips.payrollRunId, runId));
}

export async function deletePayrollRun(id: string): Promise<void> {
  // Cascades to slips and slip heads automatically via DB foreign key onDelete: cascade
  await getDb().delete(payrollRuns).where(eq(payrollRuns.id, id));
}
