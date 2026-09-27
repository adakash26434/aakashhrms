import { CalendarDays, Sun, Building2 } from "lucide-react";
import type { HolidayCounts } from "@/lib/engines/holiday.engine";

interface HolidayKpiCardsProps {
  counts: HolidayCounts;
}

export function HolidayKpiCards({ counts }: HolidayKpiCardsProps) {
  const metrics = [
    {
      label: "Total calendar holidays",
      value: counts.total,
      subtext: "Recognized public & statutory events",
      icon: CalendarDays,
      iconColor: "text-zinc-400",
    },
    {
      label: "Combined off days",
      value: `${counts.totalDays} days`,
      subtext: "Total non-working days allocated",
      icon: Sun,
      iconColor: "text-amber-500",
    },
    {
      label: "All-branch holidays",
      value: counts.allBranchCount,
      subtext: "Applies across all enterprise branches",
      icon: Building2,
      iconColor: "text-emerald-700",
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
