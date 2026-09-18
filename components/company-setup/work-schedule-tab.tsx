"use client";

import React, { useState } from "react";
import { Clock, Calendar, Check, Save, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CompanyWorkSchedule } from "@/lib/types/company-setup";
import { saveCompanyWorkScheduleAction } from "@/app/actions/company-setup.actions";

interface WorkScheduleTabProps {
  schedule: CompanyWorkSchedule;
  onScheduleChange: (schedule: CompanyWorkSchedule) => void;
}

const ALL_DAYS = [
  { id: "Sunday", label: "Sunday (आइतबार)" },
  { id: "Monday", label: "Monday (सोमबार)" },
  { id: "Tuesday", label: "Tuesday (मंगलबार)" },
  { id: "Wednesday", label: "Wednesday (बुधबार)" },
  { id: "Thursday", label: "Thursday (बिहीबार)" },
  { id: "Friday", label: "Friday (शुक्रबार)" },
  { id: "Saturday", label: "Saturday (शनिबार)" },
];

export function WorkScheduleTab({ schedule, onScheduleChange }: WorkScheduleTabProps) {
  const toast = useToast();
  const [formData, setFormData] = useState<CompanyWorkSchedule>(schedule);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  function handleToggleOffDay(day: string) {
    const exists = formData.weeklyOffDays.includes(day);
    let updated: string[];
    if (exists) {
      if (formData.weeklyOffDays.length <= 1) {
        toast.error("At least one weekly off day is required");
        return;
      }
      updated = formData.weeklyOffDays.filter((d) => d !== day);
    } else {
      updated = [...formData.weeklyOffDays, day];
    }
    setFormData((prev) => ({
      ...prev,
      weeklyOffDays: updated,
      workingDaysPerWeek: 7 - updated.length,
    }));
    setHasChanges(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await saveCompanyWorkScheduleAction(formData);
      if (res.success) {
        onScheduleChange(formData);
        toast.success("Work schedule and office timings updated successfully.");
        setHasChanges(false);
      } else {
        toast.error(res.error || "Failed to save work schedule.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving schedule";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_200ms_ease-out]">
      {/* Banner */}
      <div className="rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/80 via-white to-indigo-50/40 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Work Shifts, Timing & Weekly Off Policy (कार्य तालिका तथा समय)
              </h3>
              <p className="mt-1 text-xs text-slate-600 max-w-2xl">
                Configure standard office timings, 5-day vs. 6-day week schedules, grace periods for late punches, and winter office hours.
                These settings drive the automated daily attendance and late deduction engine.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm text-xs font-semibold"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save Schedule Changes"}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Off Days & Work Days */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Weekly Off Days (साप्ताहिक बिदा)
            </h4>
          </div>

          <p className="text-xs text-slate-500">
            Select the designated non-working day(s) for your organization:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_DAYS.map((d) => {
              const isSelected = formData.weeklyOffDays.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleToggleOffDay(d.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-2xs"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  <span>{d.label}</span>
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border",
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg bg-slate-50 p-3 flex items-center justify-between text-xs text-slate-700 border border-slate-200">
            <span className="font-medium">Active Working Days:</span>
            <span className="font-bold font-mono text-indigo-700">
              {formData.workingDaysPerWeek} Days / Week
            </span>
          </div>
        </div>

        {/* Office Hours & Thresholds */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Core Timing & Grace Policies (कार्यालय समय)
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office Start Time *
              </label>
              <input
                type="time"
                value={formData.coreStartTime}
                onChange={(e) => {
                  setFormData({ ...formData, coreStartTime: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office End Time *
              </label>
              <input
                type="time"
                value={formData.coreEndTime}
                onChange={(e) => {
                  setFormData({ ...formData, coreEndTime: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Winter Start Time (कार्तिक-माघ)
              </label>
              <input
                type="time"
                value={formData.winterStartTime || "10:00"}
                onChange={(e) => {
                  setFormData({ ...formData, winterStartTime: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Winter End Time
              </label>
              <input
                type="time"
                value={formData.winterEndTime || "16:00"}
                onChange={(e) => {
                  setFormData({ ...formData, winterEndTime: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Late Grace Window (Mins)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={formData.gracePeriodMinutes}
                onChange={(e) => {
                  setFormData({ ...formData, gracePeriodMinutes: Number(e.target.value) || 0 });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Permitted delay without late mark
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Half-Day Threshold (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={formData.halfDayThresholdHours}
                onChange={(e) => {
                  setFormData({ ...formData, halfDayThresholdHours: Number(e.target.value) || 4 });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Minimum working hours for half-day
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
