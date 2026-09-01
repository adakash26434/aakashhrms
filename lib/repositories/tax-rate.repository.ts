import { getDb } from '@/lib/db';
import { taxRateSlabs, fiscalYears } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { TaxSlab, TaxCategory } from '@/lib/types/tax-rate';

function mapRowToTaxSlab(row: {
  tax_rate_slabs: typeof taxRateSlabs.$inferSelect;
  fiscal_years: typeof fiscalYears.$inferSelect;
}): TaxSlab {
  return {
    id: row.tax_rate_slabs.id,
    fiscalYearId: row.tax_rate_slabs.fiscalYearId,
    fiscalYearLabel: row.fiscal_years.label,
    category: row.tax_rate_slabs.category as TaxCategory,
    amountFrom: Number(row.tax_rate_slabs.amountFrom),
    amountTo: row.tax_rate_slabs.amountTo ? Number(row.tax_rate_slabs.amountTo) : null,
    ratePercent: Number(row.tax_rate_slabs.ratePercent),
    fixedDeduction: Number(row.tax_rate_slabs.fixedDeduction),
  };
}

export async function findAllSlabs(): Promise<TaxSlab[]> {
  const rows = await getDb()
    .select()
    .from(taxRateSlabs)
    .innerJoin(fiscalYears, eq(taxRateSlabs.fiscalYearId, fiscalYears.id));

  return rows.map(mapRowToTaxSlab);
}

export async function findSlabsByFYAndCategory(args: {
  fiscalYearId: string;
  category: TaxCategory;
}): Promise<TaxSlab[]> {
  const rows = await getDb()
    .select()
    .from(taxRateSlabs)
    .innerJoin(fiscalYears, eq(taxRateSlabs.fiscalYearId, fiscalYears.id))
    .where(
      and(
        eq(taxRateSlabs.fiscalYearId, args.fiscalYearId),
        eq(taxRateSlabs.category, args.category)
      )
    )
    .orderBy(taxRateSlabs.amountFrom);

  return rows.map(mapRowToTaxSlab);
}

export async function findSlabById(id: string): Promise<TaxSlab | undefined> {
  const rows = await getDb()
    .select()
    .from(taxRateSlabs)
    .innerJoin(fiscalYears, eq(taxRateSlabs.fiscalYearId, fiscalYears.id))
    .where(eq(taxRateSlabs.id, id));

  if (!rows.length) return undefined;
  return mapRowToTaxSlab(rows[0]);
}

type CreatePayload = Omit<TaxSlab, "id" | "fiscalYearLabel">;

export async function createSlab(data: CreatePayload): Promise<TaxSlab> {
  const inserted = await getDb().insert(taxRateSlabs).values({
    fiscalYearId: data.fiscalYearId,
    category: data.category,
    amountFrom: data.amountFrom.toString(),
    amountTo: data.amountTo ? data.amountTo.toString() : null,
    ratePercent: data.ratePercent.toString(),
    fixedDeduction: data.fixedDeduction.toString(),
  }).returning({ id: taxRateSlabs.id }); 

  const newSlab = await findSlabById(inserted[0].id);
  if (!newSlab) throw new Error("Failed to retrieve created slab");
  
  return newSlab;
}

type UpdatePayload = Partial<Omit<TaxSlab, "id" | "fiscalYearId" | "fiscalYearLabel" | "category">>;

export async function updateSlab(id: string, data: UpdatePayload): Promise<TaxSlab> {
  await getDb().update(taxRateSlabs)
    .set({
      amountFrom: data.amountFrom?.toString(),
      amountTo: data.amountTo === null ? null : data.amountTo?.toString(),
      ratePercent: data.ratePercent?.toString(),
      fixedDeduction: data.fixedDeduction?.toString(),
    })
    .where(eq(taxRateSlabs.id, id));

  const updatedSlab = await findSlabById(id);
  if (!updatedSlab) throw new Error("Failed to retrieve updated slab");
  
  return updatedSlab;
}

export async function deleteSlab(id: string): Promise<void> {
  await getDb().delete(taxRateSlabs).where(eq(taxRateSlabs.id, id));
}