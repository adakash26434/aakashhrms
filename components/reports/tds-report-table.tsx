"use client";

import type { TDSReportData, TDSReportRow } from "@/lib/types/report";
import { Download, AlertCircle, Eye, Printer, ShieldAlert } from "lucide-react";

interface TDSReportTableProps {
  data: TDSReportData;
  onExportCsv?: () => void;
  isExporting?: boolean;
  onSingleEmployeeAction?: (row: TDSReportRow, action: "preview" | "print" | "export") => void;
}

export function TDSReportTable({
  data,
  onExportCsv,
  isExporting = false,
  onSingleEmployeeAction,
}: TDSReportTableProps) {
  const {
    rows,
    period,
    fiscalYearLabel,
    totalTds,
    totalGrossIncome,
    employeesWithoutPAN,
  } = data;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#d7e8d0] bg-[#f6faf6] p-8 text-center text-xs text-gray-500">
        No TDS records found for the selected period and filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Missing PAN Banner */}
      {employeesWithoutPAN > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 animate-[fadeIn_150ms_ease-out] print:hidden">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong className="font-bold text-amber-900">
                {employeesWithoutPAN} employee(s)
              </strong>{" "}
              are missing PAN numbers. IRD submission requires valid PAN
              numbers.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            Action Needed in Employee Profiles
          </span>
        </div>
      )}

      {/* Header bar */}
      <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-payroll-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d7e8d0]/60 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2e7d32] block">
              Government of Nepal — Inland Revenue Department (IRD)
            </span>
            <h2 className="text-base font-bold text-[#1b3a1f] uppercase tracking-wider">
              TDS Withholding Statement (Form-29 / Schedule 1) — {period}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Fiscal Year: <span className="font-bold text-[#1b3a1f]">{fiscalYearLabel}</span> · Total Employees:{" "}
              <span className="font-bold text-[#1b3a1f]">{rows.length}</span> · Gross Income:{" "}
              <span className="font-bold font-mono text-[#1b3a1f]">
                NPR {Number(totalGrossIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>{" "}
              · Total TDS Withheld:{" "}
              <span className="font-bold font-mono text-red-600">
                NPR {Number(totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d7e8d0] bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#1b3a1f] shadow-payroll-sm transition-all hover:bg-[#d7e8d0]/40 hover:text-[#2e7d32] disabled:opacity-50 print:hidden"
            >
              <Download className="h-3.5 w-3.5 text-[#2e7d32]" />
              {isExporting ? "Exporting..." : "Export IRD CSV"}
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-[#d7e8d0] bg-white shadow-sm max-h-150 overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-none">
        <table className="w-full text-left text-xs text-[#1b3a1f] border-collapse">
          <thead className="sticky top-0 z-10 border-b border-[#d7e8d0] bg-[#f6faf6] font-bold uppercase tracking-wider text-gray-600 text-[10px]">
            <tr>
              <th className="px-3 py-3 text-center border-r border-[#d7e8d0]">
                SN
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0]">Code</th>
              <th className="px-3 py-3 border-r border-[#d7e8d0] min-w-35">
                Employee Name
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0]">
                PAN Number
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0]">
                Tax Status
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0]">Period</th>
              <th className="px-3 py-3 border-r border-[#d7e8d0] text-right font-bold">
                Gross Income
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0] text-right">
                PF Deducted
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0] text-right">
                CIT Deducted
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0] text-right font-semibold">
                Taxable Income
              </th>
              <th className="px-3 py-3 border-r border-[#d7e8d0] text-right font-bold bg-red-50 text-red-900">
                TDS Deducted
              </th>
              {onSingleEmployeeAction && (
                <th className="px-3 py-3 text-center print:hidden min-w-28">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#d7e8d0]/60">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-[#f6faf6]/80 transition-colors">
                <td className="px-3 py-2.5 text-center text-gray-400 font-medium border-r border-[#d7e8d0]/60">
                  {idx + 1}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500 border-r border-[#d7e8d0]/60">
                  {row.employeeCode}
                </td>
                <td className="px-3 py-2.5 font-semibold text-[#1b3a1f] border-r border-[#d7e8d0]/60">
                  {row.employeeName}
                </td>
                <td className="px-3 py-2.5 border-r border-[#d7e8d0]/60">
                  {row.panNumber ? (
                    <span className="font-mono font-bold text-emerald-800">
                      {row.panNumber}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <AlertCircle className="h-3 w-3" /> N/A
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-600 border-r border-[#d7e8d0]/60 text-[11px]">
                  {row.taxStatus}
                </td>
                <td className="px-3 py-2.5 text-gray-500 border-r border-[#d7e8d0]/60 text-[11px]">
                  {row.period}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right font-semibold border-r border-[#d7e8d0]/60">
                  {Number(row.grossIncome).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right border-r border-[#d7e8d0]/60 text-gray-600">
                  {Number(row.pfDeducted) > 0
                    ? Number(row.pfDeducted).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })
                    : "-"}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right border-r border-[#d7e8d0]/60 text-gray-600">
                  {Number(row.citDeducted) > 0
                    ? Number(row.citDeducted).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })
                    : "-"}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right font-semibold border-r border-[#d7e8d0]/60 text-gray-800">
                  {Number(row.taxableIncome).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right font-bold text-red-600 bg-red-50/40 border-r border-[#d7e8d0]/60">
                  {Number(row.tdsDeducted).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                {onSingleEmployeeAction && (
                  <td className="px-3 py-2 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "preview")}
                        className="p-1 rounded-md text-[#2e7d32] hover:bg-[#2e7d32]/10 transition-colors"
                        title={`Preview TDS report for ${row.employeeName}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "print")}
                        className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title={`Print TDS report for ${row.employeeName}`}
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
            ))}
          </tbody>

          <tfoot className="sticky bottom-0 bg-[#f6faf6] font-bold border-t-2 border-[#d7e8d0] text-xs">
            <tr>
              <td
                colSpan={6}
                className="px-3 py-3 text-right uppercase tracking-wider text-gray-500 border-r border-[#d7e8d0]"
              >
                TOTAL ({rows.length} employees)
              </td>
              <td className="px-3 py-3 text-right tabular-nums border-r border-[#d7e8d0]">
                {Number(totalGrossIncome).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="px-3 py-3 border-r border-[#d7e8d0]"></td>
              <td className="px-3 py-3 border-r border-[#d7e8d0]"></td>
              <td className="px-3 py-3 border-r border-[#d7e8d0]"></td>
              <td className="px-3 py-3 text-right text-red-800 font-black tabular-nums bg-red-100/60">
                {Number(totalTds).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
