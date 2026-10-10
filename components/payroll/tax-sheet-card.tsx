import type { TaxSheet } from "@/lib/engines/tax-projection.engine";
import type { MarginalTaxSheet } from "@/lib/engines/off-cycle.engine";

// Tax projection (4.8 / F5): how this month's TDS was worked out. Read-only; the figures
// are the ones frozen on the payslip when it was calculated.

const rs = (v: string) => `Rs. ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function isTaxSheet(v: unknown): v is TaxSheet {
  return !!v && typeof v === "object" && "projectedAnnualTaxable" in v && "tdsThisMonth" in v;
}

export function TaxSheetCard({ sheet }: { sheet: TaxSheet }) {
  const rows: [string, string][] = [
    [`Taxable income of ${sheet.monthsPaid} earlier month${sheet.monthsPaid === 1 ? "" : "s"}`, rs(sheet.ytdTaxable)],
    [`This month × ${sheet.monthsRemaining} month${sheet.monthsRemaining === 1 ? "" : "s"} left (this one included)`, rs(String(Number(sheet.currentTaxable) * sheet.monthsRemaining))],
    ...(Number(sheet.oneOffTaxable ?? 0) > 0 ? ([["Paid once this month (arrears, leave salary…)", rs(sheet.oneOffTaxable!)]] as [string, string][]) : []),
    ["Projected taxable income for the year", rs(sheet.projectedAnnualTaxable)],
    ["Tax on the projected year", rs(sheet.annualTax)],
    ["Tax already deducted", rs(sheet.ytdTds)],
    ["Tax still to collect", rs(sheet.taxToCollect)],
  ];
  return (
    <section aria-label="Tax computation" className="rounded-md border border-line bg-surface p-3 text-xs text-ink">
      <h4 className="mb-2 font-semibold">How this month&apos;s tax was worked out</h4>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1 font-semibold">
          <dt>TDS this month (÷ {sheet.monthsRemaining})</dt>
          <dd className="tabular-nums">{rs(sheet.tdsThisMonth)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** F6: an off-cycle payslip's tax is the extra annual tax its payment causes. */
export function isMarginalTaxSheet(v: unknown): v is MarginalTaxSheet {
  return !!v && typeof v === "object" && (v as { kind?: unknown }).kind === "marginal";
}

export function MarginalTaxCard({ sheet }: { sheet: MarginalTaxSheet }) {
  const rows: [string, string][] = [
    ["Projected taxable income for the year, before this payment", rs(sheet.marginalBase)],
    ["Taxable amount of this payment", rs(sheet.extra)],
    ["Tax on the year without it", rs(sheet.taxWithout)],
    ["Tax on the year with it", rs(sheet.taxWith)],
  ];
  return (
    <section aria-label="Tax computation" className="rounded-md border border-line bg-surface p-3 text-xs text-ink">
      <h4 className="mb-2 font-semibold">How the tax on this payment was worked out</h4>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1 font-semibold">
          <dt>TDS on this payment (the difference)</dt>
          <dd className="tabular-nums">{rs(sheet.tds)}</dd>
        </div>
      </dl>
    </section>
  );
}
