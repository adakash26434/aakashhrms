"use client";

import { useMemo } from "react";
import { Toggle } from "@/components/ui/toggle";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";
import type {
  GradePolicySettings,
  GradeCalculationMethod,
} from "@/lib/types/system-control";
import {
  DEFAULT_GRADE_POLICY,
  calculateGradeRate,
  calculateTotalGradeAmount,
} from "@/lib/engines/grade-policy.engine";

interface GradePolicyCardProps {
  value?: GradePolicySettings;
  onChange: (next: GradePolicySettings) => void;
}

const METHODS: ReadonlyArray<{
  value: GradeCalculationMethod;
  label: string;
  badge?: string;
  description: string;
}> = [
  {
    value: "STATUTORY_DAILY_RATE",
    label: "Statutory daily rate (Basic / 30)",
    badge: "Nepal standard",
    description:
      "1 grade = 1 day basic salary (Civil Service Rule 112 & BFI Bylaws). Scales automatically when basic salary increases.",
  },
  {
    value: "FIXED_AMOUNT_PER_GRADE",
    label: "Fixed rupee step scale",
    description:
      "Each annual grade earns a pre-defined fixed cash amount (e.g. NPR 1,000) regardless of basic salary changes.",
  },
  {
    value: "PERCENTAGE_OF_BASIC",
    label: "Percentage of basic salary",
    description:
      "Each grade is calculated as a fixed percentage (e.g. 3.33% or 5%) of monthly basic salary.",
  },
  {
    value: "MANUAL_INPUT",
    label: "Manual entry (Discretionary)",
    description:
      "HR manually enters the cash grade amount per employee without automated formula enforcement.",
  },
  {
    value: "DISABLED_NO_GRADES",
    label: "Disabled (Consolidated basic)",
    description:
      "Grades are not tracked separately. Used by tech companies and organizations with consolidated merit pay.",
  },
];

