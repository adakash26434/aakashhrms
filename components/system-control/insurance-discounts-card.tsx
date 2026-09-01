"use client";

import { HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { InsuranceDiscountsSettings } from "@/lib/types/system-control";
import { NumberInput } from "@/components/ui/number-input";

interface InsuranceDiscountsCardProps {
  value: InsuranceDiscountsSettings;
  onChange: (next: InsuranceDiscountsSettings) => void;
}

function inputClassName(hasPrefix: boolean, hasSuffix: boolean): string {
  const base =
    "w-full rounded-lg border border-[#d7e8d0] bg-white py-2 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]";
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
}

function Field({ id, label, value, onChange, prefix, suffix, min, max }: FieldProps) {
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
          className={inputClassName(Boolean(prefix), Boolean(suffix))}
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

export function InsuranceDiscountsCard({
  value,
  onChange,
}: InsuranceDiscountsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7e8d0]/70">
            <HeartPulse className="h-5 w-5 text-[#2e7d32]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1b3a1f]">
              Insurance & Discounts
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Medical, house, life insurance and womens discount
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
            id="women-discount"
            label="Women Discount"
            value={value.womenDiscountPercent}
            onChange={(n) => onChange({ ...value, womenDiscountPercent: n })}
            suffix="%"
            min={0}
            max={100}
          />
        </div>

        <Field
          id="remote-allowance"
          label="Remote Allowance"
          value={value.remoteAllowanceNpr}
          onChange={(n) => onChange({ ...value, remoteAllowanceNpr: n })}
          prefix="NPR"
          min={0}
        />
      </CardContent>
    </Card>
  );
}
