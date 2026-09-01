"use client";

import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
}: NumberFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-gray-600"
      >
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-gray-400">
            {prefix}
          </span>
        )}
        <NumberInput
          id={id}
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className={
            prefix
              ? "w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 pl-12 pr-12 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              : suffix
                ? "w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 pr-12 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
                : "w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
          }
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatutoryDeductionLimitsCard({
  value,
  onChange,
}: StatutoryDeductionLimitsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7e8d0]/70">
            <ShieldCheck className="h-5 w-5 text-[#2e7d32]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1b3a1f]">
              Statutory Deduction Limits
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              PF, SSF, CIT and retirement fund thresholds
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            id="pf-max-limit"
            label="PF Maximum Limit"
            value={value.pfMaximumLimitPercent}
            onChange={(n) => onChange({ ...value, pfMaximumLimitPercent: n })}
            suffix="%"
            min={0}
            max={100}
          />
          <NumberField
            id="cit-limit"
            label="CIT Limit"
            value={value.citLimitNpr}
            onChange={(n) => onChange({ ...value, citLimitNpr: n })}
            prefix="NPR"
            min={0}
          />
          <NumberField
            id="retirement-fund-limit"
            label="Retirement Fund Limit"
            value={value.retirementFundLimitNpr}
            onChange={(n) => onChange({ ...value, retirementFundLimitNpr: n })}
            prefix="NPR"
            min={0}
          />
          <NumberField
            id="handicapped-deduction"
            label="Handicapped Deduction"
            value={value.handicappedDeductionPercent}
            onChange={(n) =>
              onChange({ ...value, handicappedDeductionPercent: n })
            }
            suffix="%"
            min={0}
            max={100}
          />
        </div>

        <div className="h-px w-full bg-[#d7e8d0]/60" />

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#d7e8d0]/60 bg-[#f6faf6] p-3">
          <div>
            <p className="text-sm font-medium text-[#1b3a1f]">
              Company has SSF
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              If enabled, PF 1% employee contribution is redirected to SSF
            </p>
          </div>
          <Toggle
            checked={value.companyHasSsf}
            onChange={(next) => onChange({ ...value, companyHasSsf: next })}
            label=""
          />
        </div>
      </CardContent>
    </Card>
  );
}
