import { Layers, TrendingUp, ListChecks } from "lucide-react";
import { formatRateLabel, type TaxSlab } from "@/lib/types/tax-rate";

interface TaxRateKpiCardsProps {
  /** All slabs for the currently selected FY (across categories). */
  slabs: TaxSlab[];
  /** Highest marginal rate for the selected FY (pre-computed via engine). */
  highestRate: number;
  /** Number of categories with at least one slab (pre-computed via engine). */
  configuredCount: number;
  /** Total possible categories. Defaults to 4 (TAX_CATEGORIES.length). */
  totalCategories: number;
}

/**
 * Three KPI cards at the bottom of the Tax Rate Setup page:
 *   1. Active Slabs         — `slabs.length`
 *   2. Highest Rate         — `formatRateLabel(highestRate)`
 *   3. Categories Configured — `${configuredCount} of ${totalCategories}`
 *
 * The first metric is computed inline (a `.length` is trivial). The
 * latter two are pre-computed by the parent using the **engine** —
 * this keeps the engine as the single source of truth for the
 * computation rules and lets the same numbers be reused elsewhere
 * (e.g. an analytics dashboard) without re-implementing the logic.
 */
export function TaxRateKpiCards({
  slabs,
  highestRate,
  configuredCount,
  totalCategories,
}: TaxRateKpiCardsProps) {
  const activeSlabs = slabs.length;
  const hasSlabs = activeSlabs > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        icon={<Layers className="h-5 w-5 text-[#2e7d32]" />}
        label="Active Slabs"
        value={`${activeSlabs} ${activeSlabs === 1 ? "slab" : "slabs"}`}
        tone="blue"
      />
      <KpiCard
        icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
        label="Highest Rate"
        value={hasSlabs ? formatRateLabel(highestRate) : "—"}
        tone="emerald"
      />
      <KpiCard
        icon={<ListChecks className="h-5 w-5 text-violet-600" />}
        label="Categories Configured"
        value={`${configuredCount} of ${totalCategories}`}
        tone="violet"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Tints the icon background. Purely decorative. */
  tone: "blue" | "emerald" | "violet";
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneBg: Record<KpiCardProps["tone"], string> = {
    blue: "bg-green-50",
    emerald: "bg-emerald-50",
    violet: "bg-violet-50",
  };

  return (
    <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneBg[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-semibold text-[#1b3a1f]">{value}</p>
        </div>
      </div>
    </div>
  );
}
