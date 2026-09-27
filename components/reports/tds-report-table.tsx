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
      <div className="border-b border-zinc-100 py-12 text-center text-xs text-zinc-500 font-medium">
        No TDS records found for the selected period and filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Missing PAN Banner */}
      {employeesWithoutPAN > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50/80 border border-amber-200/60 p-3 text-xs text-amber-900 animate-[fadeIn_150ms_ease-out] print:hidden">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong className="font-semibold text-amber-950">
                {employeesWithoutPAN} employee(s)
              </strong>{" "}
              are missing PAN numbers. IRD submission requires valid PAN numbers.
            </span>
          </div>
          <span className="text-[11px] font-medium text-amber-800 bg-amber-100/70 border border-amber-200/50 px-2 py-0.5 rounded">
            Action Needed in Employee Profiles
          </span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-300/80">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-900 block">
            Government of Nepal — Inland Revenue Department (IRD)
          </span>
          <h2 className="text-sm font-semibold text-zinc-900">
            TDS Withholding Statement (Form-29 / Schedule 1) — {period}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Fiscal Year: <span className="font-medium text-zinc-800">{fiscalYearLabel}</span> · Total Employees:{" "}
            <span className="font-medium text-zinc-800">{rows.length}</span> · Gross Income:{" "}
            <span className="font-medium font-mono text-zinc-800">
              NPR {Number(totalGrossIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>{" "}
            · Total TDS Withheld:{" "}
            <span className="font-medium font-mono text-rose-700">
              NPR {Number(totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        {onExportCsv && (
          <button
            onClick={onExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors disabled:opacity-50 print:hidden"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            {isExporting ? "Exporting..." : "Export IRD CSV"}
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-150 overflow-y-auto print:max-h-none print:overflow-visible">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 border-b border-zinc-300 bg-zinc-200 font-semibold uppercase tracking-wider text-zinc-900 text-[10px]">
            <tr>
              <th className="px-3.5 py-3 text-center w-12">SN</th>
              <th className="px-3.5 py-3">Code</th>
              <th className="px-3.5 py-3 min-w-36">Employee Name</th>
              <th className="px-3.5 py-3">PAN Number</th>
              <th className="px-3.5 py-3">Tax Status</th>
              <th className="px-3.5 py-3">Period</th>
              <th className="px-3.5 py-3 text-right">Gross Income</th>
              <th className="px-3.5 py-3 text-right">PF Deducted</th>
              <th className="px-3.5 py-3 text-right">CIT Deducted</th>
              <th className="px-3.5 py-3 text-right">Taxable Income</th>
              <th className="px-3.5 py-3 text-right text-rose-700">TDS Deducted</th>
              {onSingleEmployeeAction && (
                <th className="px-3.5 py-3 text-center print:hidden min-w-24">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-3.5 py-3 text-center text-zinc-400 font-medium">
                  {idx + 1}
                </td>
                <td className="px-3.5 py-3 font-mono text-[11px] text-zinc-500">
                  {row.employeeCode}
                </td>
                <td className="px-3.5 py-3 font-medium text-zinc-900">
                  {row.employeeName}
                </td>
                <td className="px-3.5 py-3">
                  {row.panNumber ? (
                    <span className="font-mono font-medium text-zinc-800">
                      {row.panNumber}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-200/50 bg-amber-50/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      <AlertCircle className="h-3 w-3" /> N/A
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-3 text-zinc-600 text-[11px]">
                  {row.taxStatus}
                </td>
                <td className="px-3.5 py-3 text-zinc-500 text-[11px]">
                  {row.period}
                </td>
                <td className="px-3.5 py-3 tabular-nums text-right font-medium text-zinc-900">
                  {Number(row.grossIncome).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3.5 py-3 tabular-nums text-right text-zinc-600">
                  {Number(row.pfDeducted) > 0
                    ? Number(row.pfDeducted).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })
                    : "-"}
                </td>
                <td className="px-3.5 py-3 tabular-nums text-right text-zinc-600">
                  {Number(row.citDeducted) > 0
                    ? Number(row.citDeducted).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })
                    : "-"}
                </td>
                <td className="px-3.5 py-3 tabular-nums text-right font-medium text-zinc-800">
                  {Number(row.taxableIncome).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3.5 py-3 tabular-nums text-right font-medium text-rose-700">
                  {Number(row.tdsDeducted).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                {onSingleEmployeeAction && (
                  <td className="px-3.5 py-3 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "preview")}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                        title={`Preview TDS report for ${row.employeeName}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "print")}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                        title={`Print TDS report for ${row.employeeName}`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "export")}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
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

          <tfoot className="sticky bottom-0 bg-zinc-50/90 backdrop-blur-xs font-semibold border-t border-zinc-200 text-xs">
            <tr>
              <td
                colSpan={6}
                className="px-3.5 py-3 text-right uppercase tracking-wider text-zinc-500"
              >
                TOTAL ({rows.length} employees)
              </td>
              <td className="px-3.5 py-3 text-right tabular-nums text-zinc-900 font-semibold">
                {Number(totalGrossIncome).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3"></td>
              <td className="px-3.5 py-3 text-right text-rose-700 font-semibold tabular-nums">
                {Number(totalTds).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </td>
              {onSingleEmployeeAction && <td className="px-3.5 py-3 print:hidden"></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
