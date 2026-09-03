import {
  Building2,
  CheckCircle2,
  Briefcase,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DepartmentCounts } from "@/lib/engines/department.engine";

interface DepartmentKpiCardsProps {
  counts: DepartmentCounts;
}

export function DepartmentKpiCards({ counts }: DepartmentKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={<Building2 className="h-4.5 w-4.5 text-payroll-primary" />}
        label="Total Departments"
        value={counts.total}
        tone="primary"
      />
      <KpiCard
        icon={<CheckCircle2 className="h-4.5 w-4.5 text-emerald-700" />}
        label="Active"
        value={counts.active}
        tone="emerald"
      />
      <KpiCard
        icon={<Briefcase className="h-4.5 w-4.5 text-amber-700" />}
        label="Designations"
        value={counts.totalDesignations}
        tone="amber"
      />
      <KpiCard
        icon={<Users className="h-4.5 w-4.5 text-payroll-navy" />}
        label="Employees"
        value={counts.totalEmployees}
        tone="navy"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "navy";
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneBg: Record<KpiCardProps["tone"], string> = {
    primary: "bg-payroll-cream text-payroll-primary border border-payroll-light/80",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    amber: "bg-amber-50 text-amber-700 border border-amber-200/60",
    navy: "bg-payroll-light/60 text-payroll-navy border border-payroll-light",
  };

  return (
    <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-payroll-xs hover:shadow-payroll-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl ${toneBg[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-bold text-payroll-navy tabular-nums">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}
