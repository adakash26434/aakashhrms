"use client";

import { Pencil, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalaryMapping } from "@/lib/types/salary-mapping";
import { DrawerShell } from "@/components/ui/drawer-shell";

interface SalaryMappingDetailPanelProps {
  open: boolean;
  mapping: SalaryMapping | null;
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

  const headerActions = (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-payroll-navy">Salary Mapping Details</span>
      <button
        type="button"
        onClick={() => onEdit(mapping.id)}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-payroll-light/40 hover:text-payroll-primary cursor-pointer ml-2"
        title="Edit mapping"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      title={headerActions}
      size="md"
    >
      <div className="space-y-6">
        {/* Employee Info */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Employee
          </h3>
          <div className="rounded-xl border border-payroll-light/80 bg-payroll-cream/60 p-3.5 shadow-payroll-xs">
            <p className="text-sm font-semibold text-payroll-navy">
              {emp ? emp.fullName : "Unknown"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{emp?.employeeCode ?? ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-medium text-payroll-primary">
                {emp?.departmentName ?? "—"}
              </span>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {emp?.branchName ?? "—"}
              </span>
              <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">
                {emp?.designationName ?? "—"}
              </span>
              {mapping.salaryHeads.some((h) => h.payHeadName.toLowerCase().includes("ssf")) ? (
                <span className="rounded-md bg-emerald-100/70 font-semibold px-2 py-0.5 text-[11px] text-emerald-800">
                  SSF Enrolled (11% / 20% / 31%)
                </span>
              ) : (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                  Non-SSF
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Base Salary */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <DollarSign className="h-3 w-3" /> Base Salary
          </h3>
          <div className="space-y-2 rounded-xl border border-payroll-light/80 bg-white p-3.5 shadow-payroll-xs">
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
                    "flex items-center justify-between rounded-xl border px-3.5 py-2 text-xs",
                    head.payHeadType === "allowance"
                      ? "border-emerald-100 bg-emerald-50/40 text-emerald-900"
                      : "border-red-100 bg-red-50/40 text-red-900",
                  )}
                >
                  <span className="font-medium">{head.payHeadName}</span>
                  <span className="font-mono font-semibold">
                    {head.payHeadType === "deduction" ? "-" : "+"}
                    {formatNPR(head.amount)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Loans */}
        {(mapping.loan1Deduction > 0 || mapping.loan2Deduction > 0) && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Active Loans
            </h3>
            <div className="space-y-2 rounded-xl border border-payroll-light/80 bg-white p-3.5 shadow-payroll-xs">
              {mapping.loan1Deduction > 0 && (
                <Row label="Loan 1 Monthly EMI" value={formatNPR(mapping.loan1Deduction)} />
              )}
              {mapping.loan2Deduction > 0 && (
                <Row label="Loan 2 Monthly EMI" value={formatNPR(mapping.loan2Deduction)} />
              )}
            </div>
          </section>
        )}

        {/* Summary */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Summary
          </h3>
          <div className="space-y-2 rounded-xl border border-payroll-light/80 bg-payroll-cream/30 p-3.5 text-xs shadow-payroll-xs">
            <Row label="Base + Grade" value={formatNPR(mapping.basicSalary + mapping.gradeAmount)} />
            <Row label="Total Allowances" value={`+${formatNPR(totalAllowances)}`} valueClass="text-emerald-600" />
            <Row label="Gross Salary" value={formatNPR(mapping.basicSalary + mapping.gradeAmount + totalAllowances)} bold />
            <Row label="Total Deductions" value={`-${formatNPR(totalDeductions)}`} valueClass="text-red-600" />
            {totalLoan > 0 && (
              <Row label="Loan Deductions" value={`-${formatNPR(totalLoan)}`} valueClass="text-red-600" />
            )}
            <div className="border-t border-payroll-light/80 pt-2">
              <Row label="Estimated Net Payable" value={formatNPR(mapping.netAmount)} bold valueClass="text-payroll-primary text-sm" />
            </div>
          </div>
        </section>
      </div>
    </DrawerShell>
  );
}

function Row({
  label,
  value,
  bold = false,
  valueClass = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={cn(bold ? "font-semibold text-payroll-navy" : "text-gray-600")}>
        {label}
      </span>
      <span className={cn("font-mono font-medium", bold && "font-bold", valueClass || "text-payroll-navy")}>
        {value}
      </span>
    </div>
  );
}