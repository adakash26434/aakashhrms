"use client";

import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { NumberInput } from "@/components/ui/number-input";
import {
  formatOfficeTime,
  officeTimeFrom24,
  officeTimeTo24,
} from "@/lib/utils";
import type {
  OfficeTimeSettings,
  OfficeTimeValue,
} from "@/lib/types";

interface OfficeTimeCardProps {
  value: OfficeTimeSettings;
  onChange: (next: OfficeTimeSettings) => void;
}

interface TimeFieldProps {
  id: string;
  label: string;
  time: OfficeTimeValue;
  onChange: (next: OfficeTimeValue) => void;
}

function TimeField({ id, label, time, onChange }: TimeFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-gray-600"
      >
        {label}
      </label>
      <div className="flex overflow-hidden rounded-lg border border-[#d7e8d0] bg-white focus-within:border-[#2e7d32] focus-within:ring-1 focus-within:ring-[#2e7d32]">
        <input
          id={id}
          type="time"
          value={officeTimeTo24(time)}
          onChange={(e) => onChange(officeTimeFrom24(e.target.value))}
          className="flex-1 cursor-pointer bg-transparent px-3 py-2 text-sm text-[#1b3a1f] focus:outline-none"
        />
        <span
          aria-hidden
          className="flex items-center bg-[#f6faf6] px-3 text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          {formatOfficeTime(time)}
        </span>
      </div>
    </div>
  );
}

export function OfficeTimeCard({ value, onChange }: OfficeTimeCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7e8d0]/70">
            <Clock className="h-5 w-5 text-[#2e7d32]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1b3a1f]">
              Office Time
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Standard working hours and attendance grace window
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TimeField
            id="office-in-time"
            label="In Time"
            time={value.inTime}
            onChange={(inTime) => onChange({ ...value, inTime })}
          />
          <TimeField
            id="office-out-time"
            label="Out Time"
            time={value.outTime}
            onChange={(outTime) => onChange({ ...value, outTime })}
          />
        </div>

        <div className="h-px w-full bg-[#d7e8d0]/60" />

        <div className="space-y-3">
          <Toggle
            checked={value.calculateOtAndAbsent}
            onChange={(next) => onChange({ ...value, calculateOtAndAbsent: next })}
            label="Calculate OT and Absent before and after office time (from device)"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Toggle
              checked={value.applyGraceWindow}
              onChange={(next) =>
                onChange({ ...value, applyGraceWindow: next })
              }
              label="Apply grace window"
            />
            <div className="relative w-24">
              <NumberInput
                min={0}
                value={value.graceWindowMinutes}
                onChange={(nextMinutes) =>
                  onChange({
                    ...value,
                    graceWindowMinutes: nextMinutes,
                  })
                }
                className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-1.5 pr-2 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              />
            </div>
            <span className="text-sm text-gray-500">minutes</span>
          </div>
        </div>

        <div className="h-px w-full bg-[#d7e8d0]/60" />

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Overtime Multipliers (Nepal Labour Act)
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ot-mult-office" className="mb-1.5 block text-xs font-medium text-gray-600">
                Office Day OT Multiplier (Fixed)
              </label>
              <div className="flex overflow-hidden rounded-lg border border-[#d7e8d0] bg-gray-50">
                <input
                  id="ot-mult-office"
                  type="number"
                  disabled
                  value={1.5}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-400 cursor-not-allowed focus:outline-none font-mono"
                />
                <span className="flex items-center bg-[#d7e8d0]/30 px-3 text-xs font-medium text-gray-400">
                  x Rate
                </span>
              </div>
              <p className="mt-1 text-[10px] text-gray-400 font-medium">
                Fixed standard under Nepal's Labour Act.
              </p>
            </div>

            <div>
              <label htmlFor="ot-mult-off" className="mb-1.5 block text-xs font-medium text-gray-600">
                Off Day / Holiday OT Multiplier
              </label>
              <div className="flex overflow-hidden rounded-lg border border-[#d7e8d0] bg-white focus-within:border-[#2e7d32] focus-within:ring-1 focus-within:ring-[#2e7d32]">
                <input
                  id="ot-mult-off"
                  type="number"
                  step="0.1"
                  min="1.5"
                  max="5"
                  value={value.otMultiplierOffDay ?? 2.0}
                  onChange={(e) => onChange({ ...value, otMultiplierOffDay: Number(e.target.value) })}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-[#1b3a1f] focus:outline-none font-mono"
                />
                <span className="flex items-center bg-[#f6faf6] px-3 text-xs font-medium text-gray-500">
                  x Rate
                </span>
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                Minimum 1.5x as required by law.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
