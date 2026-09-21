"use client";

import React, { useState } from "react";
import type { AttendanceReportData, AttendanceReportRow } from "@/lib/types/report";
import { Download, Eye, Printer, Calendar, Search, Users, Clock } from "lucide-react";

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
  const [punchViewMode, setPunchViewMode] = useState<"DAILY_LOG" | "MATRIX">("DAILY_LOG");
  const [selectedLogDay, setSelectedLogDay] = useState<number>(1);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-payroll-light bg-payroll-cream p-8 text-center text-xs text-gray-500">
        No attendance/OT records found for the selected month and filters.
      </div>
    );
  }

  const activeFormat = reportFormat || "STATUTORY_SUMMARY";

  // Filter headers based on Day From - Day To range
  const activeDateHeaders = (dateHeaders || []).filter(
    (dh) => dh.dayNum >= fromDay && dh.dayNum <= toDay
  );

  // In-table search filtering
  const filteredRows = rows.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.employeeName.toLowerCase().includes(q) ||
      r.employeeCode.toLowerCase().includes(q) ||
      r.departmentName.toLowerCase().includes(q) ||
      r.designationName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Sleek & Spacious Control Bar (Uncluttered, Single-Layer UI) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-payroll-light shadow-payroll-sm print:hidden">
        {/* Left: Date Filter with Calendar Selectors & Presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-payroll-navy flex items-center gap-1.5 pl-1">
            <Clock className="h-4 w-4 text-payroll-primary" /> Range Filter:
          </span>

          {/* Calendar From/To Date Selectors */}
          <div className="flex items-center gap-1.5 bg-payroll-cream px-2.5 py-1 rounded-lg border border-payroll-light">
            <span className="text-[11px] text-gray-500 font-medium">From:</span>
            <select
              value={fromDay}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFromDay(val);
                if (val > toDay) setToDay(val);
              }}
              className="font-bold text-payroll-navy bg-transparent focus:outline-none cursor-pointer text-xs"
            >
              {(dateHeaders || []).map((dh) => (
                <option key={dh.dayNum} value={dh.dayNum}>
                  {calendarType === "BS" ? dh.dateStr : dh.dateStrAD} (Day {dh.dayNum})
                </option>
              ))}
            </select>

            <span className="text-[11px] text-gray-500 font-medium ml-1">To:</span>
            <select
              value={toDay}
              onChange={(e) => {
                const val = Number(e.target.value);
                setToDay(val);
                if (val < fromDay) setFromDay(val);
              }}
              className="font-bold text-payroll-navy bg-transparent focus:outline-none cursor-pointer text-xs"
            >
              {(dateHeaders || []).map((dh) => (
                <option key={dh.dayNum} value={dh.dayNum}>
                  {calendarType === "BS" ? dh.dateStr : dh.dateStrAD} (Day {dh.dayNum})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Presets */}
          <div className="inline-flex rounded-lg border border-payroll-light bg-payroll-cream p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setFromDay(1); setToDay(30); }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                fromDay === 1 && toDay === 30 ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              Full Month (1-30)
            </button>
            <button
              type="button"
              onClick={() => { setFromDay(1); setToDay(15); }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                fromDay === 1 && toDay === 15 ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              1st Half (1-15)
            </button>
            <button
              type="button"
              onClick={() => { setFromDay(16); setToDay(30); }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                fromDay === 16 && toDay === 30 ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              2nd Half (16-30)
            </button>
          </div>
        </div>

        {/* Right: Date Mode, Search & CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar Format Switcher (BS / AD) */}
          <div className="inline-flex items-center rounded-lg border border-payroll-light bg-payroll-cream p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCalendarType("BS")}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                calendarType === "BS" ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              BS Date
            </button>
            <button
              type="button"
              onClick={() => setCalendarType("AD")}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                calendarType === "AD" ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              AD Date
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-44">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff..."
              className="h-8 w-full rounded-lg border border-payroll-light bg-payroll-cream pl-8 pr-2.5 text-xs text-payroll-navy focus:border-payroll-primary focus:bg-white focus:outline-none"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          </div>

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-payroll-navy shadow-payroll-sm transition-all hover:bg-payroll-light/20 hover:text-payroll-primary disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-payroll-primary" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          )}
        </div>
      </div>

      {/* Sub View Switcher Bar (Daily Log List View vs Summary / Matrix View) */}
      <div className="flex flex-wrap items-center justify-between bg-white p-2 rounded-xl border border-payroll-light shadow-payroll-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-payroll-navy pl-2">Display Layout:</span>
          <div className="inline-flex rounded-lg border border-payroll-light bg-payroll-cream p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPunchViewMode("DAILY_LOG")}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5 ${
                punchViewMode === "DAILY_LOG" ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Daily Attendance Log View (Spacious)
            </button>
            <button
              type="button"
              onClick={() => setPunchViewMode("MATRIX")}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5 ${
                punchViewMode === "MATRIX" ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {activeFormat === "STATUTORY_SUMMARY"
                ? "Monthly Summary Table"
                : activeFormat === "STATUS_MATRIX"
                ? "Daily Status Matrix"
                : "30-Day Punch Grid Matrix"}
            </button>
          </div>
        </div>

        {punchViewMode === "DAILY_LOG" && (
          <div className="flex items-center gap-2 pr-2">
            <span className="text-xs font-medium text-gray-500">Select Date/Day:</span>
            <select
              value={selectedLogDay}
              onChange={(e) => setSelectedLogDay(Number(e.target.value))}
              className="rounded-lg border border-payroll-light bg-payroll-cream px-3 py-1 text-xs font-bold text-payroll-navy focus:border-payroll-primary focus:outline-none cursor-pointer"
            >
              {(activeDateHeaders || []).map((dh) => (
                <option key={dh.dayNum} value={dh.dayNum}>
                  Day {dh.dayNum} — {dh.dateStr} BS ({dh.dateStrAD} — {dh.dayName})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: Spacious Daily Attendance Log List View (Available across all formats) */}
      {punchViewMode === "DAILY_LOG" && (
        <div className="overflow-x-auto rounded-xl border border-payroll-light bg-white shadow-payroll-sm">
          <table className="w-full text-left text-xs text-payroll-navy border-collapse min-w-max">
            <thead className="border-b border-payroll-light bg-payroll-cream font-bold uppercase tracking-wider text-gray-600 text-[11px]">
              <tr>
                <th className="px-4 py-3 text-center border-r border-payroll-light">SN</th>
                <th className="px-4 py-3 border-r border-payroll-light min-w-44">Employee Name</th>
                <th className="px-3 py-3 text-center border-r border-payroll-light">Code (EIN)</th>
                <th className="px-4 py-3 border-r border-payroll-light">Department</th>
                <th className="px-4 py-3 border-r border-payroll-light">Job Title / Position</th>
                <th className="px-4 py-3 border-r border-payroll-light min-w-32">Date</th>
                <th className="px-3 py-3 border-r border-payroll-light">Day</th>
                <th className="px-4 py-3 text-center border-r border-payroll-light">Day Type Status</th>
                <th className="px-4 py-3 text-center border-r border-payroll-light">Duty Shift / Punch</th>
                <th className="px-4 py-3 text-center bg-green-50/40 text-payroll-navy">Work Hours</th>
                {onSingleEmployeeAction && (
                  <th className="px-3 py-3 text-center print:hidden">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-payroll-light/60 text-[12px]">
              {filteredRows.map((row, idx) => {
                const dh = (dateHeaders || []).find((h) => h.dayNum === selectedLogDay) || dateHeaders?.[0];
                const d = (row.dailyDetails || []).find((detail) => detail.dayNum === selectedLogDay);

                const statusCode = d?.statusCode || (dh?.dayName === "Sat" || dh?.dayName === "Sun" ? "OFF" : "-");

                let statusBadge = (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Present
                  </span>
                );

                if (statusCode === "OFF") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      Weekly Off
                    </span>
                  );
                } else if (statusCode === "A") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                      Absent / Unposted
                    </span>
                  );
                } else if (statusCode === "L") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                      On Leave
                    </span>
                  );
                } else if (statusCode === "HD") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Half Day
                    </span>
                  );
                } else if (statusCode === "HO") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                      Public Holiday
                    </span>
                  );
                } else if (statusCode === "LWOP") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                      LWOP
                    </span>
                  );
                } else if (statusCode === "UPCOMING" || statusCode === "-") {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                      Upcoming / Future
                    </span>
                  );
                }

                const hasPunch = d?.inTime && d.inTime !== "-" && d?.outTime && d.outTime !== "-";

                return (
                  <tr key={idx} className="hover:bg-payroll-cream transition-colors">
                    <td className="px-4 py-3.5 text-center text-gray-400 font-semibold border-r border-payroll-light/60">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-payroll-primary border-r border-payroll-light/60">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-payroll-primary/10 text-payroll-primary font-bold text-xs flex items-center justify-center">
                          {row.employeeName.charAt(0)}
                        </div>
                        <span>{row.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-semibold text-gray-600 border-r border-payroll-light/60">{row.employeeCode}</td>
                    <td className="px-4 py-3.5 text-gray-700 font-medium border-r border-payroll-light/60">{row.departmentName}</td>
                    <td className="px-4 py-3.5 text-gray-700 font-medium border-r border-payroll-light/60">{row.designationName}</td>
                    <td className="px-4 py-3.5 font-mono text-gray-600 border-r border-payroll-light/60">
                      {dh ? (calendarType === "BS" ? `${dh.dateStr} (${dh.dateStrAD})` : `${dh.dateStrAD} (${dh.dateStr})`) : "-"}
                    </td>
                    <td className="px-3 py-3.5 font-medium text-gray-600 border-r border-payroll-light/60">{dh?.dayName}</td>
                    <td className="px-4 py-3.5 text-center border-r border-payroll-light/60">{statusBadge}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-600 border-r border-payroll-light/60">
                      {hasPunch ? `${d.inTime} – ${d.outTime}` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-payroll-navy bg-green-50/20 border-r border-payroll-light/60">
                      {d?.workHours && d.workHours !== "-" && d.workHours !== "00:00" ? `${d.workHours} hrs` : "00:00 hrs"}
                    </td>
                    {onSingleEmployeeAction && (
                      <td className="px-3 py-3.5 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded-md text-payroll-primary hover:bg-payroll-primary/10" title="Preview"><Eye className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50" title="Print"><Printer className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded-md text-purple-600 hover:bg-purple-50" title="Export CSV"><Download className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW MODE 2: MATRIX / SUMMARY VIEW */}
      {punchViewMode === "MATRIX" && (
        <>
          {/* Format 1: DEVICE_PUNCH Grid Matrix */}
          {activeFormat === "DEVICE_PUNCH" && (
            <div className="overflow-x-auto rounded-xl border border-payroll-light bg-white shadow-payroll-sm max-h-150 overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-none">
              <table className="w-full text-left text-xs text-payroll-navy border-collapse min-w-max">
                <thead className="sticky top-0 z-10 border-b border-payroll-light bg-payroll-cream font-bold uppercase tracking-wider text-gray-600 text-[10px]">
                  <tr>
                    <th rowSpan={2} className="px-3 py-2 text-center border-r border-payroll-light sticky left-0 z-20 bg-payroll-cream">SN</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-payroll-light min-w-36 sticky left-8 z-20 bg-payroll-cream">Name</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-payroll-light">Department</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-payroll-light">Position</th>
                    {activeDateHeaders.map((dh) => (
                      <th key={dh.dayNum} colSpan={3} className="px-2 py-1 text-center border-r border-b border-payroll-light bg-green-50/50 min-w-44">
                        {calendarType === "BS" ? `Day ${dh.dayNum} (${dh.dayName})` : `${dh.dateStrAD} (${dh.dayName})`}
                      </th>
                    ))}
                    <th rowSpan={2} className="px-3 py-2 text-center border-r border-payroll-light bg-emerald-50 text-emerald-900 font-bold min-w-32">
                      Total (Working Hours)
                    </th>
                    {onSingleEmployeeAction && (
                      <th rowSpan={2} className="px-3 py-2 text-center print:hidden">Actions</th>
                    )}
                  </tr>
                  <tr>
                    {activeDateHeaders.map((dh) => (
                      <React.Fragment key={`sub-${dh.dayNum}`}>
                        <th className="px-1.5 py-1 text-[9px] text-gray-500 border-r border-payroll-light bg-payroll-cream">In Time</th>
                        <th className="px-1.5 py-1 text-[9px] text-gray-500 border-r border-payroll-light bg-payroll-cream">Out Time</th>
                        <th className="px-1.5 py-1 text-[9px] text-gray-500 border-r border-payroll-light bg-green-50/20">Total Hour</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-payroll-light/60">
                  {filteredRows.map((row, idx) => {
                    const activeDetails = (row.dailyDetails || []).filter((d) => d.dayNum >= fromDay && d.dayNum <= toDay);
                    return (
                      <tr key={idx} className="hover:bg-payroll-cream/80 transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-medium border-r border-payroll-light/60 sticky left-0 z-10 bg-white">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-payroll-navy border-r border-payroll-light/60 sticky left-8 z-10 bg-white">
                          {row.employeeName}
                        </td>
                        <td className="px-3 py-2 text-gray-600 border-r border-payroll-light/60">{row.departmentName}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-payroll-light/60">{row.designationName}</td>
                        {activeDetails.map((d, dIdx) => (
                          <React.Fragment key={dIdx}>
                            <td className="px-1.5 py-2 text-center text-[10px] font-mono text-gray-600 border-r border-payroll-light/60">
                              {d.inTime && d.inTime !== "-" ? d.inTime : "-"}
                            </td>
                            <td className="px-1.5 py-2 text-center text-[10px] font-mono text-gray-600 border-r border-payroll-light/60">
                              {d.outTime && d.outTime !== "-" ? d.outTime : "-"}
                            </td>
                            <td className="px-1.5 py-2 text-center text-[10px] font-mono font-semibold text-payroll-navy bg-green-50/10 border-r border-payroll-light/60">
                              {d.workHours && d.workHours !== "-" && d.workHours !== "00:00" ? d.workHours : "00:00"}
                            </td>
                          </React.Fragment>
                        ))}
                        <td className="px-3 py-2 text-center tabular-nums font-bold text-emerald-800 bg-emerald-50/30 border-r border-payroll-light/60 font-mono">
                          {row.totalWorkHours || "00:00"}
                        </td>
                        {onSingleEmployeeAction && (
                          <td className="px-3 py-2 text-center print:hidden">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded-md text-payroll-primary hover:bg-payroll-primary/10"><Eye className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50"><Printer className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded-md text-purple-600 hover:bg-purple-50"><Download className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Format 2: STATUS_MATRIX Table View */}
          {activeFormat === "STATUS_MATRIX" && (
            <div className="overflow-x-auto rounded-xl border border-payroll-light bg-white shadow-payroll-sm max-h-150 overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-none">
              <table className="w-full text-left text-xs text-payroll-navy border-collapse min-w-max">
                <thead className="sticky top-0 z-10 border-b border-payroll-light bg-payroll-cream font-bold uppercase tracking-wider text-gray-600 text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5 text-center border-r border-payroll-light sticky left-0 z-20 bg-payroll-cream">SN</th>
                    <th className="px-3 py-2.5 border-r border-payroll-light min-w-36 sticky left-8 z-20 bg-payroll-cream">Name</th>
                    <th className="px-3 py-2.5 border-r border-payroll-light">Department</th>
                    <th className="px-3 py-2.5 border-r border-payroll-light">Position</th>
                    {activeDateHeaders.map((dh) => (
                      <th key={dh.dayNum} className="px-1.5 py-2.5 text-center border-r border-payroll-light min-w-8">
                        {calendarType === "BS" ? dh.dayNum : dh.dateStrAD.split(" ")[1]}
                      </th>
                    ))}
                    <th className="px-2.5 py-2.5 text-center border-r border-payroll-light bg-emerald-50 text-emerald-800">Total Attend</th>
                    <th className="px-2.5 py-2.5 text-center border-r border-payroll-light bg-green-50 text-green-800">Total Leave</th>
                    <th className="px-2.5 py-2.5 text-center border-r border-payroll-light bg-red-50 text-red-800">Total Absent</th>
                    <th className="px-2.5 py-2.5 text-center border-r border-payroll-light bg-amber-50 text-amber-800">Total LWOP</th>
                    {onSingleEmployeeAction && (
                      <th className="px-3 py-2.5 text-center print:hidden">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-payroll-light/60 text-[11px]">
                  {filteredRows.map((row, idx) => {
                    const activeDetails = (row.dailyDetails || []).filter((d) => d.dayNum >= fromDay && d.dayNum <= toDay);
                    let rangePresent = 0;
                    let rangeLeave = 0;
                    let rangeAbsent = 0;
                    let rangeLwop = 0;

                    activeDetails.forEach((d) => {
                      const st = d.statusCode || "P";
                      if (st === "P" || st === "HD") rangePresent += st === "HD" ? 0.5 : 1;
                      else if (st === "L") rangeLeave += 1;
                      else if (st === "A") rangeAbsent += 1;
                      else if (st === "LWOP") rangeLwop += 1;
                    });

                    return (
                      <tr key={idx} className="hover:bg-payroll-cream/80 transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-medium border-r border-payroll-light/60 sticky left-0 z-10 bg-white">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-payroll-navy border-r border-payroll-light/60 sticky left-8 z-10 bg-white">{row.employeeName}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-payroll-light/60">{row.departmentName}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-payroll-light/60">{row.designationName}</td>
                        {activeDetails.map((d, dIdx) => {
                          const st = d.statusCode || "-";
                          const badgeClass =
                            st === "P" ? "bg-emerald-100 text-emerald-800" :
                            st === "A" ? "bg-red-100 text-red-800 font-bold" :
                            st === "L" ? "bg-green-100 text-green-800" :
                            st === "HD" ? "bg-amber-100 text-amber-800" :
                            st === "OFF" ? "bg-slate-100 text-slate-700" :
                            st === "HO" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-400";
                          return (
                            <td key={dIdx} className="px-1 py-2 text-center border-r border-payroll-light/60">
                              <span className={`inline-block w-6 py-0.5 text-[9px] font-bold rounded ${badgeClass}`}>
                                {st}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-2.5 py-2 text-center font-bold font-mono text-emerald-700 bg-emerald-50/30 border-r border-payroll-light/60">{rangePresent}</td>
                        <td className="px-2.5 py-2 text-center font-semibold font-mono text-green-700 bg-green-50/20 border-r border-payroll-light/60">{rangeLeave}</td>
                        <td className="px-2.5 py-2 text-center font-bold font-mono text-red-600 bg-red-50/30 border-r border-payroll-light/60">{rangeAbsent}</td>
                        <td className="px-2.5 py-2 text-center font-semibold font-mono text-amber-700 bg-amber-50/20 border-r border-payroll-light/60">{rangeLwop}</td>
                        {onSingleEmployeeAction && (
                          <td className="px-3 py-2 text-center print:hidden">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded-md text-payroll-primary hover:bg-payroll-primary/10"><Eye className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50"><Printer className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded-md text-purple-600 hover:bg-purple-50"><Download className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Format 3: STATUTORY_SUMMARY Table View */}
          {activeFormat === "STATUTORY_SUMMARY" && (
            <div className="overflow-x-auto rounded-xl border border-payroll-light bg-white shadow-sm max-h-150 overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-none">
              <table className="w-full text-left text-xs text-payroll-navy border-collapse">
                <thead className="sticky top-0 z-10 border-b border-payroll-light bg-payroll-cream font-bold uppercase tracking-wider text-gray-600 text-[10px]">
                  <tr>
                    <th className="px-3 py-3 text-center border-r border-payroll-light">SN</th>
                    <th className="px-3 py-3 border-r border-payroll-light">Code</th>
                    <th className="px-3 py-3 border-r border-payroll-light min-w-35">Employee Name</th>
                    <th className="px-3 py-3 border-r border-payroll-light">Department</th>
                    <th className="px-3 py-3 border-r border-payroll-light">Position</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-center">Working Days</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-center bg-emerald-50 text-emerald-800">Present</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-center bg-green-50 text-green-800">Pay Leave</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-center bg-amber-50 text-amber-800">Non-Pay Leave</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-center bg-red-50 text-red-800">Absent Days</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-right">Office OT (hrs)</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-right">Off-Day OT (hrs)</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-right font-bold text-emerald-800">OT Earned</th>
                    <th className="px-3 py-3 border-r border-payroll-light text-right font-bold text-red-800">Leave Deduction</th>
                    {onSingleEmployeeAction && (
                      <th className="px-3 py-3 text-center print:hidden min-w-28">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-payroll-light/60">
                  {filteredRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-payroll-cream/80 transition-colors">
                      <td className="px-3 py-2.5 text-center text-gray-400 font-medium border-r border-payroll-light/60">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500 border-r border-payroll-light/60">{row.employeeCode}</td>
                      <td className="px-3 py-2.5 font-semibold text-payroll-navy border-r border-payroll-light/60">{row.employeeName}</td>
                      <td className="px-3 py-2.5 text-gray-500 border-r border-payroll-light/60 text-[11px]">{row.departmentName}</td>
                      <td className="px-3 py-2.5 text-gray-500 border-r border-payroll-light/60 text-[11px]">{row.designationName}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold border-r border-payroll-light/60">{row.totalWorkingDays}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-bold text-emerald-700 bg-emerald-50/30 border-r border-payroll-light/60">{row.presentDays}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-green-700 bg-green-50/20 border-r border-payroll-light/60">{row.payLeaveDays}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-amber-700 bg-amber-50/20 border-r border-payroll-light/60">{row.nonPayLeaveDays}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-bold text-red-600 bg-red-50/30 border-r border-payroll-light/60">{row.absentDays}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums border-r border-payroll-light/60">{row.totalOtHoursOffice}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums border-r border-payroll-light/60">{row.totalOtHoursOff}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700 border-r border-payroll-light/60">
                        NPR {Number(row.otEarnedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-red-600 border-r border-payroll-light/60">
                        NPR {Number(row.leaveDeductionAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      {onSingleEmployeeAction && (
                        <td className="px-3 py-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "preview")} className="p-1 rounded-md text-payroll-primary hover:bg-payroll-primary/10" title={`Preview attendance for ${row.employeeName}`}><Eye className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "print")} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50" title={`Print attendance for ${row.employeeName}`}><Printer className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => onSingleEmployeeAction(row, "export")} className="p-1 rounded-md text-purple-600 hover:bg-purple-50" title={`Export CSV for ${row.employeeName}`}><Download className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
