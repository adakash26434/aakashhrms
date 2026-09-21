"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  X,
  RotateCcw,
  User,
  Building2,
  Briefcase,
  CalendarDays,
  CreditCard,
} from "lucide-react";
import type { ReportFilterLookupData } from "@/lib/types/report";
import { BS_MONTHS_LIST } from "@/lib/utils/bs-calendar";
import { cn } from "@/lib/utils";

export interface ReportFilterState {
  payrollRunId?: string;
  fiscalYearId?: string;
  bsMonth?: number;
  reportType?: "MONTHLY" | "ANNUAL";
  reportFormat?: "DEVICE_PUNCH" | "STATUS_MATRIX" | "STATUTORY_SUMMARY";
  branchId?: string;
  departmentId?: string;
  designationId?: string;
  employeeId?: string;
  leaveTypeId?: string;
  loanTypeId?: string;
  payHeadType?: "ALL" | "ALLOWANCE" | "DEDUCTION";
  search?: string;
}

export interface ReportFilterBarProps {
  lookupData: ReportFilterLookupData;
  showRunSelector?: boolean;
  showFYSelector?: boolean;
  showMonthSelector?: boolean;
  showReportTypeToggle?: boolean;
  showReportFormatToggle?: boolean;
  showBranchFilter?: boolean;
  showDepartmentFilter?: boolean;
  showDesignationFilter?: boolean;
  showEmployeeFilter?: boolean;
  showLeaveTypeFilter?: boolean;
  showLoanTypeFilter?: boolean;
  showPayHeadTypeFilter?: boolean;
  showSearchFilter?: boolean;
  onFilterChange: (filters: ReportFilterState) => void;
  isLoading?: boolean;
}

