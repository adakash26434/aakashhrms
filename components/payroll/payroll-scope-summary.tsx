"use client";

import { Calendar, Building2, Briefcase, Award, Users, CheckCircle2 } from "lucide-react";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";

interface PayrollScopeSummaryProps {
  bsYear: number;
  payPeriodMonth: number;
  branchCount: number;
  totalBranches: number;
  departmentCount: number;
  totalDepartments: number;
  designationCount: number;
  totalDesignations: number;
  categoryCount: number;
  totalCategories: number;
  matchedEmployeesCount: number;
  selectedEmployeesCount?: number;
  employeesLoaded?: boolean;
}

export function PayrollScopeSummary({
  bsYear,
  payPeriodMonth,
  branchCount,
  totalBranches,
  departmentCount,
  totalDepartments,
  designationCount,
  totalDesignations,
  categoryCount,
  totalCategories,
  matchedEmployeesCount,
  selectedEmployeesCount,
  employeesLoaded = false,
}: PayrollScopeSummaryProps) {
  const monthName = BS_MONTHS_EN[payPeriodMonth] ?? `Month ${payPeriodMonth}`;

  // Next year representation for Nepal FY notation, e.g. "2083/84"
  const nextYearSuffix = String(bsYear + 1).slice(-2);
  const fyLabel = `FY ${bsYear}/${nextYearSuffix}`;

  const branchText =
    branchCount === totalBranches ? `All ${totalBranches} branches` : `${branchCount} of ${totalBranches} branches`;

  const deptText =
    departmentCount === totalDepartments
      ? `All ${totalDepartments} depts`
      : `${departmentCount} of ${totalDepartments} depts`;

  const desigText =
    designationCount === totalDesignations
      ? `All ${totalDesignations} desigs`
      : `${designationCount} of ${totalDesignations} desigs`;

  const catText =
    categoryCount === 0 || categoryCount === totalCategories
      ? "All categories"
      : `${categoryCount} categories`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-payroll-primary/20 bg-payroll-cream/60 px-4 py-3 shadow-payroll-xs">
      {/* Scope Metadata Strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-payroll-navy">
        <div className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 font-bold text-payroll-primary shadow-xs border border-payroll-light/70">
          <Calendar className="h-3.5 w-3.5" />
          <span>{fyLabel}</span>
          <span className="text-gray-300">·</span>
          <span>{monthName} Run</span>
        </div>

        <span className="text-gray-300 hidden sm:inline">|</span>

        <div className="flex items-center gap-1 text-gray-600">
          <Building2 className="h-3.5 w-3.5 text-gray-400" />
          <span>{branchText}</span>
        </div>

        <span className="text-gray-300">·</span>

        <div className="flex items-center gap-1 text-gray-600">
          <Briefcase className="h-3.5 w-3.5 text-gray-400" />
          <span>{deptText}</span>
        </div>

        <span className="text-gray-300">·</span>

        <div className="flex items-center gap-1 text-gray-600">
          <Award className="h-3.5 w-3.5 text-gray-400" />
          <span>{desigText}</span>
        </div>

        <span className="text-gray-300">·</span>

        <div className="flex items-center gap-1 text-gray-600">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          <span>{catText}</span>
        </div>
      </div>

      {/* Matched / Selected Counts Badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1 text-xs font-semibold shadow-xs border border-payroll-light/80">
          <CheckCircle2 className="h-4 w-4 text-payroll-primary" />
          <span className="text-gray-600">Matched Scope:</span>
          <span className="font-bold text-payroll-primary font-mono text-[13px]">
            {matchedEmployeesCount} {matchedEmployeesCount === 1 ? "staff" : "staff"}
          </span>
          {employeesLoaded && selectedEmployeesCount !== undefined && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-emerald-700 font-bold font-mono">
                {selectedEmployeesCount} selected
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
