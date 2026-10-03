import { getDb } from '@/lib/db';
import { employmentTypes } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
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
  const db = (await getDb());
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
