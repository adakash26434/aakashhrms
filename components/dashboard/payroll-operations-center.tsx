"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatNPR, formatPayrollCycleMonth, cn } from "@/lib/utils";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import type {
  PayrollRunSummary,
  ValidationException,
  WorkflowStepStatus,
} from "@/lib/types/dashboard";

interface PayrollOperationsCenterProps {
  run: PayrollRunSummary;
  exceptions: ValidationException[];
}

function StepCircle({
  status,
  stepNumber,
}: {
  status: WorkflowStepStatus;
  stepNumber: number;
}) {
  if (status === "complete") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-payroll-primary text-white shadow-2xs">
        <Check className="h-3 w-3 stroke-[2.5]" />
      </div>
    );
  }
  if (status === "in-review") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-payroll-primary text-white font-semibold text-[11px] ring-2 ring-payroll-primary-light">
        <span>{stepNumber}</span>
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400 font-medium text-[11px]">
      <span>{stepNumber}</span>
    </div>
  );
}

export function PayrollOperationsCenter({
  run,
  exceptions,
}: PayrollOperationsCenterProps) {
  const { calendar } = useDateFormat();
  const isLocked = run.statusLabel.toUpperCase() === "LOCKED";
  const isInProgress = !isLocked;
  const exceptionCount = exceptions.length || run.exceptions || 0;

  // Format cycle name according to selected calendar style (BS: Shrawan 2083, AD: July/August 2026)
  const localizedPeriod = formatPayrollCycleMonth(
    run.payPeriodMonth,
    run.payPeriodYear,
    run.payPeriodStartDate,
    calendar
  );
  const cycleName = `${localizedPeriod} payroll`;

  return (
    <Card className="h-full flex flex-col justify-between relative overflow-hidden border-t-2 border-t-payroll-primary bg-white p-4 sm:p-5 shadow-payroll-xs">
      <div>
        {/* 1. Header Bar: Title + Status Marker */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-gray-950">
              Payroll overview
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isInProgress ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>In progress</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                <span>Locked & Disbursed</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Active Run Info & Diagonal Link */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-payroll-primary-light border border-payroll-primary-border text-payroll-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 capitalize">
                {cycleName}
              </h3>
              <p className="text-[11px] text-gray-500">
                Monthly cycle · {run.employeesIncluded.toLocaleString()} employees
              </p>
            </div>
          </div>

          <Link
            href="/payroll/generate"
            className="rounded-lg p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            title="Open cycle details"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 3. Main Financial Metric: Net Payout vs Payment Date */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end rounded-lg bg-payroll-cream/50 p-3 border border-payroll-border/60">
          <div>
            <p className="text-[11px] font-medium text-gray-500">Estimated net payout</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-xs font-semibold text-gray-400 font-mono">NPR</span>
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-950 font-sans">
                {formatNPR(run.netPayable).replace(/^NPR\s*/, "")}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span>Gross: {formatNPR(run.grossPayroll)}</span>
              <span>·</span>
              <span>Deductions: {formatNPR(run.totalDeductions)}</span>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-[11px] font-medium text-gray-500">Payment date</p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-gray-900 font-mono">
              {run.dateRange ? run.dateRange.split("–")[1]?.trim() || "30 Sep, 2026" : "End of month"}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">
              {run.employeesExcluded} excluded · {run.exceptions} exceptions
            </p>
          </div>
        </div>

        {/* 4. Statutory Deductions Breakdown Row */}
        {run.deductions && run.deductions.length > 0 && (
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {run.deductions.map((d) => (
              <div
                key={d.label}
                className="rounded-lg border border-payroll-border/80 bg-white p-2 text-center shadow-2xs"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {d.label}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-gray-900 font-mono">
                  {formatNPR(d.amount)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 5. Stepper Pipeline (Horizontal, Compact) */}
        <div className="my-3 pt-2.5 border-t border-gray-100">
          <div className="relative flex items-center justify-between">
            {/* Connector Lines */}
            <div className="absolute left-4 right-4 top-2.5 -translate-y-1/2 h-0.5 bg-gray-200 z-0">
              <div
                className="h-full bg-payroll-primary transition-all duration-300"
                style={{
                  width: isLocked ? "100%" : "66%",
                }}
              />
            </div>

            {/* Step 1: Attendance */}
            <div className="relative z-10 flex flex-col items-center">
              <StepCircle status="complete" stepNumber={1} />
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-gray-800 text-center">
                Attendance locked
              </span>
            </div>

            {/* Step 2: Payroll calculated */}
            <div className="relative z-10 flex flex-col items-center">
              <StepCircle status="complete" stepNumber={2} />
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-gray-800 text-center">
                Payroll calculated
              </span>
            </div>

            {/* Step 3: Review & approve */}
            <div className="relative z-10 flex flex-col items-center">
              <StepCircle
                status={isLocked ? "complete" : "in-review"}
                stepNumber={3}
              />
              <span
                className={cn(
                  "mt-1 text-[10px] sm:text-[11px] text-center font-semibold",
                  isLocked ? "text-gray-800" : "text-payroll-primary",
                )}
              >
                Review & approve
              </span>
            </div>

            {/* Step 4: Payment */}
            <div className="relative z-10 flex flex-col items-center">
              <StepCircle
                status={isLocked ? "complete" : "upcoming"}
                stepNumber={4}
              />
              <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-gray-400 text-center">
                Payment
              </span>
            </div>
          </div>
        </div>

        {/* 6. Preflight / Disbursed Status Callout */}
        {isLocked ? (
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-payroll-primary shrink-0" />
              <span className="font-medium text-xs">Payroll locked & disbursed. All statutory deductions verified.</span>
            </div>
            <Link
              href="/reports/salary-sheet"
              className="font-semibold text-payroll-primary hover:underline shrink-0 text-xs inline-flex items-center gap-0.5"
            >
              <span>Salary sheet</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-payroll-primary-border bg-emerald-50/40 p-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-payroll-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Before you approve</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-600">
                {exceptionCount > 0 ? `${exceptionCount} open items` : "Preflight clear"}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">
              {exceptionCount > 0
                ? "Resolve exceptions before final approval."
                : "All statutory TDS, PF & SSF calculated on active tax slabs."}
            </p>
          </div>
        )}
      </div>

      {/* 7. Bottom Review Action Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span>
            {isLocked
              ? "All validations passed"
              : exceptionCount > 0
              ? `${exceptionCount} items need review`
              : "Ready for disbursement"}
          </span>
        </div>

        <Link
          href="/payroll/generate"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-payroll-primary px-3 py-1.5 text-xs font-semibold text-white shadow-payroll-xs hover:bg-payroll-primary-hover active:scale-[0.98] transition-all"
        >
          <span>{isLocked ? "View payroll" : "Review payroll"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
