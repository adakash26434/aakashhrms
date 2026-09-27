"use client";

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
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Attendance payroll fallback
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Default calculation behavior when monthly attendance is not yet posted prior to running payroll.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-700">
          When attendance record is unposted during payroll generation, assume employee status as:
        </p>
        <RadioGroup
          name="manual-attendance-default"
          value={value.defaultWhenNotPosted}
          onChange={(next) =>
            onChange({ ...value, defaultWhenNotPosted: next })
          }
          options={RADIO_OPTIONS}
        />
        <p className="text-[11px] text-slate-500">
          Choosing &quot;Present&quot; treats unposted records as full attendance with standard work hours. &quot;Absent&quot; flags unposted records for manual HR review.
        </p>
      </div>
    </div>
  );
}
