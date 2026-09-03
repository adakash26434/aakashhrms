import Link from "next/link";
import { Download, Play, Settings2, Sparkles } from "lucide-react";
import type { DashboardHero } from "@/lib/types/dashboard";

interface DashboardHeroProps {
  data: DashboardHero;
}

export function DashboardHeroSection({ data }: DashboardHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-1">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-payroll-light/70 text-payroll-navy border border-payroll-light">
            <Sparkles className="w-3 h-3 text-payroll-primary animate-[pulseSubtle_2.5s_infinite]" />
            <span>Active HR & Payroll Workspace</span>
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold leading-tight tracking-tight text-payroll-navy">
          {data.greeting}
        </h1>
        <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-gray-600">
          {data.summary}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-xs font-semibold text-payroll-navy transition-all shadow-payroll-xs"
        >
          <Download className="h-3.5 w-3.5 text-payroll-primary" />
          <span>Export Reports</span>
        </Link>

        <Link
          href="/setup/company"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-xs font-semibold text-payroll-navy transition-all shadow-payroll-xs"
        >
          <Settings2 className="h-3.5 w-3.5 text-payroll-primary" />
          <span>System Setup</span>
        </Link>

        <Link
          href="/payroll/generate"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-xs font-bold text-white transition-all shadow-payroll-sm active:scale-[0.98]"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Run Payroll Cycle</span>
        </Link>
      </div>
    </div>
  );
}
