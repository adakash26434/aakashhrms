import { getDb } from '@/lib/db';
import { fiscalYears } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { FiscalYear, FiscalYearStatus, BSMonthNumber } from '@/lib/types/fiscal-year';
import { formatBSDate } from '@/lib/utils/bs-calendar';

type FiscalYearRow = typeof fiscalYears.$inferSelect;

function mapRowToFiscalYear(row: FiscalYearRow): FiscalYear {
  return {
    id: row.id,
    label: row.label,
    slug: row.slug,
    fromMonth: row.fromMonth as unknown as BSMonthNumber, 
    toMonth: row.toMonth as unknown as BSMonthNumber,
    startDateAD: row.startDateAD,
    endDateAD: row.endDateAD,
    startDateBS: row.startDateBS,
    endDateBS: row.endDateBS,
    status: row.status as FiscalYearStatus,
    payslipsGenerated: row.payslipsGenerated,
  };
}

export async function findAllFiscalYears(): Promise<FiscalYear[]> {
  const rows = await getDb().select().from(fiscalYears);
  return rows.map(mapRowToFiscalYear);
}

export async function findFiscalYearById(id: string): Promise<FiscalYear | undefined> {
  const rows = await getDb().select().from(fiscalYears).where(eq(fiscalYears.id, id));
  if (!rows.length) return undefined;
  return mapRowToFiscalYear(rows[0]);
}

type CreateFiscalYearPayload = Omit<FiscalYear, "id" | "label" | "startDateBS" | "endDateBS" | "status" | "payslipsGenerated">;

export async function createFiscalYear(data: CreateFiscalYearPayload): Promise<FiscalYear> {
  const label = `FY ${data.startDateAD.getFullYear()}/${String(data.endDateAD.getFullYear()).slice(-2)}`;
  const startDateBS = formatBSDate(data.startDateAD, "numeric");
  const endDateBS = formatBSDate(data.endDateAD, "numeric");

  const rows = await getDb().insert(fiscalYears).values({
    label,
    slug: data.slug,
    fromMonth: data.fromMonth,
    toMonth: data.toMonth,
    startDateAD: data.startDateAD,
    endDateAD: data.endDateAD,
    startDateBS,
    endDateBS,
    status: "Active",
    payslipsGenerated: false,
  }).returning();
  
  return mapRowToFiscalYear(rows[0]);
}

export async function updateFiscalYear(id: string, data: CreateFiscalYearPayload): Promise<FiscalYear> {
  const label = `FY ${data.startDateAD.getFullYear()}/${String(data.endDateAD.getFullYear()).slice(-2)}`;
  const startDateBS = formatBSDate(data.startDateAD, "numeric");
  const endDateBS = formatBSDate(data.endDateAD, "numeric");

  const rows = await getDb().update(fiscalYears)
    .set({
      label,
      slug: data.slug,
      fromMonth: data.fromMonth,
      toMonth: data.toMonth,
      startDateAD: data.startDateAD,
      endDateAD: data.endDateAD,
      startDateBS,
      endDateBS,
      updatedAt: new Date(),
    })
    .where(eq(fiscalYears.id, id))
    .returning();
    
  return mapRowToFiscalYear(rows[0]);
}

export async function lockFiscalYear(id: string): Promise<FiscalYear> {
  const rows = await getDb().update(fiscalYears)
    .set({
      status: 'Locked',
      payslipsGenerated: true,
      updatedAt: new Date(),
    })
    .where(eq(fiscalYears.id, id))
    .returning();
  return mapRowToFiscalYear(rows[0]);
}

export async function deleteFiscalYear(id: string): Promise<void> {
  await getDb().delete(fiscalYears).where(eq(fiscalYears.id, id));
}