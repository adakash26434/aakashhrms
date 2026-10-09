import { getDb } from '@/lib/db';
import { assetHandovers, assets, branches, employees } from '@/lib/db/schema';
import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';

// Assets (G14): Drizzle queries only. Rules live in lib/engines/asset.engine.ts;
// orchestration in lib/services/asset.service.ts. Issue and return are
// claim-first on the asset's status so an asset never has two open handovers.

export type AssetRecord = typeof assets.$inferSelect;
export type HandoverRecord = typeof assetHandovers.$inferSelect;

export interface AssetWithHolder extends AssetRecord {
  branch: string | null;
  holderId: string | null;
  holderName: string | null;
  holderCode: string | null;
  issuedAd: string | null;
}

const openHandover = and(eq(assetHandovers.assetId, assets.id), isNull(assetHandovers.returnedAd));

const withHolder = {
  a: assets,
  branch: branches.name,
  holderId: assetHandovers.employeeId,
  holderName: employees.fullName,
  holderCode: employees.employeeCode,
  issuedAd: assetHandovers.issuedAd,
};
const flatten = (r: { a: AssetRecord; branch: string | null; holderId: string | null; holderName: string | null; holderCode: string | null; issuedAd: string | null }): AssetWithHolder => ({
  ...r.a,
  branch: r.branch,
  holderId: r.holderId,
  holderName: r.holderName,
  holderCode: r.holderCode,
  issuedAd: r.issuedAd,
});

export async function listAssets(): Promise<AssetWithHolder[]> {
  const db = await getDb();
  const rows = await db
    .select(withHolder)
    .from(assets)
    .leftJoin(branches, eq(assets.branchId, branches.id))
    .leftJoin(assetHandovers, openHandover)
    .leftJoin(employees, eq(assetHandovers.employeeId, employees.id))
    .orderBy(asc(assets.tag))
    .limit(2000);
  return rows.map(flatten);
}

export async function findAsset(id: string): Promise<AssetWithHolder | null> {
  const db = await getDb();
  const rows = await db
    .select(withHolder)
    .from(assets)
    .leftJoin(branches, eq(assets.branchId, branches.id))
    .leftJoin(assetHandovers, openHandover)
    .leftJoin(employees, eq(assetHandovers.employeeId, employees.id))
    .where(eq(assets.id, id))
    .limit(1);
  return rows[0] ? flatten(rows[0]) : null;
}

export interface AssetWrite {
  tag: string;
  name: string;
  category: string;
  branchId: string | null;
  note: string | null;
}

export async function insertAsset(data: AssetWrite, userId: string): Promise<AssetRecord> {
  const db = await getDb();
  const [row] = await db.insert(assets).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

export async function updateAsset(id: string, data: AssetWrite, userId: string): Promise<AssetRecord | null> {
  const db = await getDb();
  const [row] = await db.update(assets).set({ ...data, updatedBy: userId }).where(eq(assets.id, id)).returning();
  return row ?? null;
}

/** Claim-first: the asset flips available → issued and the handover is written in one transaction. */
export async function issueTx(assetId: string, employeeId: string, issuedAd: string, note: string | null, userId: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(assets)
      .set({ status: 'issued', updatedBy: userId })
      .where(and(eq(assets.id, assetId), eq(assets.status, 'available')))
      .returning({ id: assets.id });
    if (!claimed) return false;
    await tx.insert(assetHandovers).values({ assetId, employeeId, issuedAd, note, issuedBy: userId });
    return true;
  });
}

/** Claim-first: closes the open handover and sets the asset's next status in one transaction. */
export async function returnTx(assetId: string, returnedAd: string, condition: string, note: string | null, nextStatus: 'available' | 'retired', userId: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [closed] = await tx
      .update(assetHandovers)
      .set({ returnedAd, condition, note, returnedBy: userId })
      .where(and(eq(assetHandovers.assetId, assetId), isNull(assetHandovers.returnedAd)))
      .returning({ id: assetHandovers.id });
    if (!closed) return false;
    await tx.update(assets).set({ status: nextStatus, updatedBy: userId }).where(eq(assets.id, assetId));
    return true;
  });
}

export async function retire(assetId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .update(assets)
    .set({ status: 'retired', updatedBy: userId })
    .where(and(eq(assets.id, assetId), eq(assets.status, 'available')))
    .returning({ id: assets.id });
  return !!row;
}

export interface HandoverJoined extends HandoverRecord {
  employeeName: string;
  employeeCode: string;
}

export async function handoversFor(assetId: string): Promise<HandoverJoined[]> {
  const db = await getDb();
  const rows = await db
    .select({ h: assetHandovers, employeeName: employees.fullName, employeeCode: employees.employeeCode })
    .from(assetHandovers)
    .innerJoin(employees, eq(assetHandovers.employeeId, employees.id))
    .where(eq(assetHandovers.assetId, assetId))
    .orderBy(desc(assetHandovers.issuedAd));
  return rows.map((r) => ({ ...r.h, employeeName: r.employeeName, employeeCode: r.employeeCode }));
}

export async function openHandoverFor(assetId: string): Promise<HandoverRecord | null> {
  const db = await getDb();
  const [row] = await db.select().from(assetHandovers).where(and(eq(assetHandovers.assetId, assetId), isNull(assetHandovers.returnedAd))).limit(1);
  return row ?? null;
}

/** Assets an employee still holds (read-only context, e.g. the exit case). */
export async function heldBy(employeeId: string): Promise<{ tag: string; name: string; issuedAd: string }[]> {
  const db = await getDb();
  return db
    .select({ tag: assets.tag, name: assets.name, issuedAd: assetHandovers.issuedAd })
    .from(assetHandovers)
    .innerJoin(assets, eq(assetHandovers.assetId, assets.id))
    .where(and(eq(assetHandovers.employeeId, employeeId), isNull(assetHandovers.returnedAd)))
    .orderBy(asc(assets.tag));
}

export async function branchOptions(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  return db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.name));
}

/** Is this employee in the caller's scope? Issuing needs an active one; a return may come from someone already inactive. */
export async function employeeInScope(employeeId: string, scopeCondition: SQL<unknown> | undefined, activeOnly: boolean): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), activeOnly ? sql`${employees.status} = 'Active'` : undefined, scopeCondition))
    .limit(1);
  return !!row;
}
