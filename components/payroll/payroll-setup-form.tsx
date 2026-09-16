"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  RefreshCw,
  Calendar,
  Building2,
  Briefcase,
  Award,
  Users,
  Check,
  Search,
  UserCheck,
} from "lucide-react";
import type { PayrollRunSetupPayload } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";
import { adToBS } from "@/lib/utils/bs-calendar";

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
  const [payslipMonth, setPayslipMonth] = useState<number>(4); // Default same as month
  const [payslipDate, setPayslipDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Multi-select state arrays
  const [selectedBranches, setSelectedBranches] = useState<string[]>(() =>
    branches.map((b) => b.id),
  );
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() =>
    departments.map((d) => d.id),
  );
  const [selectedDesignations, setSelectedDesignations] = useState<string[]>(
    () => designations.map((d) => d.id),
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Employee checklist states
  const [employeesLoaded, setEmployeesLoaded] = useState<boolean>(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>("");

  const [selectedOccasionalAllowances, setSelectedOccasionalAllowances] =
    useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Month ordering matching Nepal Fiscal Year sequence: Shrawan (4) -> Asad (3)
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

  // Merge static list with any custom employee categories in database
  const dbCategories = Array.from(
    new Set(employees.map((emp) => emp.category).filter(Boolean)),
  );
  const categories = Array.from(
    new Set([...defaultCategories, ...dbCategories]),
  );

  // Calculate currently matched employees based on selection filters
  const matchedEmployees = employees.filter((emp) => {
    const matchesBranch = selectedBranches.includes(emp.branchId);
    const matchesDept = selectedDepartments.includes(emp.departmentId);
    const matchesDesig = selectedDesignations.includes(emp.designationId);
    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.includes(emp.category);
    return matchesBranch && matchesDept && matchesDesig && matchesCategory;
  });

  const matchedEmployeesCount = matchedEmployees.length;

  // Auto-adjust selected employees checklist when filters are changed
  useEffect(() => {
    if (employeesLoaded) {
      setSelectedEmployeeIds((prev) => {
        const stillMatching = prev.filter((id) =>
          matchedEmployees.some((emp) => emp.id === id),
        );
        const newMatching = matchedEmployees
          .filter((emp) => !prev.includes(emp.id))
          .map((emp) => emp.id);
        return [...stillMatching, ...newMatching];
      });
    }
  }, [
    selectedBranches,
    selectedDepartments,
    selectedDesignations,
    selectedCategories,
    employeesLoaded,
  ]);

  // Checklist search filter
  const searchedEmployees = matchedEmployees.filter((emp) => {
    if (!employeeSearchQuery) return true;
    const query = employeeSearchQuery.toLowerCase();
    const fullName = emp.name.toLowerCase();
    const code = emp.employeeCode.toLowerCase();
    return fullName.includes(query) || code.includes(query);
  });

  // Toggler helpers for select cards
  const toggleBranch = (id: string) => {
    if (selectedBranches.includes(id)) {
      setSelectedBranches(selectedBranches.filter((bId) => bId !== id));
    } else {
      setSelectedBranches([...selectedBranches, id]);
    }
  };

  const toggleDepartment = (id: string) => {
    if (selectedDepartments.includes(id)) {
      setSelectedDepartments(selectedDepartments.filter((dId) => dId !== id));
    } else {
      setSelectedDepartments([...selectedDepartments, id]);
    }
  };

  const toggleDesignation = (id: string) => {
    if (selectedDesignations.includes(id)) {
      setSelectedDesignations(selectedDesignations.filter((dId) => dId !== id));
    } else {
      setSelectedDesignations([...selectedDesignations, id]);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  // Card select/clear actions
  const selectAllBranches = () =>
    setSelectedBranches(branches.map((b) => b.id));
  const clearBranches = () => setSelectedBranches([]);

  const selectAllDepartments = () =>
    setSelectedDepartments(departments.map((d) => d.id));
  const clearDepartments = () => setSelectedDepartments([]);

  const selectAllDesignations = () =>
    setSelectedDesignations(designations.map((d) => d.id));
  const clearDesignations = () => setSelectedDesignations([]);

  const selectAllCategories = () => setSelectedCategories(categories);
  const clearCategories = () => setSelectedCategories([]);

  // Load matching employees list flow
  const handleLoadEmployees = () => {
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

    setEmployeesLoaded(true);
    setSelectedEmployeeIds(matchedEmployees.map((emp) => emp.id));
  };

  // Checklist multi-select toggles
  const isEmployeeChecked = (id: string) => selectedEmployeeIds.includes(id);

  const toggleEmployee = (id: string) => {
    if (selectedEmployeeIds.includes(id)) {
      setSelectedEmployeeIds(
        selectedEmployeeIds.filter((empId) => empId !== id),
      );
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, id]);
    }
  };

  const toggleSelectAllEmployees = () => {
    const allSearchedSelected = searchedEmployees.every((emp) =>
      selectedEmployeeIds.includes(emp.id),
    );
    if (allSearchedSelected) {
      setSelectedEmployeeIds(
        selectedEmployeeIds.filter(
          (id) => !searchedEmployees.some((emp) => emp.id === id),
        ),
      );
    } else {
      const newIds = searchedEmployees
        .filter((emp) => !selectedEmployeeIds.includes(emp.id))
        .map((emp) => emp.id);
      setSelectedEmployeeIds([...selectedEmployeeIds, ...newIds]);
    }
  };

  const handleOccasionalToggle = (id: string) => {
    if (selectedOccasionalAllowances.includes(id)) {
      setSelectedOccasionalAllowances(
        selectedOccasionalAllowances.filter((item) => item !== id),
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
    if (selectedEmployeeIds.length === 0) {
      setError(
        "Please select at least one employee to generate payslips. Run 'Load Employees' and check the active list.",
      );
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
          : "Failed to generate payroll run.",
      );
    }
  };

  return (
    <form
      onSubmit={(e) => handleSubmit(e, false)}
      className="space-y-6 rounded-xl border border-payroll-light bg-white p-6 shadow-sm"
    >
      <div className="border-b border-payroll-light pb-4">
        <h2 className="text-base font-bold text-payroll-navy">
          Employee PaySlip Generation Setup
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Provide period details, scope filters, and select occasional
          allowances to generate monthly payslips.
        </p>
      </div>

      {error && error.toLowerCase().includes("already exists") ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold text-amber-900">A Payroll Run Already Exists for This Period</p>
              <p className="mt-0.5 text-amber-800">
                A draft payroll run already exists for {fiscalMonths.find(m => m.value === payPeriodMonth)?.label} {payPeriodYear}. Would you like to overwrite it and re-generate payslips with the latest allowances, deductions, and attendance?
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-generate & Overwrite Draft
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100/50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Main Period Parameters */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
        {/* Month Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Month
          </label>
          <select
            value={payPeriodMonth}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPayPeriodMonth(val);
              setPayslipMonth(val); // default same
            }}
            className="w-full rounded-lg border border-payroll-light bg-white px-3.5 py-2.5 text-sm text-payroll-navy shadow-sm outline-none transition-all focus:border-payroll-primary"
          >
            {fiscalMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Payslip Month */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Payslip Month
          </label>
          <select
            value={payslipMonth}
            onChange={(e) => setPayslipMonth(Number(e.target.value))}
            className="w-full rounded-lg border border-payroll-light bg-white px-3.5 py-2.5 text-sm text-payroll-navy shadow-sm outline-none transition-all focus:border-payroll-primary"
          >
            {fiscalMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Payslip Date */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Payslip Date
          </label>
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={payslipDate}
              onChange={(e) => setPayslipDate(e.target.value)}
              className="w-full rounded-lg border border-payroll-light bg-white pl-3.5 pr-10 py-2.5 text-sm text-payroll-navy shadow-sm outline-none transition-all focus:border-payroll-primary tabular-nums"
            />
          </div>
        </div>

        {/* BS Year Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            BS Year
          </label>
          <select
            value={payPeriodYear}
            onChange={(e) => setPayPeriodYear(Number(e.target.value))}
            className="w-full rounded-lg border border-payroll-light bg-white px-3.5 py-2.5 text-sm text-payroll-navy shadow-sm outline-none transition-all focus:border-payroll-primary font-mono"
          >
            {Array.from({ length: 9 }, (_, i) => currentYear - 4 + i).map((y) => (
              <option key={y} value={y}>
                {y} BS {y === currentYear ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scope Selectors Grid (Branches, Departments, Designations) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Branches Selection Card */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-sm min-h-55">
          <div>
            <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-payroll-primary" />
                <span className="font-bold text-sm text-payroll-navy">
                  Branches
                </span>
              </div>
              <div className="flex gap-2.5 text-xs font-semibold text-payroll-primary">
                <button
                  type="button"
                  onClick={selectAllBranches}
                  className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
                >
                  All
                </button>
                <span className="text-payroll-light">|</span>
                <button
                  type="button"
                  onClick={clearBranches}
                  className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const isSelected = selectedBranches.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBranch(b.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-all border cursor-pointer select-none",
                      isSelected
                        ? "border-payroll-primary bg-payroll-primary/5 text-payroll-primary font-bold shadow-xs"
                        : "border-payroll-light bg-white text-payroll-navy hover:border-payroll-primary/50 hover:bg-payroll-cream",
                    )}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
          <p
            className={cn(
              "text-[10px] font-semibold mt-4 transition-colors",
              selectedBranches.length === 0
                ? "text-red-500 animate-pulse"
                : "text-gray-400",
            )}
          >
            Select at least one branch to continue
          </p>
        </div>

        {/* Departments Selection Card */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-sm min-h-55">
          <div>
            <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4.5 w-4.5 text-payroll-primary" />
                <span className="font-bold text-sm text-payroll-navy">
                  Departments
                </span>
              </div>
              <div className="flex gap-2.5 text-xs font-semibold text-payroll-primary">
                <button
                  type="button"
                  onClick={selectAllDepartments}
                  className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
                >
                  All
                </button>
                <span className="text-payroll-light">|</span>
                <button
                  type="button"
                  onClick={clearDepartments}
                  className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-35 overflow-y-auto pr-1">
              {departments.map((d) => {
                const isSelected = selectedDepartments.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDepartment(d.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-all border cursor-pointer select-none",
                      isSelected
                        ? "border-payroll-primary bg-payroll-primary/5 text-payroll-primary font-bold shadow-xs"
                        : "border-payroll-light bg-white text-payroll-navy hover:border-payroll-primary/50 hover:bg-payroll-cream",
                    )}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
          <p
            className={cn(
              "text-[10px] font-semibold mt-4 transition-colors",
              selectedDepartments.length === 0
                ? "text-red-500 animate-pulse"
                : "text-gray-400",
            )}
          >
            Select at least one department to continue
          </p>
        </div>

        {/* Designations Selection Card */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-sm min-h-55">
          <div>
            <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-payroll-primary" />
                <span className="font-bold text-sm text-payroll-navy">
                  Designations
                </span>
              </div>
              <div className="flex gap-2.5 text-xs font-semibold text-payroll-primary">
                <button
                  type="button"
                  onClick={selectAllDesignations}
                  className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
                >
                  All
                </button>
                <span className="text-payroll-light">|</span>
                <button
                  type="button"
                  onClick={clearDesignations}
                  className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-35 overflow-y-auto pr-1">
              {designations.map((d) => {
                const isSelected = selectedDesignations.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDesignation(d.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-all border cursor-pointer select-none",
                      isSelected
                        ? "border-payroll-primary bg-payroll-primary/5 text-payroll-primary font-bold shadow-xs"
                        : "border-payroll-light bg-white text-payroll-navy hover:border-payroll-primary/50 hover:bg-payroll-cream",
                    )}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
          <p
            className={cn(
              "text-[10px] font-semibold mt-4 transition-colors",
              selectedDesignations.length === 0
                ? "text-red-500 animate-pulse"
                : "text-gray-400",
            )}
          >
            Select at least one designation to continue
          </p>
        </div>
      </div>

      {/* Employee Categories Card (Full Width block) */}
      <div className="rounded-xl border border-payroll-light bg-white p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-payroll-primary" />
              <span className="font-bold text-sm text-payroll-navy">
                Employee Category
              </span>
            </div>
            <div className="flex gap-2.5 text-xs font-semibold text-payroll-primary">
              <button
                type="button"
                onClick={selectAllCategories}
                className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
              >
                All
              </button>
              <span className="text-payroll-light">|</span>
              <button
                type="button"
                onClick={clearCategories}
                className="hover:underline cursor-pointer hover:text-payroll-navy transition-all"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const isSelected = selectedCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg transition-all border cursor-pointer select-none",
                    isSelected
                      ? "border-payroll-primary bg-payroll-primary/5 text-payroll-primary font-bold shadow-xs"
                      : "border-payroll-light bg-white text-payroll-navy hover:border-payroll-primary/50 hover:bg-payroll-cream",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 font-semibold mt-4">
          Leave empty to include all categories
        </p>
      </div>

      {/* Load Employees trigger bar */}
      <div className="flex items-center justify-between border-t border-payroll-light pt-5 mt-4">
        <div className="text-xs text-gray-500 font-medium">
          {employeesLoaded ? (
            <span>
              Active employee scope matches:{" "}
              <strong className="text-payroll-primary font-bold">
                {matchedEmployeesCount} employees
              </strong>
            </span>
          ) : (
            <span>Ready to load employees based on selection.</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLoadEmployees}
          disabled={
            selectedBranches.length === 0 ||
            selectedDepartments.length === 0 ||
            selectedDesignations.length === 0
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer",
            selectedBranches.length === 0 ||
              selectedDepartments.length === 0 ||
              selectedDesignations.length === 0
              ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
              : "bg-payroll-cream text-payroll-navy border border-payroll-light hover:bg-payroll-primary hover:text-white hover:border-payroll-primary",
          )}
        >
          <UserCheck className="h-4 w-4" />
          {employeesLoaded ? "Reload Employees" : "Load Employees"}
        </button>
      </div>

      {/* Interactive Employee Checklist Section */}
      {employeesLoaded && (
        <div className="space-y-4 rounded-xl border border-payroll-light bg-white p-5 shadow-sm animate-[fadeIn_200ms_ease-out]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-payroll-light/60 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-payroll-navy">
                Matched Employees Checklist
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Select the specific employees to include in this payroll
                generation run.
              </p>
            </div>
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or code..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-payroll-light bg-white pl-9 pr-3 py-1.5 text-xs text-payroll-navy shadow-sm outline-none transition-all focus:border-payroll-primary"
              />
            </div>
          </div>

          {/* Select all toggle summary */}
          <div className="flex items-center justify-between bg-payroll-cream rounded-lg p-3 border border-payroll-light text-xs font-semibold text-payroll-navy">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  searchedEmployees.length > 0 &&
                  searchedEmployees.every((emp) =>
                    selectedEmployeeIds.includes(emp.id),
                  )
                }
                onChange={toggleSelectAllEmployees}
                className="rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary h-4 w-4 cursor-pointer"
              />
              <span>
                Select All Visible ({searchedEmployees.length} filtered)
              </span>
            </label>
            <span className="text-payroll-primary">
              Selected {selectedEmployeeIds.length} of {matchedEmployeesCount}{" "}
              employees
            </span>
          </div>

          {/* Scrollable employee list */}
          <div className="max-h-64 overflow-y-auto border border-payroll-light rounded-lg divide-y divide-payroll-light bg-white">
            {searchedEmployees.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                No matching employees found in scope
              </div>
            ) : (
              searchedEmployees.map((emp) => {
                const isChecked = isEmployeeChecked(emp.id);
                const branchName =
                  branches.find((b) => b.id === emp.branchId)?.name ||
                  "Unknown Branch";
                const deptName =
                  departments.find((d) => d.id === emp.departmentId)?.name ||
                  "Unknown Dept";
                const desigName =
                  designations.find((d) => d.id === emp.designationId)?.name ||
                  "Unknown Desig";

                return (
                  <label
                    key={emp.id}
                    className={cn(
                      "flex items-center justify-between p-3 transition-all hover:bg-payroll-cream cursor-pointer text-xs font-medium select-none",
                      isChecked ? "bg-payroll-primary/2" : "",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployee(emp.id)}
                        className="rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary h-4 w-4 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-payroll-navy">
                          {emp.name}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {emp.employeeCode}
                        </span>
                      </div>
                    </div>

                    {/* Scope metadata tags */}
                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                        {branchName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-payroll-primary/5 border border-payroll-primary/20 text-[9px] font-semibold text-payroll-primary uppercase tracking-wider">
                        {deptName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-[9px] font-semibold text-orange-600 uppercase tracking-wider">
                        {desigName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[9px] font-semibold text-green-600 uppercase tracking-wider">
                        {emp.category}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Occasional Allowances Checkbox List */}
      <div className="flex flex-col gap-3 rounded-lg bg-payroll-cream border border-payroll-light p-4">
        <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider mb-1">
          Occasional Allowances
        </span>
        {occasionalAllowances.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium">
            No occasional pay heads configured in system
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {occasionalAllowances.map((allowance) => (
              <label
                key={allowance.id}
                className="flex items-center gap-2.5 text-xs text-payroll-navy font-medium cursor-pointer py-1"
              >
                <input
                  type="checkbox"
                  checked={selectedOccasionalAllowances.includes(allowance.id)}
                  onChange={() => handleOccasionalToggle(allowance.id)}
                  className="rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary"
                />
                {allowance.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={
            isLoading || (employeesLoaded && selectedEmployeeIds.length === 0)
          }
          className="inline-flex items-center gap-2 rounded-lg bg-payroll-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-payroll-navy disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processing Slip Calculations...
            </>
          ) : (
            "Generate & Save Draft Slips"
          )}
        </button>
      </div>
    </form>
  );
}
