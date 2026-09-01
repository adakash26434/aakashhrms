"use client";

import { SidePanel } from "@/components/ui/side-panel";
import { Clock, ShieldCheck, AlertTriangle, User, FileText } from "lucide-react";
import type { AttendanceRecord } from "@/lib/types/attendance";

interface AttendanceDetailPanelProps {
  open: boolean;
  record: AttendanceRecord | null;
  onClose: () => void;
}

export function AttendanceDetailPanel({ open, record, onClose }: AttendanceDetailPanelProps) {
  if (!record) return null;

  return (
    <SidePanel open={open} onClose={onClose} header="Attendance Punch Audit">
      <div className="space-y-6 text-sm">
        <div className="rounded-xl bg-[#d7e8d0]/30 p-4 border border-[#d7e8d0]">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#2e7d32] p-3 text-white font-bold">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-[#1b3a1f] text-base">{record.employeeName}</h3>
              <p className="font-mono text-xs text-gray-600">{record.attendanceCode} • {record.departmentName}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-[#1b3a1f] flex items-center gap-1.5 border-b pb-1">
            <Clock className="h-4 w-4 text-[#2e7d32]" /> Punch Timestamps & Hours
          </h4>
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border">
            <div>
              <span className="text-xs text-gray-500 block">Check-In Time:</span>
              <span className="font-mono font-bold text-[#1b3a1f]">{record.inTime || "Not Punched"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Check-Out Time:</span>
              <span className="font-mono font-bold text-[#1b3a1f]">{record.outTime || "Not Punched"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Total Work Hours:</span>
              <span className="font-bold text-emerald-600">{record.workHours} hrs</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Total OT Earned:</span>
              <span className="font-bold text-[#2e7d32]">+{record.otHoursOfficeDay + record.otHoursOffDay} hrs</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-[#1b3a1f] flex items-center gap-1.5 border-b pb-1">
            <ShieldCheck className="h-4 w-4 text-[#2e7d32]" /> Statutory Compliance Flags
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
              <span className="text-gray-600 font-medium">40-Minute Grace Window Status:</span>
              {record.isLate ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  <AlertTriangle className="h-3 w-3" /> Exceeded (Late)
                </span>
              ) : (
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">On Time / Valid</span>
              )}
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
              <span className="text-gray-600 font-medium">Entry Source:</span>
              <span className="font-mono text-gray-800">{record.isManualEntry ? "HR Manual Override" : "Biometric Device API"}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
              <span className="text-gray-600 font-medium">Payroll Lock Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${record.isLocked ? "bg-rose-100 text-rose-800" : "bg-gray-100 text-gray-700"}`}>
                {record.isLocked ? "LOCKED (Immutable)" : "Open / Editable"}
              </span>
            </div>
            {Number(record.otHoursOfficeDay) + Number(record.otHoursOffDay) > 4 && (
              <div className="flex flex-col gap-1 p-2.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-800 mt-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>Statutory Overtime Warning</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-normal">
                  Total OT hours for this day ({Number(record.otHoursOfficeDay) + Number(record.otHoursOffDay)} hrs) exceeds the legal limit of 4 hours/day under Nepal's Labour Act.
                </p>
              </div>
            )}
          </div>
        </div>

        {record.remarks && (
          <div className="space-y-1">
            <h4 className="font-semibold text-[#1b3a1f] text-xs flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-gray-400" /> Override Remarks / Audit Note:
            </h4>
            <div className="p-3 rounded-lg bg-gray-50 border text-xs text-gray-700 italic">
              &quot;{record.remarks}&quot;
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
}