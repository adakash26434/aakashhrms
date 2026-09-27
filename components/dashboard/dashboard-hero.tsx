"use client";

import Link from "next/link";
import { Calendar, ChevronDown, FileSpreadsheet } from "lucide-react";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { formatPayrollCycleMonth } from "@/lib/utils";
import type { DashboardHero } from "@/lib/types/dashboard";

interface DashboardHeroProps {
  data: DashboardHero;
  periodLabel?: string;
  payPeriodMonth?: number;
  payPeriodYear?: number;
  payPeriodStartDate?: string;
}

export function DashboardHeroSection({
  data,
  periodLabel,
  payPeriodMonth,
  payPeriodYear,
  payPeriodStartDate,
}: DashboardHeroProps) {
  const { calendar } = useDateFormat();

  // Extract user greeting or name if available
  const greetingParts = data.greeting.replace(/^Welcome back,\s*/i, "").split("—")[0].trim();
  const userName = greetingParts || "Administrator";

  const todayStr = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const activePeriodLabel = payPeriodMonth
    ? formatPayrollCycleMonth(payPeriodMonth, payPeriodYear, payPeriodStartDate, calendar)
    : periodLabel || "Current Month";

  return (
    <div className="space-y-4">
      {/* Top Banner Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950">
            Payroll & Workforce Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500">
            Good morning, {userName}. Operations, compliance, and payroll cycle status.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span>{activePeriodLabel}</span>
            <ChevronDown className="h-3 w-3 text-zinc-400 ml-0.5" />
          </div>

          <Link
            href="/payroll/generate"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-payroll-primary px-3.5 text-xs font-medium text-white shadow-2xs hover:bg-payroll-primary-hover active:scale-[0.99] transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Review payroll</span>
          </Link>
        </div>
      </div>

      {/* Subheader Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-300/80 pb-2 text-xs">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="font-semibold text-zinc-800">Company Overview</span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500">{todayStr}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
          <span>Active payroll cycle for selected month</span>
        </div>
      </div>
    </div>
  );
}
