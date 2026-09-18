import { getDb } from '@/lib/db';
import { employmentTypes, employees } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import type { EmploymentType, EmploymentTypeFormData } from '@/lib/types/company-setup';

type EmploymentTypeRow = typeof employmentTypes.$inferSelect;

function mapRowToType(row: EmploymentTypeRow): EmploymentType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameNepali: row.nameNepali,
    isPfEligible: row.isPfEligible,
    isSsfEligible: row.isSsfEligible,
    isFestivalEligible: row.isFestivalEligible,
    isLeaveEligible: row.isLeaveEligible,
    isOtEligible: row.isOtEligible,
    noticePeriodDays: row.noticePeriodDays,
    probationMonths: row.probationMonths,
    rankOrder: row.rankOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const DEFAULT_EMPLOYMENT_TYPES: EmploymentTypeFormData[] = [
  {
    code: 'PERMANENT',
    name: 'Permanent',
    nameNepali: 'नियमित / स्थायी रोजगारी',
    isPfEligible: true,
    isSsfEligible: true,
    isFestivalEligible: true,
    isLeaveEligible: true,
    isOtEligible: true,
    noticePeriodDays: 30,
    probationMonths: 6,
    rankOrder: 1,
    isActive: true,
  },
  {
    code: 'CONTRACT',
    name: 'Contract',
    nameNepali: 'समयावधि / करार रोजगारी',
    isPfEligible: true,
    isSsfEligible: true,
    isFestivalEligible: true,
    isLeaveEligible: true,
    isOtEligible: true,
    noticePeriodDays: 30,
    probationMonths: 0,
    rankOrder: 2,
    isActive: true,
  },
  {
    code: 'PROBATION',
    name: 'Probation / Trainee',
    nameNepali: 'परीक्षणकाल / प्रशिक्षार्थी',
    isPfEligible: true,
    isSsfEligible: true,
    isFestivalEligible: false,
    isLeaveEligible: true,
    isOtEligible: true,
    noticePeriodDays: 15,
    probationMonths: 6,
    rankOrder: 3,
    isActive: true,
  },
  {
    code: 'CONSULTANT',
    name: 'Consultant',
    nameNepali: 'परामर्शदाता / सेवा करार',
    isPfEligible: false,
    isSsfEligible: false,
    isFestivalEligible: false,
    isLeaveEligible: false,
    isOtEligible: false,
    noticePeriodDays: 30,
    probationMonths: 0,
    rankOrder: 4,
    isActive: true,
  },
  {
    code: 'TEMPORARY',
    name: 'Temporary',
    nameNepali: 'अस्थायी रोजगारी',
    isPfEligible: false,
    isSsfEligible: false,
    isFestivalEligible: true,
    isLeaveEligible: true,
    isOtEligible: true,
    noticePeriodDays: 15,
    probationMonths: 0,
    rankOrder: 5,
    isActive: true,
  },
  {
    code: 'DAILY_WAGE',
    name: 'Daily Wage',
    nameNepali: 'आकस्मिक / दैनिक ज्यालादारी',
    isPfEligible: false,
    isSsfEligible: false,
    isFestivalEligible: false,
    isLeaveEligible: false,
    isOtEligible: true,
    noticePeriodDays: 7,
    probationMonths: 0,
    rankOrder: 6,
    isActive: true,
  },
];

/**
 * Retrieves all employment types for the tenant.
 * Auto-seeds with standard Nepal Labour Act categories if table is empty.
 */
