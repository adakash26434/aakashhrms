import { and, asc, desc, eq, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { employees, fiscalYears, reimbursementClaims, reimbursementTypes, users } from "@/lib/db/schema";

// Reimbursements (4.8 / F16): Drizzle queries only. Rules in lib/engines/reimbursement.engine.ts,
// orchestration in lib/services/reimbursement.service.ts. Claims are always read within the
// caller's employee scope; status moves are claim-first.

export type TypeRecord = typeof reimbursementTypes.$inferSelect;
export type ClaimRecord = typeof reimbursementClaims.$inferSelect;

export async function listTypes(): Promise<TypeRecord[]> {
  return (await getDb()).select().from(reimbursementTypes).orderBy(asc(reimbursementTypes.name));
}

export async function findType(id: string): Promise<TypeRecord | null> {
  const [row] = await (await getDb()).select().from(reimbursementTypes).where(eq(reimbursementTypes.id, id)).limit(1);
  return row ?? null;
}

export type TypeWrite = Pick<typeof reimbursementTypes.$inferInsert, "code" | "name" | "nameNp" | "taxable" | "perClaimCap" | "yearlyCap" | "receiptRequired" | "isActive">;

export async function insertType(data: TypeWrite, userId: string): Promise<TypeRecord> {
  const [row] = await (await getDb()).insert(reimbursementTypes).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

export async function updateType(id: string, data: TypeWrite, userId: string): Promise<TypeRecord | null> {
  const [row] = await (await getDb())
    .update(reimbursementTypes)
    .set({ ...data, updatedBy: userId, updatedAt: new Date() })
    .where(eq(reimbursementTypes.id, id))
    .returning();
  return row ?? null;
}

export interface ClaimJoined extends ClaimRecord {
  employeeName: string;
  employeeCode: string;
  typeCode: string;
  typeName: string;
  typeNameNp: string | null;
  createdByName: string | null;
  decidedByName: string | null;
}

async function selectClaims(where: SQL<unknown> | undefined, limit: number): Promise<ClaimJoined[]> {
  const db = await getDb();
  const rows = await db
    .select({
      c: reimbursementClaims,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      typeCode: reimbursementTypes.code,
      typeName: reimbursementTypes.name,
      typeNameNp: reimbursementTypes.nameNp,
      createdByName: sql<string | null>`COALESCE(NULLIF(${users.name}, ''), ${users.email})`,
    })
    .from(reimbursementClaims)
    .innerJoin(employees, eq(reimbursementClaims.employeeId, employees.id))
    .innerJoin(reimbursementTypes, eq(reimbursementClaims.typeId, reimbursementTypes.id))
    .leftJoin(users, eq(reimbursementClaims.createdBy, users.id))
    .where(where)
    .orderBy(desc(reimbursementClaims.expenseDate), desc(reimbursementClaims.createdAt))
    .limit(limit);
  const deciderIds = [...new Set(rows.map((r) => r.c.decidedBy).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (deciderIds.length) {
    for (const u of await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, deciderIds))) names.set(u.id, u.name || u.email || "—");
  }
  return rows.map((r) => ({
    ...r.c,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    typeCode: r.typeCode,
    typeName: r.typeName,
    typeNameNp: r.typeNameNp,
    createdByName: r.createdByName,
    decidedByName: r.c.decidedBy ? (names.get(r.c.decidedBy) ?? "—") : null,
  }));
}

export const listClaims = (scopeCondition?: SQL<unknown>) => selectClaims(scopeCondition, 2000);

export async function findClaim(id: string, scopeCondition?: SQL<unknown>): Promise<ClaimJoined | null> {
  const rows = await selectClaims(scopeCondition ? and(eq(reimbursementClaims.id, id), scopeCondition) : eq(reimbursementClaims.id, id), 1);
  return rows[0] ?? null;
}

/** Claims in one status within the scope, leaving out one employee's own (the bell: nobody decides their own, S21). */
export async function countInStatus(status: string, scopeCondition: SQL<unknown> | undefined, excludeEmployeeId: string | null): Promise<number> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(reimbursementClaims)
    .innerJoin(employees, eq(reimbursementClaims.employeeId, employees.id))
    .where(and(eq(reimbursementClaims.status, status), scopeCondition, excludeEmployeeId ? ne(reimbursementClaims.employeeId, excludeEmployeeId) : undefined));
  return row?.n ?? 0;
}

/** An active employee within the scope condition (who a claim may be recorded for). */
export async function activeEmployeeInScope(employeeId: string, scopeCondition?: SQL<unknown>): Promise<boolean> {
  const [row] = await (await getDb())
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.status, "Active"), scopeCondition))
    .limit(1);
  return !!row;
}

