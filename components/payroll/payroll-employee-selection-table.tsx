"use client";

import { useState, useMemo } from "react";
import { Search, CreditCard, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScopeEmployee {
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
}

interface PayrollEmployeeSelectionTableProps {
  employees: ScopeEmployee[];
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  selectedEmployeeIds: string[];
  onToggleEmployee: (id: string) => void;
  onToggleSelectAllVisible: (visibleIds: string[]) => void;
}

export function PayrollEmployeeSelectionTable({
  employees,
  branches,
  departments,
  designations,
  selectedEmployeeIds,
  onToggleEmployee,
  onToggleSelectAllVisible,
}: PayrollEmployeeSelectionTableProps) {
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "selected">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Lookup maps for fast name resolution
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const desigMap = useMemo(() => new Map(designations.map((d) => [d.id, d.name])), [designations]);

  // Unique departments present in matched scope
  const availableDepts = useMemo(() => {
    const ids = Array.from(new Set(employees.map((e) => e.departmentId)));
    return ids.map((id) => ({ id, name: deptMap.get(id) || "Dept" }));
  }, [employees, deptMap]);

  // Filter employees based on search, viewFilter, and deptFilter
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (viewFilter === "selected" && !selectedEmployeeIds.includes(emp.id)) {
        return false;
      }
      if (deptFilter !== "all" && emp.departmentId !== deptFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.employeeCode.toLowerCase().includes(q)
      );
    });
  }, [employees, viewFilter, selectedEmployeeIds, deptFilter, search]);

  const allVisibleSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((emp) => selectedEmployeeIds.includes(emp.id));

  const handleSelectAll = () => {
    onToggleSelectAllVisible(filteredEmployees.map((e) => e.id));
  };

  return (
    <div className="rounded-xl border border-payroll-light bg-white shadow-xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-payroll-light/70 p-3.5 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-payroll-primary/10 text-payroll-primary">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
              Employee Selection Table
            </h4>
            <p className="text-[11px] text-gray-500">
              Confirm individual staff and verify bank & calculation readiness.
            </p>
          </div>
        </div>

        {/* Search, Dept Filter, & View Toggle Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative w-44 sm:w-52">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code..."
              className="w-full rounded-lg border border-payroll-light bg-white pl-8 pr-3 py-1.5 text-xs text-payroll-navy outline-none focus:border-payroll-primary shadow-2xs"
            />
          </div>

          {/* Department Filter Dropdown (if more than 1 dept) */}
          {availableDepts.length > 1 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-payroll-light bg-white px-2.5 py-1.5 text-xs font-medium text-payroll-navy outline-none focus:border-payroll-primary shadow-2xs"
            >
              <option value="all">All Departments</option>
              {availableDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* View Filter Toggle (All vs Selected) */}
          <div className="inline-flex rounded-lg border border-payroll-light p-0.5 bg-payroll-cream/50 text-[11px] font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setViewFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors cursor-pointer select-none",
                viewFilter === "all"
                  ? "bg-white text-payroll-navy shadow-xs font-bold"
                  : "text-gray-500 hover:text-payroll-navy"
              )}
            >
              All ({employees.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("selected")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors cursor-pointer select-none",
                viewFilter === "selected"
                  ? "bg-payroll-primary text-white shadow-xs font-bold"
                  : "text-gray-500 hover:text-payroll-navy"
              )}
            >
              Selected ({selectedEmployeeIds.length})
            </button>
          </div>
        </div>
      </div>

      {/* Table with Sticky Header */}
      <div className="max-h-80 overflow-y-auto overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-payroll-light/80 bg-payroll-cream text-[10px] font-bold uppercase tracking-wider text-gray-600">
            <tr>
              <th className="w-10 px-3.5 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleSelectAll}
                  className="rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary h-3.5 w-3.5 cursor-pointer"
                  title="Select / deselect all visible"
                />
              </th>
              <th className="px-3.5 py-2.5 min-w-44">Employee</th>
              <th className="px-3.5 py-2.5 min-w-32">Department</th>
              <th className="px-3.5 py-2.5 min-w-32">Designation</th>
              <th className="px-3.5 py-2.5 min-w-24">Category</th>
              <th className="px-3.5 py-2.5 text-center min-w-24">Readiness</th>
              <th className="px-3.5 py-2.5 text-right min-w-28">Bank Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-payroll-light/50 bg-white">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-gray-400 font-medium">
                  No matching employees found in scope
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const isChecked = selectedEmployeeIds.includes(emp.id);
                const branchName = branchMap.get(emp.branchId) || "Branch";
                const deptName = deptMap.get(emp.departmentId) || "Dept";
                const desigName = desigMap.get(emp.designationId) || "Desig";
                const hasBank =
                  emp.hasBank ?? Boolean(emp.bankAccountNumber && emp.bankAccountNumber.trim() !== "");

                return (
                  <tr
                    key={emp.id}
                    onClick={() => onToggleEmployee(emp.id)}
                    className={cn(
                      "transition-colors hover:bg-payroll-cream/40 cursor-pointer select-none",
                      isChecked ? "bg-payroll-primary/2 font-medium" : "opacity-75"
                    )}
                  >
                    {/* Checkbox */}
                    <td
                      className="px-3.5 py-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleEmployee(emp.id)}
                        className="rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary h-3.5 w-3.5 cursor-pointer"
                      />
                    </td>

                    {/* Employee Name & Code */}
                    <td className="px-3.5 py-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-payroll-navy truncate">
                          {emp.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {emp.employeeCode} · {branchName}
                        </span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-3.5 py-2 text-gray-700 truncate">
                      {deptName}
                    </td>

                    {/* Designation */}
                    <td className="px-3.5 py-2 text-gray-700 truncate">
                      {desigName}
                    </td>

                    {/* Category */}
                    <td className="px-3.5 py-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-semibold text-gray-600">
                        {emp.category || "Staff"}
                      </span>
                    </td>

                    {/* Payroll Readiness */}
                    <td className="px-3.5 py-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Ready
                      </span>
                    </td>

                    {/* Bank Status */}
                    <td className="px-3.5 py-2 text-right">
                      {hasBank ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                          <CreditCard className="h-3 w-3" />
                          Bank OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-[10px] font-semibold text-rose-700">
                          <AlertCircle className="h-3 w-3" />
                          No Bank
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div className="flex items-center justify-between border-t border-payroll-light/70 px-4 py-2 bg-payroll-cream/40 text-[11px] text-gray-600 font-medium">
        <span>
          Showing <strong>{filteredEmployees.length}</strong> of <strong>{employees.length}</strong> employees in scope
        </span>
        <span className="font-semibold text-payroll-primary">
          {selectedEmployeeIds.length} checked for draft payslip generation
        </span>
      </div>
    </div>
  );
}
