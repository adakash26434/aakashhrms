"use client";

import { ShieldCheck } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import type { StatutoryDeductionLimitsSettings } from "@/lib/types/system-control";
import { NumberInput } from "@/components/ui/number-input";

interface StatutoryDeductionLimitsCardProps {
  value: StatutoryDeductionLimitsSettings;
  onChange: (next: StatutoryDeductionLimitsSettings) => void;
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  helper?: string;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min,
  max,
  helper,
}: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-medium text-slate-400">
            {prefix}
          </span>
        )}
        <NumberInput
          id={id}
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className={`h-9 w-full rounded-lg border border-slate-300 bg-white text-xs text-slate-900 transition-colors focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary ${
            prefix ? "pl-11 pr-3 font-mono" : suffix ? "pl-3 pr-8 font-mono" : "px-3 font-mono"
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {helper && <p className="text-2xs text-slate-500">{helper}</p>}
    </div>
  );
}

export function StatutoryDeductionLimitsCard({
  value,
  onChange,
}: StatutoryDeductionLimitsCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Statutory deduction limits
            </h3>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-mono font-medium text-slate-600">
              Labour Act 2074
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ceilings and statutory thresholds for PF, SSF, and retirement contributions.
          </p>
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumberField
          id="pf-max-limit"
          label="PF maximum limit"
          value={value.pfMaximumLimitPercent}
          onChange={(n) => onChange({ ...value, pfMaximumLimitPercent: n })}
          suffix="%"
          min={0}
          max={100}
          helper="Standard 10% employee + 10% employer"
        />
        <NumberField
          id="cit-limit"
          label="CIT annual limit"
          value={value.citLimitNpr}
          onChange={(n) => onChange({ ...value, citLimitNpr: n })}
          prefix="NPR"
          min={0}
          helper="Approved Citizen Investment Trust ceiling"
        />
        <NumberField
          id="retirement-fund-limit"
          label="Retirement fund limit"
          value={value.retirementFundLimitNpr}
          onChange={(n) => onChange({ ...value, retirementFundLimitNpr: n })}
          prefix="NPR"
          min={0}
          helper="Maximum aggregate tax-deductible fund"
        />
      </div>

      {/* SSF Redirection Setting */}
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">
                Social Security Fund (SSF) redirection
              </span>
              <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-1.5 py-0.2 text-2xs font-mono">
                SSF Act 2074
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              When enabled, 1% statutory employee tax contribution redirects to Social Security Fund in accordance with Ministry of Labour regulations.
            </p>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            <Toggle
              checked={value.companyHasSsf}
              onChange={(next) => onChange({ ...value, companyHasSsf: next })}
              label=""
            />
          </div>
        </div>
      </div>

      {/* SSF contribution base */}
      <div className="rounded-lg border border-line bg-surface-sunken/60 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <label htmlFor="ssf-base" className="text-xs font-semibold text-ink">
              SSF contribution base
            </label>
            <p className="max-w-xl text-xs leading-relaxed text-ink-muted">
              What the employee&apos;s 11% and the employer&apos;s 20% (31% deposited) are worked out on. Applies to new and draft payroll runs; locked runs
              are never recalculated.
            </p>
          </div>
          <select
            id="ssf-base"
            value={value.ssfContributionBase === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade"}
            onChange={(e) => onChange({ ...value, ssfContributionBase: e.target.value === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade" })}
            className="h-9 shrink-0 rounded-md border border-line-input bg-white px-2 text-xs text-ink"
          >
            <option value="BasicPlusGrade">Basic + grade (default)</option>
            <option value="BasicSalary">Basic only</option>
          </select>
        </div>
      </div>
    </div>
  );
}
