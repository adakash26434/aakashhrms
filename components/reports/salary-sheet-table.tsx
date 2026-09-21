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
      <div className="rounded-xl border border-dashed border-payroll-light bg-payroll-cream p-8 text-center">
        <p className="text-sm font-semibold text-gray-500">
          No slips found for the selected run or filters.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Select a locked payroll run and click &quot;Generate Report&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar with summary & export */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-payroll-light bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-payroll-navy uppercase tracking-wider">
            Salary Sheet — {run.label}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Total Employees: <span className="font-bold text-payroll-navy">{summary.totalEmployees}</span> ·
            Gross: <span className="font-bold text-payroll-navy">NPR {Number(summary.totalGrossEarnings).toLocaleString()}</span> ·
            Net Payable: <span className="font-bold text-emerald-600">NPR {Number(summary.totalNetPayable).toLocaleString()}</span>
          </p>
        </div>

        {onExportCsv && (
          <button
            onClick={onExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-payroll-navy shadow-sm transition-all hover:bg-payroll-light/20 hover:text-payroll-primary disabled:opacity-50 print:hidden"
          >
            <Download className="h-3.5 w-3.5 text-payroll-primary" />
            {isExporting ? "Exporting..." : "Export Full CSV"}
          </button>
        )}
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto rounded-xl border border-payroll-light bg-white shadow-sm max-h-150 overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-none">
        <table className="w-full text-left text-xs text-payroll-navy border-collapse">
          <thead className="sticky top-0 z-10 border-b border-payroll-light bg-payroll-cream font-bold uppercase tracking-wider text-gray-600 text-[10px]">
            <tr>
              <th className="px-3 py-3 text-center border-r border-payroll-light sticky left-0 z-20 bg-payroll-cream">SN</th>
              <th className="px-3 py-3 border-r border-payroll-light sticky left-8 z-20 bg-payroll-cream">Code</th>
              <th className="px-3 py-3 border-r border-payroll-light min-w-35 sticky left-24 z-20 bg-payroll-cream">Employee Name</th>
              <th className="px-3 py-3 border-r border-payroll-light">Department</th>
              <th className="px-3 py-3 border-r border-payroll-light">Position / Designation</th>
              <th className="px-3 py-3 border-r border-payroll-light text-right">Basic Salary</th>
              <th className="px-3 py-3 border-r border-payroll-light text-right">Grade Amount</th>
              <th className="px-3 py-3 border-r border-payroll-light text-right">OT Amount</th>

              {/* Dynamic Allowance Columns */}
              {allAllowanceHeadNames.map((name) => (
                <th key={name} className="px-3 py-3 border-r border-payroll-light bg-emerald-50/50 text-emerald-800">
                  {name}
                </th>
              ))}

              <th className="px-3 py-3 border-r border-payroll-light bg-emerald-100/60 text-emerald-900 font-extrabold">
                Gross Earnings
              </th>
              <th className="px-3 py-3 border-r border-payroll-light text-red-700">Absent Ded.</th>
              <th className="px-3 py-3 border-r border-payroll-light">PF (Emp)</th>
              <th className="px-3 py-3 border-r border-payroll-light">SSF (Emp)</th>
              <th className="px-3 py-3 border-r border-payroll-light">CIT</th>
              <th className="px-3 py-3 border-r border-payroll-light">TDS (Tax)</th>
              <th className="px-3 py-3 border-r border-payroll-light">Loan Ded.</th>

              {/* Dynamic Deduction Columns */}
              {allDeductionHeadNames.map((name) => (
                <th key={name} className="px-3 py-3 border-r border-payroll-light bg-red-50/50 text-red-800">
                  {name}
                </th>
              ))}

              <th className="px-3 py-3 border-r border-payroll-light bg-red-100/60 text-red-900 font-extrabold">
                Total Deductions
              </th>
              <th className="px-3 py-3 border-r border-payroll-light bg-emerald-100 text-emerald-950 font-black text-xs">
                Net Payable
              </th>
              <th className="px-3 py-3 border-r border-payroll-light">Bank Name</th>
              <th className="px-3 py-3 border-r border-payroll-light min-w-27.5">Bank Account</th>
              {onSingleEmployeeAction && (
                <th className="px-3 py-3 text-center print:hidden min-w-28">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-payroll-light/60">
            {rows.map((row, idx) => {
              const allowMap = new Map(row.allowanceHeads.map((h) => [h.name, h.amount]));
              const dedMap = new Map(row.deductionHeads.map((h) => [h.name, h.amount]));

              return (
                <tr key={idx} className="hover:bg-payroll-cream/80 transition-colors">
                  <td className="px-3 py-2 text-center text-gray-400 font-medium border-r border-payroll-light/60 sticky left-0 z-10 bg-white">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500 border-r border-payroll-light/60 sticky left-8 z-10 bg-white">
                    {row.employeeCode}
                  </td>
                  <td className="px-3 py-2 font-semibold text-payroll-navy border-r border-payroll-light/60 sticky left-24 z-10 bg-white">
                    {row.employeeName}
                  </td>
                  <td className="px-3 py-2 text-gray-500 border-r border-payroll-light/60 text-[11px]">
                    {row.departmentName}
                  </td>
                  <td className="px-3 py-2 text-gray-500 border-r border-payroll-light/60 text-[11px]">
                    {row.designationName || "Staff"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60 font-mono">
                    {Number(row.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60 font-mono">
                    {Number(row.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60 font-mono">
                    {Number(row.otAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>

                  {/* Dynamic Allowance Values */}
                  {allAllowanceHeadNames.map((name) => {
                    const amt = allowMap.get(name) || "0.00";
                    return (
                      <td key={name} className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60 bg-emerald-50/20">
                        {Number(amt) > 0 ? Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 tabular-nums text-right font-bold text-emerald-700 bg-emerald-50/40 border-r border-payroll-light/60">
                    {Number(row.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60 text-red-600">
                    {Number(row.absentDeduction) > 0 ? Number(row.absentDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60">
                    {Number(row.pfEmployee) > 0 ? Number(row.pfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60">
                    {Number(row.ssfEmployee) > 0 ? Number(row.ssfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60">
                    {Number(row.citDeduction) > 0 ? Number(row.citDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60">
                    {Number(row.tdsThisMonth) > 0 ? Number(row.tdsThisMonth).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60">
                    {Number(row.loanDeduction) > 0 ? Number(row.loanDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                  </td>

                  {/* Dynamic Deduction Values */}
                  {allDeductionHeadNames.map((name) => {
                    const amt = dedMap.get(name) || "0.00";
                    return (
                      <td key={name} className="px-3 py-2 tabular-nums text-right border-r border-payroll-light/60 bg-red-50/20">
                        {Number(amt) > 0 ? Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 tabular-nums text-right font-bold text-red-600 bg-red-50/40 border-r border-payroll-light/60">
                    {Number(row.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right font-black text-emerald-700 bg-emerald-100/50 border-r border-payroll-light/60">
                    {Number(row.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-payroll-light/60 text-[11px]">
                    {row.bankName}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-600 border-r border-payroll-light/60">
                    {row.bankAccountNumberMasked}
                  </td>
                  {onSingleEmployeeAction && (
                    <td className="px-3 py-2 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "preview")}
                          className="p-1 rounded-md text-payroll-navy hover:bg-payroll-navy/10 transition-colors"
                          title={`Preview report for ${row.employeeName}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "print")}
                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title={`Print report for ${row.employeeName}`}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "export")}
                          className="p-1 rounded-md text-purple-600 hover:bg-purple-50 transition-colors"
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
          <tfoot className="sticky bottom-0 bg-payroll-light font-bold border-t-2 border-payroll-navy text-xs">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wider text-gray-500 border-r border-payroll-light">
                TOTAL ({summary.totalEmployees} employees)
              </td>
              <td className="px-3 py-3 border-r border-payroll-light"></td>
              <td className="px-3 py-3 border-r border-payroll-light"></td>
              <td className="px-3 py-3 border-r border-payroll-light"></td>
              {allAllowanceHeadNames.map((name) => (
                <td key={name} className="px-3 py-3 border-r border-payroll-light"></td>
              ))}
              <td className="px-3 py-3 text-right text-emerald-800 tabular-nums border-r border-payroll-light bg-emerald-100/40">
                {Number(summary.totalGrossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 border-r border-payroll-light"></td>
              <td className="px-3 py-3 text-right tabular-nums border-r border-payroll-light">
                {Number(summary.totalPf).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums border-r border-payroll-light">
                {Number(summary.totalSsf).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums border-r border-payroll-light">
                {Number(summary.totalCit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums border-r border-payroll-light">
                {Number(summary.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums border-r border-payroll-light">
                {Number(summary.totalLoanDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              {allDeductionHeadNames.map((name) => (
                <td key={name} className="px-3 py-3 border-r border-payroll-light"></td>
              ))}
              <td className="px-3 py-3 text-right text-red-700 tabular-nums border-r border-payroll-light bg-red-100/40">
                {Number(summary.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 text-right text-emerald-950 font-black tabular-nums border-r border-payroll-light bg-emerald-200/60">
                {Number(summary.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-3 border-r border-payroll-light"></td>
              <td className="px-3 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
