"use client";

import { X, Pencil, Building2, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalaryMapping } from "@/lib/types/salary-mapping";

interface SalaryMappingDetailPanelProps {
  open: boolean;
  mapping: SalaryMapping | null;
  employeeMap: Map<
    string,
    {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      departmentName: string;
      branchName: string;
      designationName: string;
    }
  >;
  onClose: () => void;
  onEdit: (id: string) => void;
}

function formatNPR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `NPR ${value.toLocaleString("en-IN")}`;
}

export function SalaryMappingDetailPanel({
  open,
  mapping,
  employeeMap,
  onClose,
  onEdit,
}: SalaryMappingDetailPanelProps) {
  if (!open || !mapping) return null;

  const emp = employeeMap.get(mapping.employeeId);
  const totalAllowances = mapping.salaryHeads
    .filter((h) => h.payHeadType === "allowance")
    .reduce((s, h) => s + h.amount, 0);
  const totalDeductions = mapping.salaryHeads
    .filter((h) => h.payHeadType === "deduction")
    .reduce((s, h) => s + h.amount, 0);
  const totalLoan = mapping.loan1Deduction + mapping.loan2Deduction;

  return (
    <>
      {/* Backdrop overlay — click outside to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-[#d7e8d0] bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d7e8d0] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1b3a1f]">Salary Mapping Details</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(mapping.id)}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#d7e8d0]/40 hover:text-[#2e7d32]"
              title="Edit mapping"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1b3a1f]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-64px)] p-5 space-y-6">
          {/* Employee Info */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Employee
            </h3>
            <div className="rounded-lg border border-[#d7e8d0]/80 bg-[#f6faf6] p-3">
              <p className="text-sm font-semibold text-[#1b3a1f]">
                {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{emp?.employeeCode ?? ""}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] text-[#2e7d32]">
                  {emp?.departmentName ?? "—"}
                </span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {emp?.branchName ?? "—"}
                </span>
                <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] text-violet-600">
                  {emp?.designationName ?? "—"}
                </span>
              </div>
            </div>
          </section>

          {/* Base Salary */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" /> Base Salary
            </h3>
            <div className="space-y-2 rounded-lg border border-[#d7e8d0]/80 bg-white p-3">
              <Row label="Basic Salary" value={formatNPR(mapping.basicSalary)} />
              <Row label={`Grade (${mapping.gradePercent}%)`} value={formatNPR(Math.round(mapping.basicSalary * mapping.gradePercent / 100))} />
              <Row label="Grade Amount" value={formatNPR(mapping.gradeAmount)} />
            </div>
          </section>

          {/* Pay Heads */}
          {mapping.salaryHeads.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Pay Heads ({mapping.salaryHeads.length})
              </h3>
              <div className="space-y-1.5">
                {mapping.salaryHeads.map((head) => (
                  <div
                    key={head.id}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2",
                      head.payHeadType === "allowance"
                        ? "border-emerald-100 bg-emerald-50/30"
                        : "border-red-100 bg-red-50/30",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#1b3a1f]">{head.payHeadName}</p>
                      <p className="text-[10px] text-gray-500 capitalize">{head.payHeadType}</p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        head.payHeadType === "allowance" ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {head.payHeadType === "allowance" ? "+" : "-"}
                      {formatNPR(head.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#d7e8d0]/60 pt-2">
                <span className="text-xs text-gray-500">Total Allowances</span>
                <span className="text-xs font-semibold text-emerald-600 tabular-nums">+{formatNPR(totalAllowances)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#d7e8d0]/60 pt-1">
                <span className="text-xs text-gray-500">Total Deductions</span>
                <span className="text-xs font-semibold text-red-600 tabular-nums">-{formatNPR(totalDeductions)}</span>
              </div>
            </section>
          )}

          {/* Loan Deductions */}
          {totalLoan > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Loan Deductions
              </h3>
              <div className="space-y-1.5 rounded-lg border border-[#d7e8d0]/80 bg-white p-3">
                {mapping.loan1Deduction > 0 && (
                  <Row
                    label="Loan 1 Deduction"
                    value={`-${formatNPR(mapping.loan1Deduction)}`}
                    valueClass="text-amber-600"
                  />
                )}
                {mapping.loan2Deduction > 0 && (
                  <Row
                    label="Loan 2 Deduction"
                    value={`-${formatNPR(mapping.loan2Deduction)}`}
                    valueClass="text-amber-600"
                  />
                )}
              </div>
            </section>
          )}

          {/* Net Amount */}
          <section className="rounded-lg border border-[#2e7d32]/30 bg-[#2e7d32]/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1b3a1f]">Net Amount</span>
              <span className="text-lg font-bold text-[#1b3a1f] tabular-nums">
                {formatNPR(mapping.netAmount)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Effective from {new Date(mapping.effectiveFrom).toLocaleDateString()}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={cn("text-xs font-medium tabular-nums text-[#1b3a1f]", valueClass)}>
        {value}
      </span>
    </div>
  );
}