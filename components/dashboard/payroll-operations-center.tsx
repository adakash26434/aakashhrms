"use client";

import Link from "next/link";
import {
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
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white shadow-2xs">
        <Check className="h-3 w-3 stroke-[2.5]" />
      </div>
    );
  }
  if (status === "in-review") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-payroll-primary text-white font-medium text-[11px] ring-2 ring-payroll-primary-light">
        <span>{stepNumber}</span>
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 font-medium text-[11px]">
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
    <Card className="h-full flex flex-col justify-between relative overflow-hidden bg-white p-4 sm:p-5">
      <div>
        {/* 1. Header Bar: Title + Status Marker */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-zinc-950">
              Payroll Operations
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isInProgress ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-xs font-medium text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>In progress</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-3 w-3" />
                <span>Locked & Disbursed</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Active Run Info & Link */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 capitalize">
                {cycleName}
              </h3>
              <p className="text-[11px] text-zinc-500">
                Monthly cycle · {run.employeesIncluded.toLocaleString()} employees
              </p>
            </div>
          </div>

          <Link
            href="/payroll/generate"
            className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="Open cycle details"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 3. Main Financial Metric: Net Payout vs Payment Date */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end rounded-md bg-zinc-50/70 p-3.5 border border-zinc-200/70">
          <div>
            <p className="text-[11px] font-medium text-zinc-500">Estimated net payout</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-zinc-400 font-mono">NPR</span>
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 font-mono">
                {formatNPR(run.netPayable).replace(/^NPR\s*/, "")}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span>Gross: {formatNPR(run.grossPayroll)}</span>
              <span>·</span>
              <span>Deductions: {formatNPR(run.totalDeductions)}</span>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-[11px] font-medium text-zinc-500">Payment date</p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-zinc-900 font-mono">
              {run.dateRange ? run.dateRange.split("–")[1]?.trim() || "30 Sep, 2026" : "End of month"}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-400">
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
                className="rounded-md border border-zinc-200/80 bg-white p-2 text-center shadow-2xs"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {d.label}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-900 font-mono">
                  {formatNPR(d.amount)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 5. Stepper Pipeline (Horizontal, Compact) */}
        <div className="my-3 pt-2.5 border-t border-zinc-200">
          <div className="relative flex items-center justify-between">
            {/* Connector Lines */}
            <div className="absolute left-4 right-4 top-2.5 -translate-y-1/2 h-0.5 bg-zinc-200 z-0">
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
              <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-zinc-800 text-center">
                Attendance locked
              </span>
            </div>

            {/* Step 2: Payroll calculated */}
            <div className="relative z-10 flex flex-col items-center">
              <StepCircle status="complete" stepNumber={2} />
              <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-zinc-800 text-center">
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
                  "mt-1 text-[10px] sm:text-[11px] text-center font-medium",
                  isLocked ? "text-zinc-800" : "text-emerald-900 font-semibold",
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
              <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-zinc-400 text-center">
                Payment
              </span>
            </div>
          </div>
        </div>

        {/* 6. Preflight / Disbursed Status Callout */}
        {isLocked ? (
          <div className="rounded-md border border-emerald-200/80 bg-emerald-50/50 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-emerald-800 shrink-0" />
              <span className="font-medium text-xs">Payroll locked & disbursed. All statutory deductions verified.</span>
            </div>
            <Link
              href="/reports/salary-sheet"
              className="font-medium text-emerald-800 hover:underline shrink-0 text-xs inline-flex items-center gap-0.5"
            >
              <span>Salary sheet</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-800" />
                <span>Preflight Validation</span>
              </div>
              <span className="text-[11px] font-medium text-zinc-600">
                {exceptionCount > 0 ? `${exceptionCount} open items` : "Preflight clear"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1">
              {exceptionCount > 0
                ? "Resolve exceptions before final approval."
                : "All statutory TDS, PF & SSF calculated on active tax slabs."}
            </p>
          </div>
        )}
      </div>

      {/* 7. Bottom Review Action Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-200">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
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
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-payroll-primary px-3.5 text-xs font-medium text-white shadow-2xs hover:bg-payroll-primary-hover active:scale-[0.99] transition-all"
        >
          <span>{isLocked ? "View payroll" : "Review payroll"}</span>
        </Link>
      </div>
    </Card>
  );
}
