import { getDb } from '@/lib/db';
import { holidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Holiday, HolidayCategory } from '@/lib/types/holiday';
import { bsStringToAD } from '@/lib/utils/bs-calendar';

type HolidayRow = typeof holidays.$inferSelect;

function mapRowToHoliday(row: HolidayRow): Holiday {
  return {
    id: row.id,
    name: row.name,
    category: row.category as HolidayCategory,
    startDate: row.startDate,
    endDate: row.endDate,
    startDateAD: row.startDateAD,
    endDateAD: row.endDateAD,
    branchIds: Array.isArray(row.branchIds) ? row.branchIds : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllHolidays(): Promise<Holiday[]> {
  const rows = await getDb().select().from(holidays);
  return rows.map(mapRowToHoliday);
}

export async function findHolidayById(id: string): Promise<Holiday | undefined> {
  const rows = await getDb().select().from(holidays).where(eq(holidays.id, id));
  if (!rows.length) return undefined;
  return mapRowToHoliday(rows[0]);
}

type CreatePayload = Omit<Holiday, "id" | "createdAt" | "updatedAt" | "startDateAD" | "endDateAD">;

export async function createHoliday(data: CreatePayload): Promise<Holiday> {
  const startDateAD = bsStringToAD(data.startDate);
  const endDateAD = bsStringToAD(data.endDate);

  if (!startDateAD || !endDateAD) {
    throw new Error("Invalid BS dates provided to holiday repository.");
  }

  const rows = await getDb().insert(holidays).values({
    name: data.name,
    category: data.category,
    startDate: data.startDate,
    endDate: data.endDate,
    startDateAD: startDateAD,
    endDateAD: endDateAD,
    branchIds: data.branchIds || [],
  }).returning();

  return mapRowToHoliday(rows[0]);
}

export async function updateHoliday(id: string, data: CreatePayload): Promise<Holiday> {
  const startDateAD = bsStringToAD(data.startDate);
  const endDateAD = bsStringToAD(data.endDate);

  if (!startDateAD || !endDateAD) {
    throw new Error("Invalid BS dates provided to holiday repository.");
  }

  const rows = await getDb().update(holidays).set({
    name: data.name,
    category: data.category,
    startDate: data.startDate,
    endDate: data.endDate,
    startDateAD: startDateAD,
    endDateAD: endDateAD,
    branchIds: data.branchIds || [],
    updatedAt: new Date(),
  }).where(eq(holidays.id, id)).returning();

  return mapRowToHoliday(rows[0]);
}

export async function deleteHoliday(id: string): Promise<void> {
  await getDb().delete(holidays).where(eq(holidays.id, id));
}