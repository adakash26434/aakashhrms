"use client";

import { useMemo } from "react";
import { TrendingUp, Sparkles, ShieldCheck, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    label: "Statutory Daily Rate (Basic / 30)",
    badge: "Nepal Standard",
    description:
      "1 Grade = 1 day basic salary (Civil Service Rule 112 & BFI Bylaws). Dynamically expands when basic salary increases.",
  },
  {
    value: "FIXED_AMOUNT_PER_GRADE",
    label: "Fixed Rupee Step Scale",
    description:
      "Each annual grade earns a pre-defined fixed cash amount (e.g., NPR 1,000/yr) regardless of basic salary changes.",
  },
  {
    value: "PERCENTAGE_OF_BASIC",
    label: "Percentage of Basic Salary",
    description:
      "Each grade is calculated as a fixed percentage (e.g., 3.33% or 5%) of monthly basic salary.",
  },
  {
    value: "MANUAL_INPUT",
    label: "Manual Entry (Discretionary)",
    description:
      "HR manually enters the cash grade amount per employee without automated formula enforcement.",
  },
  {
    value: "DISABLED_NO_GRADES",
    label: "Disabled / Consolidated Basic",
    description:
      "System does not track separate grade lines (modern tech firms & MNCs using consolidated annual merit hikes).",
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

  // Live simulation for preview badge
  const previewSimulation = useMemo(() => {
    const sampleBasic = 30000;
    const sampleGrades = 2;
    const rate = calculateGradeRate(sampleBasic, policy);
    const total = calculateTotalGradeAmount(sampleBasic, sampleGrades, policy);
    return { sampleBasic, sampleGrades, rate, total };
  }, [policy]);

  return (
    <Card className="border border-payroll-border bg-white shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-payroll-light/70 text-payroll-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-payroll-navy">
                  Grade &amp; Promotion Policy
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  Statutory Rule 112 &amp; 113
                </span>
              </div>
              <p className="mt-0.5 text-xs text-payroll-slate">
                Master calculation rules for annual grade increments and promotion pay protection.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Method Selector */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-payroll-slate">
            Grade Calculation Formula
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {METHODS.map((m) => {
              const isSelected = policy.calculationMethod === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => update("calculationMethod", m.value)}
                  className={cn(
                    "flex flex-col text-left p-3 rounded-xl border transition-all text-xs cursor-pointer relative",
                    isSelected
                      ? "border-payroll-primary bg-payroll-cream/50 ring-1 ring-payroll-primary shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-1 w-full mb-1">
                    <span className="font-semibold text-payroll-navy">
                      {m.label}
                    </span>
                    {m.badge && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
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

        {/* Dynamic Parameter Settings */}
        <div className="rounded-xl border border-payroll-border/80 bg-slate-50/60 p-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-payroll-slate">
            Policy Parameters &amp; Limits
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {policy.calculationMethod === "STATUTORY_DAILY_RATE" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  Days in Month Divisor
                  <span className="text-[11px] text-slate-400 font-normal">(Nepal 30-day standard)</span>
                </label>
                <div className="relative">
                  <NumberInput
                    min={1}
                    max={31}
                    value={policy.daysInMonthForDailyRate}
                    onChange={(n) => update("daysInMonthForDailyRate", n || 30)}
                    className="w-full rounded-lg border border-payroll-border bg-white px-3 py-1.5 text-xs text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                    days
                  </span>
                </div>
              </div>
            )}

            {policy.calculationMethod === "PERCENTAGE_OF_BASIC" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Fixed Grade Percent (%)
                </label>
                <div className="relative">
                  <NumberInput
                    min={0}
                    max={100}
                    value={policy.fixedGradePercent}
                    onChange={(n) => update("fixedGradePercent", n)}
                    className="w-full rounded-lg border border-payroll-border bg-white px-3 py-1.5 text-xs text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                    %
                  </span>
                </div>
              </div>
            )}

            {policy.calculationMethod === "FIXED_AMOUNT_PER_GRADE" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Fixed Amount per Grade (NPR)
                </label>
                <div className="relative">
                  <NumberInput
                    min={0}
                    value={policy.fixedAmountPerGrade}
                    onChange={(n) => update("fixedAmountPerGrade", n)}
                    className="w-full rounded-lg border border-payroll-border bg-white px-3 py-1.5 text-xs text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                    NPR
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                Max Grades Cap per Level
                <span className="text-[11px] text-slate-400 font-normal">(0 = Unlimited)</span>
              </label>
              <div className="relative">
                <NumberInput
                  min={0}
                  max={30}
                  value={policy.maxGradesAllowedPerLevel}
                  onChange={(n) => update("maxGradesAllowedPerLevel", n)}
                  className="w-full rounded-lg border border-payroll-border bg-white px-3 py-1.5 text-xs text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                  grades
                </span>
              </div>
            </div>

            {/* Live preview badge */}
            <div className="sm:col-span-full rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-emerald-900">
                  Live Formula Simulation:
                </span>
                <span className="text-xs text-emerald-800">
                  Sample Basic: <strong>NPR {previewSimulation.sampleBasic.toLocaleString()}</strong> with{" "}
                  <strong>{previewSimulation.sampleGrades} Grades</strong>
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-950 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs">
                = NPR {previewSimulation.total.toLocaleString()} / month{" "}
                <span className="text-[11px] font-normal text-emerald-700">
                  (Rate: NPR {previewSimulation.rate.toLocaleString()}/grade)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Promotion Rules & Non-Reduction */}
        <div className="rounded-xl border border-payroll-border/80 bg-slate-50/60 p-4 space-y-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-payroll-navy">
              Promotion Pay Protection (Non-Reduction Principle)
            </h3>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              Rule 113 Compliance
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-200/80">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-800">
                  Enforce Non-Reduction of Base Pay on Promotion
                </span>
                <p className="text-[11px] text-slate-500">
                  Guarantees that an employee&apos;s new basic pay after promotion can never be less than their previous total base (Old Basic + Old Grade Amount).
                </p>
              </div>
              <Toggle
                checked={policy.promotionRule.enforceNonReduction}
                onChange={(checked) =>
                  updatePromotionRule("enforceNonReduction", checked)
                }
              />
            </div>

            <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-200/80">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-800">
                  Guarantee Minimum 1 Grade Increment of New Post
                </span>
                <p className="text-[11px] text-slate-500">
                  Statutory rule in BFIs and Public Enterprises: Promotion salary must exceed Old Basic + Old Grade by at least the value of 1 grade of the promoted post.
                </p>
              </div>
              <Toggle
                checked={policy.promotionRule.guaranteeMinimumOneNewGrade}
                onChange={(checked) =>
                  updatePromotionRule("guaranteeMinimumOneNewGrade", checked)
                }
              />
            </div>

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-medium text-slate-700">
                Adjustment Method for Scale Deficits:
              </span>
              <div className="flex items-center gap-3">
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
                    className="text-payroll-primary focus:ring-payroll-primary"
                  />
                  <span>Compensatory Stepping Grades</span>
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
                    className="text-payroll-primary focus:ring-payroll-primary"
                  />
                  <span>Direct Basic Pay Adjustment</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
