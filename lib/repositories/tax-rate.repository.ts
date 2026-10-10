import { getDb } from '@/lib/db';
import { taxRateSlabs, fiscalYears } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { TaxSlab, TaxCategory } from '@/lib/types/tax-rate';

// Tax slabs (4.12): a category's ladder for a fiscal year is replaced as a whole (replaceLadder),
// never band by band, so a ladder is never half saved.

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
  const rows = await (await getDb())
    .select()
    .from(taxRateSlabs)
    .innerJoin(fiscalYears, eq(taxRateSlabs.fiscalYearId, fiscalYears.id));

  return rows.map(mapRowToTaxSlab);
}

/** Every category's slabs for one fiscal year — the run's year, never all years (4.8 fix). */
export async function findSlabsByFiscalYear(fiscalYearId: string): Promise<TaxSlab[]> {
  const rows = await (await getDb())
    .select()
    .from(taxRateSlabs)
    .innerJoin(fiscalYears, eq(taxRateSlabs.fiscalYearId, fiscalYears.id))
    .where(eq(taxRateSlabs.fiscalYearId, fiscalYearId))
    .orderBy(taxRateSlabs.amountFrom);
  return rows.map(mapRowToTaxSlab);
}

/**
 * A category's whole ladder for a year, replaced in one transaction (bands as
 * boundaries). The year's row is locked first, so two saves never interleave
 * into a doubled ladder and a year closed meanwhile is left alone (false).
 */
export async function replaceLadder(fiscalYearId: string, category: TaxCategory, bands: { from: number; upTo: number | null; ratePercent: number; fixedDeduction: number }[]): Promise<boolean> {
  return (await getDb()).transaction(async (tx) => {
    const [year] = await tx.select({ status: fiscalYears.status }).from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId)).for('update');
    if (!year || year.status === 'Locked') return false;
    await tx.delete(taxRateSlabs).where(and(eq(taxRateSlabs.fiscalYearId, fiscalYearId), eq(taxRateSlabs.category, category)));
    if (bands.length) {
      await tx.insert(taxRateSlabs).values(
        bands.map((b) => ({
          fiscalYearId,
          category,
          amountFrom: String(b.from),
          amountTo: b.upTo === null ? null : String(b.upTo),
          ratePercent: String(b.ratePercent),
          fixedDeduction: String(b.fixedDeduction),
        }))
      );
    }
    return true;
  });
}
