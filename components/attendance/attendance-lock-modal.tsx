"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, Calculator } from "lucide-react";
import { getTodayBS } from "@/lib/utils/bs-calendar";

interface AttendanceLockModalProps {
  open: boolean;
  onClose: () => void;
  onRunEngine: (bsMonth: number, datePrefix: string) => void;
  employeesCount: number;
}

export function AttendanceLockModal({
  open,
  onClose,
  onRunEngine,
  employeesCount,
}: AttendanceLockModalProps) {
  const [bsMonth, setBsMonth] = useState(() => getTodayBS().month);
  const [datePrefix, setDatePrefix] = useState(new Date().toISOString().substring(0, 7)); // e.g. "2026-07"

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Monthly Attendance Calculation & Sealing"
      description="Aggregate attendances, compute unpaid leave deductions (LWOP), and review overtime."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            Scope: {employeesCount} employees
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
              onClick={() => {
                onRunEngine(bsMonth, datePrefix);
                onClose();
              }}
              className="rounded-md bg-emerald-950 hover:bg-emerald-900 text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <Lock className="h-4 w-4" />
              Calculate & Seal Period
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-zinc-600 leading-relaxed">
          Aggregates present days, calculates statutory unpaid leave deductions (<span className="font-mono font-semibold text-zinc-900">LWOP</span>) 
          against salary mappings, and computes earned overtime from assigned OT rules.
        </p>

        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900 flex items-start gap-2.5">
          <Calculator className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="block font-semibold text-emerald-950">Automated Payroll Integration:</strong>
            Payroll runs now automatically calculate attendance, leaves, and overtime dynamically in real time and seal records upon final approval. Running manual seal here is optional if you wish to review or lock records beforehand.
          </div>
        </div>

        <div className="space-y-4 pt-1">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Select B.S. Pay Month <span className="text-red-500">*</span>
            </label>
            <select
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
              value={bsMonth}
              onChange={(e) => setBsMonth(Number(e.target.value))}
            >
              <option value={1}>1 - Baisakh (Mid-Apr to Mid-May)</option>
              <option value={2}>2 - Jestha (Mid-May to Mid-Jun)</option>
              <option value={3}>3 - Asar (Mid-Jun to Mid-Jul)</option>
              <option value={4}>4 - Shrawan (Mid-Jul to Mid-Aug) - FY Start</option>
              <option value={5}>5 - Bhadra (Mid-Aug to Mid-Sep)</option>
              <option value={6}>6 - Ashwin (Mid-Sep to Mid-Oct)</option>
              <option value={7}>7 - Kartik (Mid-Oct to Mid-Nov)</option>
              <option value={8}>8 - Mangsir (Mid-Nov to Mid-Dec)</option>
              <option value={9}>9 - Poush (Mid-Dec to Mid-Jan)</option>
              <option value={10}>10 - Magh (Mid-Jan to Mid-Feb)</option>
              <option value={11}>11 - Falgun (Mid-Feb to Mid-Mar)</option>
              <option value={12}>12 - Chaitra (Mid-Mar to Mid-Apr)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              A.D. Date Range Matcher <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
              value={datePrefix}
              onChange={(e) => setDatePrefix(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Matches attendance punches corresponding to this month period.
            </p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong className="block font-semibold">Immutability Notice:</strong>
              Once locked, daily attendance punches for all {employeesCount} active employees become read-only and sealed for payroll.
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}