"use client";

import React, { useState } from "react";
import type { AttendanceReportData, AttendanceReportRow } from "@/lib/types/report";
import { Download, Eye, Printer, Calendar, Search } from "lucide-react";

interface AttendanceReportTableProps {
  data: AttendanceReportData;
  onExportCsv?: () => void;
  isExporting?: boolean;
  onSingleEmployeeAction?: (row: AttendanceReportRow, action: "preview" | "print" | "export") => void;
}

export function AttendanceReportTable({
  data,
  onExportCsv,
  isExporting = false,
  onSingleEmployeeAction,
}: AttendanceReportTableProps) {
  const { rows, reportFormat, dateHeaders } = data;
  const [calendarType, setCalendarType] = useState<"BS" | "AD">("BS");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDay, setFromDay] = useState<number>(1);
  const [toDay, setToDay] = useState<number>(30);

  // Default view: STATUS_MATRIX for matrix format, SUMMARY for everything else
  const defaultView = reportFormat === "STATUS_MATRIX" || reportFormat === "DEVICE_PUNCH" ? "MATRIX" : "SUMMARY";
  const [viewMode, setViewMode] = useState<"SUMMARY" | "MATRIX">(defaultView);

  if (rows.length === 0) {
    return (
      <div className="border-b border-zinc-100 py-12 text-center text-xs text-zinc-500 font-medium">
        No attendance records found for the selected month and filters.
      </div>
    );
  }

  const activeFormat = reportFormat || "STATUTORY_SUMMARY";
  const activeDateHeaders = (dateHeaders || []).filter(
    (dh) => dh.dayNum >= fromDay && dh.dayNum <= toDay
  );

  const filteredRows = rows.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.employeeName.toLowerCase().includes(q) ||
      r.employeeCode.toLowerCase().includes(q) ||
      r.departmentName.toLowerCase().includes(q)
    );
  });

  // ── Status colour helpers ──────────────────────────────────────────────────
  const statusClass = (st: string) => {
    switch (st) {
      case "P":   return "text-emerald-700 font-semibold";
      case "A":   return "text-rose-700 font-semibold";
      case "L":   return "text-teal-700";
      case "HD":  return "text-amber-700";
      case "OFF": return "text-zinc-400";
      case "HO":  return "text-purple-700";
      case "LWOP": return "text-orange-700";
      default:    return "text-zinc-300";
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Single Clean Control Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-300/80 print:hidden">
        {/* Left: date range + presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Day range selectors */}
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50/50 px-2.5 py-1">
            <span className="text-[11px] text-zinc-500">From day</span>
            <select
              value={fromDay}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFromDay(v);
                if (v > toDay) setToDay(v);
              }}
              className="text-xs font-medium text-zinc-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {(dateHeaders || []).map((dh) => (
                <option key={dh.dayNum} value={dh.dayNum}>{dh.dayNum}</option>
              ))}
            </select>
            <span className="text-[11px] text-zinc-400">–</span>
            <select
              value={toDay}
              onChange={(e) => {
                const v = Number(e.target.value);
                setToDay(v);
                if (v < fromDay) setFromDay(v);
              }}
              className="text-xs font-medium text-zinc-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {(dateHeaders || []).map((dh) => (
                <option key={dh.dayNum} value={dh.dayNum}>{dh.dayNum}</option>
              ))}
            </select>
          </div>

          {/* Quick presets */}
          <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
            {[
              { label: "Full", from: 1, to: 30 },
              { label: "1–15", from: 1, to: 15 },
              { label: "16–30", from: 16, to: 30 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setFromDay(p.from); setToDay(p.to); }}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  fromDay === p.from && toDay === p.to
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* View toggle (only shown when format supports matrix) */}
          {(activeFormat === "STATUS_MATRIX" || activeFormat === "DEVICE_PUNCH") && (
            <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("SUMMARY")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === "SUMMARY" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode("MATRIX")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  viewMode === "MATRIX" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <Calendar className="h-3 w-3" />
                Day grid
              </button>
            </div>
          )}
        </div>

        {/* Right: calendar type, search, export */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
            <button
              type="button"
              onClick={() => setCalendarType("BS")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                calendarType === "BS" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              BS
            </button>
            <button
              type="button"
              onClick={() => setCalendarType("AD")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                calendarType === "AD" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              AD
            </button>
          </div>

          <div className="relative w-40">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff..."
              className="h-7 w-full rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none"
            />
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-zinc-400" />
          </div>

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-zinc-500" />
              {isExporting ? "Exporting…" : "Export CSV"}
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY VIEW (Statutory / default) ── */}
      {(viewMode === "SUMMARY" || activeFormat === "STATUTORY_SUMMARY") && (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold text-zinc-900">
              <tr>
                <th className="px-3 py-3 text-center">SN</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3 min-w-36">Employee name</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Position</th>
                <th className="px-3 py-3 text-center">Working days</th>
                <th className="px-3 py-3 text-center text-emerald-700">Present</th>
                <th className="px-3 py-3 text-center text-teal-700">Pay leave</th>
                <th className="px-3 py-3 text-center text-amber-700">Non-pay leave</th>
                <th className="px-3 py-3 text-center text-rose-700">Absent</th>
                <th className="px-3 py-3 text-right">Office OT (hrs)</th>
                <th className="px-3 py-3 text-right">Off-day OT (hrs)</th>
                <th className="px-3 py-3 text-right text-emerald-700">OT earned</th>
                <th className="px-3 py-3 text-right text-rose-700">Leave deduction</th>
                {onSingleEmployeeAction && (
                  <th className="px-3 py-3 text-center print:hidden">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-3 py-3 text-center text-zinc-400 font-medium">{idx + 1}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-zinc-500">{row.employeeCode}</td>
                  <td className="px-3 py-3 font-medium text-zinc-900">{row.employeeName}</td>
                  <td className="px-3 py-3 text-zinc-500 text-[11px]">{row.departmentName}</td>
                  <td className="px-3 py-3 text-zinc-500 text-[11px]">{row.designationName}</td>
                  <td className="px-3 py-3 text-center tabular-nums font-medium text-zinc-700">{row.totalWorkingDays}</td>
                  <td className="px-3 py-3 text-center tabular-nums font-semibold text-emerald-800">{row.presentDays}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-teal-700">{row.payLeaveDays}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-amber-700">{row.nonPayLeaveDays}</td>
                  <td className="px-3 py-3 text-center tabular-nums font-semibold text-rose-700">{row.absentDays}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600 font-mono">{row.totalOtHoursOffice}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600 font-mono">{row.totalOtHoursOff}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-emerald-800 font-mono">
                    NPR {Number(row.otEarnedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-rose-700 font-mono">
                    NPR {Number(row.leaveDeductionAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  {onSingleEmployeeAction && (
                    <td className="px-3 py-3 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors" title={`Preview — ${row.employeeName}`}><Eye className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors" title={`Print — ${row.employeeName}`}><Printer className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors" title={`Export — ${row.employeeName}`}><Download className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MATRIX VIEW (Status grid, available for STATUS_MATRIX & DEVICE_PUNCH formats) ── */}
      {viewMode === "MATRIX" && activeFormat !== "STATUTORY_SUMMARY" && (
        <div className="overflow-x-auto print:overflow-visible">
          {activeFormat === "STATUS_MATRIX" && (
            <table className="w-full text-left text-xs border-collapse min-w-max">
              <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold text-zinc-900">
                <tr>
                  <th className="px-3 py-2.5 text-center sticky left-0 z-20 bg-white">SN</th>
                  <th className="px-3 py-2.5 min-w-36 sticky left-8 z-20 bg-white">Name</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Position</th>
                  {activeDateHeaders.map((dh) => (
                    <th key={dh.dayNum} className="px-1 py-2.5 text-center min-w-7 font-medium text-zinc-400">
                      {calendarType === "BS" ? dh.dayNum : dh.dateStrAD.split(" ")[1]}
                    </th>
                  ))}
                  <th className="px-2.5 py-2.5 text-center text-emerald-700">P</th>
                  <th className="px-2.5 py-2.5 text-center text-teal-700">L</th>
                  <th className="px-2.5 py-2.5 text-center text-rose-700">A</th>
                  <th className="px-2.5 py-2.5 text-center text-amber-700">LWOP</th>
                  {onSingleEmployeeAction && (
                    <th className="px-3 py-2.5 text-center print:hidden">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[11px]">
                {filteredRows.map((row, idx) => {
                  const activeDetails = (row.dailyDetails || []).filter((d) => d.dayNum >= fromDay && d.dayNum <= toDay);
                  let rP = 0, rL = 0, rA = 0, rLwop = 0;
                  activeDetails.forEach((d) => {
                    const st = d.statusCode || "P";
                    if (st === "P" || st === "HD") rP += st === "HD" ? 0.5 : 1;
                    else if (st === "L") rL += 1;
                    else if (st === "A") rA += 1;
                    else if (st === "LWOP") rLwop += 1;
                  });

                  return (
                    <tr key={idx} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-3 py-2 text-center text-zinc-400 sticky left-0 z-10 bg-white group-hover:bg-zinc-50/60">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900 sticky left-8 z-10 bg-white group-hover:bg-zinc-50/60">{row.employeeName}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.departmentName}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.designationName}</td>
                      {activeDetails.map((d, dIdx) => {
                        const st = d.statusCode || "-";
                        return (
                          <td key={dIdx} className={`px-0.5 py-1.5 text-center font-mono ${statusClass(st)}`}>
                            {st}
                          </td>
                        );
                      })}
                      <td className="px-2.5 py-2 text-center font-medium font-mono text-emerald-700">{rP}</td>
                      <td className="px-2.5 py-2 text-center font-medium font-mono text-teal-700">{rL}</td>
                      <td className="px-2.5 py-2 text-center font-medium font-mono text-rose-700">{rA}</td>
                      <td className="px-2.5 py-2 text-center font-medium font-mono text-amber-700">{rLwop}</td>
                      {onSingleEmployeeAction && (
                        <td className="px-3 py-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"><Printer className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"><Download className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeFormat === "DEVICE_PUNCH" && (
            <table className="w-full text-left text-xs border-collapse min-w-max">
              <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold text-zinc-900">
                <tr>
                  <th rowSpan={2} className="px-3 py-2.5 text-center sticky left-0 z-20 bg-white">SN</th>
                  <th rowSpan={2} className="px-3 py-2.5 min-w-36 sticky left-8 z-20 bg-white">Name</th>
                  <th rowSpan={2} className="px-3 py-2.5">Department</th>
                  <th rowSpan={2} className="px-3 py-2.5">Position</th>
                  {activeDateHeaders.map((dh) => (
                    <th key={dh.dayNum} colSpan={3} className="px-2 py-1 text-center min-w-36 border-b border-zinc-100">
                      {calendarType === "BS" ? `Day ${dh.dayNum}` : dh.dateStrAD} ({dh.dayName})
                    </th>
                  ))}
                  <th rowSpan={2} className="px-3 py-2.5 text-center text-emerald-700">Total (hrs)</th>
                  {onSingleEmployeeAction && (
                    <th rowSpan={2} className="px-3 py-2.5 text-center print:hidden">Actions</th>
                  )}
                </tr>
                <tr>
                  {activeDateHeaders.map((dh) => (
                    <React.Fragment key={`sub-${dh.dayNum}`}>
                      <th className="px-1.5 py-1 text-[9px] text-zinc-400">In</th>
                      <th className="px-1.5 py-1 text-[9px] text-zinc-400">Out</th>
                      <th className="px-1.5 py-1 text-[9px] text-zinc-400">Hrs</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredRows.map((row, idx) => {
                  const activeDetails = (row.dailyDetails || []).filter((d) => d.dayNum >= fromDay && d.dayNum <= toDay);
                  return (
                    <tr key={idx} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-3 py-2 text-center text-zinc-400 sticky left-0 z-10 bg-white group-hover:bg-zinc-50/60">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900 sticky left-8 z-10 bg-white group-hover:bg-zinc-50/60">{row.employeeName}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.departmentName}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.designationName}</td>
                      {activeDetails.map((d, dIdx) => (
                        <React.Fragment key={dIdx}>
                          <td className="px-1.5 py-2 text-center text-[10px] font-mono text-zinc-500">{d.inTime && d.inTime !== "-" ? d.inTime : "—"}</td>
                          <td className="px-1.5 py-2 text-center text-[10px] font-mono text-zinc-500">{d.outTime && d.outTime !== "-" ? d.outTime : "—"}</td>
                          <td className="px-1.5 py-2 text-center text-[10px] font-mono font-medium text-zinc-700">{d.workHours && d.workHours !== "-" && d.workHours !== "00:00" ? d.workHours : "—"}</td>
                        </React.Fragment>
                      ))}
                      <td className="px-3 py-2 text-center tabular-nums font-semibold text-emerald-700 font-mono">{row.totalWorkHours || "00:00"}</td>
                      {onSingleEmployeeAction && (
                        <td className="px-3 py-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"><Printer className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"><Download className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
