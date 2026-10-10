import { getDb } from '@/lib/db';
import { holidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Holiday, HolidayAppliesTo, HolidayCategory } from '@/lib/types/holiday';
import type { HolidayWrite } from '@/lib/engines/holiday.engine';
import { bsStringToAD } from '@/lib/utils/bs-calendar';

// Holidays (4.12c). The BS days are the record; the AD columns beside them are local-midnight
// timestamps (attendance reads them back in Nepal time).

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
    appliesTo: (row.appliesTo === 'women' ? 'women' : 'everyone') as HolidayAppliesTo,
    branchIds: Array.isArray(row.branchIds) ? row.branchIds : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllHolidays(): Promise<Holiday[]> {
  const rows = await (await getDb()).select().from(holidays);
  return rows.map(mapRowToHoliday);
}

export async function findHolidayById(id: string): Promise<Holiday | undefined> {
  const rows = await (await getDb()).select().from(holidays).where(eq(holidays.id, id));
  if (!rows.length) return undefined;
  return mapRowToHoliday(rows[0]);
}

function columns(w: HolidayWrite) {
  const startDateAD = bsStringToAD(w.startDate);
  const endDateAD = bsStringToAD(w.endDate);
  if (!startDateAD || !endDateAD) throw new Error('Holiday dates outside the BS calendar.');
  return { name: w.name, category: w.category, startDate: w.startDate, endDate: w.endDate, startDateAD, endDateAD, appliesTo: w.appliesTo, branchIds: w.branchIds };
}

export async function insertHoliday(w: HolidayWrite): Promise<Holiday> {
  const [row] = await (await getDb()).insert(holidays).values(columns(w)).returning();
  return mapRowToHoliday(row);
}

/** Saves a holiday (null: it was deleted meanwhile). */
export async function updateHoliday(id: string, w: HolidayWrite): Promise<Holiday | null> {
  const [row] = await (await getDb()).update(holidays).set({ ...columns(w), updatedAt: new Date() }).where(eq(holidays.id, id)).returning();
  return row ? mapRowToHoliday(row) : null;
}

/** Deletes a holiday (false: it was deleted meanwhile). */
export async function deleteHoliday(id: string): Promise<boolean> {
  const rows = await (await getDb()).delete(holidays).where(eq(holidays.id, id)).returning({ id: holidays.id });
  return rows.length > 0;
}
