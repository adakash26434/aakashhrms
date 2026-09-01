import Link from "next/link";
import { Download, Play, Settings2, Sparkles } from "lucide-react";
import type { DashboardHero } from "@/lib/types/dashboard";

interface DashboardHeroProps {
  data: DashboardHero;
}

export function DashboardHeroSection({ data }: DashboardHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-2">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-payroll-light text-payroll-navy">
            <Sparkles className="w-3 h-3 text-payroll-primary" />
            <span>Live Workspace Dashboard</span>
          </span>
        </div>
        <h1 className="text-xl font-bold leading-snug tracking-tight text-payroll-navy sm:text-2xl">
          {data.greeting}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-600">
          {data.summary}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5 pt-1">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-xs font-semibold text-payroll-navy transition-all shadow-2xs"
        >
          <Download className="h-3.5 w-3.5 text-payroll-primary" />
          <span>Export Reports</span>
        </Link>

        <Link
          href="/setup"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-xs font-semibold text-payroll-navy transition-all shadow-2xs"
        >
          <Settings2 className="h-3.5 w-3.5 text-payroll-primary" />
          <span>System Setup</span>
        </Link>

        <Link
          href="/payroll/run"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-payroll-primary hover:bg-payroll-navy text-xs font-bold text-white transition-all shadow-md shadow-payroll-primary/20"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Run Payroll Cycle</span>
        </Link>
      </div>
    </div>
  );
}
