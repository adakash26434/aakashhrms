"use client";

import { OnboardingStep5PayHeadsInput } from "@/lib/types/onboarding";
import {
  Coins,
  Percent,
  FileCheck2,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
} from "lucide-react";

interface Step5Props {
  data: OnboardingStep5PayHeadsInput;
  onChange: (data: OnboardingStep5PayHeadsInput) => void;
  fiscalYearLabel?: string;
}

export function Step5PayHeadsTax({ data, fiscalYearLabel }: Step5Props) {
  const earnings = data.payHeads.filter((p) => p.type === "EARNING");
  const deductions = data.payHeads.filter((p) => p.type === "DEDUCTION");

  return (
    <div className="space-y-6">
      {/* ── Section A: Standard Nepal Pay Heads ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Earnings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Standard Earnings ({earnings.length})
            </h4>
          </div>

          <div className="space-y-2">
            {earnings.map((ph, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    {ph.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {ph.code} • Basic Salary Component
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                  Taxable
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deductions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <ArrowDownRight className="h-4 w-4 text-amber-600" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Statutory Deductions ({deductions.length})
            </h4>
          </div>

          <div className="space-y-2">
            {deductions.map((ph, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    {ph.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {ph.code} •{" "}
                    {ph.isSsfHead
                      ? "Govt SSF Scheme (11% + 20%)"
                      : ph.isPfHead
                        ? "Provident Fund (10% + 10%)"
                        : ph.isCitHead
                          ? "Citizen Investment Trust"
                          : ph.isTdsHead
                            ? "Inland Revenue TDS"
                            : "Deduction"}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                  Pre-Tax Deductible
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section B: Nepal IRD Income Tax Slabs (Annex-10) ── */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-payroll-primary" />
            <div>
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Nepal IRD Progressive Income Tax Slabs ({fiscalYearLabel || "Active Cycle"})
              </h4>
              <p className="text-[11px] text-gray-500">
                Statutory personal income tax rates (Nepal Income Tax Act 2058 / Finance Act).
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-payroll-cream border border-payroll-light text-[11px] text-payroll-navy">
            <SlidersHorizontal className="h-3 w-3 text-payroll-primary" />
            <span>Customizable in <strong>Setup → Tax Rates</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Unmarried Slabs */}
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200 text-xs">
            <h5 className="font-bold text-gray-900 mb-2">
              Unmarried (Single) Individual
            </h5>
            <ul className="space-y-1 text-[11px] text-gray-600">
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>First NPR 500,000</span>
                <strong className="text-gray-900">1% (SST)</strong>
              </li>
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>Next NPR 200,000 (500K - 700K)</span>
                <strong className="text-gray-900">10%</strong>
              </li>
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>Next NPR 300,000 (700K - 1M)</span>
                <strong className="text-gray-900">20%</strong>
              </li>
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>Next NPR 1,000,000 (1M - 2M)</span>
                <strong className="text-gray-900">30%</strong>
              </li>
              <li className="flex justify-between py-1">
                <span>Above NPR 2,000,000</span>
                <strong className="text-gray-900">36%</strong>
              </li>
            </ul>
          </div>

          {/* Married Slabs */}
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200 text-xs">
            <h5 className="font-bold text-gray-900 mb-2">Married Couple</h5>
            <ul className="space-y-1 text-[11px] text-gray-600">
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>First NPR 600,000</span>
                <strong className="text-gray-900">1% (SST)</strong>
              </li>
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>Next NPR 200,000 (600K - 800K)</span>
                <strong className="text-gray-900">10%</strong>
              </li>
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>Next NPR 300,000 (800K - 1.1M)</span>
                <strong className="text-gray-900">20%</strong>
              </li>
              <li className="flex justify-between py-1 border-b border-gray-200/60">
                <span>Next NPR 900,000 (1.1M - 2M)</span>
                <strong className="text-gray-900">30%</strong>
              </li>
              <li className="flex justify-between py-1">
                <span>Above NPR 2,000,000</span>
                <strong className="text-gray-900">36%</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
