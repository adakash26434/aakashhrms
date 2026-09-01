import { getDb } from "@/lib/db";
import { leaveRules, leaveTypes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { LeaveRule, LeaveRuleCategory, AccrualMethod, EncashmentRate } from "@/lib/types/leave-rule";

function mapLeaveRule(
  row: typeof leaveRules.$inferSelect,
  leaveTypeName: string,
  leaveTypeCode: string,
): LeaveRule {
  return {
    id: row.id,
    leaveTypeId: row.leaveTypeId,
    leaveTypeName,
    leaveTypeCode,
    fiscalYearId: row.fiscalYearId,
    ruleName: row.ruleName,
    ruleCategory: row.ruleCategory as LeaveRuleCategory,
    accrualMethod: row.accrualMethod as AccrualMethod,
    accrualValue: Number(row.accrualValue) || 0,
    encashmentRate: (row.encashmentRate || "BASIC_DAILY") as EncashmentRate,
    encashmentFixedAmount: Number(row.encashmentFixedAmount) || 0,
    minServiceDaysForEligibility: row.minServiceDaysForEligibility || 0,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findAllLeaveRules(): Promise<LeaveRule[]> {
  const rows = await getDb()
    .select({
      rule: leaveRules,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
    })
    .from(leaveRules)
    .innerJoin(leaveTypes, eq(leaveRules.leaveTypeId, leaveTypes.id))
    .orderBy(desc(leaveRules.createdAt));

  return rows.map((r) => mapLeaveRule(r.rule, r.leaveTypeName, r.leaveTypeCode));
}

export async function findActiveLeaveRules(): Promise<LeaveRule[]> {
  const rows = await getDb()
    .select({
      rule: leaveRules,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
    })
    .from(leaveRules)
    .innerJoin(leaveTypes, eq(leaveRules.leaveTypeId, leaveTypes.id))
    .where(eq(leaveRules.isActive, true))
    .orderBy(desc(leaveRules.createdAt));

  return rows.map((r) => mapLeaveRule(r.rule, r.leaveTypeName, r.leaveTypeCode));
}

export async function findLeaveRuleById(id: string): Promise<LeaveRule | null> {
  const rows = await getDb()
    .select({
      rule: leaveRules,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
    })
    .from(leaveRules)
    .innerJoin(leaveTypes, eq(leaveRules.leaveTypeId, leaveTypes.id))
    .where(eq(leaveRules.id, id));

  return rows.length ? mapLeaveRule(rows[0].rule, rows[0].leaveTypeName, rows[0].leaveTypeCode) : null;
}

export async function findLeaveRuleByLeaveTypeId(leaveTypeId: string): Promise<LeaveRule | null> {
  const rows = await getDb()
    .select({
      rule: leaveRules,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
    })
    .from(leaveRules)
    .innerJoin(leaveTypes, eq(leaveRules.leaveTypeId, leaveTypes.id))
    .where(eq(leaveRules.leaveTypeId, leaveTypeId));

  return rows.length ? mapLeaveRule(rows[0].rule, rows[0].leaveTypeName, rows[0].leaveTypeCode) : null;
}

export async function createLeaveRule(data: {
  leaveTypeId: string;
  fiscalYearId?: string | null;
  ruleName: string;
  ruleCategory: string;
  accrualMethod: string;
  accrualValue: number;
  encashmentRate?: string;
  encashmentFixedAmount?: number;
  minServiceDaysForEligibility?: number;
  isActive?: boolean;
}): Promise<LeaveRule> {
  const rows = await getDb().insert(leaveRules).values({
    leaveTypeId: data.leaveTypeId,
    fiscalYearId: data.fiscalYearId || null,
    ruleName: data.ruleName,
    ruleCategory: data.ruleCategory,
    accrualMethod: data.accrualMethod,
    accrualValue: data.accrualValue.toString(),
    encashmentRate: data.encashmentRate || "BASIC_DAILY",
    encashmentFixedAmount: (data.encashmentFixedAmount ?? 0).toString(),
    minServiceDaysForEligibility: data.minServiceDaysForEligibility ?? 0,
    isActive: data.isActive ?? true,
  }).returning();

  // Re-fetch with join to get leave type name
  const result = await findLeaveRuleById(rows[0].id);
  return result!;
}

export async function updateLeaveRule(id: string, data: Partial<{
  leaveTypeId: string;
  fiscalYearId: string | null;
  ruleName: string;
  ruleCategory: string;
  accrualMethod: string;
  accrualValue: number;
  encashmentRate: string;
  encashmentFixedAmount: number;
  minServiceDaysForEligibility: number;
  isActive: boolean;
}>): Promise<LeaveRule | null> {
  const updateVals: Record<string, unknown> = { updatedAt: new Date() };
  if (data.leaveTypeId !== undefined) updateVals.leaveTypeId = data.leaveTypeId;
  if (data.fiscalYearId !== undefined) updateVals.fiscalYearId = data.fiscalYearId;
  if (data.ruleName !== undefined) updateVals.ruleName = data.ruleName;
  if (data.ruleCategory !== undefined) updateVals.ruleCategory = data.ruleCategory;
  if (data.accrualMethod !== undefined) updateVals.accrualMethod = data.accrualMethod;
  if (data.accrualValue !== undefined) updateVals.accrualValue = data.accrualValue.toString();
  if (data.encashmentRate !== undefined) updateVals.encashmentRate = data.encashmentRate;
  if (data.encashmentFixedAmount !== undefined) updateVals.encashmentFixedAmount = data.encashmentFixedAmount.toString();
  if (data.minServiceDaysForEligibility !== undefined) updateVals.minServiceDaysForEligibility = data.minServiceDaysForEligibility;
  if (data.isActive !== undefined) updateVals.isActive = data.isActive;

  const rows = await getDb().update(leaveRules).set(updateVals).where(eq(leaveRules.id, id)).returning();
  if (!rows.length) return null;

  return findLeaveRuleById(rows[0].id);
}

export async function removeLeaveRule(id: string): Promise<boolean> {
  const res = await getDb().delete(leaveRules).where(eq(leaveRules.id, id)).returning({ id: leaveRules.id });
  return res.length > 0;
}
