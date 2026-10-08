import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { auditLogs, systemConfig, users } from "@/lib/db/schema";
import { OVERTIME_POLICY_KEY } from "@/lib/engines/overtime.engine";

// Overtime (4.7): the company's policy is one JSON value in system_config;
// its history is the audit log (module OT_RULES, record "overtime.policy").

export const POLICY_KEY = OVERTIME_POLICY_KEY;

/** The stored policy (unparsed JSON), or null before the company has one. */
export async function findPolicyValue(): Promise<string | null> {
  const [row] = await (await getDb()).select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, POLICY_KEY)).limit(1);
  return row?.value ?? null;
}

export async function savePolicyValue(value: string): Promise<void> {
  await (await getDb())
    .insert(systemConfig)
    .values({ key: POLICY_KEY, value, dataType: "json" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, dataType: "json", updatedAt: new Date() } });
}

/** Saved policy changes, newest first, with who made them. */
export async function findPolicyHistory(limit = 20): Promise<{ at: Date; by: string; oldValues: unknown; newValues: unknown }[]> {
  const db = await getDb();
  const rows = await db
    .select({ at: auditLogs.createdAt, userId: auditLogs.userId, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues })
    .from(auditLogs)
    .where(and(eq(auditLogs.module, "OT_RULES"), eq(auditLogs.recordId, POLICY_KEY), eq(auditLogs.result, "SUCCESS")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
  const names = ids.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ids)) : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name || n.email]));
  return rows.map((r) => ({ at: r.at, by: r.userId ? nameOf.get(r.userId) ?? "Unknown user" : "System", oldValues: r.oldValues, newValues: r.newValues }));
}
