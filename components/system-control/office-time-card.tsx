"use client";

import { useRef } from "react";
import Link from "next/link";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold text-payroll-navy"
      >
        {label}
      </label>
      <div
        onClick={handleOpenPicker}
        className="flex cursor-pointer overflow-hidden rounded-lg border border-payroll-light bg-white transition-colors hover:border-payroll-primary/60 focus-within:ring-1 focus-within:ring-payroll-primary"
      >
        <input
          ref={inputRef}
          id={id}
          type="time"
          value={officeTimeTo24(time)}
          onChange={(e) => {
            if (e.target.value) {
              onChange(officeTimeFrom24(e.target.value));
            }
          }}
          className="flex-1 cursor-pointer bg-transparent px-3 py-2 text-sm font-medium text-payroll-navy focus:outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenPicker();
          }}
          className="flex items-center gap-1.5 border-l border-payroll-light bg-payroll-cream px-3 text-xs font-semibold text-payroll-primary transition-colors hover:bg-payroll-light/50 cursor-pointer"
          title="Click to select time"
        >
          <Clock className="h-3.5 w-3.5" />
          <span>{formatOfficeTime(time)}</span>
        </button>
      </div>
    </div>
  );
}

export function OfficeTimeCard({ value, onChange }: OfficeTimeCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-payroll-light/70">
            <Clock className="h-5 w-5 text-payroll-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-payroll-navy">
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

        <div className="h-px w-full bg-payroll-light/60" />

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
                className="w-full rounded-lg border border-payroll-light bg-white px-3 py-1.5 pr-2 text-sm text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              />
            </div>
            <span className="text-sm text-gray-500">minutes</span>
          </div>
        </div>

        <div className="h-px w-full bg-payroll-light/60" />

        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Overtime</h3>
          <p className="text-sm text-gray-500">
            Overtime rates, rounding and approval are set in{" "}
            <Link href="/timeAndLeave/policies?tab=overtime" className="font-medium text-payroll-primary hover:underline">
              Time &amp; Leave → Policies → Overtime
            </Link>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