export async function findAllEmploymentTypes(): Promise<EmploymentType[]> {
  const db = getDb();
  let rows: EmploymentTypeRow[] = [];

  try {
    rows = await db
      .select()
      .from(employmentTypes)
      .orderBy(asc(employmentTypes.rankOrder));
  } catch {
    return DEFAULT_EMPLOYMENT_TYPES.map((t, idx) => ({
      id: `default-${idx}`,
      ...t,
      nameNepali: t.nameNepali || null,
      isActive: true,
      rankOrder: t.rankOrder || idx + 1,
    }));
  }

  if (rows.length === 0) {
    try {
      for (const item of DEFAULT_EMPLOYMENT_TYPES) {
        await db
          .insert(employmentTypes)
          .values({
            code: item.code,
            name: item.name,
            nameNepali: item.nameNepali || null,
            isPfEligible: item.isPfEligible,
            isSsfEligible: item.isSsfEligible,
            isFestivalEligible: item.isFestivalEligible,
            isLeaveEligible: item.isLeaveEligible,
            isOtEligible: item.isOtEligible,
            noticePeriodDays: item.noticePeriodDays,
            probationMonths: item.probationMonths,
            rankOrder: item.rankOrder || 1,
            isActive: true,
          })
          .onConflictDoNothing();
      }

      rows = await db
        .select()
        .from(employmentTypes)
        .orderBy(asc(employmentTypes.rankOrder));
    } catch {
      return DEFAULT_EMPLOYMENT_TYPES.map((t, idx) => ({
        id: `default-${idx}`,
        ...t,
        nameNepali: t.nameNepali || null,
        isActive: true,
        rankOrder: t.rankOrder || idx + 1,
      }));
    }
  }

  return rows.map(mapRowToType);
}

export async function createEmploymentType(data: EmploymentTypeFormData): Promise<EmploymentType> {
  const db = getDb();
  const code = data.code.trim().toUpperCase();

  const [row] = await db
    .insert(employmentTypes)
    .values({
      code,
      name: data.name.trim(),
      nameNepali: data.nameNepali?.trim() || null,
      isPfEligible: data.isPfEligible ?? true,
      isSsfEligible: data.isSsfEligible ?? true,
      isFestivalEligible: data.isFestivalEligible ?? true,
      isLeaveEligible: data.isLeaveEligible ?? true,
      isOtEligible: data.isOtEligible ?? true,
      noticePeriodDays: Number(data.noticePeriodDays) || 30,
      probationMonths: Number(data.probationMonths) || 0,
      rankOrder: data.rankOrder !== undefined ? data.rankOrder : 99,
      isActive: data.isActive ?? true,
    })
    .returning();

  return mapRowToType(row);
}

export async function updateEmploymentType(
  id: string,
  data: Partial<EmploymentTypeFormData>
): Promise<EmploymentType> {
  const db = getDb();
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) updates.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.nameNepali !== undefined) updates.nameNepali = data.nameNepali?.trim() || null;
  if (data.isPfEligible !== undefined) updates.isPfEligible = data.isPfEligible;
  if (data.isSsfEligible !== undefined) updates.isSsfEligible = data.isSsfEligible;
  if (data.isFestivalEligible !== undefined) updates.isFestivalEligible = data.isFestivalEligible;
  if (data.isLeaveEligible !== undefined) updates.isLeaveEligible = data.isLeaveEligible;
  if (data.isOtEligible !== undefined) updates.isOtEligible = data.isOtEligible;
  if (data.noticePeriodDays !== undefined) updates.noticePeriodDays = Number(data.noticePeriodDays);
  if (data.probationMonths !== undefined) updates.probationMonths = Number(data.probationMonths);
  if (data.rankOrder !== undefined) updates.rankOrder = data.rankOrder;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [row] = await db
    .update(employmentTypes)
    .set(updates)
    .where(eq(employmentTypes.id, id))
    .returning();

  return mapRowToType(row);
}

export async function deleteEmploymentType(id: string): Promise<void> {
  const db = getDb();
  const [target] = await db.select().from(employmentTypes).where(eq(employmentTypes.id, id)).limit(1);
  if (!target) return;

  // Check if any employee has this category
  const inUse = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.category, target.name));

  const usageCount = inUse[0]?.count ?? 0;
  if (usageCount > 0) {
    throw new Error(
      `Cannot delete category "${target.name}" because it is currently assigned to ${usageCount} employee(s).`
    );
  }

  await db.delete(employmentTypes).where(eq(employmentTypes.id, id));
}
