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
  Coins,
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
    <div className="space-y-4 border-b border-zinc-300/80 pb-6 print:hidden">
      {/* Filter Header & Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-700" />
          <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
            Filter report data
          </h3>
          {hasActiveFilterChips && (
            <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              Filters applied
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilterChips && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset filters
            </button>
          )}

          {showReportTypeToggle && (
            <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-100/70 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setReportType("MONTHLY");
                  handleApply({ reportType: "MONTHLY" });
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  reportType === "MONTHLY"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Monthly view
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportType("ANNUAL");
                  handleApply({ reportType: "ANNUAL" });
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  reportType === "ANNUAL"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Annual fiscal view
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Inputs Grid */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 items-end">
        {/* Run Selector */}
        {showRunSelector && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">
              Locked payroll run <span className="text-rose-500">*</span>
            </label>
            <select
              value={payrollRunId}
              onChange={(e) => setPayrollRunId(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors"
            >
              {lookupData.lockedPayrollRuns.length === 0 ? (
                <option value="">No locked runs available</option>
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
            <label className="text-xs font-medium text-zinc-600">
              Fiscal year <span className="text-rose-500">*</span>
            </label>
            <select
              value={fiscalYearId}
              onChange={(e) => setFiscalYearId(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors"
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
            <label className="text-xs font-medium text-zinc-600">
              BS month <span className="text-rose-500">*</span>
            </label>
            <select
              value={bsMonth}
              onChange={(e) => setBsMonth(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors"
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
            <label className="text-xs font-medium text-zinc-600">
              Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                branchId ? "border-payroll-primary bg-payroll-primary-light text-zinc-900" : "border-zinc-200 bg-white"
              )}
            >
              <option value="">All branches</option>
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
            <label className="text-xs font-medium text-zinc-600">
              Report format mode
            </label>
            <select
              value={reportFormat}
              onChange={(e) =>
                setReportFormat(
                  e.target.value as "DEVICE_PUNCH" | "STATUS_MATRIX" | "STATUTORY_SUMMARY"
                )
              }
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors"
            >
              <option value="STATUTORY_SUMMARY">
                Monthly Summary Ledger (Nepal Labour Act &amp; OT)
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

        {/* Pay Head Type Filter */}
        {showPayHeadTypeFilter && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1">
              <Coins className="h-3 w-3 text-zinc-400" /> Pay head type
            </label>
            <select
              value={payHeadType}
              onChange={(e) => setPayHeadType(e.target.value as "ALL" | "ALLOWANCE" | "DEDUCTION")}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                payHeadType !== "ALL" ? "border-payroll-primary bg-payroll-primary-light text-zinc-900" : "border-zinc-200 bg-white"
              )}
            >
              <option value="ALL">All pay heads</option>
              <option value="ALLOWANCE">Allowances only</option>
              <option value="DEDUCTION">Deductions only</option>
            </select>
          </div>
        )}

        {/* Department Filter */}
        {showDepartmentFilter && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                departmentId ? "border-payroll-primary bg-payroll-primary-light text-zinc-900" : "border-zinc-200 bg-white"
              )}
            >
              <option value="">All departments</option>
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
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-zinc-400" /> Position / designation
            </label>
            <select
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                designationId ? "border-payroll-primary bg-payroll-primary-light text-zinc-900" : "border-zinc-200 bg-white"
              )}
            >
              <option value="">All positions / designations</option>
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
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-zinc-400" /> Leave type
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                leaveTypeId ? "border-payroll-primary bg-payroll-primary-light text-zinc-900" : "border-zinc-200 bg-white"
              )}
            >
              <option value="">All leave types</option>
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
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1">
              <CreditCard className="h-3 w-3 text-zinc-400" /> Loan type
            </label>
            <select
              value={loanTypeId}
              onChange={(e) => setLoanTypeId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                loanTypeId ? "border-payroll-primary bg-payroll-primary-light text-zinc-900" : "border-zinc-200 bg-white"
              )}
            >
              <option value="">All loan types</option>
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
            <label className="text-xs font-medium text-zinc-700 flex items-center gap-1">
              <User className="h-3 w-3 text-zinc-400" /> Single employee filter
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={cn(
                "h-9 w-full rounded-md border px-2.5 text-xs font-medium text-zinc-800 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                employeeId ? "border-zinc-400 bg-zinc-50 font-semibold text-zinc-950" : "border-zinc-200 bg-white"
              )}
            >
              <option value="">All employees (full company)</option>
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
            <label className="text-xs font-medium text-zinc-600">
              Search text
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or code..."
                className={cn(
                  "h-9 w-full rounded-md border pl-8 pr-2.5 text-xs text-zinc-900 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors",
                  search ? "border-payroll-primary bg-payroll-primary-light" : "border-zinc-200 bg-white"
                )}
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            </div>
          </div>
        )}
      </div>

      {/* Action Row: Enterprise Black CTA Button */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => handleApply()}
          disabled={isLoading}
          className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-sm px-6 shadow-sm shadow-payroll-primary/10 transition-colors disabled:opacity-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-payroll-primary focus-visible:ring-offset-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-zinc-300" />
              <span>Generating report...</span>
            </>
          ) : (
            <>
              <Filter className="h-4 w-4 text-zinc-300" />
              <span>Generate report</span>
            </>
          )}
        </button>
      </div>

      {/* Active Filter Chips / Badges Toolbar */}
      {hasActiveFilterChips && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200 text-xs">
          <span className="text-xs font-medium text-zinc-500">Active filters:</span>

          {selectedEmployeeObj && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <User className="h-3 w-3 text-zinc-500" />
              Employee: {selectedEmployeeObj.name} ({selectedEmployeeObj.employeeCode})
              <button
                type="button"
                onClick={() => {
                  setEmployeeId("");
                  handleApply({ employeeId: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove employee filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedDeptObj && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <Briefcase className="h-3 w-3 text-zinc-500" />
              Dept: {selectedDeptObj.name}
              <button
                type="button"
                onClick={() => {
                  setDepartmentId("");
                  handleApply({ departmentId: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove department filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedBranchObj && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <Building2 className="h-3 w-3 text-zinc-500" />
              Branch: {selectedBranchObj.name}
              <button
                type="button"
                onClick={() => {
                  setBranchId("");
                  handleApply({ branchId: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove branch filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedDesigObj && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <Briefcase className="h-3 w-3 text-zinc-500" />
              Designation: {selectedDesigObj.name}
              <button
                type="button"
                onClick={() => {
                  setDesignationId("");
                  handleApply({ designationId: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove designation filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedLeaveTypeObj && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <CalendarDays className="h-3 w-3 text-zinc-500" />
              Leave: {selectedLeaveTypeObj.name}
              <button
                type="button"
                onClick={() => {
                  setLeaveTypeId("");
                  handleApply({ leaveTypeId: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove leave type filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedLoanTypeObj && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <CreditCard className="h-3 w-3 text-zinc-500" />
              Loan: {selectedLoanTypeObj.name}
              <button
                type="button"
                onClick={() => {
                  setLoanTypeId("");
                  handleApply({ loanTypeId: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove loan type filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {search && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <Search className="h-3 w-3 text-zinc-500" />
              Search: &quot;{search}&quot;
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  handleApply({ search: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {showPayHeadTypeFilter && payHeadType !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-800">
              <Coins className="h-3 w-3 text-zinc-500" />
              Pay heads: {payHeadType === "ALLOWANCE" ? "Allowances" : "Deductions"}
              <button
                type="button"
                onClick={() => {
                  setPayHeadType("ALL");
                  handleApply({ payHeadType: undefined });
                }}
                className="rounded p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Remove pay head type filter"
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
