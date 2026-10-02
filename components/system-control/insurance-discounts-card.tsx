"use client";

import { Lock } from "lucide-react";
import type { InsuranceDiscountsSettings } from "@/lib/types/system-control";
import { NumberInput } from "@/components/ui/number-input";

interface InsuranceDiscountsCardProps {
  value: InsuranceDiscountsSettings;
  onChange: (next: InsuranceDiscountsSettings) => void;
  isSuperAdmin?: boolean;
}

interface FieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  helperText?: string;
  isLocked?: boolean;
}

function Field({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min,
  max,
  disabled,
  helperText,
  isLocked,
}: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-medium text-slate-700">
          {label}
        </label>
        {isLocked && (
          <span
            title="Controlled by tax slab configuration"
            className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-2xs font-medium text-slate-600"
          >
            <Lock className="h-2.5 w-2.5 text-slate-400" />
            Locked
          </span>
        )}
      </div>

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
          disabled={disabled}
          onChange={onChange}
          className={`h-9 w-full rounded-lg border text-xs transition-colors ${
            disabled
              ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed select-none"
              : "border-slate-300 bg-white text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          } ${prefix ? "pl-11 pr-3 font-mono" : suffix ? "pl-3 pr-8 font-mono" : "px-3 font-mono"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">
            {suffix}
          </span>
        )}
      </div>

      {helperText && (
        <p className="text-2xs text-slate-500 leading-normal">{helperText}</p>
      )}
    </div>
  );
}

export function InsuranceDiscountsCard({
  value,
  onChange,
}: InsuranceDiscountsCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Insurance exemptions &amp; tax rebates
            </h3>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-mono font-medium text-slate-600">
              Income Tax Act 2058
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Allowable annual premium exemptions and statutory TDS rebates on taxable payroll.
          </p>
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field
          id="medical-insurance"
          label="Medical insurance deduction"
          value={value.medicalInsuranceNpr}
          onChange={(n) => onChange({ ...value, medicalInsuranceNpr: n })}
          prefix="NPR"
          min={0}
          helperText="Section 12B ceiling (Max NPR 20,000)"
        />
        <Field
          id="life-insurance"
          label="Life insurance deduction"
          value={value.lifeInsuranceNpr}
          onChange={(n) => onChange({ ...value, lifeInsuranceNpr: n })}
          prefix="NPR"
          min={0}
          helperText="Section 12A ceiling (Max NPR 40,000)"
        />
        <Field
          id="house-insurance"
          label="House insurance deduction"
          value={value.houseInsuranceNpr}
          onChange={(n) => onChange({ ...value, houseInsuranceNpr: n })}
          prefix="NPR"
          min={0}
          helperText="Private residential insurance ceiling"
        />
        <Field
          id="remote-allowance"
          label="Remote area allowance"
          value={value.remoteAllowanceNpr}
          onChange={(n) => onChange({ ...value, remoteAllowanceNpr: n })}
          prefix="NPR"
          min={0}
          helperText="Class A-E regional statutory exemption"
        />
        <Field
          id="women-discount"
          label="Women tax rebate"
          value={value.womenDiscountPercent}
          onChange={(n) => onChange({ ...value, womenDiscountPercent: n })}
          suffix="%"
          min={0}
          max={100}
          helperText="Standard 10% statutory TDS rebate for female employees"
        />
        <Field
          id="handicapped-discount"
          label="Disability / handicapped rebate"
          value={0}
          onChange={() => {}}
          suffix="%"
          min={0}
          max={100}
          disabled={true}
          isLocked={true}
          helperText="Managed via separate Handicapped tax slabs in Tax rates."
        />
      </div>
    </div>
  );
}
