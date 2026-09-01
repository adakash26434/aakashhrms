"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Clock } from "lucide-react";
import type { AttendanceBulkItem, AttendanceStatus } from "@/lib/types/attendance";

interface AttendanceBulkModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (date: string, items: AttendanceBulkItem[]) => void;
  employees: { id: string; firstName: string; lastName: string; attendanceCode: string; departmentName: string }[];
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

  if (!open) return null;

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
          otHours: nextOtHours
        }
      };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex flex-col h-[85vh] w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1b3a1f]">Daily Bulk Attendance Posting</h2>
            <p className="text-xs text-gray-500">Post attendance for all active employees simultaneously in one atomic batch.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Target Date:</span>
            <input
              type="date"
              className="rounded-lg border border-gray-300 p-1.5 text-xs font-semibold text-[#2e7d32]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 py-3 bg-[#f6faf6] px-4 rounded-lg my-3 border border-[#d7e8d0]">
          <span className="text-xs font-bold text-gray-600">Quick Mark All:</span>
          <Button size="sm" variant="outline" className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-300" onClick={() => setAllStatus("Present")}>
            <Check className="h-3 w-3 mr-1" /> All Present
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs bg-rose-50 text-rose-700 border-rose-300" onClick={() => setAllStatus("Absent")}>
            <X className="h-3 w-3 mr-1" /> All Absent
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs bg-amber-50 text-amber-700 border-amber-300" onClick={() => setAllStatus("Half Day")}>
            <Clock className="h-3 w-3 mr-1" /> All Half Day
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs bg-gray-100 text-gray-700" onClick={() => setAllStatus("Holiday")}>
            Holiday / Off
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#d7e8d0]/60 font-semibold text-gray-700 uppercase">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-24">Work Hrs</th>
                <th className="p-3 w-24">OT Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((e) => {
                const item = items[e.id] || { status: "Present", workHours: 8, otHours: 0 };
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-[#1b3a1f]">{e.firstName} {e.lastName} <span className="font-mono text-[10px] text-gray-500">({e.attendanceCode})</span></td>
                    <td className="p-3 text-gray-600">{e.departmentName}</td>
                    <td className="p-3">
                      <select
                        className={`rounded border p-1 text-xs font-semibold ${
                          item.status === "Present" ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                          item.status === "Absent" || item.status === "LWOP" ? "bg-rose-50 text-rose-800 border-rose-300" : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                        value={item.status}
                        onChange={(ev) => {
                          const st = ev.target.value as AttendanceStatus;
                          updateEmp(e.id, { status: st, workHours: st === "Present" ? 8 : st === "Half Day" ? 4 : 0 });
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
                    <td className="p-3">
                      <input
                        type="number"
                        className="w-16 rounded border p-1 text-center font-mono"
                        value={item.workHours}
                        onChange={(ev) => updateEmp(e.id, { workHours: Number(ev.target.value) })}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        className="w-16 rounded border p-1 text-center font-mono text-[#2e7d32] font-bold"
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

        <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const payload: AttendanceBulkItem[] = Object.entries(items).map(([empId, val]) => ({
                employeeId: empId,
                status: val.status,
                workHours: val.workHours,
                otHoursOfficeDay: val.status === "Holiday" || val.status === "Weekly Off" ? 0 : val.otHours,
                otHoursOffDay: val.status === "Holiday" || val.status === "Weekly Off" ? val.otHours : 0,
                remarks: "Bulk attendance posting",
              }));
              onSave(date, payload);
            }}
            className="bg-[#2e7d32] text-white hover:bg-[#1b3a1f]"
          >
            Post Bulk Attendance ({employees.length} Records)
          </Button>
        </div>
      </div>
    </div>
  );
}