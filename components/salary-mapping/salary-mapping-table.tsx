"use client";

import { Eye, Pencil, Trash2, DollarSign } from "lucide-react";
import type { SalaryMapping } from "@/lib/types/salary-mapping";

interface SalaryMappingTableProps {
  mappings: SalaryMapping[];
  employeeMap: Map<
    string,
    {
      id: string;
      employeeCode: string;
      fullName: string;
      departmentName: string;
      branchName: string;
      designationName: string;
    }
  >;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatNPR(value: number): string {
  return `NPR ${value.toLocaleString("en-IN")}`;
}

export function SalaryMappingTable({
  mappings,
  employeeMap,
  onSelect,
  onEdit,
  onDelete,
}: SalaryMappingTableProps) {
  if (mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <DollarSign className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">No salary mappings found</p>
        <p className="mt-1 text-xs text-gray-500">
          Add a new salary mapping to get started or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3 text-right">Basic Salary</th>
            <th className="px-4 py-3 text-right">Grade Amount</th>
            <th className="px-4 py-3 text-right">Allowances</th>
            <th className="px-4 py-3 text-right">Deductions</th>
            <th className="px-4 py-3 text-right">Loan Ded.</th>
            <th className="px-4 py-3 text-right">Net Amount</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {mappings.map((mapping) => {
            const emp = employeeMap.get(mapping.employeeId);
            const totalAllowances = mapping.salaryHeads
              .filter((h) => h.payHeadType === "allowance")
              .reduce((s, h) => s + h.amount, 0);
            const totalDeductions = mapping.salaryHeads
              .filter((h) => h.payHeadType === "deduction")
              .reduce((s, h) => s + h.amount, 0);
            const totalLoan = mapping.loan1Deduction + mapping.loan2Deduction;

            return (
              <tr
                key={mapping.id}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {emp
                        ? emp.fullName
                        : "Unknown"}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {emp?.employeeCode ?? ""}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {emp?.departmentName ?? "—"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {emp?.branchName ?? "—"}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-zinc-900 font-medium">
                  {formatNPR(mapping.basicSalary)}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-zinc-600">
                  {mapping.gradeAmount > 0 ? formatNPR(mapping.gradeAmount) : (mapping.gradePercent > 0 && mapping.gradePercent !== 100 ? `${mapping.gradePercent}%` : "—")}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-emerald-700 font-medium">
                  {formatNPR(totalAllowances)}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-rose-700 font-medium">
                  {formatNPR(totalDeductions)}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-amber-700">
                  {totalLoan > 0 ? formatNPR(totalLoan) : "—"}
                </td>
                <td className="px-4 py-4 text-right tabular-nums font-semibold text-zinc-900">
                  {formatNPR(mapping.netAmount)}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(mapping.id)}
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                      title="View mapping details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(mapping.id)}
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                      title="Edit mapping"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(mapping.id)}
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete mapping"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}