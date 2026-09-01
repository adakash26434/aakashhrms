"use client";

import { Edit2, Trash2, Lock, Clock, AlertTriangle } from "lucide-react";
import type { AttendanceRecord } from "@/lib/types/attendance";

interface AttendanceTableProps {
  records: AttendanceRecord[];
  onSelect: (record: AttendanceRecord) => void;
  onEdit: (record: AttendanceRecord) => void;
  onDelete: (id: string) => void;
}

export function AttendanceTable({ records, onSelect, onEdit, onDelete }: AttendanceTableProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
        <Clock className="h-10 w-10 text-gray-300" />
        <p className="mt-2 font-medium">No attendance records found for this date.</p>
        <p className="text-xs text-gray-400">Use &quot;Daily Bulk Entry&quot; or &quot;Log Single Punch&quot; to record attendance.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#f6faf6] text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-[#d7e8d0]">
          <tr>
            <th className="p-4">Employee</th>
            <th className="p-4">Attendance Code</th>
            <th className="p-4">Department</th>
            <th className="p-4">Status</th>
            <th className="p-4">In / Out Time</th>
            <th className="p-4">Work Hrs</th>
            <th className="p-4">OT Hrs</th>
            <th className="p-4">Flags</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d7e8d0]/60">
          {records.map((r) => (
            <tr key={r.id} className="hover:bg-[#f6faf6]/40 cursor-pointer transition-colors" onClick={() => onSelect(r)}>
              <td className="p-4 font-semibold text-[#1b3a1f]">{r.employeeName}</td>
              <td className="p-4 font-mono text-xs text-gray-600">{r.attendanceCode}</td>
              <td className="p-4 text-gray-600">{r.departmentName}</td>
              <td className="p-4">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === "Present" ? "bg-emerald-100 text-emerald-800" :
                  r.status === "Absent" || r.status === "LWOP" ? "bg-rose-100 text-rose-800" :
                  "bg-amber-100 text-amber-800"
                }`}>
                  {r.status}
                </span>
              </td>
              <td className="p-4 text-xs font-mono text-gray-700">
                {r.inTime || "—"} / {r.outTime || "—"}
              </td>
              <td className="p-4 font-semibold text-[#1b3a1f]">{r.workHours}</td>
              <td className="p-4">
                {(r.otHoursOfficeDay > 0 || r.otHoursOffDay > 0) ? (
                  <span className="inline-flex items-center gap-1 rounded bg-[#2e7d32]/10 px-2 py-0.5 text-xs font-bold text-[#2e7d32]">
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
                    className={`rounded p-1.5 ${r.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-gray-100 hover:text-[#2e7d32]"}`}
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