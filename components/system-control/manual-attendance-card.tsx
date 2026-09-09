"use client";

import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/radio-group";
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-payroll-light/70">
            <CalendarDays className="h-5 w-5 text-payroll-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-payroll-navy">
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
      </CardContent>
    </Card>
  );
}
