"use client";

import React, { useState } from "react";
import { Check, Save } from "lucide-react";
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
  { id: "Sunday", label: "Sunday" },
  { id: "Monday", label: "Monday" },
  { id: "Tuesday", label: "Tuesday" },
  { id: "Wednesday", label: "Wednesday" },
  { id: "Thursday", label: "Thursday" },
  { id: "Friday", label: "Friday" },
  { id: "Saturday", label: "Saturday" },
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
        toast.error("At least one weekly off-day is required.");
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
        toast.success("Work schedule changes saved.");
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
    <div className="space-y-8 animate-[fadeIn_150ms_ease-out]">
      {/* Top Header & Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Work schedule & office shifts
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
            Standard operating hours, weekly off-days, and attendance grace policies across the organization.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer shadow-xs text-xs font-medium h-9 px-4 rounded-lg self-start sm:self-auto shrink-0 transition-colors"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          <span>{isSaving ? "Saving..." : "Save changes"}</span>
        </Button>
      </div>

      {/* Section 1: Weekly Off-Days */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Weekly off-days
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select non-working days for standard calendar shifts. Selected days will count as official rest days.
            </p>
          </div>

          <div className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 font-mono">
            {formData.workingDaysPerWeek} working days / week
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
          {ALL_DAYS.map((d) => {
            const isOff = formData.weeklyOffDays.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleToggleOffDay(d.id)}
                className={cn(
                  "flex flex-col items-start justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer select-none",
                  isOff
                    ? "border-emerald-800 bg-emerald-50/60 text-emerald-950 font-semibold"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs">{d.label}</span>
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      isOff
                        ? "bg-emerald-800 border-emerald-800 text-white"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {isOff && <Check className="h-3 w-3 stroke-3" />}
                  </div>
                </div>
                <span className="text-[11px] font-normal text-slate-400 mt-2">
                  {isOff ? "Official off-day" : "Working day"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Structural Divider */}
      <hr className="border-slate-200/80" />

      {/* Section 2: Shift Timings */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Standard shift hours
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Regular and seasonal winter operational office hours.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Standard start time
            </label>
            <input
              type="time"
              value={formData.coreStartTime}
              onChange={(e) => {
                setFormData({ ...formData, coreStartTime: e.target.value });
                setHasChanges(true);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Standard end time
            </label>
            <input
              type="time"
              value={formData.coreEndTime}
              onChange={(e) => {
                setFormData({ ...formData, coreEndTime: e.target.value });
                setHasChanges(true);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Winter shift start
            </label>
            <input
              type="time"
              value={formData.winterStartTime || "10:00"}
              onChange={(e) => {
                setFormData({ ...formData, winterStartTime: e.target.value });
                setHasChanges(true);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Winter shift end
            </label>
            <input
              type="time"
              value={formData.winterEndTime || "16:00"}
              onChange={(e) => {
                setFormData({ ...formData, winterEndTime: e.target.value });
                setHasChanges(true);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>
        </div>
      </section>

      {/* Structural Divider */}
      <hr className="border-slate-200/80" />

      {/* Section 3: Grace Policies & Thresholds */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Attendance thresholds & grace policies
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Grace windows for check-in delays and minimum required hours for half-day credit.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 max-w-xl">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Late grace window (minutes)
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
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
            <p className="text-[11px] text-slate-400">
              Check-in delays within this window do not record a penalty.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Half-day minimum threshold (hours)
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
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
            <p className="text-[11px] text-slate-400">
              Minimum working hours required to record half-day attendance.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
