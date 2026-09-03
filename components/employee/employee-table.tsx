"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Eye,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  resolveBranchName,
  resolveDesignationName,
  resolveDepartmentName,
  type EmployeeLookups,
} from "@/lib/constants/employee-lookups";
import { Employee } from "@/lib/types/employee";
import { cn } from "@/lib/utils";
import { EmployeeExpandableRow } from "./employee-expandable-row";

interface EmployeeTableProps {
  employees: Employee[];
  isLoading: boolean;
  lookups: EmployeeLookups;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

type SortKey =
  | "attendanceCode"
  | "employeeCode"
  | "name"
  | "departmentId"
  | "designationId"
  | "branchId"
  | "status";

export function EmployeeTable({
  employees,
  isLoading,
  lookups,
  onSelect,
  onEdit,
  onDelete,
}: EmployeeTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("employeeCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Close the action menu when clicking outside
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const sortedEmployees = useMemo(() => {
    const list = [...employees];
    list.sort((a, b) => {
      const getValue = (emp: Employee) => {
        switch (sortKey) {
          case "name":
            return `${emp.firstName} ${emp.lastName}`.toLowerCase();
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const isAllSelected = sortedEmployees.length > 0 && selectedIds.size === sortedEmployees.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < sortedEmployees.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedEmployees.map((e) => e.id)));
    }
  };

  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportSelected = () => {
    const selectedEmps = sortedEmployees.filter((e) => selectedIds.has(e.id));
    if (selectedEmps.length === 0) return;

    const headers = ["Employee Code", "Attendance Code", "Name", "Department", "Designation", "Branch", "Category", "Status", "Email", "Mobile"];
    const csvRows = [headers.join(",")];

    for (const emp of selectedEmps) {
      const dept = resolveDepartmentName(emp.departmentId, lookups.departmentNameById);
      const desig = resolveDesignationName(emp.designationId, lookups.designationNameById);
      const branch = resolveBranchName(emp.branchId, lookups.branchNameById);
      const name = `"${emp.firstName} ${emp.lastName}"`;
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

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
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
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-payroll-light/80 bg-white shadow-payroll-xs">
      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-30 m-3 flex items-center justify-between rounded-xl bg-payroll-navy px-4 py-2.5 text-white shadow-payroll-lg animate-[slideInUp_150ms_ease-out]">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-payroll-primary text-xs font-bold text-white shadow-payroll-xs">
              {selectedIds.size}
            </span>
            <span className="text-xs font-medium">
              {selectedIds.size === 1 ? "1 employee selected" : `${selectedIds.size} employees selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSelected}
              className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary hover:bg-payroll-primary-hover px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-left text-xs text-gray-600">
        <thead className="bg-payroll-cream/70 text-xs font-bold text-payroll-navy border-b border-payroll-light/80">
          <tr>
            {/* Checkbox Column */}
            <th scope="col" className="w-8 px-3 py-3 text-center align-middle">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={handleSelectAll}
                className="h-3.5 w-3.5 rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary cursor-pointer"
                title="Select all"
              />
            </th>
            <th scope="col" className="w-8 px-2 py-3 text-center align-middle" />
            <SortHeader
              label="Attn Code"
              onClick={() => toggleSort("attendanceCode")}
            />
            <SortHeader
              label="Emp Code"
              onClick={() => toggleSort("employeeCode")}
            />
            <SortHeader label="Employee Name" onClick={() => toggleSort("name")} />
            <SortHeader
              label="Department"
              onClick={() => toggleSort("departmentId")}
            />
            <SortHeader
              label="Designation"
              onClick={() => toggleSort("designationId")}
            />
            <th scope="col" className="px-4 py-3 font-bold text-payroll-navy">
              Contact
            </th>
            <SortHeader label="Branch" onClick={() => toggleSort("branchId")} />
            <SortHeader label="Status" onClick={() => toggleSort("status")} />
            <th scope="col" className="px-4 py-3 text-right font-bold text-payroll-navy">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-payroll-light/50 bg-white">
          {sortedEmployees.map((emp) => {
            const isExpanded = expandedId === emp.id;
            const isRowSelected = selectedIds.has(emp.id);
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

            return (
              <React.Fragment key={emp.id}>
                <tr
                  onClick={() => onSelect(emp.id)}
                  className={cn(
                    "cursor-pointer transition-colors select-none",
                    isRowSelected
                      ? "bg-payroll-light/40 hover:bg-payroll-light/50"
                      : "hover:bg-payroll-cream/50",
                    isExpanded && "bg-payroll-cream/70",
                  )}
                >
                  {/* Row Checkbox */}
                  <td
                    className="px-3 py-3 text-center align-middle"
                    onClick={(e) => handleToggleRow(emp.id, e)}
                  >
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => {}}
                      className="h-3.5 w-3.5 rounded border-payroll-light text-payroll-primary focus:ring-payroll-primary cursor-pointer"
                    />
                  </td>

                  <td
                    className="px-2 py-3 text-center align-middle"
                    onClick={(e) => toggleExpand(emp.id, e)}
                  >
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse row" : "Expand row"}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-payroll-light/60 hover:text-payroll-navy transition-colors"
                    >
                      {isExpanded ? (
                        <Minus className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-payroll-navy align-middle">
                    {emp.attendanceCode}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500 align-middle">
                    {emp.employeeCode}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-payroll-light/70 text-[11px] font-bold text-payroll-navy border border-payroll-light shadow-2xs">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-payroll-navy truncate">
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/50">
                            {emp.category}
                          </span>
                          <span className="rounded-md bg-payroll-light/50 px-1.5 py-0.5 text-[10px] font-medium text-payroll-navy">
                            {emp.salaryGrade}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-gray-600">
                    {departmentName}
                  </td>
                  <td className="px-4 py-3 align-middle text-gray-600">
                    {designationName}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="text-gray-700 truncate max-w-44">{emp.email}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{emp.mobileNo}</div>
                  </td>
                  <td className="px-4 py-3 align-middle text-gray-600">
                    {branchName}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge
                      variant={
                        emp.status === "Active"
                          ? "success"
                          : emp.status === "Terminated"
                            ? "danger"
                            : "warning"
                      }
                      size="sm"
                    >
                      {emp.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <div className="relative inline-block" ref={menuRef}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === emp.id ? null : emp.id);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-payroll-cream hover:text-payroll-navy cursor-pointer"
                        aria-label="Employee actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpenId === emp.id && (
                        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-payroll-light bg-white py-1 shadow-payroll-lg animate-[dialogIn_120ms_ease-out]">
                          <ActionMenuItem
                            icon={Eye}
                            label="View"
                            onClick={() => {
                              onSelect(emp.id);
                              setMenuOpenId(null);
                            }}
                          />
                          <ActionMenuItem
                            icon={Pencil}
                            label="Edit"
                            onClick={() => {
                              onEdit(emp.id);
                              setMenuOpenId(null);
                            }}
                          />
                          <ActionMenuItem
                            icon={Trash2}
                            label="Delete"
                            tone="danger"
                            onClick={() => {
                              onDelete(emp.id);
                              setMenuOpenId(null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={11} className="p-0 bg-payroll-cream/30">
                      <EmployeeExpandableRow employee={emp} lookups={lookups} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
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
    <th scope="col" className="px-4 py-3 font-bold text-payroll-navy">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-payroll-primary cursor-pointer select-none"
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function ActionMenuItem({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold transition-colors cursor-pointer select-none",
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-gray-700 hover:bg-payroll-cream",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
