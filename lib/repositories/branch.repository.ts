import { getDb } from '@/lib/db';
import { branches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Branch } from '@/lib/types/branch';

type BranchRow = typeof branches.$inferSelect;

function mapRowToBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    phone: row.phone,
    email: row.email,
    status: row.status as "active" | "inactive",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllBranches(): Promise<Branch[]> {
  const rows = await getDb().select().from(branches);
  return rows.map(mapRowToBranch);
}

export async function findBranchById(id: string): Promise<Branch | undefined> {
  const rows = await getDb().select().from(branches).where(eq(branches.id, id));
  if (!rows.length) return undefined;
  return mapRowToBranch(rows[0]);
}

export async function createBranch(data: Omit<Branch, "id" | "createdAt" | "updatedAt">): Promise<Branch> {
  const rows = await getDb().insert(branches).values({
    code: data.code,
    name: data.name,
    location: data.location,
    phone: data.phone,
    email: data.email,
    status: data.status,
  }).returning();
  return mapRowToBranch(rows[0]);
}

export async function updateBranch(id: string, data: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>): Promise<Branch> {
  const rows = await getDb().update(branches)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(branches.id, id))
    .returning();
  return mapRowToBranch(rows[0]);
}

export async function deleteBranch(id: string): Promise<void> {
  await getDb().delete(branches).where(eq(branches.id, id));
}