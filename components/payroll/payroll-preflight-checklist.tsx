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

interface PayrollPreflightChecklistProps {
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

export function PayrollPreflightChecklist({
  bsYear,
  payPeriodMonth,
  selectedEmployeeCount,
  missingBankEmployees = [],
  occasionalAllowancesCount,
  occasionalAllowanceNames = [],
}: PayrollPreflightChecklistProps) {
  const [showMissingBank, setShowMissingBank] = useState(false);
  const monthName = BS_MONTHS_EN[payPeriodMonth] ?? `Month ${payPeriodMonth}`;

  const hasEmployees = selectedEmployeeCount > 0;
  const hasBankDiscrepancy = missingBankEmployees.length > 0;

  // Overall readiness status
  const canGenerate = hasEmployees;
  const hasWarnings = hasBankDiscrepancy;

  return (
    <div className="rounded-xl border border-payroll-light bg-white p-4 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-payroll-light/70 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              !canGenerate
                ? "bg-red-100 text-red-700"
                : hasWarnings
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            )}
          >
            {!canGenerate ? (
              <AlertCircle className="h-4 w-4" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
              Payroll Preflight Checklist
            </h4>
            <p className="text-[11px] text-gray-500">
              Confidence gate verifying period, scope readiness, and disbursement requirements before generating draft slips.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!canGenerate ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
              <AlertCircle className="h-3 w-3" />
              Scope Selection Required
            </span>
          ) : hasWarnings ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
              <AlertTriangle className="h-3 w-3" />
              Ready with {missingBankEmployees.length} Warning
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Preflight Verified
            </span>
          )}
        </div>
      </div>

      {/* Grid of 5 Checklist Items */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
        {/* Item 1: Fiscal Period */}
        <div className="flex items-start gap-2.5 rounded-lg border border-payroll-light/70 bg-payroll-cream/30 p-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-payroll-navy truncate">
              {monthName} {bsYear} BS
            </p>
            <p className="text-[10px] text-gray-500">
              Regular monthly schedule & tax period confirmed
            </p>
          </div>
        </div>

        {/* Item 2: Employee Scope */}
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-2.5",
            hasEmployees
              ? "border-payroll-light/70 bg-payroll-cream/30"
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
                : "No employees in scope"}
            </p>
            <p
              className={cn(
                "text-[10px]",
                hasEmployees ? "text-gray-500" : "text-red-600"
              )}
            >
              {hasEmployees
                ? "Salary mappings & rosters ready to compute"
                : "Select at least 1 employee to proceed"}
            </p>
          </div>
        </div>

        {/* Item 3: Bank Details */}
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-2.5",
            hasBankDiscrepancy
              ? "border-amber-200 bg-amber-50/40"
              : "border-payroll-light/70 bg-payroll-cream/30"
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
                  onClick={() => setShowMissingBank(!showMissingBank)}
                  className="text-[10px] font-semibold text-amber-800 hover:underline cursor-pointer flex items-center"
                >
                  {showMissingBank ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
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
                ? "Will require manual disbursement"
                : "Ready for automated bank export"}
            </p>
          </div>
        </div>

        {/* Item 4: Attendance & Leave Locking */}
        <div className="flex items-start gap-2.5 rounded-lg border border-payroll-light/70 bg-payroll-cream/30 p-2.5">
          <Clock className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-payroll-navy truncate">
              Attendance & Leave Cut-off
            </p>
            <p className="text-[10px] text-gray-500">
              Approved leaves and overtime synced dynamically
            </p>
          </div>
        </div>

        {/* Item 5: Occasional Adjustments */}
        <div className="flex items-start gap-2.5 rounded-lg border border-payroll-light/70 bg-payroll-cream/30 p-2.5 sm:col-span-2 lg:col-span-2">
          <Sparkles className="h-4 w-4 shrink-0 text-payroll-primary mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-payroll-navy truncate">
              {occasionalAllowancesCount > 0
                ? `${occasionalAllowancesCount} occasional allowance(s) applied`
                : "Standard compensation structure"}
            </p>
            <p className="text-[10px] text-gray-500">
              {occasionalAllowancesCount > 0
                ? occasionalAllowanceNames.join(", ")
                : "No festival, Dashain, or remote additions in this run"}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded list of employees missing bank details if any */}
      {showMissingBank && hasBankDiscrepancy && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 space-y-1 animate-[fadeIn_150ms_ease-out]">
          <p className="font-bold text-[11px]">Staff with missing bank account numbers:</p>
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
            {missingBankEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between py-0.5 border-b border-amber-200/50">
                <span>{emp.name}</span>
                <span className="text-amber-700">{emp.employeeCode}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
