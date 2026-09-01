import { getDb } from '@/lib/db';
import { departments, designations, employees } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { Department, DepartmentStatus } from '@/lib/types/department';
import type { DepartmentWriteInput } from '@/lib/data/mock-departments';

export async function countActive(): Promise<number> {
  const result = await getDb().select({
    count: sql<number>`count(*)::int`
  }).from(departments).where(eq(departments.status, 'active'));
  return result[0]?.count ?? 0;
}

type DepartmentRow = typeof departments.$inferSelect;

function mapRowToDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    branchId: row.branchId,
    headName: row.headName,
    designationCount: row.designationCount,
    employeeCount: row.employeeCount,
    description: row.description,
    status: row.status as DepartmentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllDepartments(): Promise<Department[]> {
  const db = getDb();
  const [deptRows, desigRows, empRows] = await Promise.all([
    db.select().from(departments),
    db.select({ departmentId: designations.departmentId, count: sql<number>`count(*)::int` })
      .from(designations)
      .groupBy(designations.departmentId),
    db.select({ departmentId: employees.departmentId, count: sql<number>`count(*)::int` })
      .from(employees)
      .groupBy(employees.departmentId),
  ]);

  const desigCountByDept = new Map(desigRows.map((r) => [r.departmentId, Number(r.count)]));
  const empCountByDept = new Map(empRows.map((r) => [r.departmentId, Number(r.count)]));

  return deptRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    branchId: row.branchId,
    headName: row.headName,
    designationCount: desigCountByDept.get(row.id) ?? 0,
    employeeCount: empCountByDept.get(row.id) ?? 0,
    description: row.description,
    status: row.status as DepartmentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function findDepartmentById(id: string): Promise<Department | undefined> {
  const db = getDb();
  const [deptRows, desigRows, empRows] = await Promise.all([
    db.select().from(departments).where(eq(departments.id, id)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(designations)
      .where(eq(designations.departmentId, id)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(eq(employees.departmentId, id)),
  ]);

  if (!deptRows.length) return undefined;
  const row = deptRows[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    branchId: row.branchId,
    headName: row.headName,
    designationCount: desigRows[0]?.count ?? 0,
    employeeCount: empRows[0]?.count ?? 0,
    description: row.description,
    status: row.status as DepartmentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDepartment(data: DepartmentWriteInput): Promise<Department> {
  const rows = await getDb().insert(departments).values({
    code: data.code,
    name: data.name,
    branchId: data.branchId,
    headName: data.headName,
    description: data.description,
    status: data.status,
    designationCount: 0,
    employeeCount: 0,
  }).returning();
  return mapRowToDepartment(rows[0]);
}

export async function updateDepartment(id: string, data: DepartmentWriteInput): Promise<Department> {
  const rows = await getDb().update(departments)
    .set({
      code: data.code,
      name: data.name,
      branchId: data.branchId,
      headName: data.headName,
      description: data.description,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(departments.id, id))
    .returning();
  return mapRowToDepartment(rows[0]);
}

export async function deleteDepartment(id: string): Promise<void> {
  await getDb().delete(departments).where(eq(departments.id, id));
}