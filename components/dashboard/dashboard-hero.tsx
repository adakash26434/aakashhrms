"use client";

import Link from "next/link";
import { ArrowRight, Calendar, ChevronDown, FileSpreadsheet } from "lucide-react";
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
          <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-gray-950">
            A little clarity for your workday.
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Good morning, {userName}. Your people, priorities, and next payday—all in view.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-lg border border-payroll-border bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-payroll-xs">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span>{activePeriodLabel}</span>
            <ChevronDown className="h-3 w-3 text-gray-400 ml-0.5" />
          </div>

          <Link
            href="/payroll/generate"
            className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-3.5 py-2 text-xs font-semibold text-white shadow-payroll-xs hover:bg-payroll-primary-hover active:scale-[0.99] transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Review payroll</span>
            <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Subheader Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-payroll-border/80 pb-2 text-xs">
        <div className="flex items-center gap-2 text-gray-500">
          <span className="font-semibold text-gray-800">Company overview</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">{todayStr}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-payroll-primary" />
          <span>People today · payroll by selected month</span>
        </div>
      </div>
    </div>
  );
}
