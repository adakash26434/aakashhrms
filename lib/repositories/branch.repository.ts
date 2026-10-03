import { getDb } from '@/lib/db';
import { branches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Branch } from '@/lib/types/branch';

// Read model for other modules. Writes live in organization.repository.ts (4.3).

type BranchRow = typeof branches.$inferSelect;

function mapRowToBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    phone: row.phone,
    email: row.email,
    isHeadOffice: row.isHeadOffice,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllBranches(): Promise<Branch[]> {
  const rows = await (await getDb()).select().from(branches);
  return rows.map(mapRowToBranch);
}

export async function findBranchById(id: string): Promise<Branch | undefined> {
  const rows = await (await getDb()).select().from(branches).where(eq(branches.id, id));
  return rows.length ? mapRowToBranch(rows[0]) : undefined;
}
