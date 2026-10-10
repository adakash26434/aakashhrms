import type { TaxSheet } from "@/lib/engines/tax-projection.engine";

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
