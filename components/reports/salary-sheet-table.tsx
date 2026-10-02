"use client";

import type { SalarySheetReportData, SalarySheetRow } from "@/lib/types/report";
import { Download, Eye, Printer } from "lucide-react";

interface SalarySheetTableProps {
  data: SalarySheetReportData;
  onExportCsv?: () => void;
  isExporting?: boolean;
  onSingleEmployeeAction?: (row: SalarySheetRow, action: "preview" | "print" | "export") => void;
}

export function SalarySheetTable({
  data,
  onExportCsv,
  isExporting = false,
  onSingleEmployeeAction,
}: SalarySheetTableProps) {
  const { rows, summary, allAllowanceHeadNames, allDeductionHeadNames, run } = data;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-medium text-zinc-600">
          No slips found for the selected run or filters.
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Select a locked payroll run and click &quot;Generate Report&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar with summary & export */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-300 pb-3 bg-transparent">
        <div>
          <p className="text-xs font-semibold text-zinc-900">
            Salary Sheet — {run.label}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Total Employees: <span className="font-medium text-zinc-900">{summary.totalEmployees}</span> &middot;
            Gross: <span className="font-medium text-zinc-900 font-mono">NPR {Number(summary.totalGrossEarnings).toLocaleString()}</span> &middot;
            Net Payable: <span className="font-semibold text-emerald-700 font-mono">NPR {Number(summary.totalNetPayable).toLocaleString()}</span>
          </p>
        </div>

        {onExportCsv && (
          <button
            onClick={onExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 print:hidden cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            {isExporting ? "Exporting..." : "Export Full CSV"}
          </button>
        )}
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto max-h-150 overflow-y-auto print:max-h-none print:overflow-visible print:w-full">
        <table className="w-full text-left text-xs text-zinc-900 border-collapse print:text-[7.5pt]">
          <thead className="sticky top-0 z-10 border-b border-zinc-300 bg-zinc-200 font-semibold text-zinc-900 text-2xs">
            <tr>
              <th className="px-3.5 py-3 text-center sticky left-0 z-20 bg-white print:static print:px-1.5 print:py-1.5">SN</th>
              <th className="px-3.5 py-3 sticky left-8 z-20 bg-white print:static print:px-1.5 print:py-1.5">Code</th>
              <th className="px-3.5 py-3 min-w-35 sticky left-24 z-20 bg-white print:static print:px-1.5 print:py-1.5 print:min-w-0">Employee Name</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">Department</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">Position / Designation</th>
              <th className="px-3.5 py-3 text-right print:px-1.5 print:py-1.5">Basic Salary</th>
              <th className="px-3.5 py-3 text-right print:px-1.5 print:py-1.5">Grade Amt</th>
              <th className="px-3.5 py-3 text-right print:px-1.5 print:py-1.5">OT Amt</th>

              {/* Dynamic Allowance Columns */}
              {allAllowanceHeadNames.map((name) => (
                <th key={name} className="px-3.5 py-3 bg-emerald-50/40 text-emerald-800 print:px-1.5 print:py-1.5">
                  {name}
                </th>
              ))}

              <th className="px-3.5 py-3 bg-emerald-50/70 text-emerald-900 font-semibold print:px-1.5 print:py-1.5">
                Gross
              </th>
              <th className="px-3.5 py-3 text-rose-700 print:px-1.5 print:py-1.5">Absent</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">PF</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">SSF</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">CIT</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">TDS</th>
              <th className="px-3.5 py-3 print:px-1.5 print:py-1.5">Loan</th>

              {/* Dynamic Deduction Columns */}
              {allDeductionHeadNames.map((name) => (
                <th key={name} className="px-3.5 py-3 bg-rose-50/40 text-rose-800 print:px-1.5 print:py-1.5">
                  {name}
                </th>
              ))}

              <th className="px-3.5 py-3 bg-rose-50/70 text-rose-900 font-semibold print:px-1.5 print:py-1.5">
                Total Ded.
              </th>
              <th className="px-3.5 py-3 bg-emerald-100/60 text-emerald-950 font-bold text-xs print:px-1.5 print:py-1.5">
                Net Pay
              </th>
              <th className="px-3.5 py-3 print:hidden">Bank Name</th>
              <th className="px-3.5 py-3 min-w-28 print:hidden">Bank Account</th>
              {onSingleEmployeeAction && (
                <th className="px-3.5 py-3 text-center print:hidden min-w-28">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200">
            {rows.map((row, idx) => {
              const allowMap = new Map(row.allowanceHeads.map((h) => [h.name, h.amount]));
              const dedMap = new Map(row.deductionHeads.map((h) => [h.name, h.amount]));

              return (
                <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                  <td className="px-3.5 py-3.5 text-center text-zinc-400 font-medium sticky left-0 z-10 bg-white print:static print:px-1.5 print:py-1">
                    {idx + 1}
                  </td>
                  <td className="px-3.5 py-3.5 font-mono text-2xs text-zinc-500 sticky left-8 z-10 bg-white print:static print:px-1.5 print:py-1">
                    {row.employeeCode}
                  </td>
                  <td className="px-3.5 py-3.5 font-medium text-zinc-900 sticky left-24 z-10 bg-white print:static print:px-1.5 print:py-1">
                    {row.employeeName}
                  </td>
                  <td className="px-3.5 py-3.5 text-zinc-600 text-2xs print:px-1.5 print:py-1">
                    {row.departmentName}
                  </td>
                  <td className="px-3.5 py-3.5 text-zinc-600 text-2xs print:px-1.5 print:py-1">
                    {row.designationName || "Staff"}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right font-mono text-zinc-800 print:px-1.5 print:py-1">
                    {Number(row.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right font-mono text-zinc-600 print:px-1.5 print:py-1">
                    {Number(row.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right font-mono text-zinc-600 print:px-1.5 print:py-1">
                    {Number(row.otAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>

                  {/* Dynamic Allowance Values */}
                  {allAllowanceHeadNames.map((name) => {
                    const amt = allowMap.get(name) || "0.00";
                    return (
                      <td key={name} className="px-3.5 py-3.5 tabular-nums text-right bg-emerald-50/20 text-emerald-900 font-mono print:px-1.5 print:py-1">
                        {Number(amt) > 0 ? Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                      </td>
                    );
                  })}

                  <td className="px-3.5 py-3.5 tabular-nums text-right font-semibold text-emerald-800 bg-emerald-50/30 font-mono print:px-1.5 print:py-1">
                    {Number(row.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right text-rose-700 font-mono print:px-1.5 print:py-1">
                    {Number(row.absentDeduction) > 0 ? Number(row.absentDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right text-zinc-700 font-mono print:px-1.5 print:py-1">
                    {Number(row.pfEmployee) > 0 ? Number(row.pfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right text-zinc-700 font-mono print:px-1.5 print:py-1">
                    {Number(row.ssfEmployee) > 0 ? Number(row.ssfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right text-zinc-700 font-mono print:px-1.5 print:py-1">
                    {Number(row.citDeduction) > 0 ? Number(row.citDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right text-zinc-700 font-mono print:px-1.5 print:py-1">
                    {Number(row.tdsThisMonth) > 0 ? Number(row.tdsThisMonth).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right text-zinc-700 font-mono print:px-1.5 print:py-1">
                    {Number(row.loanDeduction) > 0 ? Number(row.loanDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>

                  {/* Dynamic Deduction Values */}
                  {allDeductionHeadNames.map((name) => {
                    const amt = dedMap.get(name) || "0.00";
                    return (
                      <td key={name} className="px-3.5 py-3.5 tabular-nums text-right bg-rose-50/20 text-rose-900 font-mono print:px-1.5 print:py-1">
                        {Number(amt) > 0 ? Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                      </td>
                    );
                  })}

                  <td className="px-3.5 py-3.5 tabular-nums text-right font-semibold text-rose-700 bg-rose-50/30 font-mono print:px-1.5 print:py-1">
                    {Number(row.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-3.5 tabular-nums text-right font-bold text-emerald-800 bg-emerald-50/50 font-mono print:px-1.5 print:py-1">
                    {Number(row.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3.5 py-3.5 text-zinc-600 text-2xs print:hidden">
                    {row.bankName}
                  </td>
                  <td className="px-3.5 py-3.5 font-mono text-2xs text-zinc-600 print:hidden">
                    {row.bankAccountNumberMasked}
                  </td>
                  {onSingleEmployeeAction && (
                    <td className="px-3.5 py-3.5 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "preview")}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                          title={`Preview report for ${row.employeeName}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "print")}
                          className="p-1 rounded text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title={`Print report for ${row.employeeName}`}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "export")}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                          title={`Export CSV for ${row.employeeName}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Table Summary Footer */}
          <tfoot className="sticky bottom-0 bg-zinc-50/90 font-medium border-t border-zinc-200 text-xs text-zinc-800">
            <tr>
              <td colSpan={5} className="px-3.5 py-3 text-right uppercase tracking-wider text-zinc-500 font-semibold text-2xs">
                Total ({summary.totalEmployees} employees)
              </td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3"></td>
              {allAllowanceHeadNames.map((name) => (
                <td key={name} className="px-3.5 py-3"></td>
              ))}
              <td className="px-3.5 py-3 text-right text-emerald-800 tabular-nums font-semibold font-mono bg-emerald-50/40">
                {Number(summary.totalGrossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3 text-right tabular-nums font-mono">
                {Number(summary.totalPf).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3 text-right tabular-nums font-mono">
                {Number(summary.totalSsf).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3 text-right tabular-nums font-mono">
                {Number(summary.totalCit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3 text-right tabular-nums font-mono">
                {Number(summary.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3 text-right tabular-nums font-mono">
                {Number(summary.totalLoanDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              {allDeductionHeadNames.map((name) => (
                <td key={name} className="px-3.5 py-3"></td>
              ))}
              <td className="px-3.5 py-3 text-right text-rose-700 tabular-nums font-semibold font-mono bg-rose-50/40">
                {Number(summary.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3 text-right text-emerald-950 font-bold tabular-nums font-mono bg-emerald-100/60">
                {Number(summary.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
