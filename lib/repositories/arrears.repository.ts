import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { arrearsItems, employeeSalaryMap, leaveOtCalculations, payHeads, payrollRuns, payrollSlipHeads, payrollSlips } from "@/lib/db/schema";
import type { ArrearsComponents, ArrearsMonthLine } from "@/lib/types/payroll-run";

// Arrears (4.8b): which locked months may need a difference paid, what was
// already paid as arrears, and the rows an arrears payslip keeps.

export type LockedSlipRow = typeof payrollSlips.$inferSelect & {
  run: Pick<typeof payrollRuns.$inferSelect, "id" | "calendar" | "payPeriodYear" | "payPeriodMonth" | "payPeriodEndDate" | "fiscalYearId" | "occasionalAllowanceHeadIds" | "lockedAt">;
  heads: (typeof payrollSlipHeads.$inferSelect)[];
};

/**
 * LOCKED regular payslips of some employees that may differ from what is due
 * now: a salary revision approved after the lock whose effective date reaches
 * the month, or a month summary written again after the lock (a reopen and
 * close). The service recomputes each and keeps the material ones.
 */
export async function findTouchedLockedSlips(employeeIds: string[]): Promise<LockedSlipRow[]> {
  if (!employeeIds.length) return [];
  const db = await getDb();
  const rows = await db
    .select({ slip: payrollSlips, run: { id: payrollRuns.id, calendar: payrollRuns.calendar, payPeriodYear: payrollRuns.payPeriodYear, payPeriodMonth: payrollRuns.payPeriodMonth, payPeriodEndDate: payrollRuns.payPeriodEndDate, fiscalYearId: payrollRuns.fiscalYearId, occasionalAllowanceHeadIds: payrollRuns.occasionalAllowanceHeadIds, lockedAt: payrollRuns.lockedAt } })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(payrollSlips.employeeId, employeeIds), eq(payrollRuns.status, "LOCKED"), eq(payrollRuns.runType, "REGULAR")))
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth));
  if (!rows.length) return [];
  const touched = rows.filter((r) => !!r.run.lockedAt);
  // Revisions approved after a lock, with an effective date on or before that month's end.
  const revisions = await db
    .select({ employeeId: employeeSalaryMap.employeeId, effectiveFrom: employeeSalaryMap.effectiveFrom, approvedAt: employeeSalaryMap.approvedAt })
    .from(employeeSalaryMap)
    .where(and(inArray(employeeSalaryMap.employeeId, employeeIds), eq(employeeSalaryMap.status, "approved")));
  // Summaries written again after the lock (the lock itself touches them within the same minute).
  const summaries = await db
    .select({ employeeId: leaveOtCalculations.employeeId, calendar: leaveOtCalculations.calendar, periodYear: leaveOtCalculations.periodYear, periodMonth: leaveOtCalculations.periodMonth, updatedAt: leaveOtCalculations.updatedAt })
    .from(leaveOtCalculations)
    .where(inArray(leaveOtCalculations.employeeId, employeeIds));
  const GRACE_MS = 2 * 60 * 1000;
  const picked = touched.filter((r) => {
    const lockedAt = new Date(r.run.lockedAt!).getTime();
    const end = String(r.run.payPeriodEndDate).slice(0, 10);
    const revised = revisions.some((v) => v.employeeId === r.slip.employeeId && String(v.effectiveFrom).slice(0, 10) <= end && !!v.approvedAt && new Date(v.approvedAt).getTime() > lockedAt);
    const reclosed = summaries.some((x) => x.employeeId === r.slip.employeeId && x.calendar === r.run.calendar && x.periodYear === r.run.payPeriodYear && x.periodMonth === r.run.payPeriodMonth && new Date(x.updatedAt).getTime() > lockedAt + GRACE_MS);
    return revised || reclosed;
  });
  if (!picked.length) return [];
  const heads = await db.select().from(payrollSlipHeads).where(inArray(payrollSlipHeads.payrollSlipId, picked.map((r) => r.slip.id)));
  return picked.map((r) => ({ ...r.slip, run: r.run, heads: heads.filter((h) => h.payrollSlipId === r.slip.id) }));
}

