"use client";

import { HeartPulse, Lock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { InsuranceDiscountsSettings } from "@/lib/types/system-control";
import { NumberInput } from "@/components/ui/number-input";

interface InsuranceDiscountsCardProps {
  value: InsuranceDiscountsSettings;
  onChange: (next: InsuranceDiscountsSettings) => void;
  isSuperAdmin?: boolean;
}

function inputClassName(hasPrefix: boolean, hasSuffix: boolean, disabled?: boolean): string {
  const base = disabled
    ? "w-full rounded-lg border border-gray-200 bg-gray-100 py-2 text-sm text-gray-500 cursor-not-allowed select-none"
    : "w-full rounded-lg border border-payroll-light bg-white py-2 text-sm text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary";
  if (hasPrefix && hasSuffix) return `${base} pl-12 pr-12`;
  if (hasPrefix) return `${base} pl-12 pr-3`;
  if (hasSuffix) return `${base} pl-3 pr-12`;
  return `${base} px-3`;
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

function Field({ id, label, value, onChange, prefix, suffix, min, max, disabled, helperText, isLocked }: FieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600"
        >
          <span>{label}</span>
          {isLocked && (
            <span
              title="Only Super Admins can modify this setting"
              className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.2 text-[10px] font-medium text-amber-700 border border-amber-200"
            >
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </label>
      </div>
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
          disabled={disabled}
          onChange={onChange}
          className={inputClassName(Boolean(prefix), Boolean(suffix), disabled)}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      {helperText && (
        <p className="mt-1 text-[11px] leading-tight text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
}

export function InsuranceDiscountsCard({
  value,
  onChange,
}: InsuranceDiscountsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-payroll-light/70">
            <HeartPulse className="h-5 w-5 text-payroll-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-payroll-navy">
              Insurance & Discounts
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Medical, life, disability, women discount and insurance limits
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="medical-insurance"
            label="Medical Insurance Deduction"
            value={value.medicalInsuranceNpr}
            onChange={(n) => onChange({ ...value, medicalInsuranceNpr: n })}
            prefix="NPR"
            min={0}
          />
          <Field
            id="house-insurance"
            label="House Insurance Deduction"
            value={value.houseInsuranceNpr}
            onChange={(n) => onChange({ ...value, houseInsuranceNpr: n })}
            prefix="NPR"
            min={0}
          />
          <Field
            id="life-insurance"
            label="Life Insurance"
            value={value.lifeInsuranceNpr}
            onChange={(n) => onChange({ ...value, lifeInsuranceNpr: n })}
            prefix="NPR"
            min={0}
          />
          <Field
            id="remote-allowance"
            label="Remote Allowance"
            value={value.remoteAllowanceNpr}
            onChange={(n) => onChange({ ...value, remoteAllowanceNpr: n })}
            prefix="NPR"
            min={0}
          />
          <Field
            id="women-discount"
            label="Women Tax Discount"
            value={value.womenDiscountPercent}
            onChange={(n) => onChange({ ...value, womenDiscountPercent: n })}
            suffix="%"
            min={0}
            max={100}
          />
          <Field
            id="handicapped-discount"
            label="Disability / Handicapped Discount"
            value={0}
            onChange={() => {}}
            suffix="%"
            min={0}
            max={100}
            disabled={true}
            isLocked={true}
            helperText="Calculated via Handicapped Tax Slabs in Setup → Tax Rates. Locked at 0% to prevent double-discounting."
          />
        </div>
      </CardContent>
    </Card>
  );
}
