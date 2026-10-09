import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payHeads, payrollRuns, payrollSlips, systemConfig } from "@/lib/db/schema";
import { DEFAULT_SETTLEMENT_SETTINGS, parseSettlementSettings } from "@/lib/engines/settlement.engine";
import type { SettlementSettings } from "@/lib/types/payroll-run";

// 4.8b-3 Final settlement: the company's gratuity rules (one JSON value in system_config), the
// run that settles an exit case, and the system pay heads a settlement payslip uses.

export const SETTLEMENT_SETTINGS_KEY = "payroll.settlement";

export async function getSettlementSettings(): Promise<SettlementSettings> {
  const [row] = await (await getDb()).select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, SETTLEMENT_SETTINGS_KEY)).limit(1);
  return row ? parseSettlementSettings(row.value) : { ...DEFAULT_SETTLEMENT_SETTINGS };
}

export async function setSettlementSettings(s: SettlementSettings): Promise<void> {
  const value = JSON.stringify(s);
  await (await getDb())
    .insert(systemConfig)
    .values({ key: SETTLEMENT_SETTINGS_KEY, value, dataType: "json" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, dataType: "json", updatedAt: new Date() } });
}

/** The run (any status) that settles an exit case: one settlement per case. */
export async function findRunByExitCase(exitCaseId: string) {
  const [row] = await (await getDb()).select().from(payrollRuns).where(eq(payrollRuns.exitCaseId, exitCaseId)).limit(1);
  return row ?? null;
}

export async function findRunsByExitCases(ids: string[]): Promise<Map<string, { id: string; status: string }>> {
  const out = new Map<string, { id: string; status: string }>();
  if (!ids.length) return out;
  const rows = await (await getDb()).select({ id: payrollRuns.id, status: payrollRuns.status, exitCaseId: payrollRuns.exitCaseId }).from(payrollRuns).where(inArray(payrollRuns.exitCaseId, ids));
  for (const r of rows) if (r.exitCaseId) out.set(r.exitCaseId, { id: r.id, status: r.status });
  return out;
}

/** Whether the employee's month is already paid by a locked regular run (then the settlement pays no month). */
export async function findLockedRegularSlip(employeeId: string, calendar: string, year: number, month: number) {
  const [row] = await (await getDb())
    .select({ id: payrollSlips.id, grossEarnings: payrollSlips.grossEarnings })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollSlips.employeeId, employeeId),
        eq(payrollRuns.status, "LOCKED"),
        eq(payrollRuns.runType, "REGULAR"),
        eq(payrollRuns.calendar, calendar),
        eq(payrollRuns.payPeriodYear, year),
        eq(payrollRuns.payPeriodMonth, month)
      )
    )
    .limit(1);
  return row ?? null;
}

export type SettlementHeads = Record<"LEAVE_ENCASH" | "GRATUITY" | "FUND_PAYOUT" | "LOAN_CLOSEOUT" | "NOTICE_RECOVERY" | "GRATUITY_TDS", typeof payHeads.$inferSelect>;

/** The settlement's own pay heads, created on first use (one-off: never synced to a salary map). */
export async function ensureSettlementPayHeads(): Promise<SettlementHeads> {
  const db = await getDb();
  const find = async (code: string) => (await db.select().from(payHeads).where(eq(payHeads.code, code)).limit(1))[0];
  const make = async (code: string, name: string, type: "allowance" | "deduction", effectOnTax: boolean) => {
    const existing = await find(code);
    if (existing) return existing;
    await db
      .insert(payHeads)
      .values({ code, name, type, effectOnTax, calcBasis: "None", calcParameter: "FixedAmount", calcPercent: "0", isActive: true } as typeof payHeads.$inferInsert)
      .onConflictDoNothing();
    return (await find(code))!;
  };
  return {
    LEAVE_ENCASH: await make("LEAVE_ENCASH", "Leave encashment", "allowance", true),
    GRATUITY: await make("GRATUITY", "Gratuity", "allowance", false),
    FUND_PAYOUT: await make("FUND_PAYOUT", "Welfare fund payout", "allowance", false),
    LOAN_CLOSEOUT: await make("LOAN_CLOSEOUT", "Loan closed out", "deduction", false),
    NOTICE_RECOVERY: await make("NOTICE_RECOVERY", "Notice period recovery", "deduction", false),
    GRATUITY_TDS: await make("GRATUITY_TDS", "Tax withheld on gratuity", "deduction", false),
  };
}
