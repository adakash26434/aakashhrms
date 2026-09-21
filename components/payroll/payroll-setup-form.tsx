"use client";

import { useState, useMemo } from "react";
import {
  AlertCircle,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PayrollRunSetupPayload } from "@/lib/types/payroll";
import { adToBS } from "@/lib/utils/bs-calendar";
import { PayrollPeriodSummaryBar } from "./payroll-period-summary-bar";
import { PayrollScopeToolbar } from "./payroll-scope-toolbar";
import { PayrollPreflightSummary } from "./payroll-preflight-summary";
import { PayrollEmployeeSelectionTable, type ScopeEmployee } from "./payroll-employee-selection-table";
import { PayrollStickyActionBar } from "./payroll-sticky-action-bar";

interface PayrollSetupFormProps {
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  employees: Array<{
    id: string;
    name: string;
    employeeCode: string;
    branchId: string;
    departmentId: string;
    designationId: string;
    category: string;
    hasBank?: boolean;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    panNumber?: string | null;
  }>;
  occasionalAllowances: Array<{
    id: string;
    name: string;
    isFestivalAllowance: boolean;
    isRemoteAllowance: boolean;
  }>;
  onSubmit: (payload: PayrollRunSetupPayload) => Promise<void>;
  isLoading: boolean;
}

