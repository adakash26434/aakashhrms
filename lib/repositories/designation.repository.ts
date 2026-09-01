import { getDb } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { designations, departments, employees } from '@/lib/db/schema';
import type { Designation, DesignationStatus } from '@/lib/types/designation';
import type { DesignationWriteInput } from '@/lib/data/mock-designations';

type DesignationRow = typeof designations.$inferSelect;

function mapRowToDesignation(row: DesignationRow): Designation {
  return {
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
    description: row.description,
    status: row.status as DesignationStatus,
    employeeCount: row.employeeCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllDesignations(): Promise<Designation[]> {
  const db = getDb();
  const [desigRows, empRows] = await Promise.all([
    db.select().from(designations),
    db.select({ designationId: employees.designationId, count: sql<number>`count(*)::int` })
      .from(employees)
      .groupBy(employees.designationId),
  ]);

  const empCountByDesig = new Map(empRows.map((r) => [r.designationId, Number(r.count)]));

  return desigRows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
    description: row.description,
    status: row.status as DesignationStatus,
    employeeCount: empCountByDesig.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function findDesignationById(id: string): Promise<Designation | undefined> {
  const db = getDb();
  const [desigRows, empRows] = await Promise.all([
    db.select().from(designations).where(eq(designations.id, id)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(eq(employees.designationId, id)),
  ]);

  if (!desigRows.length) return undefined;
  const row = desigRows[0];
  return {
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
    description: row.description,
    status: row.status as DesignationStatus,
    employeeCount: empRows[0]?.count ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDesignation(data: DesignationWriteInput): Promise<Designation> {
  const rows = await getDb().insert(designations).values({
    name: data.name,
    departmentId: data.departmentId,
    description: data.description,
    status: data.status,
    employeeCount: 0,
  }).returning();

  await getDb().update(departments)
    .set({ designationCount: sql`${departments.designationCount} + 1` })
    .where(eq(departments.id, data.departmentId));

  return mapRowToDesignation(rows[0]);
}

export async function updateDesignation(id: string, data: DesignationWriteInput): Promise<Designation> {
  const rows = await getDb().update(designations)
    .set({
      name: data.name,
      departmentId: data.departmentId,
      description: data.description,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(designations.id, id))
    .returning();
  return mapRowToDesignation(rows[0]);
}

export async function deleteDesignation(id: string): Promise<void> {
  const designation = await findDesignationById(id);
  
  if (designation) {
    await getDb().delete(designations).where(eq(designations.id, id));
    
    await getDb().update(departments)
      .set({ designationCount: sql`${departments.designationCount} - 1` })
      .where(eq(departments.id, designation.departmentId));
  }
}