/** The salary revision in force on a date, with its batch (the arrears source reference). */
export async function findRevisionBatch(employeeId: string, onDate: string): Promise<{ batchId: string | null; approvedAt: Date | null } | null> {
  const [row] = await (await getDb())
    .select({ batchId: employeeSalaryMap.batchId, approvedAt: employeeSalaryMap.approvedAt })
    .from(employeeSalaryMap)
    .where(and(eq(employeeSalaryMap.employeeId, employeeId), eq(employeeSalaryMap.status, "approved"), sql`${employeeSalaryMap.effectiveFrom} <= ${onDate}::date`))
    .orderBy(desc(employeeSalaryMap.effectiveFrom), desc(employeeSalaryMap.createdAt))
    .limit(1);
  return row ?? null;
}

/** Arrears already paid (LOCKED) per employee and month: their diffs count as paid. */
export async function findLockedArrearsItems(employeeIds: string[]): Promise<{ employeeId: string; calendar: string; periodYear: number; periodMonth: number; diff: ArrearsComponents }[]> {
  if (!employeeIds.length) return [];
  return (await getDb())
    .select({ employeeId: arrearsItems.employeeId, calendar: arrearsItems.calendar, periodYear: arrearsItems.periodYear, periodMonth: arrearsItems.periodMonth, diff: arrearsItems.diff })
    .from(arrearsItems)
    .innerJoin(payrollSlips, eq(arrearsItems.payrollSlipId, payrollSlips.id))
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(arrearsItems.employeeId, employeeIds), eq(payrollRuns.status, "LOCKED")));
}

/** Arrears waiting in a run not locked yet (an employee-month is in one run at a time). */
export async function findPendingArrearsItems(employeeIds: string[]): Promise<{ employeeId: string; calendar: string; periodYear: number; periodMonth: number; runId: string; runYear: number; runMonth: number; runCalendar: string }[]> {
  if (!employeeIds.length) return [];
  return (await getDb())
    .select({ employeeId: arrearsItems.employeeId, calendar: arrearsItems.calendar, periodYear: arrearsItems.periodYear, periodMonth: arrearsItems.periodMonth, runId: payrollRuns.id, runYear: payrollRuns.payPeriodYear, runMonth: payrollRuns.payPeriodMonth, runCalendar: payrollRuns.calendar })
    .from(arrearsItems)
    .innerJoin(payrollSlips, eq(arrearsItems.payrollSlipId, payrollSlips.id))
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(arrearsItems.employeeId, employeeIds), sql`${payrollRuns.status} <> 'LOCKED'`));
}

export async function insertItems(slipId: string, employeeId: string, lines: readonly ArrearsMonthLine[], tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0]): Promise<void> {
  if (!lines.length) return;
  await tx.insert(arrearsItems).values(
    lines.map((l) => ({ payrollSlipId: slipId, employeeId, kind: l.kind, calendar: l.calendar, periodYear: l.year, periodMonth: l.month, sourceSlipId: l.sourceSlipId, sourceRef: l.sourceRef, paid: l.paid, due: l.due, diff: l.diff }))
  );
}

/** The pay heads an arrears payslip uses, created once per company: an allowance and a recovery deduction. */
export async function ensureArrearsPayHeads(): Promise<{ arrears: typeof payHeads.$inferSelect; recovery: typeof payHeads.$inferSelect }> {
  const db = await getDb();
  const find = async (code: string) => (await db.select().from(payHeads).where(eq(payHeads.code, code)).limit(1))[0];
  const make = async (code: string, name: string, type: "allowance" | "deduction") => {
    const existing = await find(code);
    if (existing) return existing;
    await db
      .insert(payHeads)
      .values({ code, name, type, effectOnTax: type === "allowance", calcBasis: "None", calcParameter: "FixedAmount", calcPercent: "0", isActive: true } as typeof payHeads.$inferInsert)
      .onConflictDoNothing();
    return (await find(code))!;
  };
  return { arrears: await make("ARREARS", "Arrears", "allowance"), recovery: await make("ARREARS_RECOVERY", "Arrears recovery", "deduction") };
}

/** Whether a pay head exists (the slip's statutory heads need master ids). */
export async function findMasterHeads() {
  return (await getDb()).select().from(payHeads);
}

export { gt };
