"use client";

import { OnboardingStep4LeaveOtInput } from "@/lib/types/onboarding";
import { Clock, Palmtree, Scale, CheckCircle2, Shield } from "lucide-react";

interface Step4Props {
  data: OnboardingStep4LeaveOtInput;
  onChange: (data: OnboardingStep4LeaveOtInput) => void;
}

export function Step4LeaveOt({ data, onChange }: Step4Props) {
  const handleMultiplierChange = (val: number) => {
    onChange({ ...data, otHourlyMultiplier: val });
  };

  return (
    <div className="space-y-6">
      {/* ── Section A: Nepal Labour Act 2074 Statutory Leave Package ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-payroll-primary" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Nepal Labour Act 2074 Statutory Leave Allotments
            </h4>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
            Statutory Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.leaveTypes.map((lt, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    {lt.name}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    {lt.code} • {lt.category}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-payroll-primary bg-payroll-cream px-2 py-0.5 rounded-lg border border-payroll-light">
                    {lt.daysPerYear} days / yr
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500 flex-wrap">
                {lt.isEncashable ? (
                  <span className="text-emerald-700 font-medium">
                    ✓ Encashable (up to {lt.maxAccumulation}d)
                  </span>
                ) : (
                  <span>Non-encashable</span>
                )}
                <span>•</span>
                <span>{lt.isPaid ? "Fully Paid" : "Unpaid"}</span>
                {lt.genderSpecific && lt.genderSpecific !== "All" && (
                  <>
                    <span>•</span>
                    <span className="text-purple-700 font-medium">
                      {lt.genderSpecific} Only
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section B: Overtime Calculation Rate ── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Clock className="h-4 w-4 text-payroll-primary" />
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Overtime Calculation Rate (Labour Act Minimum: 1.5x)
            </h4>
            <p className="text-[11px] text-gray-500">
              Multiplier applied to the employee's basic hourly wage for
              overtime hours.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              value: 1.5,
              label: "1.5x Hourly Rate",
              badge: "Statutory Standard",
              desc: "Standard statutory overtime rate as per Nepal Labour Act Section 31.",
            },
            {
              value: 1.75,
              label: "1.75x Hourly Rate",
              badge: "Enhanced Policy",
              desc: "Higher compensatory overtime rate for technical or shift workers.",
            },
            {
              value: 2.0,
              label: "2.0x Double Rate",
              badge: "Executive / Premium",
              desc: "Double rate compensation for night shift and national holiday work.",
            },
          ].map((opt) => {
            const isSelected = data.otHourlyMultiplier === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => handleMultiplierChange(opt.value)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? "border-payroll-primary bg-[#f4f9f4] shadow-sm ring-1 ring-payroll-primary"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold ${isSelected ? "text-payroll-navy" : "text-gray-900"}`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    {opt.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
