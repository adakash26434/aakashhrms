import { getDb } from '@/lib/db';
import { departments, designations, employees } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { Department } from '@/lib/types/department';

// Read model for other modules, with live counts (the stored counters are not
// trusted). Writes live in organization.repository.ts (4.3).

export async function countActive(): Promise<number> {
  const result = await (await getDb()).select({ count: sql<number>`count(*)::int` }).from(departments).where(eq(departments.status, 'active'));
  return result[0]?.count ?? 0;
}

type DepartmentRow = typeof departments.$inferSelect;

function map(row: DepartmentRow, designationCount: number, employeeCount: number): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    branchIds: row.branchIds ?? [],
    headEmployeeId: row.headEmployeeId ?? null,
    headName: row.headName ?? null,
    designationCount,
    employeeCount,
    description: row.description ?? '',
    status: row.status === 'inactive' ? 'inactive' : 'active',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllDepartments(): Promise<Department[]> {
  const db = await getDb();
  const [deptRows, desigRows, empRows] = await Promise.all([
    db.select().from(departments),
    db.select({ departmentId: designations.departmentId, count: sql<number>`count(*)::int` }).from(designations).groupBy(designations.departmentId),
    db.select({ departmentId: employees.departmentId, count: sql<number>`count(*)::int` }).from(employees).groupBy(employees.departmentId),
  ]);
  const desig = new Map(desigRows.map((r) => [r.departmentId, Number(r.count)]));
  const emp = new Map(empRows.map((r) => [r.departmentId, Number(r.count)]));
  return deptRows.map((row) => map(row, desig.get(row.id) ?? 0, emp.get(row.id) ?? 0));
}

export async function findDepartmentById(id: string): Promise<Department | undefined> {
  const all = await findAllDepartments();
  return all.find((d) => d.id === id);
}
