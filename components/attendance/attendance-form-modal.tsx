"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { AttendanceRecord, AttendanceFormData, AttendanceStatus } from "@/lib/types/attendance";
import { calculateWorkHours, evaluateLateArrival } from "@/lib/engines/attendance.engine";

interface AttendanceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: AttendanceFormData) => void;
  initialData: AttendanceRecord | null;
  employees: { id: string; firstName: string; lastName: string; attendanceCode: string }[];
  selectedDate: string;
}

export function AttendanceFormModal({ open, onClose, onSave, initialData, employees, selectedDate }: AttendanceFormModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [status, setStatus] = useState<AttendanceStatus>("Present");
  const [inTime, setInTime] = useState("09:00 AM");
  const [outTime, setOutTime] = useState("05:00 PM");
  const [workHours, setWorkHours] = useState(8);
  const [otOffice, setOtOffice] = useState(0);
  const [otOff, setOtOff] = useState(0);
  const [isLate, setIsLate] = useState(false);
  const [remarks, setRemarks] = useState("");

  const recompute = (currentIn: string, currentOut: string, currentStatus: AttendanceStatus) => {
    const workH = calculateWorkHours(currentIn, currentOut);
    if (workH > 0) {
      setWorkHours(workH);
      
      if (currentStatus === "Present" || currentStatus === "Half Day") {
        setOtOffice(Math.max(0, workH - 8));
        setOtOff(0);
      } else if (currentStatus === "Holiday" || currentStatus === "Weekly Off") {
        setOtOffice(0);
        setOtOff(workH);
      } else {
        setOtOffice(0);
        setOtOff(0);
      }
      
      const late = evaluateLateArrival(currentIn, 9, 0, 40);
      setIsLate(late);
    } else {
      if (currentStatus === "Present") {
        setWorkHours(8);
        setOtOffice(0);
        setOtOff(0);
      } else if (currentStatus === "Half Day") {
        setWorkHours(4);
        setOtOffice(0);
        setOtOff(0);
      } else {
        setWorkHours(0);
        setOtOffice(0);
        setOtOff(0);
      }
      setIsLate(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setEmployeeId(initialData.employeeId);
      setDate(initialData.attendanceDate);
      setStatus(initialData.status);
      setInTime(initialData.inTime || "09:00 AM");
      setOutTime(initialData.outTime || "05:00 PM");
      setWorkHours(initialData.workHours);
      setOtOffice(initialData.otHoursOfficeDay);
      setOtOff(initialData.otHoursOffDay);
      setIsLate(initialData.isLate);
      setRemarks(initialData.remarks || "");
    } else {
      setEmployeeId(employees[0]?.id || "");
      setDate(selectedDate);
      setStatus("Present");
      setInTime("09:00 AM");
      setOutTime("05:00 PM");
      setWorkHours(8);
      setOtOffice(0);
      setOtOff(0);
      setIsLate(false);
      setRemarks("");
    }
  }, [initialData, open, employees, selectedDate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-[#1b3a1f]">
          {initialData ? "Edit Daily Punch Record" : "Log Daily Attendance Punch"}
        </h2>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block font-medium text-gray-700">Employee *</label>
            <select
              disabled={!!initialData}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2e7d32] focus:outline-none"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.attendanceCode})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">Date *</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2e7d32] focus:outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Status *</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2e7d32] focus:outline-none"
                value={status}
                onChange={(e) => {
                  const s = e.target.value as AttendanceStatus;
                  setStatus(s);
                  recompute(inTime, outTime, s);
                }}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Half Day">Half Day</option>
                <option value="On Leave">On Leave (Paid)</option>
                <option value="LWOP">LWOP (Unpaid Leave)</option>
                <option value="Holiday">Holiday</option>
                <option value="Weekly Off">Weekly Off</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">In Time</label>
              <input
                type="text"
                placeholder="e.g. 09:05 AM"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs focus:border-[#2e7d32] focus:outline-none"
                value={inTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setInTime(val);
                  recompute(val, outTime, status);
                }}
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Out Time</label>
              <input
                type="text"
                placeholder="e.g. 05:15 PM"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs focus:border-[#2e7d32] focus:outline-none"
                value={outTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setOutTime(val);
                  recompute(inTime, val, status);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-gray-700">Work Hours</label>
              <input
                type="number"
                step="0.5"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2e7d32] focus:outline-none"
                value={workHours}
                onChange={(e) => setWorkHours(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">OT (Office Day)</label>
              <input
                type="number"
                step="0.5"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2e7d32] focus:outline-none"
                value={otOffice}
                onChange={(e) => setOtOffice(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">OT (Off Day)</label>
              <input
                type="number"
                step="0.5"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2e7d32] focus:outline-none"
                value={otOff}
                onChange={(e) => setOtOff(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isLateCheck"
              checked={isLate}
              onChange={(e) => setIsLate(e.target.checked)}
              className="rounded border-gray-300 text-[#2e7d32] focus:ring-[#2e7d32]"
            />
            <label htmlFor="isLateCheck" className="text-xs font-medium text-gray-700 cursor-pointer">
              Flag as Late Arrival (exceeded 40-min grace window)
            </label>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Remarks</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[#2e7d32] focus:outline-none"
              placeholder="Reason for manual override..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSave({
                employeeId,
                attendanceDate: date,
                status,
                inTime,
                outTime,
                workHours,
                otHoursOfficeDay: otOffice,
                otHoursOffDay: otOff,
                isLate,
                remarks,
              });
            }}
            className="bg-[#2e7d32] text-white hover:bg-[#1b3a1f]"
          >
            Save Punch
          </Button>
        </div>
      </div>
    </div>
  );
}