"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttendanceRecord, AttendanceFormData, AttendanceStatus } from "@/lib/types/attendance";
import { calculateWorkHours, evaluateLateArrival } from "@/lib/engines/attendance.engine";

interface AttendanceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: AttendanceFormData) => void;
  initialData: AttendanceRecord | null;
  employees: { id: string; fullName: string; attendanceCode: string }[];
  selectedDate: string;
}

export function AttendanceFormModal({
  open,
  onClose,
  onSave,
  initialData,
  employees,
  selectedDate,
}: AttendanceFormModalProps) {
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

  const handleSave = () => {
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
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initialData ? "Edit Daily Punch Record" : "Log Daily Attendance Punch"}
      description="Manually record or override punch timings, work hours, and statutory overtime."
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {date} • Status: {status}
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
              onClick={handleSave}
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm"
            >
              Save Punch
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 1: Staff & Status */}
        <FormSection
          title="Staff & Status"
          description="Identify the staff member, calendar date, and the attendance classification."
          isFirst
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Staff Member <span className="text-red-500">*</span>
              </label>
              <select
                disabled={!!initialData}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.attendanceCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Punch Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Attendance Status <span className="text-red-500">*</span>
                </label>
                <select
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
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
          </div>
        </FormSection>

        {/* Section 2: Punch Timings & Work Hours */}
        <FormSection
          title="Punch Clock & Computation"
          description="Specify in/out timestamps, standard working hours, and any applicable overtime."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  In Time (hh:mm AM/PM)
                </label>
                <input
                  type="text"
                  placeholder="09:00 AM"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  value={inTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInTime(val);
                    recompute(val, outTime, status);
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Out Time (hh:mm AM/PM)
                </label>
                <input
                  type="text"
                  placeholder="05:00 PM"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  value={outTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOutTime(val);
                    recompute(inTime, val, status);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Work Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  value={workHours}
                  onChange={(e) => setWorkHours(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  OT (Office Day)
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  value={otOffice}
                  onChange={(e) => setOtOffice(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  OT (Off Day / Holiday)
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  value={otOff}
                  onChange={(e) => setOtOff(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="pt-1">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                  isLate
                    ? "border-amber-500 bg-amber-50/50 text-amber-900"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                )}
              >
                <input
                  type="checkbox"
                  id="isLateCheck"
                  checked={isLate}
                  onChange={(e) => setIsLate(e.target.checked)}
                  className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Flag as Late Arrival (exceeded 40-minute grace window)</span>
              </label>
            </div>
          </div>
        </FormSection>

        {/* Section 3: Justification Remarks */}
        <FormSection
          title="Justification Remarks"
          description="Document operational reasoning or supervisor reference for this manual entry."
        >
          <div>
            <textarea
              rows={2}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary resize-y"
              placeholder="Reason for manual override or log correction..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </FormSection>
      </div>
    </Dialog>
  );
}

function FormSection({
  title,
  description,
  children,
  isFirst = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-3", !isFirst && "pt-5 border-t border-zinc-200")}>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h4>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}