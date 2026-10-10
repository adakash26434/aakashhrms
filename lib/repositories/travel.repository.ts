import { getDb } from '@/lib/db';
import { designations, employees, travelClaims, travelRates, users } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';

// TA-DA (G11): Drizzle queries only. Rules in lib/engines/travel.engine.ts;
// orchestration in lib/services/travel.service.ts. Claims are always read
// within the caller's employee scope; status moves are claim-first.

export type RateRecord = typeof travelRates.$inferSelect;
export type ClaimRecord = typeof travelClaims.$inferSelect;

export interface RateJoined extends RateRecord {
  designation: string | null;
}

export async function listRates(): Promise<RateJoined[]> {
  const db = await getDb();
  const rows = await db
    .select({ r: travelRates, designation: designations.name })
    .from(travelRates)
    .leftJoin(designations, eq(travelRates.designationId, designations.id))
    .orderBy(asc(travelRates.name));
  return rows.map((x) => ({ ...x.r, designation: x.designation }));
}

/** The card for a designation, falling back to the default card (designation null). Null when there is no card at all. */
export async function cardFor(designationId: string): Promise<RateRecord | null> {
  const db = await getDb();
  const [specific] = await db.select().from(travelRates).where(and(eq(travelRates.designationId, designationId), eq(travelRates.isActive, true))).limit(1);
  if (specific) return specific;
  const [fallback] = await db.select().from(travelRates).where(and(isNull(travelRates.designationId), eq(travelRates.isActive, true))).limit(1);
  return fallback ?? null;
}

export interface RateWrite {
  name: string;
  designationId: string | null;
  dailyAllowance: string;
  lodgingPerNight: string;
  kmRate: string;
  isActive: boolean;
}

export async function insertRate(data: RateWrite, userId: string): Promise<RateRecord> {
  const db = await getDb();
  const [row] = await db.insert(travelRates).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

export async function updateRate(id: string, data: RateWrite, userId: string): Promise<RateRecord | null> {
  const db = await getDb();
  const [row] = await db.update(travelRates).set({ ...data, updatedBy: userId }).where(eq(travelRates.id, id)).returning();
  return row ?? null;
}

export interface ClaimJoined extends ClaimRecord {
  employeeName: string;
  employeeCode: string;
  designationId: string;
  createdByName: string | null;
  decidedByName: string | null;
}

async function selectClaims(where: SQL<unknown> | undefined, limit: number): Promise<ClaimJoined[]> {
  const db = await getDb();
  const rows = await db
    .select({ c: travelClaims, employeeName: employees.fullName, employeeCode: employees.employeeCode, designationId: employees.designationId, createdByName: sql<string | null>`COALESCE(NULLIF(${users.name}, ''), ${users.email})` })
    .from(travelClaims)
    .innerJoin(employees, eq(travelClaims.employeeId, employees.id))
    .leftJoin(users, eq(travelClaims.createdBy, users.id))
    .where(where)
    .orderBy(desc(travelClaims.startAd))
    .limit(limit);
  const deciderIds = [...new Set(rows.map((r) => r.c.decidedBy).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (deciderIds.length) {
    for (const u of await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, deciderIds))) names.set(u.id, u.name || u.email || '—');
  }
  return rows.map((r) => ({ ...r.c, employeeName: r.employeeName, employeeCode: r.employeeCode, designationId: r.designationId, createdByName: r.createdByName, decidedByName: r.c.decidedBy ? names.get(r.c.decidedBy) ?? '—' : null }));
}

export const listClaims = (scopeCondition?: SQL<unknown>) => selectClaims(scopeCondition, 1000);

export async function findClaim(id: string, scopeCondition?: SQL<unknown>): Promise<ClaimJoined | null> {
  const rows = await selectClaims(scopeCondition ? and(eq(travelClaims.id, id), scopeCondition) : eq(travelClaims.id, id), 1);
  return rows[0] ?? null;
}

/** Claims in one status within the scope, leaving out one employee's own (the bell: nobody decides their own, S38). */
export async function countInStatus(status: string, scopeCondition: SQL<unknown> | undefined, excludeEmployeeId: string | null): Promise<number> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(travelClaims)
    .innerJoin(employees, eq(travelClaims.employeeId, employees.id))
    .where(and(eq(travelClaims.status, status), scopeCondition, excludeEmployeeId ? ne(travelClaims.employeeId, excludeEmployeeId) : undefined));
  return row?.n ?? 0;
}

export async function employeeDesignation(employeeId: string, scopeCondition?: SQL<unknown>): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ designationId: employees.designationId })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.status, 'Active'), scopeCondition))
    .limit(1);
  return row?.designationId ?? null;
}

export type ClaimWrite = Omit<typeof travelClaims.$inferInsert, 'id' | 'status' | 'decisionNote' | 'decidedBy' | 'decidedAt' | 'settledAt' | 'createdAt' | 'updatedAt'>;

export async function insertClaim(data: ClaimWrite): Promise<ClaimRecord> {
  const db = await getDb();
  const [row] = await db.insert(travelClaims).values(data).returning();
  return row;
}

/** Drafts only. */
export async function updateDraft(id: string, data: ClaimWrite): Promise<ClaimRecord | null> {
  const db = await getDb();
  const [row] = await db
    .update(travelClaims)
    .set(data)
    .where(and(eq(travelClaims.id, id), eq(travelClaims.status, 'draft')))
    .returning();
  return row ?? null;
}

/** Claim-first status move; decision fields are written for approve / reject / return. */
export async function moveClaim(id: string, from: string, to: string, note: string | null, userId: string): Promise<boolean> {
  const db = await getDb();
  const decision = to === 'approved' || to === 'rejected' || to === 'draft';
  const [row] = await db
    .update(travelClaims)
    .set({
      status: to,
      updatedBy: userId,
      ...(decision ? { decisionNote: note, decidedBy: userId, decidedAt: new Date() } : {}),
      ...(to === 'settled' ? { settledAt: new Date() } : {}),
    })
    .where(and(eq(travelClaims.id, id), eq(travelClaims.status, from)))
    .returning({ id: travelClaims.id });
  return !!row;
}

export async function designationOptions(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  return db.select({ id: designations.id, name: designations.name }).from(designations).orderBy(asc(designations.name));
}
