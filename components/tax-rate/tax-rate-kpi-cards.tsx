import { Layers, TrendingUp, ListChecks } from "lucide-react";
import { formatRateLabel, type TaxSlab } from "@/lib/types/tax-rate";

interface TaxRateKpiCardsProps {
  slabs: TaxSlab[];
  highestRate: number;
  configuredCount: number;
  totalCategories: number;
}

export function TaxRateKpiCards({
  slabs,
  highestRate,
  configuredCount,
  totalCategories,
}: TaxRateKpiCardsProps) {
  const activeSlabs = slabs.length;
  const hasSlabs = activeSlabs > 0;

  const metrics = [
    {
      label: "Active tax slabs",
      value: `${activeSlabs} ${activeSlabs === 1 ? "slab" : "slabs"}`,
      subtext: "Configured brackets for fiscal year",
      icon: Layers,
      iconColor: "text-zinc-400",
    },
    {
      label: "Highest marginal rate",
      value: hasSlabs ? formatRateLabel(highestRate) : "—",
      subtext: "Top progressive statutory bracket",
      icon: TrendingUp,
      iconColor: "text-emerald-700",
    },
    {
      label: "Configured categories",
      value: `${configuredCount} of ${totalCategories}`,
      subtext: "Marital & resident tax classifications",
      icon: ListChecks,
      iconColor: "text-zinc-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">{m.label}</p>
                <Icon className={`h-4 w-4 ${m.iconColor}`} />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {m.value}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              {m.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}
