import {
  Building2,
  CheckCircle2,
  Briefcase,
  Users,
} from "lucide-react";
import type { DepartmentCounts } from "@/lib/engines/department.engine";

interface DepartmentKpiCardsProps {
  counts: DepartmentCounts;
}

/**
 * Four KPI cards for the Department Setup page:
 *   1. Total Departments     — `counts.total`               (Building2, blue)
 *   2. Active                — `counts.active`              (CheckCircle2, emerald)
 *   3. Designations          — `counts.totalDesignations`   (Briefcase, amber)
 *   4. Employees             — `counts.totalEmployees`      (Users, violet)
 *
 * The numbers are pre-computed by the parent (via the engine's
 * `countDepartments`) — this keeps the engine as the single
 * source of truth for the rules and lets the same numbers be
 * reused elsewhere (e.g. the page header counts).
 */
export function DepartmentKpiCards({ counts }: DepartmentKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={<Building2 className="h-5 w-5 text-[#2e7d32]" />}
        label="Total Departments"
        value={counts.total}
        tone="blue"
      />
      <KpiCard
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        label="Active"
        value={counts.active}
        tone="emerald"
      />
      <KpiCard
        icon={<Briefcase className="h-5 w-5 text-amber-600" />}
        label="Designations"
        value={counts.totalDesignations}
        tone="amber"
      />
      <KpiCard
        icon={<Users className="h-5 w-5 text-violet-600" />}
        label="Employees"
        value={counts.totalEmployees}
        tone="violet"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  /** Tints the icon background. Purely decorative. */
  tone: "blue" | "emerald" | "amber" | "violet";
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneBg: Record<KpiCardProps["tone"], string> = {
    blue: "bg-green-50",
    emerald: "bg-emerald-50",
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
