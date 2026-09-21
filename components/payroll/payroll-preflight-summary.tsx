"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { cn } from "@/lib/utils";

interface PayrollPreflightSummaryProps {
  bsYear: number;
  payPeriodMonth: number;
  selectedEmployeeCount: number;
  missingBankEmployees?: Array<{
    id: string;
    name: string;
    employeeCode: string;
  }>;
  occasionalAllowancesCount: number;
  occasionalAllowanceNames?: string[];
}

export function PayrollPreflightSummary({
  bsYear,
  payPeriodMonth,
  selectedEmployeeCount,
  missingBankEmployees = [],
  occasionalAllowancesCount,
  occasionalAllowanceNames = [],
}: PayrollPreflightSummaryProps) {
  const hasEmployees = selectedEmployeeCount > 0;
  const hasBankDiscrepancy = missingBankEmployees.length > 0;

  // Auto-expand if there are warnings or blocking issues
  const [isExpanded, setIsExpanded] = useState(() => !hasEmployees || hasBankDiscrepancy);
  const [showMissingBankList, setShowMissingBankList] = useState(false);

  const monthName = BS_MONTHS_EN[payPeriodMonth] ?? `Month ${payPeriodMonth}`;
  const canGenerate = hasEmployees;
  const hasWarnings = hasBankDiscrepancy;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all shadow-xs",
        !canGenerate
          ? "border-red-200 bg-red-50/40"
          : hasWarnings
          ? "border-amber-200 bg-amber-50/40"
          : "border-emerald-200/80 bg-emerald-50/40"
      )}
    >
      {/* 1-Line Compact Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5 text-xs">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
              !canGenerate
                ? "bg-red-100 text-red-700"
                : hasWarnings
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            )}
          >
            {!canGenerate ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-bold text-[12px]",
                !canGenerate
                  ? "text-red-800"
                  : hasWarnings
                  ? "text-amber-900"
                  : "text-emerald-900"
              )}
            >
              {!canGenerate
                ? "Preflight Attention: Scope Selection Required"
                : hasWarnings
                ? `Preflight Ready · ${missingBankEmployees.length} Warning(s)`
                : "Preflight Verified"}
            </span>

            <span className="text-gray-300">·</span>

            <span className="text-gray-600 text-[11px]">
              {selectedEmployeeCount} staff selected
            </span>

            <span className="text-gray-300">·</span>

            <span className="text-gray-600 text-[11px]">
              {hasBankDiscrepancy
                ? `${missingBankEmployees.length} staff lack bank details (manual payout required)`
                : "Bank details verified"}
            </span>

            <span className="text-gray-300 hidden md:inline">·</span>

            <span className="text-gray-600 text-[11px] hidden md:inline">
              {occasionalAllowancesCount > 0
                ? `${occasionalAllowancesCount} occasional allowance(s)`
                : "Standard compensation"}
            </span>
          </div>
        </div>

        {/* View Details Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
            !canGenerate
              ? "bg-white text-red-700 border border-red-200 hover:bg-red-50"
              : hasWarnings
              ? "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
              : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
          )}
        >
          <span>{isExpanded ? "Hide Checks" : "View Checks"}</span>
          {isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Expanded Checklist Grid */}
      {isExpanded && (
        <div className="border-t border-inherit bg-white/80 p-4 animate-[fadeIn_150ms_ease-out] space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Period */}
            <div className="flex items-start gap-2.5 rounded-lg border border-payroll-light/70 bg-white p-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-payroll-navy truncate">
                  {monthName} {bsYear} BS Period
                </p>
                <p className="text-[10px] text-gray-500">
                  Fiscal schedule & tax period confirmed
                </p>
              </div>
            </div>

            {/* 2. Scope */}
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-2.5",
                hasEmployees
                  ? "border-payroll-light/70 bg-white"
                  : "border-red-200 bg-red-50/50"
              )}
            >
              {hasEmployees ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-bold truncate",
                    hasEmployees ? "text-payroll-navy" : "text-red-700"
                  )}
                >
                  {hasEmployees
                    ? `${selectedEmployeeCount} staff selected`
                    : "0 employees in scope"}
                </p>
                <p
                  className={cn(
                    "text-[10px]",
                    hasEmployees ? "text-gray-500" : "text-red-600"
                  )}
                >
                  {hasEmployees
                    ? "Roster ready for draft calculation"
                    : "Check at least 1 employee to proceed"}
                </p>
              </div>
            </div>

            {/* 3. Bank Accounts */}
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-2.5",
                hasBankDiscrepancy
                  ? "border-amber-200 bg-amber-50/40"
                  : "border-payroll-light/70 bg-white"
              )}
            >
              {hasBankDiscrepancy ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p
                    className={cn(
                      "text-xs font-bold truncate",
                      hasBankDiscrepancy ? "text-amber-900" : "text-payroll-navy"
                    )}
                  >
                    {hasBankDiscrepancy
                      ? `${missingBankEmployees.length} lack bank accounts`
                      : "Bank accounts verified"}
                  </p>
                  {hasBankDiscrepancy && (
                    <button
                      type="button"
                      onClick={() => setShowMissingBankList(!showMissingBankList)}
                      className="text-[10px] font-semibold text-amber-800 hover:underline cursor-pointer flex items-center"
                    >
                      {showMissingBankList ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                <p
                  className={cn(
                    "text-[10px]",
                    hasBankDiscrepancy ? "text-amber-700" : "text-gray-500"
                  )}
                >
                  {hasBankDiscrepancy
                    ? "Requires manual cheque/cash payout"
                    : "Automated bank file compatible"}
                </p>
              </div>
            </div>

            {/* 4. Attendance Cut-off */}
            <div className="flex items-start gap-2.5 rounded-lg border border-payroll-light/70 bg-white p-2.5">
              <Clock className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-payroll-navy truncate">
                  Attendance & Leave Inputs
                </p>
                <p className="text-[10px] text-gray-500">
                  Approved leaves and overtime dynamically synced
                </p>
              </div>
            </div>

            {/* 5. Occasional Adjustments */}
            <div className="flex items-start gap-2.5 rounded-lg border border-payroll-light/70 bg-white p-2.5 sm:col-span-2 lg:col-span-2">
              <Sparkles className="h-4 w-4 shrink-0 text-payroll-primary mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-payroll-navy truncate">
                  {occasionalAllowancesCount > 0
                    ? `${occasionalAllowancesCount} occasional allowance(s) applied`
                    : "Standard monthly compensation"}
                </p>
                <p className="text-[10px] text-gray-500">
                  {occasionalAllowancesCount > 0
                    ? occasionalAllowanceNames.join(", ")
                    : "No festival, Dashain, or remote additions in this run"}
                </p>
              </div>
            </div>
          </div>

          {/* Missing Bank Details List if requested */}
          {showMissingBankList && hasBankDiscrepancy && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5 animate-[fadeIn_150ms_ease-out]">
              <p className="font-bold text-[11px]">Staff with missing bank account numbers:</p>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {missingBankEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between py-0.5 border-b border-amber-200/50">
                    <span>{emp.name}</span>
                    <span className="text-amber-800">{emp.employeeCode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