/** The fiscal year an AD date falls in (the yearly cap's year). */
export async function fiscalYearOf(dateAd: string): Promise<{ id: string; label: string; from: string; to: string } | null> {
  const [row] = await (await getDb())
    .select({ id: fiscalYears.id, label: fiscalYears.label, from: sql<string>`(${fiscalYears.startDateAD})::date::text`, to: sql<string>`(${fiscalYears.endDateAD})::date::text` })
    .from(fiscalYears)
    .where(and(lte(fiscalYears.startDateAD, new Date(`${dateAd}T12:00:00Z`)), gte(fiscalYears.endDateAD, new Date(`${dateAd}T00:00:00Z`))))
    .limit(1);
  return row ?? null;
}

/** What an employee claimed of a type between two dates in the given statuses (other claims than `excludeId`). */
export async function usedBetween(employeeId: string, typeId: string, from: string, to: string, statuses: readonly string[], excludeId?: string): Promise<number> {
  const [row] = await (await getDb())
    .select({ total: sql<string>`COALESCE(sum(${reimbursementClaims.amount}), 0)::text` })
    .from(reimbursementClaims)
    .where(
      and(
        eq(reimbursementClaims.employeeId, employeeId),
        eq(reimbursementClaims.typeId, typeId),
        sql`${reimbursementClaims.expenseDate} BETWEEN ${from}::date AND ${to}::date`,
        inArray(reimbursementClaims.status, [...statuses]),
        excludeId ? ne(reimbursementClaims.id, excludeId) : undefined
      )
    );
  return Number(row?.total ?? 0);
}

export type ClaimWrite = Pick<typeof reimbursementClaims.$inferInsert, "employeeId" | "typeId" | "expenseDate" | "amount" | "receiptNo" | "description" | "taxable">;

/** A new claim: a draft, or (self-service) submitted at once. */
export async function insertClaim(data: ClaimWrite, status: "draft" | "submitted", userId: string): Promise<ClaimRecord> {
  const [row] = await (await getDb())
    .insert(reimbursementClaims)
    .values({ ...data, status, createdBy: userId, updatedBy: userId })
    .returning();
  return row;
}

/** Drafts only. */
export async function updateDraft(id: string, data: ClaimWrite, userId: string): Promise<ClaimRecord | null> {
  const [row] = await (await getDb())
    .update(reimbursementClaims)
    .set({ ...data, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(reimbursementClaims.id, id), eq(reimbursementClaims.status, "draft")))
    .returning();
  return row ?? null;
}

/** Claim-first status move; decision fields for approve / reject / return, settled time for settle. */
export async function moveClaim(id: string, from: string, to: string, note: string | null, userId: string): Promise<boolean> {
  const decision = to === "approved" || to === "rejected" || to === "draft";
  const [row] = await (await getDb())
    .update(reimbursementClaims)
    .set({
      status: to,
      updatedBy: userId,
      updatedAt: new Date(),
      ...(decision ? { decisionNote: note, decidedBy: userId, decidedAt: new Date() } : {}),
      ...(to === "settled" ? { settledAt: new Date() } : {}),
    })
    .where(and(eq(reimbursementClaims.id, id), eq(reimbursementClaims.status, from)))
    .returning({ id: reimbursementClaims.id });
  return !!row;
}
