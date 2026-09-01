"use client";

import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/radio-group";
import { NumberInput } from "@/components/ui/number-input";
import type {
  ManualAttendanceDefault,
  ManualAttendanceSettings,
} from "@/lib/types/system-control";

interface ManualAttendanceCardProps {
  value: ManualAttendanceSettings;
  onChange: (next: ManualAttendanceSettings) => void;
}

const RADIO_OPTIONS: ReadonlyArray<{
  label: ManualAttendanceDefault;
  value: ManualAttendanceDefault;
}> = [
  { label: "Absent", value: "Absent" },
  { label: "Present", value: "Present" },
];

export function ManualAttendanceCard({
  value,
  onChange,
}: ManualAttendanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7e8d0]/70">
            <CalendarDays className="h-5 w-5 text-[#2e7d32]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1b3a1f]">
              Manual Attendance
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Default behavior when manual attendance is not posted
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            If manual attendance is not posted, default calculate as:
          </p>
          <RadioGroup
            name="manual-attendance-default"
            value={value.defaultWhenNotPosted}
            onChange={(next) =>
              onChange({ ...value, defaultWhenNotPosted: next })
            }
            options={RADIO_OPTIONS}
          />
        </div>

        <div className="h-px w-full bg-[#d7e8d0]/60" />

        <div>
          <label
            htmlFor="yearly-insurance-premium"
            className="mb-1.5 block text-xs font-medium text-gray-600"
          >
            Yearly Insurance Premium Limit
          </label>
          <div className="relative max-w-sm">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-gray-400">
              NPR
            </span>
            <NumberInput
              id="yearly-insurance-premium"
              min={0}
              value={value.yearlyInsurancePremiumLimit}
              onChange={(nextVal) =>
                onChange({
                  ...value,
                  yearlyInsurancePremiumLimit: nextVal,
                })
              }
              className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 pl-12 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