export function PayrollSetupForm({
  branches,
  departments,
  designations,
  employees,
  occasionalAllowances,
  onSubmit,
  isLoading,
}: PayrollSetupFormProps) {
  const currentYear = adToBS(new Date()).year;

  const [payPeriodMonth, setPayPeriodMonth] = useState<number>(4); // Default to Shrawan (Month 4)
  const [payPeriodYear, setPayPeriodYear] = useState<number>(currentYear);
  const [payslipMonth, setPayslipMonth] = useState<number>(4);
  const [payslipDate, setPayslipDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Multi-select scope filter states
  const [selectedBranches, setSelectedBranches] = useState<string[]>(() =>
    branches.map((b) => b.id)
  );
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() =>
    departments.map((d) => d.id)
  );
  const [selectedDesignations, setSelectedDesignations] = useState<string[]>(
    () => designations.map((d) => d.id)
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Employee selection states
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(() =>
    employees.map((e) => e.id)
  );

  // Optional adjustments accordion state
  const [showOptionalAdjustments, setShowOptionalAdjustments] = useState(false);
  const [selectedOccasionalAllowances, setSelectedOccasionalAllowances] =
    useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fiscal month ordering: Shrawan (4) -> Asar (3)
  const fiscalMonths = [
    { value: 4, label: "Shrawan" },
    { value: 5, label: "Bhadra" },
    { value: 6, label: "Aswin" },
    { value: 7, label: "Kartik" },
    { value: 8, label: "Mangsir" },
    { value: 9, label: "Poush" },
    { value: 10, label: "Magh" },
    { value: 11, label: "Falgun" },
    { value: 12, label: "Chaitra" },
    { value: 1, label: "Baisakh" },
    { value: 2, label: "Jestha" },
    { value: 3, label: "Asar (Ashadh)" },
  ];

  const defaultCategories = [
    "Trainee",
    "Probation",
    "Permanent",
    "Contract",
    "Intern",
    "Consultant",
    "Temporary",
    "OutSource",
    "Volunteer",
  ];

  const dbCategories = Array.from(
    new Set(employees.map((emp) => emp.category).filter(Boolean))
  );
  const categories = Array.from(
    new Set([...defaultCategories, ...dbCategories])
  );

  // Matched employees in current scope
  const matchedEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesBranch = selectedBranches.includes(emp.branchId);
      const matchesDept = selectedDepartments.includes(emp.departmentId);
      const matchesDesig = selectedDesignations.includes(emp.designationId);
      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(emp.category);
      return matchesBranch && matchesDept && matchesDesig && matchesCategory;
    });
  }, [
    employees,
    selectedBranches,
    selectedDepartments,
    selectedDesignations,
    selectedCategories,
  ]);

  // Derived missing bank accounts for preflight check
  const missingBankEmployees = useMemo(() => {
    return employees
      .filter((emp) => selectedEmployeeIds.includes(emp.id))
      .filter((emp) => !emp.hasBank && (!emp.bankAccountNumber || emp.bankAccountNumber.trim() === ""));
  }, [employees, selectedEmployeeIds]);

  const handleResetFilters = () => {
    setSelectedBranches(branches.map((b) => b.id));
    setSelectedDepartments(departments.map((d) => d.id));
    setSelectedDesignations(designations.map((d) => d.id));
    setSelectedCategories([]);
    setError(null);
  };

  // Toggle single employee
  const handleToggleEmployee = (id: string) => {
    if (selectedEmployeeIds.includes(id)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter((empId) => empId !== id));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, id]);
    }
  };

  // Toggle all visible employees in table
  const handleToggleSelectAllVisible = (visibleIds: string[]) => {
    const allVisibleSelected = visibleIds.every((id) =>
      selectedEmployeeIds.includes(id)
    );
    if (allVisibleSelected) {
      setSelectedEmployeeIds(
        selectedEmployeeIds.filter((id) => !visibleIds.includes(id))
      );
    } else {
      const newIds = visibleIds.filter((id) => !selectedEmployeeIds.includes(id));
      setSelectedEmployeeIds([...selectedEmployeeIds, ...newIds]);
    }
  };

  const handleOccasionalToggle = (id: string) => {
    if (selectedOccasionalAllowances.includes(id)) {
      setSelectedOccasionalAllowances(
        selectedOccasionalAllowances.filter((item) => item !== id)
      );
    } else {
      setSelectedOccasionalAllowances([...selectedOccasionalAllowances, id]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, recreateIfExists = false) => {
    if (e) e.preventDefault();
    setError(null);

    if (selectedBranches.length === 0) {
      setError("Please select at least one branch office.");
      return;
    }
    if (selectedDepartments.length === 0) {
      setError("Please select at least one department.");
      return;
    }
    if (selectedDesignations.length === 0) {
      setError("Please select at least one designation.");
      return;
    }
    if (selectedEmployeeIds.length === 0) {
      setError("Please select at least one employee to generate payslips.");
      return;
    }

    try {
      await onSubmit({
        payPeriodMonth,
        payPeriodYear,
        branchIds: selectedBranches,
        departmentIds:
          selectedDepartments.length === departments.length
            ? null
            : selectedDepartments,
        designationIds:
          selectedDesignations.length === designations.length
            ? null
            : selectedDesignations,
        employeeCategories:
          selectedCategories.length === 0 ? null : selectedCategories,
        employeeIds:
          selectedEmployeeIds.length === matchedEmployees.length
            ? null
            : selectedEmployeeIds,
        occasionalAllowanceHeadIds:
          selectedOccasionalAllowances.length > 0
            ? selectedOccasionalAllowances
            : null,
        payslipMonth,
        payslipDate: payslipDate || null,
        recreateIfExists,
      });
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate payroll run."
      );
    }
  };

  const selectedOccasionalNames = occasionalAllowances
    .filter((oa) => selectedOccasionalAllowances.includes(oa.id))
    .map((oa) => oa.name);

  return (
    <form
      onSubmit={(e) => handleSubmit(e, false)}
      className="space-y-4 pb-12"
    >
      {/* Existing Run Overwrite Banner */}
      {error && error.toLowerCase().includes("already exists") ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold text-amber-900">
                A Payroll Run Already Exists for This Period
              </p>
              <p className="mt-0.5 text-amber-800">
                A draft payroll run already exists for{" "}
                {fiscalMonths.find((m) => m.value === payPeriodMonth)?.label}{" "}
                {payPeriodYear}. Would you like to overwrite it and re-generate payslips with the latest allowances, deductions, and attendance?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setError(null);
                handleSubmit(undefined, true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-generate & Overwrite Draft
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100/50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* 1. COMPACT PERIOD SUMMARY BAR WITH EDIT */}
      <PayrollPeriodSummaryBar
        payPeriodMonth={payPeriodMonth}
        setPayPeriodMonth={setPayPeriodMonth}
        payPeriodYear={payPeriodYear}
        setPayPeriodYear={setPayPeriodYear}
        payslipMonth={payslipMonth}
        setPayslipMonth={setPayslipMonth}
        payslipDate={payslipDate}
        setPayslipDate={setPayslipDate}
        fiscalMonths={fiscalMonths}
        currentYear={currentYear}
      />

      {/* 2. COMPACT SCOPE TOOLBAR WITH CONFIGURE SCOPE */}
      <PayrollScopeToolbar
        branches={branches}
        departments={departments}
        designations={designations}
        categories={categories}
        selectedBranches={selectedBranches}
        setSelectedBranches={setSelectedBranches}
        selectedDepartments={selectedDepartments}
        setSelectedDepartments={setSelectedDepartments}
        selectedDesignations={selectedDesignations}
        setSelectedDesignations={setSelectedDesignations}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        onReset={handleResetFilters}
        matchedEmployeesCount={matchedEmployees.length}
      />

      {/* 3. COMPACT PROGRESSIVE PREFLIGHT SUMMARY */}
      <PayrollPreflightSummary
        bsYear={payPeriodYear}
        payPeriodMonth={payPeriodMonth}
        selectedEmployeeCount={selectedEmployeeIds.length}
        missingBankEmployees={missingBankEmployees}
        occasionalAllowancesCount={selectedOccasionalAllowances.length}
        occasionalAllowanceNames={selectedOccasionalNames}
      />

      {/* 4. OPTION A: COMPACT EMPLOYEE SELECTION TABLE */}
      <PayrollEmployeeSelectionTable
        employees={matchedEmployees as ScopeEmployee[]}
        branches={branches}
        departments={departments}
        designations={designations}
        selectedEmployeeIds={selectedEmployeeIds}
        onToggleEmployee={handleToggleEmployee}
        onToggleSelectAllVisible={handleToggleSelectAllVisible}
      />

      {/* 5. OPTIONAL ADJUSTMENTS ACCORDION (FESTIVAL / REMOTE ALLOWANCES) */}
      <div className="rounded-xl border border-payroll-light bg-white overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowOptionalAdjustments(!showOptionalAdjustments)}
          className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-payroll-cream/30 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-payroll-primary" />
            <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Optional Adjustments (Festival & Remote Allowances)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-medium">
              {selectedOccasionalAllowances.length === 0
                ? "No occasional allowances selected"
                : `${selectedOccasionalAllowances.length} selected`}
            </span>
            {showOptionalAdjustments ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </button>

        {showOptionalAdjustments && (
          <div className="border-t border-payroll-light/70 bg-payroll-cream/30 p-4 animate-[fadeIn_150ms_ease-out]">
            {occasionalAllowances.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium">
                No occasional pay heads (Festival/Remote) are configured in system setup.
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                {occasionalAllowances.map((allowance) => (
                  <label
                    key={allowance.id}
                    className="flex items-center gap-2.5 text-xs text-payroll-navy font-medium cursor-pointer p-2 rounded-lg bg-white border border-payroll-light hover:border-payroll-primary/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOccasionalAllowances.includes(allowance.id)}
                      onChange={() => handleOccasionalToggle(allowance.id)}
                      className="rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary h-4 w-4"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold">{allowance.name}</span>
                      <span className="text-[10px] text-gray-400">
                        {allowance.isFestivalAllowance ? "Festival Allowance" : "Remote Allowance"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. STICKY BOTTOM ACTION BAR */}
      <PayrollStickyActionBar
        matchedCount={matchedEmployees.length}
        selectedCount={selectedEmployeeIds.length}
        isLoading={isLoading}
        onGenerate={() => handleSubmit(undefined, false)}
      />
    </form>
  );
}