export function GradePolicyCard({ value, onChange }: GradePolicyCardProps) {
  const policy = value ?? DEFAULT_GRADE_POLICY;

  const update = <K extends keyof GradePolicySettings>(
    key: K,
    val: GradePolicySettings[K],
  ) => {
    onChange({ ...policy, [key]: val });
  };

  const updatePromotionRule = <
    K extends keyof GradePolicySettings["promotionRule"],
  >(
    key: K,
    val: GradePolicySettings["promotionRule"][K],
  ) => {
    onChange({
      ...policy,
      promotionRule: {
        ...policy.promotionRule,
        [key]: val,
      },
    });
  };

  // Live simulation for formula preview
  const previewSimulation = useMemo(() => {
    const sampleBasic = 30000;
    const sampleGrades = 2;
    const rate = calculateGradeRate(sampleBasic, policy);
    const total = calculateTotalGradeAmount(sampleBasic, sampleGrades, policy);
    return { sampleBasic, sampleGrades, rate, total };
  }, [policy]);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Grade &amp; promotion progression
            </h3>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600">
              Civil Service Rule 112 &amp; 113
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Master calculation rules for annual grade increments and promotion pay protection.
          </p>
        </div>
      </div>

      {/* Method Selector */}
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          Grade calculation formula
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {METHODS.map((m) => {
            const isSelected = policy.calculationMethod === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => update("calculationMethod", m.value)}
                className={cn(
                  "flex flex-col text-left p-3.5 rounded-lg border transition-all text-xs cursor-pointer relative",
                  isSelected
                    ? "border-emerald-800 bg-emerald-50/40 ring-1 ring-emerald-800 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60",
                )}
              >
                <div className="flex items-center justify-between gap-1 w-full mb-1">
                  <span className={cn("font-medium", isSelected ? "text-emerald-950 font-semibold" : "text-slate-900")}>
                    {m.label}
                  </span>
                  {m.badge && (
                    <span className="rounded bg-emerald-100/80 text-emerald-800 px-1.5 py-0.2 text-[10px] font-medium shrink-0">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {m.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Parameters & Live Preview */}
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 space-y-4">
        <h4 className="text-xs font-semibold text-slate-900">
          Formula parameters &amp; limits
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {policy.calculationMethod === "STATUTORY_DAILY_RATE" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Days in month divisor
              </label>
              <div className="relative">
                <NumberInput
                  min={1}
                  max={31}
                  value={policy.daysInMonthForDailyRate}
                  onChange={(n) => update("daysInMonthForDailyRate", n || 30)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-12 text-xs font-mono text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  days
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Nepal standard 30-day divisor</p>
            </div>
          )}

          {policy.calculationMethod === "PERCENTAGE_OF_BASIC" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Fixed grade percent
              </label>
              <div className="relative">
                <NumberInput
                  min={0}
                  max={100}
                  value={policy.fixedGradePercent}
                  onChange={(n) => update("fixedGradePercent", n)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs font-mono text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  %
                </span>
              </div>
            </div>
          )}

          {policy.calculationMethod === "FIXED_AMOUNT_PER_GRADE" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Fixed amount per grade
              </label>
              <div className="relative">
                <NumberInput
                  min={0}
                  value={policy.fixedAmountPerGrade}
                  onChange={(n) => update("fixedAmountPerGrade", n)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-3 text-xs font-mono text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                />
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-slate-400">
                  NPR
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Maximum grades cap per level
            </label>
            <div className="relative">
              <NumberInput
                min={0}
                max={30}
                value={policy.maxGradesAllowedPerLevel}
                onChange={(n) => update("maxGradesAllowedPerLevel", n)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-14 text-xs font-mono text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                grades
              </span>
            </div>
            <p className="text-[11px] text-slate-500">0 = Unlimited progression</p>
          </div>
        </div>

        {/* Live Simulation Receipt */}
        <div className="rounded-lg border border-emerald-200/80 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-medium text-slate-900">
              Formula verification test
            </div>
            <div className="text-slate-500 text-[11px]">
              Sample basic salary NPR {previewSimulation.sampleBasic.toLocaleString()} with {previewSimulation.sampleGrades} grades
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-md px-3 py-1.5 self-start sm:self-auto">
            <span className="text-emerald-900 font-semibold font-mono">
              NPR {previewSimulation.total.toLocaleString()} / mo
            </span>
            <span className="text-[11px] text-emerald-700">
              (NPR {previewSimulation.rate.toLocaleString()} / grade)
            </span>
          </div>
        </div>
      </div>

      {/* Promotion Rules (Non-Reduction Principle) */}
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-slate-900">
              Promotion pay protection (Non-reduction principle)
            </h4>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600">
              Rule 113
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Protects employee earnings from diminishing upon promotion across Shreni grade scales.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-slate-900">
                Enforce non-reduction of base pay on promotion
              </span>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Guarantees new basic pay after promotion can never be less than previous total base (Old Basic + Old Grade amount).
              </p>
            </div>
            <Toggle
              checked={policy.promotionRule.enforceNonReduction}
              onChange={(checked) =>
                updatePromotionRule("enforceNonReduction", checked)
              }
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-slate-900">
                Guarantee minimum 1 grade increment of new post
              </span>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Statutory requirement in BFIs and public enterprises: Promoted pay must exceed old total base by at least 1 grade value of the new post.
              </p>
            </div>
            <Toggle
              checked={policy.promotionRule.guaranteeMinimumOneNewGrade}
              onChange={(checked) =>
                updatePromotionRule("guaranteeMinimumOneNewGrade", checked)
              }
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-slate-900">
                Scale deficit adjustment method
              </span>
              <p className="text-[11px] text-slate-500">
                Select how shortfall between old earnings and new grade minimum is resolved.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="handlingMethod"
                  value="RESET_TO_ZERO_WITH_STEPPING"
                  checked={
                    policy.promotionRule.handlingMethod ===
                    "RESET_TO_ZERO_WITH_STEPPING"
                  }
                  onChange={() =>
                    updatePromotionRule(
                      "handlingMethod",
                      "RESET_TO_ZERO_WITH_STEPPING",
                    )
                  }
                  className="text-emerald-800 focus:ring-emerald-800"
                />
                <span>Compensatory stepping</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="handlingMethod"
                  value="DIRECT_BASIC_ADJUSTMENT"
                  checked={
                    policy.promotionRule.handlingMethod ===
                    "DIRECT_BASIC_ADJUSTMENT"
                  }
                  onChange={() =>
                    updatePromotionRule(
                      "handlingMethod",
                      "DIRECT_BASIC_ADJUSTMENT",
                    )
                  }
                  className="text-emerald-800 focus:ring-emerald-800"
                />
                <span>Direct basic pay</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