export function ReportFilterBar({
  lookupData,
  showRunSelector = false,
  showFYSelector = false,
  showMonthSelector = false,
  showReportTypeToggle = false,
  showReportFormatToggle = false,
  showBranchFilter = true,
  showDepartmentFilter = true,
  showDesignationFilter = true,
  showEmployeeFilter = true,
  showLeaveTypeFilter = false,
  showLoanTypeFilter = false,
  showPayHeadTypeFilter = false,
  showSearchFilter = true,
  onFilterChange,
  isLoading = false,
}: ReportFilterBarProps) {
  const defaultRun = lookupData.lockedPayrollRuns[0]?.id || "";
  const defaultFy = lookupData.fiscalYears[0]?.id || "";

  const [payrollRunId, setPayrollRunId] = useState<string>(defaultRun);
  const [fiscalYearId, setFiscalYearId] = useState<string>(defaultFy);
  const [bsMonth, setBsMonth] = useState<number>(8); // Default Mangsir
  const [reportType, setReportType] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [reportFormat, setReportFormat] = useState<
    "DEVICE_PUNCH" | "STATUS_MATRIX" | "STATUTORY_SUMMARY"
  >("STATUTORY_SUMMARY");
  const [branchId, setBranchId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [designationId, setDesignationId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [loanTypeId, setLoanTypeId] = useState<string>("");
  const [payHeadType, setPayHeadType] = useState<"ALL" | "ALLOWANCE" | "DEDUCTION">("ALL");
  const [search, setSearch] = useState<string>("");

  const handleApply = (overrides?: Partial<ReportFilterState>) => {
    const nextState: ReportFilterState = {
      payrollRunId: showRunSelector ? payrollRunId : undefined,
      fiscalYearId: showFYSelector ? fiscalYearId : undefined,
      bsMonth: showMonthSelector ? bsMonth : undefined,
      reportType: showReportTypeToggle ? reportType : undefined,
      reportFormat: showReportFormatToggle ? reportFormat : undefined,
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
      designationId: designationId || undefined,
      employeeId: employeeId || undefined,
      leaveTypeId: showLeaveTypeFilter ? leaveTypeId || undefined : undefined,
      loanTypeId: showLoanTypeFilter ? loanTypeId || undefined : undefined,
      payHeadType: showPayHeadTypeFilter ? payHeadType : undefined,
      search: search || undefined,
      ...overrides,
    };
    onFilterChange(nextState);
  };

  const handleResetAll = () => {
    setBranchId("");
    setDepartmentId("");
    setDesignationId("");
    setEmployeeId("");
    setLeaveTypeId("");
    setLoanTypeId("");
    setPayHeadType("ALL");
    setSearch("");
    onFilterChange({
      payrollRunId: showRunSelector ? payrollRunId : undefined,
      fiscalYearId: showFYSelector ? fiscalYearId : undefined,
      bsMonth: showMonthSelector ? bsMonth : undefined,
      reportType: showReportTypeToggle ? reportType : undefined,
      reportFormat: showReportFormatToggle ? reportFormat : undefined,
      branchId: undefined,
      departmentId: undefined,
      designationId: undefined,
      employeeId: undefined,
      leaveTypeId: undefined,
      loanTypeId: undefined,
      payHeadType: undefined,
      search: undefined,
    });
  };

  const selectedEmployeeObj = lookupData.employees?.find((e) => e.id === employeeId);
  const selectedBranchObj = lookupData.branches?.find((b) => b.id === branchId);
  const selectedDeptObj = lookupData.departments?.find((d) => d.id === departmentId);
  const selectedDesigObj = lookupData.designations?.find((d) => d.id === designationId);
  const selectedLeaveTypeObj = lookupData.leaveTypes?.find((l) => l.id === leaveTypeId);
  const selectedLoanTypeObj = lookupData.loanTypes?.find((l) => l.id === loanTypeId);

  const hasActiveFilterChips = Boolean(
    employeeId ||
      branchId ||
      departmentId ||
      designationId ||
      leaveTypeId ||
      loanTypeId ||
      search
  );

  return (
    <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 sm:p-5 shadow-payroll-xs space-y-4 print:hidden">
      {/* Filter Header & Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-payroll-light/60 pb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-payroll-navy">
          <Filter className="h-4 w-4 text-payroll-primary" />
          <span>Report Filter Options</span>
          {hasActiveFilterChips && (
            <span className="inline-flex items-center rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-payroll-primary">
              Filters Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilterChips && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition-all active:scale-[0.98]"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </button>
          )}

          {showReportTypeToggle && (
            <div className="inline-flex rounded-lg border border-payroll-light bg-payroll-cream p-1">
              <button
                type="button"
                onClick={() => {
                  setReportType("MONTHLY");
                  handleApply({ reportType: "MONTHLY" });
                }}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  reportType === "MONTHLY"
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Monthly View
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportType("ANNUAL");
                  handleApply({ reportType: "ANNUAL" });
                }}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  reportType === "ANNUAL"
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Annual View (FY)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Inputs Grid */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 items-end">
        {/* Run Selector */}
        {showRunSelector && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Locked Payroll Run *
            </label>
            <select
              value={payrollRunId}
              onChange={(e) => setPayrollRunId(e.target.value)}
              className="h-9 w-full rounded-lg border border-payroll-light bg-white px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none"
            >
              {lookupData.lockedPayrollRuns.length === 0 ? (
                <option value="">No LOCKED runs available</option>
              ) : (
                lookupData.lockedPayrollRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.label}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* FY Selector */}
        {showFYSelector && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Fiscal Year *
            </label>
            <select
              value={fiscalYearId}
              onChange={(e) => setFiscalYearId(e.target.value)}
              className="h-9 w-full rounded-lg border border-payroll-light bg-white px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none"
            >
              {lookupData.fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  FY {fy.label} ({fy.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* BS Month Selector */}
        {showMonthSelector && (reportType === "MONTHLY" || !showReportTypeToggle) && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              BS Month *
            </label>
            <select
              value={bsMonth}
              onChange={(e) => setBsMonth(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-payroll-light bg-white px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none"
            >
              {BS_MONTHS_LIST.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m} ({idx + 1})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Branch Filter */}
        {showBranchFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                branchId ? "border-payroll-primary bg-payroll-primary/5" : "border-payroll-light bg-white"
              )}
            >
              <option value="">All Branches</option>
              {lookupData.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Report Format Selector */}
        {showReportFormatToggle && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-payroll-primary uppercase tracking-wider">
              Report Format Mode
            </label>
            <select
              value={reportFormat}
              onChange={(e) =>
                setReportFormat(
                  e.target.value as "DEVICE_PUNCH" | "STATUS_MATRIX" | "STATUTORY_SUMMARY"
                )
              }
              className="h-9 w-full rounded-lg border border-payroll-primary bg-payroll-primary/10 px-2.5 text-xs font-bold text-payroll-navy focus:border-payroll-primary focus:outline-none"
            >
              <option value="STATUTORY_SUMMARY">
                Monthly Summary Ledger (Nepal Labour Act & OT)
              </option>
              <option value="DEVICE_PUNCH">
                As Per Device (Daily Punch In/Out Times)
              </option>
              <option value="STATUS_MATRIX">
                As Per Manual Attendance (Daily Status Matrix)
              </option>
            </select>
          </div>
        )}

        {/* Department Filter */}
        {showDepartmentFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                departmentId ? "border-payroll-primary bg-payroll-primary/5" : "border-payroll-light bg-white"
              )}
            >
              <option value="">All Departments</option>
              {lookupData.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Designation Filter */}
        {showDesignationFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> Position / Designation
            </label>
            <select
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                designationId ? "border-payroll-primary bg-payroll-primary/5" : "border-payroll-light bg-white"
              )}
            >
              <option value="">All Positions / Designations</option>
              {lookupData.designations?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Leave Type Filter */}
        {showLeaveTypeFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Leave Type
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                leaveTypeId ? "border-payroll-primary bg-payroll-primary/5" : "border-payroll-light bg-white"
              )}
            >
              <option value="">All Leave Types</option>
              {lookupData.leaveTypes?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loan Type Filter */}
        {showLoanTypeFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Loan Type
            </label>
            <select
              value={loanTypeId}
              onChange={(e) => setLoanTypeId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border px-2.5 text-xs font-medium text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                loanTypeId ? "border-payroll-primary bg-payroll-primary/5" : "border-payroll-light bg-white"
              )}
            >
              <option value="">All Loan Types</option>
              {lookupData.loanTypes?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Specific Single Employee Filter */}
        {showEmployeeFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-payroll-primary uppercase tracking-wider flex items-center gap-1">
              <User className="h-3 w-3" /> Single Employee Filter
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border px-2.5 text-xs font-bold text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                employeeId ? "border-payroll-primary bg-purple-50/40 text-purple-900" : "border-payroll-light bg-white"
              )}
            >
              <option value="">All Employees (Full Company)</option>
              {lookupData.employees?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Filter */}
        {showSearchFilter && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Search Text
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or code..."
                className={cn(
                  "h-9 w-full rounded-lg border pl-8 pr-2.5 text-xs text-payroll-navy focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none",
                  search ? "border-payroll-primary bg-payroll-primary/5" : "border-payroll-light bg-white"
                )}
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Full-Width Generate Action Button below options */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => handleApply()}
          disabled={isLoading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-payroll-primary px-6 text-xs font-bold uppercase tracking-wider text-white shadow-payroll-xs transition-all hover:bg-payroll-primary-hover hover:shadow-payroll-sm disabled:opacity-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-payroll-primary focus-visible:ring-offset-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Generating Report Data...</span>
            </>
          ) : (
            <>
              <Filter className="h-4 w-4" />
              <span>Generate Report</span>
            </>
          )}
        </button>
      </div>

      {/* Active Filter Chips / Badges Toolbar */}
      {hasActiveFilterChips && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-payroll-light/60 text-xs">
          <span className="text-[11px] font-semibold text-gray-500">Active Filters:</span>

          {selectedEmployeeObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 border border-purple-200">
              <User className="h-3 w-3 text-purple-600" />
              Employee: {selectedEmployeeObj.name} ({selectedEmployeeObj.employeeCode})
              <button
                type="button"
                onClick={() => {
                  setEmployeeId("");
                  handleApply({ employeeId: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-purple-200 text-purple-700"
                title="Remove employee filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedDeptObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 border border-green-200">
              <Briefcase className="h-3 w-3 text-green-600" />
              Dept: {selectedDeptObj.name}
              <button
                type="button"
                onClick={() => {
                  setDepartmentId("");
                  handleApply({ departmentId: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-green-200 text-green-700"
                title="Remove department filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedBranchObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              <Building2 className="h-3 w-3 text-emerald-600" />
              Branch: {selectedBranchObj.name}
              <button
                type="button"
                onClick={() => {
                  setBranchId("");
                  handleApply({ branchId: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-emerald-200 text-emerald-700"
                title="Remove branch filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedDesigObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 border border-teal-200">
              <Briefcase className="h-3 w-3 text-teal-600" />
              Designation: {selectedDesigObj.name}
              <button
                type="button"
                onClick={() => {
                  setDesignationId("");
                  handleApply({ designationId: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-teal-200 text-teal-700"
                title="Remove designation filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedLeaveTypeObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              <CalendarDays className="h-3 w-3 text-amber-600" />
              Leave: {selectedLeaveTypeObj.name}
              <button
                type="button"
                onClick={() => {
                  setLeaveTypeId("");
                  handleApply({ leaveTypeId: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-amber-200 text-amber-700"
                title="Remove leave type filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedLoanTypeObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200">
              <CreditCard className="h-3 w-3 text-blue-600" />
              Loan: {selectedLoanTypeObj.name}
              <button
                type="button"
                onClick={() => {
                  setLoanTypeId("");
                  handleApply({ loanTypeId: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-blue-200 text-blue-700"
                title="Remove loan type filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {search && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-200">
              <Search className="h-3 w-3 text-slate-600" />
              Search: &quot;{search}&quot;
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  handleApply({ search: undefined });
                }}
                className="rounded-full p-0.5 hover:bg-slate-200 text-slate-700"
                title="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
