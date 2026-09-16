"use client";

import { Edit2, Trash2, Lock, Clock, AlertTriangle, FilterX, RotateCcw } from "lucide-react";
import type { AttendanceRecord } from "@/lib/types/attendance";

interface AttendanceTableProps {
  records: AttendanceRecord[];
  totalCountForDate?: number;
  onResetFilters?: () => void;
  onSelect: (record: AttendanceRecord) => void;
  onEdit: (record: AttendanceRecord) => void;
  onDelete: (id: string) => void;
}

export function AttendanceTable({
  records,
  totalCountForDate,
  onResetFilters,
  onSelect,
  onEdit,
  onDelete,
}: AttendanceTableProps) {
  if (records.length === 0) {
    if (totalCountForDate && totalCountForDate > 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
          <div className="rounded-full bg-amber-50 p-3 text-amber-600">
            <FilterX className="h-8 w-8" />
          </div>
          <p className="mt-3 font-semibold text-gray-800">No records match your filter criteria</p>
          <p className="mt-1 text-xs text-gray-500 max-w-sm">
            There are {totalCountForDate} attendance records for this date, but none match your active filters or search terms.
          </p>
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-3 py-1.5 text-xs font-semibold text-payroll-primary hover:bg-payroll-cream shadow-xs transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear all filters ({totalCountForDate} total records)
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
        <Clock className="h-10 w-10 text-gray-300" />
        <p className="mt-2 font-medium">No attendance records found for this date.</p>
        <p className="text-xs text-gray-400">Use &quot;1-Click Bulk Entry&quot; or &quot;Log Single Punch&quot; to record attendance.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-payroll-cream text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-payroll-light">
          <tr>
            <th className="p-4">Employee</th>
            <th className="p-4">Attendance Code</th>
            <th className="p-4">Department / Branch</th>
            <th className="p-4">Status</th>
            <th className="p-4">In / Out Time</th>
            <th className="p-4">Work Hrs</th>
            <th className="p-4">OT Hrs</th>
            <th className="p-4">Flags</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-payroll-light/60">
          {records.map((r) => (
            <tr key={r.id} className="hover:bg-payroll-cream/40 cursor-pointer transition-colors" onClick={() => onSelect(r)}>
              <td className="p-4">
                <div className="font-semibold text-payroll-navy">{r.employeeName}</div>
              </td>
              <td className="p-4 font-mono text-xs text-gray-600">
                <div>{r.attendanceCode}</div>
                {r.employeeCode && r.employeeCode !== r.attendanceCode && (
                  <div className="text-[10px] text-gray-400">Emp: {r.employeeCode}</div>
                )}
              </td>
              <td className="p-4 text-gray-600">
                <div>{r.departmentName}</div>
                {r.branchName && r.branchName !== "—" && (
                  <div className="text-[11px] text-gray-400">{r.branchName}</div>
                )}
              </td>
              <td className="p-4">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === "Present" ? "bg-emerald-100 text-emerald-800" :
                  r.status === "Absent" || r.status === "LWOP" ? "bg-rose-100 text-rose-800" :
                  r.status === "Weekly Off" || r.status === "Holiday" ? "bg-blue-100 text-blue-800" :
                  "bg-amber-100 text-amber-800"
                }`}>
                  {r.status}
                </span>
              </td>
              <td className="p-4 text-xs font-mono text-gray-700">
                {r.inTime || "—"} / {r.outTime || "—"}
              </td>
              <td className="p-4 font-semibold text-payroll-navy">{r.workHours}</td>
              <td className="p-4">
                {(r.otHoursOfficeDay > 0 || r.otHoursOffDay > 0) ? (
                  <span className="inline-flex items-center gap-1 rounded bg-payroll-primary/10 px-2 py-0.5 text-xs font-bold text-payroll-primary">
                    +{r.otHoursOfficeDay + r.otHoursOffDay} hrs
                  </span>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="p-4">
                <div className="flex items-center gap-1.5">
                  {r.isLate && (
                    <span title="Late Arrival" className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> Late
                    </span>
                  )}
                  {r.isLocked && (
                    <span title="Locked for Payroll" className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(r)}
                    disabled={r.isLocked}
                    className={`rounded p-1.5 ${r.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-gray-100 hover:text-payroll-primary"}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={r.isLocked}
                    className={`rounded p-1.5 ${r.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-rose-50 hover:text-rose-600"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}