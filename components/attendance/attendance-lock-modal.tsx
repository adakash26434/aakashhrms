"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, CheckCircle, Calculator } from "lucide-react";

interface AttendanceLockModalProps {
  open: boolean;
  onClose: () => void;
  onRunEngine: (bsMonth: number, datePrefix: string) => void;
  employeesCount: number;
}

export function AttendanceLockModal({ open, onClose, onRunEngine, employeesCount }: AttendanceLockModalProps) {
  const [bsMonth, setBsMonth] = useState(4); // Default Shrawan
  const [datePrefix, setDatePrefix] = useState(new Date().toISOString().substring(0, 7)); // e.g. "2026-07"

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border-t-8 border-amber-500">
        <div className="flex items-center gap-2 text-amber-600">
          <Calculator className="h-6 w-6 shrink-0" />
          <h2 className="text-lg font-bold text-[#1b3a1f]">Pre-Payroll Calculation Engine</h2>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Running this engine aggregates present days, calculates statutory unpaid leave deductions (<span className="font-mono font-bold">LWOP</span>) 
          against Phase 3 salary mappings, computes earned overtime from assigned OT rules, and 
          <span className="font-bold text-amber-700"> LOCKS the period</span> for Phase 6 payslip generation.
        </p>

        <div className="space-y-3 pt-2 text-sm">
          <div>
            <label className="block font-semibold text-gray-700">Select B.S. Pay Month *</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 font-semibold text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none"
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
            <label className="block font-semibold text-gray-700">A.D. Date Range Matcher *</label>
            <input
              type="month"
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 font-mono text-xs text-gray-600 focus:border-[#2e7d32] focus:outline-none"
              value={datePrefix}
              onChange={(e) => setDatePrefix(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-gray-400">Selects all attendance punches matching this year/month prefix.</p>
          </div>

          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2 border border-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <span>
              <strong className="block">Immutability Warning:</strong> Once locked, daily attendance punches for all {employeesCount} active employees become read-only.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onRunEngine(bsMonth, datePrefix)}
            className="bg-amber-600 text-white hover:bg-amber-700 font-semibold"
          >
            <Lock className="h-4 w-4 mr-1.5" /> Run Engine & Lock Period
          </Button>
        </div>
      </div>
    </div>
  );
}