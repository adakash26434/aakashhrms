import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { designations, employees } from '@/lib/db/schema';
import type { Designation } from '@/lib/types/designation';

// Read model for other modules, with live counts. Writes live in
// organization.repository.ts (4.3).

export async function findAllDesignations(): Promise<Designation[]> {
  const db = await getDb();
  const [rows, empRows] = await Promise.all([
    db.select().from(designations),
    db.select({ designationId: employees.designationId, count: sql<number>`count(*)::int` }).from(employees).groupBy(employees.designationId),
  ]);
  const emp = new Map(empRows.map((r) => [r.designationId, Number(r.count)]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
    description: row.description ?? '',
    employeeCount: emp.get(row.id) ?? 0,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
