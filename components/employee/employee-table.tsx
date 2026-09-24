"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  Users,
  RotateCcw,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TablePagination,
  useTablePagination,
} from "@/components/ui/table-pagination";
import {
  resolveBranchName,
  resolveDesignationName,
  resolveDepartmentName,
  type EmployeeLookups,
} from "@/lib/constants/employee-lookups";
import { Employee } from "@/lib/types/employee";
import { cn } from "@/lib/utils";

interface EmployeeTableProps {
  employees: Employee[];
  isLoading: boolean;
  lookups: EmployeeLookups;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

type SortKey =
  | "attendanceCode"
  | "employeeCode"
  | "name"
  | "departmentId"
  | "designationId"
  | "branchId"
  | "category"
  | "status";

function getInitials(name: string): string {
  if (!name) return "EM";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function EmployeeTable({
  employees,
  isLoading,
  lookups,
  onSelect,
  onEdit,
  onDelete,
  onClearFilters,
  hasActiveFilters,
}: EmployeeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("employeeCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedEmployees = useMemo(() => {
    const list = [...employees];
    list.sort((a, b) => {
      const getValue = (emp: Employee) => {
        switch (sortKey) {
          case "name":
            return emp.fullName.toLowerCase();
          case "attendanceCode":
            return emp.attendanceCode;
          case "employeeCode":
            return emp.employeeCode;
          case "departmentId":
            return resolveDepartmentName(
              emp.departmentId,
              lookups.departmentNameById,
            ).toLowerCase();
          case "designationId":
            return resolveDesignationName(
              emp.designationId,
              lookups.designationNameById,
            ).toLowerCase();
          case "branchId":
            return resolveBranchName(
              emp.branchId,
              lookups.branchNameById,
            ).toLowerCase();
          case "category":
            return (emp.category || "").toLowerCase();
          case "status":
            return emp.status;
          default:
            return emp.employeeCode;
        }
      };

      const left = getValue(a);
      const right = getValue(b);
      const cmp = left.localeCompare(right, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [employees, lookups, sortDir, sortKey]);

  const { paginateList, paginationProps } = useTablePagination<Employee>({
    totalItems: sortedEmployees.length,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const paginatedEmployees = paginateList(sortedEmployees);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }


  const handleExportSelected = () => {
    const selectedEmps = sortedEmployees.filter((e) => selectedIds.has(e.id));
    if (selectedEmps.length === 0) return;

    const headers = [
      "Employee Code",
      "Attendance Code",
      "Name",
      "Department",
      "Designation",
      "Branch",
      "Category",
      "Status",
      "Email",
      "Mobile",
    ];
    const csvRows = [headers.join(",")];

    for (const emp of selectedEmps) {
      const dept = resolveDepartmentName(
        emp.departmentId,
        lookups.departmentNameById,
      );
      const desig = resolveDesignationName(
        emp.designationId,
        lookups.designationNameById,
      );
      const branch = resolveBranchName(emp.branchId, lookups.branchNameById);
      const name = `"${emp.fullName}"`;
      const row = [
        emp.employeeCode,
        emp.attendanceCode,
        name,
        `"${dept}"`,
        `"${desig}"`,
        `"${branch}"`,
        emp.category,
        emp.status,
        emp.email,
        emp.mobileNo,
      ];
      csvRows.push(row.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center text-xs font-semibold text-gray-400 animate-pulse">
        Loading employee directory...
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<Users className="h-6 w-6 text-payroll-primary" />}
          title="No employees found"
          description="No employees match the selected filters or search query. Try adjusting your filters or add a new employee profile."
          action={
            hasActiveFilters && onClearFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors shadow-2xs cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>Clear Filters</span>
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-payroll-border bg-white shadow-payroll-xs">
      {/* Floating Bulk Action Bar if items selected */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-30 m-3 flex items-center justify-between rounded-lg bg-payroll-ink px-4 py-2 text-white shadow-payroll-md animate-[slideInUp_150ms_ease-out]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-payroll-primary text-xs font-semibold text-white">
              {selectedIds.size}
            </span>
            <span className="text-xs font-medium">
              {selectedIds.size === 1
                ? "1 employee selected"
                : `${selectedIds.size} employees selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSelected}
              className="inline-flex items-center gap-1 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover px-2.5 py-1 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-xs text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-payroll-border select-none">
            <tr>
              <SortHeader
                label="ATT. CODE"
                onClick={() => toggleSort("attendanceCode")}
              />
              <SortHeader
                label="EMP. CODE"
                onClick={() => toggleSort("employeeCode")}
              />
              <SortHeader
                label="EMPLOYEE"
                onClick={() => toggleSort("name")}
              />
              <SortHeader
                label="DEPARTMENT"
                onClick={() => toggleSort("departmentId")}
              />
              <SortHeader
                label="DESIGNATION"
                onClick={() => toggleSort("designationId")}
              />
              <SortHeader
                label="BRANCH"
                onClick={() => toggleSort("branchId")}
              />
              <th scope="col" className="px-4 py-3.5">
                CONTACT
              </th>
              <SortHeader
                label="TYPE"
                onClick={() => toggleSort("category")}
              />
              <SortHeader
                label="STATUS"
                onClick={() => toggleSort("status")}
              />
              <th
                scope="col"
                className="px-4 py-3.5 text-right w-24"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-payroll-border/60 bg-white">
            {paginatedEmployees.map((emp) => {
              const departmentName = resolveDepartmentName(
                emp.departmentId,
                lookups.departmentNameById,
              );
              const designationName = resolveDesignationName(
                emp.designationId,
                lookups.designationNameById,
              );
              const branchName = resolveBranchName(
                emp.branchId,
                lookups.branchNameById,
              );

              const initials = getInitials(emp.fullName);
              const isLeave = (emp.status as string) === "On Leave";
              const isActive = emp.status === "Active";

              return (
                <tr
                  key={emp.id}
                  onClick={() => onSelect(emp.id)}
                  className="group transition-colors hover:bg-gray-50/70 cursor-pointer select-none"
                >
                  {/* ATT. CODE */}
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-payroll-ink align-middle whitespace-nowrap">
                    {emp.attendanceCode}
                  </td>

                  {/* EMP. CODE */}
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500 align-middle whitespace-nowrap">
                    {emp.employeeCode}
                  </td>

                  {/* EMPLOYEE (Avatar + Name) */}
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#165a3d] text-[11px] font-semibold text-white shadow-2xs">
                        {initials}
                      </div>
                      <div className="min-w-0 max-w-50">
                        <div className="font-semibold text-sm text-payroll-ink truncate">
                          {emp.fullName}
                        </div>
                        {emp.isSupervisor && (
                          <span className="inline-block mt-0.5 rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 border border-blue-200">
                            Supervisor
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* DEPARTMENT */}
                  <td className="px-4 py-3.5 align-middle text-gray-700 whitespace-nowrap">
                    {departmentName || "—"}
                  </td>

                  {/* DESIGNATION (Separated right after Department) */}
                  <td className="px-4 py-3.5 align-middle text-gray-600 whitespace-nowrap">
                    {designationName || "—"}
                  </td>

                  {/* BRANCH */}
                  <td className="px-4 py-3.5 align-middle text-gray-600 whitespace-nowrap">
                    {branchName || "—"}
                  </td>

                  {/* CONTACT (Email + Phone Stack) */}
                  <td className="px-4 py-3.5 align-middle">
                    <div className="min-w-0 max-w-55">
                      <div className="text-xs text-gray-700 truncate font-normal">
                        {emp.companyEmail || emp.email || "—"}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {emp.mobileNo || "—"}
                      </div>
                    </div>
                  </td>

                  {/* TYPE (Soft outline pill) */}
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    <span className="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50/60 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {emp.category || "Full Time"}
                    </span>
                  </td>

                  {/* STATUS (Pill with dot) */}
                  <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                    {isLeave ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        On Leave
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        {emp.status}
                      </span>
                    )}
                  </td>

                  {/* ACTIONS (Quiet View Eye, Edit Pencil, Delete Trash) */}
                  <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <ActionButton
                        label={`View ${emp.fullName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(emp.id);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </ActionButton>
                      <ActionButton
                        label={`Edit ${emp.fullName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(emp.id);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </ActionButton>
                      <ActionButton
                        label={`Delete ${emp.fullName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(emp.id);
                        }}
                        danger
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reusable Table Pagination Footer with Limit Selection */}
      <TablePagination
        {...paginationProps}
        itemName="employees"
      />
    </div>
  );
}

function SortHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-4 py-3.5">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 transition-colors hover:text-payroll-ink cursor-pointer select-none"
      >
        <span>{label}</span>
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </th>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors cursor-pointer",
        danger
          ? "text-gray-400 hover:bg-red-50 hover:text-red-600"
          : "text-gray-400 hover:bg-gray-100 hover:text-payroll-ink",
      )}
    >
      {children}
    </button>
  );
}
