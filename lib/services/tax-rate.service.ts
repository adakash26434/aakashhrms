import * as repository from "@/lib/repositories/tax-rate.repository";
import * as fyRepository from "@/lib/repositories/fiscal-year.repository";
import { findSettings } from "@/lib/repositories/system-control.repository";
import { ladderBands, ladderIsValid, normalizeLadder, rowsFromSlabs, validateLadder, type LadderErrors } from "@/lib/engines/tax-rate.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { TAX_CATEGORIES, TAX_CATEGORY_LABEL, type TaxCategory, type TaxSlabsPage } from "@/lib/types/tax-rate";

// Tax slabs (4.12, S49): each category's ladder for a fiscal year is edited and saved as a whole —
// bands as boundaries, starting at 0, each starting where the one before ends, the last with no
// top, rates never going down (lib/engines/tax-rate.engine.ts). A closed year's slabs stay as they
// were. Callers check TAX_RATES with a company-wide role (checkCompanyControl). Every save is
// audited with the ladder before and after.

export class TaxLadderValidationError extends UserFacingError {
  constructor(public errors: LadderErrors) {
    super(errors.form ?? "Check the highlighted bands.");
    this.name = "TaxLadderValidationError";
  }
}

export interface TaxCtx {
  userId: string;
}

const emptyLadders = () => Object.fromEntries(TAX_CATEGORIES.map((c) => [c, []])) as unknown as TaxSlabsPage["ladders"];

export async function taxSlabsPage(requestedYear: string | null | undefined, canEdit: boolean): Promise<TaxSlabsPage> {
  const [all, settings] = await Promise.all([fyRepository.findAllFiscalYears(), findSettings()]);
  const years = all.sort((a, b) => b.startDateBS.localeCompare(a.startDateBS));
  const chosen = years.find((y) => y.id === requestedYear) ?? years.find((y) => y.status === "Active") ?? years[0];
  const womenRebatePercent = Number(settings.insuranceDiscounts?.womenDiscountPercent ?? 0) || 0;
  if (!chosen) return { years: [], fiscalYearId: "", fiscalYearLabel: "", ladders: emptyLadders(), closed: false, hasRuns: false, canEdit: false, womenRebatePercent };
  const [slabs, hasRuns] = await Promise.all([repository.findSlabsByFiscalYear(chosen.id), fyRepository.hasPayRuns(chosen.id)]);
  const ladders = emptyLadders();
  for (const c of TAX_CATEGORIES) ladders[c] = rowsFromSlabs(slabs.filter((s) => s.category === c));
  const closed = chosen.status === "Locked";
  return {
    years: years.map((y) => ({ value: y.id, label: y.label, closed: y.status === "Locked", current: y.status === "Active" })),
    fiscalYearId: chosen.id,
    fiscalYearLabel: chosen.label,
    ladders,
    closed,
    hasRuns,
    canEdit: canEdit && !closed,
    womenRebatePercent,
  };
}

/** Replaces one category's ladder for a year (an empty list removes it: payroll then uses Individual). */
export async function saveLadder(fiscalYearId: string, category: string, raw: unknown, ctx: TaxCtx): Promise<void> {
  if (!TAX_CATEGORIES.includes(category as TaxCategory)) throw new UserFacingError("Choose one of the tax categories.");
  const cat = category as TaxCategory;
  const year = await fyRepository.findFiscalYearById(fiscalYearId);
  if (!year) throw new UserFacingError("That fiscal year no longer exists.");
  const closed = `${year.label} is closed: its tax slabs stay as they were. Reopen the year first.`;
  if (year.status === "Locked") throw new UserFacingError(closed);
  const rows = normalizeLadder(raw);
  if (rows.length) {
    const errors = validateLadder(rows);
    if (!ladderIsValid(errors)) throw new TaxLadderValidationError(errors);
  } else if (cat === "Normal Single") {
    throw new UserFacingError("The Individual ladder is the one every other category falls back to: it can't be empty.");
  }
  const before = ladderBands(rowsFromSlabs((await repository.findSlabsByFiscalYear(fiscalYearId)).filter((s) => s.category === cat)));
  const bands = ladderBands(rows);
  if (!(await repository.replaceLadder(fiscalYearId, cat, bands))) throw new UserFacingError(closed);
  const plain = (list: typeof bands) => list.map((b) => ({ from: b.from, upTo: b.upTo, ratePercent: b.ratePercent, fixedDeduction: b.fixedDeduction }));
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "TAX_RATES",
    recordId: `${year.label} · ${TAX_CATEGORY_LABEL[cat].en}`,
    oldValues: { bands: plain(before) },
    newValues: { bands: plain(bands) },
  });
}
