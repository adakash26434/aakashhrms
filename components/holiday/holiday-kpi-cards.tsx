import { CalendarDays, Sun, Building2 } from "lucide-react";
import type { HolidayCounts } from "@/lib/engines/holiday.engine";

interface HolidayKpiCardsProps {
  counts: HolidayCounts;
}

/**
 * Three KPI cards for the Holiday Setup page:
 *   1. Total Holidays     — `counts.total`           (CalendarDays, blue)
 *   2. Holiday Days       — `counts.totalDays`       (Sun, amber)
 *   3. All Branch Holidays — `counts.allBranchCount` (Building2, violet)
 *
 * The numbers are pre-computed by the parent (via the engine's
 * `countHolidays`) — this keeps the engine as the single source
 * of truth for the rules and lets the same numbers be reused
 * elsewhere.
 */
export function HolidayKpiCards({ counts }: HolidayKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        icon={<CalendarDays className="h-5 w-5 text-[#2e7d32]" />}
        label="Total Holidays"
        value={counts.total}
        tone="blue"
      />
      <KpiCard
        icon={<Sun className="h-5 w-5 text-amber-600" />}
        label="Holiday Days"
        value={`${counts.totalDays} days`}
        tone="amber"
      />
      <KpiCard
        icon={<Building2 className="h-5 w-5 text-violet-600" />}
        label="All Branch Holidays"
        value={counts.allBranchCount}
        tone="violet"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  /** Tints the icon background. Purely decorative. */
  tone: "blue" | "amber" | "violet";
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneBg: Record<KpiCardProps["tone"], string> = {
    blue: "bg-green-50",
    amber: "bg-amber-50",
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
          <p className="mt-0.5 text-xl font-semibold text-[#1b3a1f] tabular-nums">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
