"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, Edit3, Check, ChevronDown, ChevronUp } from "lucide-react";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { cn } from "@/lib/utils";

interface PayrollPeriodSummaryBarProps {
  payPeriodMonth: number;
  setPayPeriodMonth: (val: number) => void;
  payPeriodYear: number;
  setPayPeriodYear: (val: number) => void;
  payslipMonth: number;
  setPayslipMonth: (val: number) => void;
  payslipDate: string;
  setPayslipDate: (val: string) => void;
  fiscalMonths: Array<{ value: number; label: string }>;
  currentYear: number;
}

export function PayrollPeriodSummaryBar({
  payPeriodMonth,
  setPayPeriodMonth,
  payPeriodYear,
  setPayPeriodYear,
  payslipMonth,
  setPayslipMonth,
  payslipDate,
  setPayslipDate,
  fiscalMonths,
  currentYear,
}: PayrollPeriodSummaryBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthName = BS_MONTHS_EN[payPeriodMonth] ?? `Month ${payPeriodMonth}`;
  const payslipMonthName = BS_MONTHS_EN[payslipMonth] ?? `Month ${payslipMonth}`;
  const nextYearSuffix = String(payPeriodYear + 1).slice(-2);
  const fyLabel = `FY ${payPeriodYear}/${nextYearSuffix}`;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsEditing(false);
      }
    }
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isEditing) {
        setIsEditing(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-xl border bg-white shadow-xs transition-all",
        isEditing
          ? "border-payroll-primary ring-2 ring-payroll-primary/10 shadow-sm"
          : "border-payroll-light/90 hover:border-payroll-primary/40"
      )}
    >
      {/* 1-Line Compact Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-payroll-navy">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-payroll-primary/10 text-payroll-primary">
            <Calendar className="h-4 w-4" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-payroll-navy text-[13px]">
              {monthName} {payPeriodYear} BS
            </span>
            <span className="text-gray-300">·</span>
            <span className="rounded-md bg-payroll-cream px-2 py-0.5 font-bold font-mono text-payroll-primary text-[11px] border border-payroll-light/80">
              {fyLabel}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-600">
              Payslip Date: <strong className="font-mono text-payroll-navy">{payslipDate}</strong>
            </span>
            <span className="text-gray-300 hidden md:inline">·</span>
            <span className="text-[11px] text-gray-400 hidden md:inline">
              Cut-off: 1st of {monthName} to month-end
            </span>
          </div>
        </div>

        {/* Edit Period Trigger */}
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none",
            isEditing
              ? "bg-payroll-primary text-white shadow-xs"
              : "border border-payroll-light/80 bg-payroll-cream/50 text-payroll-navy hover:bg-payroll-primary hover:text-white hover:border-payroll-primary"
          )}
        >
          {isEditing ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Done</span>
              <ChevronUp className="h-3 w-3 ml-0.5" />
            </>
          ) : (
            <>
              <Edit3 className="h-3 w-3 text-payroll-primary" />
              <span>Edit Period</span>
              <ChevronDown className="h-3 w-3 ml-0.5 text-gray-400" />
            </>
          )}
        </button>
      </div>

      {/* Expandable Period Editor Panel */}
      {isEditing && (
        <div className="border-t border-payroll-light/70 bg-payroll-cream/30 p-4 animate-[fadeIn_150ms_ease-out]">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {/* Month Selection */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Payroll Month (BS)
              </label>
              <select
                value={payPeriodMonth}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPayPeriodMonth(val);
                  setPayslipMonth(val);
                }}
                className="w-full rounded-lg border border-payroll-light bg-white px-3 py-2 text-xs font-semibold text-payroll-navy shadow-xs outline-none transition-all focus:border-payroll-primary"
              >
                {fiscalMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} (Month {m.value})
                  </option>
                ))}
              </select>
            </div>

            {/* Payslip Month */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Payslip Month
              </label>
              <select
                value={payslipMonth}
                onChange={(e) => setPayslipMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-payroll-light bg-white px-3 py-2 text-xs font-semibold text-payroll-navy shadow-xs outline-none transition-all focus:border-payroll-primary"
              >
                {fiscalMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payslip Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Payslip Date (AD)
              </label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={payslipDate}
                  onChange={(e) => setPayslipDate(e.target.value)}
                  className="w-full rounded-lg border border-payroll-light bg-white pl-3 pr-8 py-2 text-xs text-payroll-navy shadow-xs outline-none transition-all focus:border-payroll-primary tabular-nums"
                />
              </div>
            </div>

            {/* BS Year Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                BS Fiscal Year
              </label>
              <select
                value={payPeriodYear}
                onChange={(e) => setPayPeriodYear(Number(e.target.value))}
                className="w-full rounded-lg border border-payroll-light bg-white px-3 py-2 text-xs font-semibold text-payroll-navy shadow-xs outline-none transition-all focus:border-payroll-primary font-mono"
              >
                {Array.from({ length: 9 }, (_, i) => currentYear - 4 + i).map((y) => (
                  <option key={y} value={y}>
                    {y} BS {y === currentYear ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-payroll-light/50 pt-2.5 text-[11px] text-gray-500">
            <span>
              Configured: <strong>{monthName} {payPeriodYear}</strong> · Payslip registered on <strong>{payslipMonthName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-bold text-payroll-primary hover:underline cursor-pointer"
            >
              Apply & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
