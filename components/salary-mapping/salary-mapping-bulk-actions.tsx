"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SalaryHeadFormItem } from "@/lib/types/salary-mapping";
import { bulkSaveSalaryMappingsAction } from "@/app/actions/salary-mapping.actions";

interface SalaryMappingBulkActionsProps {
  open: boolean;
  onClose: () => void;
  employees: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    departmentName: string;
    designationName: string;
    gradePercent: number;
    gradeAmount: number;
  }[];
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  allowanceHeads: { id: string; name: string; calcBasis: string; calcParameter: string }[];
  deductionHeads: { id: string; name: string; calcBasis: string; calcParameter: string }[];
  onSaved: () => void;
}

interface BulkFormState {
  departmentId: string;
  branchId: string;
  selectedEmployeeIds: string[];
  basicSalary: string;
  gradePercent: string;
  gradeAmount: string;
}

const inputClass =
  "h-9 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]";

export function SalaryMappingBulkActions({
  open,
  onClose,
  employees,
  departments,
  branches,
  onSaved,
}: SalaryMappingBulkActionsProps) {
  const [form, setForm] = useState<BulkFormState>({
    departmentId: "",
    branchId: "",
    selectedEmployeeIds: [],
    basicSalary: "",
    gradePercent: "100",
    gradeAmount: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

  function update<K extends keyof BulkFormState>(key: K, value: BulkFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Filter employees by department/branch selection
  const filteredEmployees = employees.filter((e) => {
    if (form.departmentId && e.departmentName !== departments.find((d) => d.id === form.departmentId)?.name) return false;
    // Note: In a real implementation we'd filter by branchId too
    return true;
  });

  // Select all filtered
  function selectAll() {
    setForm((f) => ({
      ...f,
      selectedEmployeeIds: filteredEmployees.map((e) => e.id),
    }));
  }

  function deselectAll() {
    setForm((f) => ({ ...f, selectedEmployeeIds: [] }));
  }

  function toggleEmployee(id: string) {
    setForm((f) => ({
      ...f,
      selectedEmployeeIds: f.selectedEmployeeIds.includes(id)
        ? f.selectedEmployeeIds.filter((eid) => eid !== id)
        : [...f.selectedEmployeeIds, id],
    }));
  }

  async function handleApply() {
    setIsProcessing(true);
    setMessage("");

    try {
      const res = await bulkSaveSalaryMappingsAction(form.selectedEmployeeIds, {
        basicSalary: Number(form.basicSalary) || 0,
        gradePercent: Number(form.gradePercent) || 100,
        gradeAmount: Number(form.gradeAmount) || 0,
      });

      if (!res.success || !res.data) {
        setMessage(`Error: ${res.error || "Failed to apply bulk mappings."}`);
        return;
      }

      const { successCount, errorCount } = res.data;
      setMessage(
        `Applied to ${successCount} employee${successCount !== 1 ? "s" : ""}.` +
          (errorCount > 0 ? ` ${errorCount} failed (may already have mappings).` : "")
      );

      if (errorCount === 0 || successCount > 0) {
        setTimeout(() => {
          onSaved();
        }, 1500);
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  }


  // CSV Export
  function handleExportCSV() {
    const headers = [
      "Employee Name",
      "Employee Code",
      "Department",
      "Basic Salary",
      "Grade %",
      "Grade Amount",
      "Net Amount",
    ];
    const rows = filteredEmployees.map((e) => [
      `${e.firstName} ${e.lastName}`,
      e.employeeCode,
      e.departmentName,
      form.basicSalary || "0",
      form.gradePercent || "100",
      form.gradeAmount || String(e.gradeAmount),
      "—",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "salary-mapping-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bulk Salary Mapping"
      description="Apply salary mapping settings to multiple employees at once."
      size="xl"
      footer={
        <div className="flex w-full justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || form.selectedEmployeeIds.length === 0}
            >
              {isProcessing ? "Applying..." : `Apply to ${form.selectedEmployeeIds.length} Employee${form.selectedEmployeeIds.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {message && (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              message.includes("Error")
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            {message}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Filter by Department</label>
            <select
              value={form.departmentId}
              onChange={(e) => update("departmentId", e.target.value)}
              className={inputClass}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Filter by Branch</label>
            <select
              value={form.branchId}
              onChange={(e) => update("branchId", e.target.value)}
              className={inputClass}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Salary Fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Basic Salary</label>
            <input
              type="number"
              min={0}
              value={form.basicSalary}
              onChange={(e) => update("basicSalary", e.target.value)}
              className={inputClass}
              placeholder="e.g. 50000"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Grade %</label>
            <input
              type="number"
              min={0}
              max={200}
              value={form.gradePercent}
              onChange={(e) => update("gradePercent", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Grade Amount</label>
            <input
              type="number"
              min={0}
              value={form.gradeAmount}
              onChange={(e) => update("gradeAmount", e.target.value)}
              className={inputClass}
              placeholder="Leave empty to use employee default"
            />
          </div>
        </div>

        {/* Employee Selection */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              Select Employees ({form.selectedEmployeeIds.length} selected)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-[#2e7d32] hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs font-medium text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-[#d7e8d0]">
            {filteredEmployees.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">No employees found.</p>
            ) : (
              filteredEmployees.map((e) => {
                const selected = form.selectedEmployeeIds.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-b border-[#d7e8d0]/60 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-[#f6faf6]/50",
                      selected && "bg-green-50/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleEmployee(e.id)}
                      className="h-4 w-4 rounded border-gray-300 text-[#2e7d32] focus:ring-[#2e7d32]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[#1b3a1f]">
                        {e.firstName} {e.lastName}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">{e.employeeCode}</span>
                    </div>
                    <span className="text-xs text-gray-500">{e.departmentName}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 italic">
          Each selected employee will get a salary mapping with the values above.
          Employees with existing mappings will be skipped.
        </p>
      </div>
    </Dialog>
  );
}