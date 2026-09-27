"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceBulkItem, AttendanceStatus } from "@/lib/types/attendance";

interface AttendanceBulkModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (date: string, items: AttendanceBulkItem[]) => void;
  employees: { id: string; fullName: string; attendanceCode: string; departmentName: string }[];
  selectedDate: string;
}

export function AttendanceBulkModal({ open, onClose, onSave, employees, selectedDate }: AttendanceBulkModalProps) {
  const [date, setDate] = useState(selectedDate);
  const [items, setItems] = useState<Record<string, { status: AttendanceStatus; workHours: number; otHours: number }>>(() => {
    const initial: Record<string, { status: AttendanceStatus; workHours: number; otHours: number }> = {};
    for (const e of employees) {
      initial[e.id] = { status: "Present", workHours: 8, otHours: 0 };
    }
    return initial;
  });

  function setAllStatus(status: AttendanceStatus) {
    setItems((prev) => {
      const next = { ...prev };
      for (const id in next) {
        const nextWorkHours = status === "Present" ? 8 : status === "Half Day" ? 4 : 0;
        const nextOtHours = (status === "Holiday" || status === "Weekly Off") ? nextWorkHours : 0;
        next[id] = { status, workHours: nextWorkHours, otHours: nextOtHours };
      }
      return next;
    });
  }

  function updateEmp(id: string, updates: Partial<{ status: AttendanceStatus; workHours: number; otHours: number }>) {
    setItems((prev) => {
      const current = prev[id] || { status: "Present", workHours: 8, otHours: 0 };
      const nextStatus = updates.status !== undefined ? updates.status : current.status;
      let nextWorkHours = updates.workHours !== undefined ? updates.workHours : current.workHours;
      
      if (updates.status !== undefined && updates.workHours === undefined) {
        nextWorkHours = updates.status === "Present" ? 8 : updates.status === "Half Day" ? 4 : 0;
      }

      let nextOtHours = updates.otHours !== undefined ? updates.otHours : current.otHours;

      if (updates.otHours === undefined) {
        if (nextStatus === "Present" || nextStatus === "Half Day") {
          nextOtHours = Math.max(0, nextWorkHours - 8);
        } else if (nextStatus === "Holiday" || nextStatus === "Weekly Off") {
          nextOtHours = nextWorkHours;
        } else {
          nextOtHours = 0;
        }
      }

      return {
        ...prev,
        [id]: {
          status: nextStatus,
          workHours: nextWorkHours,
          otHours: nextOtHours,
        },
      };
    });
  }

  const handlePost = () => {
    const payload: AttendanceBulkItem[] = Object.entries(items).map(([empId, val]) => ({
      employeeId: empId,
      status: val.status,
      workHours: val.workHours,
      otHoursOfficeDay: val.status === "Holiday" || val.status === "Weekly Off" ? 0 : val.otHours,
      otHoursOffDay: val.status === "Holiday" || val.status === "Weekly Off" ? val.otHours : 0,
      remarks: "Bulk attendance posting",
    }));
    onSave(date, payload);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Daily Bulk Attendance Posting"
      description="Post attendance for all active employees simultaneously in one atomic batch."
      size="4xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            Batch size: {employees.length} records • Effective: {date}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePost}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm"
            >
              Post Bulk Attendance ({employees.length} Records)
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200/80 bg-zinc-50/50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700">Target Date:</span>
            <input
              type="date"
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-zinc-500 mr-1">Quick Mark:</span>
            <button
              type="button"
              onClick={() => setAllStatus("Present")}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100/60 transition-colors"
            >
              <Check className="h-3 w-3" /> All Present
            </button>
            <button
              type="button"
              onClick={() => setAllStatus("Absent")}
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/60 px-2.5 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100/60 transition-colors"
            >
              <X className="h-3 w-3" /> All Absent
            </button>
            <button
              type="button"
              onClick={() => setAllStatus("Half Day")}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100/60 transition-colors"
            >
              <Clock className="h-3 w-3" /> All Half Day
            </button>
            <button
              type="button"
              onClick={() => setAllStatus("Holiday")}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Holiday / Off
            </button>
          </div>
        </div>

        {/* Edge-to-edge Table */}
        <div className="max-h-[50vh] overflow-y-auto border border-zinc-200/80 rounded-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-200 border-b border-zinc-300 text-[11px] font-semibold text-zinc-900 uppercase tracking-wider z-10">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-28 text-center">Work Hrs</th>
                <th className="px-4 py-3 w-28 text-center">OT Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {employees.map((e) => {
                const item = items[e.id] || { status: "Present", workHours: 8, otHours: 0 };
                return (
                  <tr key={e.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {e.fullName} <span className="font-mono text-[11px] text-zinc-400">({e.attendanceCode})</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{e.departmentName}</td>
                    <td className="px-4 py-3">
                      <select
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium outline-none transition-colors",
                          item.status === "Present"
                            ? "bg-emerald-50/70 text-emerald-900 border-emerald-200 focus:border-emerald-700"
                            : item.status === "Absent" || item.status === "LWOP"
                            ? "bg-rose-50/70 text-rose-900 border-rose-200 focus:border-rose-700"
                            : "bg-amber-50/70 text-amber-900 border-amber-200 focus:border-amber-700"
                        )}
                        value={item.status}
                        onChange={(ev) => {
                          const st = ev.target.value as AttendanceStatus;
                          updateEmp(e.id, {
                            status: st,
                            workHours: st === "Present" ? 8 : st === "Half Day" ? 4 : 0,
                          });
                        }}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Half Day">Half Day</option>
                        <option value="On Leave">On Leave</option>
                        <option value="LWOP">LWOP (Unpaid)</option>
                        <option value="Holiday">Holiday</option>
                        <option value="Weekly Off">Weekly Off</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        className="w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 text-center font-mono text-zinc-800 text-xs outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                        value={item.workHours}
                        onChange={(ev) => updateEmp(e.id, { workHours: Number(ev.target.value) })}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        className="w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 text-center font-mono text-zinc-800 text-xs outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                        value={item.otHours}
                        onChange={(ev) => updateEmp(e.id, { otHours: Number(ev.target.value) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}