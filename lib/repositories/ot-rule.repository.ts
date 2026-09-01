import { getDb } from "@/lib/db";
import { otRules } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { OtRule, OtRuleType } from "@/lib/types/ot-rule";

function mapOtRule(row: typeof otRules.$inferSelect): OtRule {
  return {
    id: row.id,
    ruleType: row.ruleType as OtRuleType,
    ruleName: row.ruleName,
    rateOfficeDay: Number(row.rateOfficeDay) || 0,
    rateOffDay: Number(row.rateOffDay) || 0,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findAllOtRules(): Promise<OtRule[]> {
  const rows = await getDb().select().from(otRules).orderBy(desc(otRules.createdAt));
  return rows.map(mapOtRule);
}

export async function findActiveOtRules(): Promise<OtRule[]> {
  const rows = await getDb().select().from(otRules).where(eq(otRules.isActive, true)).orderBy(desc(otRules.createdAt));
  return rows.map(mapOtRule);
}

export async function findOtRuleById(id: string): Promise<OtRule | null> {
  const rows = await getDb().select().from(otRules).where(eq(otRules.id, id));
  return rows.length ? mapOtRule(rows[0]) : null;
}

export async function createOtRule(data: Partial<OtRule>): Promise<OtRule> {
  const rows = await getDb().insert(otRules).values({
    ruleType: data.ruleType || "Hourly",
    ruleName: data.ruleName || "Standard OT",
    rateOfficeDay: (data.rateOfficeDay ?? 0).toString(),
    rateOffDay: (data.rateOffDay ?? 0).toString(),
    isActive: data.isActive ?? true,
  }).returning();
  return mapOtRule(rows[0]);
}

export async function updateOtRule(id: string, data: Partial<OtRule>): Promise<OtRule | null> {
  const existing = await getDb().select().from(otRules).where(eq(otRules.id, id)).limit(1);
  if (existing.length > 0 && existing[0].isPlatformLocked) {
    throw new Error("Standard Nepal Labour Act Overtime rules are platform-locked and cannot be modified by company administrators.");
  }

  const updateVals: Record<string, unknown> = { updatedAt: new Date() };
  if (data.ruleType !== undefined) updateVals.ruleType = data.ruleType;
  if (data.ruleName !== undefined) updateVals.ruleName = data.ruleName;
  if (data.rateOfficeDay !== undefined) updateVals.rateOfficeDay = data.rateOfficeDay.toString();
  if (data.rateOffDay !== undefined) updateVals.rateOffDay = data.rateOffDay.toString();
  if (data.isActive !== undefined) updateVals.isActive = data.isActive;

  const rows = await getDb().update(otRules).set(updateVals).where(eq(otRules.id, id)).returning();
  return rows.length ? mapOtRule(rows[0]) : null;
}

export async function removeOtRule(id: string): Promise<boolean> {
  const existing = await getDb().select().from(otRules).where(eq(otRules.id, id)).limit(1);
  if (existing.length > 0 && existing[0].isPlatformLocked) {
    throw new Error("Standard Nepal Labour Act Overtime rules are platform-locked and cannot be deleted by company administrators.");
  }

  const res = await getDb().delete(otRules).where(eq(otRules.id, id)).returning({ id: otRules.id });
  return res.length > 0;
}