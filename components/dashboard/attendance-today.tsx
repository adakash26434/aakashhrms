"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AttendanceDay, TodayWorkforceSummary } from "@/lib/types/dashboard";

interface AttendanceTodayProps {
  attendance?: AttendanceDay[];
  totalEmployees?: number;
  todayWorkforce?: TodayWorkforceSummary;
}

export function AttendanceToday({
  attendance,
  totalEmployees = 0,
  todayWorkforce,
}: AttendanceTodayProps) {
  // Use real computed workforce data from database when available
  const latest =
    attendance && attendance.length > 0
      ? attendance[attendance.length - 1]
      : null;

  const total = todayWorkforce?.total ?? (totalEmployees > 0 ? totalEmployees : (latest?.present ?? 0) + (latest?.leave ?? 0) + (latest?.absent ?? 0));
  const present = todayWorkforce?.present ?? latest?.present ?? total;
  const onLeave = todayWorkforce?.onLeave ?? latest?.leave ?? 0;
  const absent = todayWorkforce?.absent ?? latest?.absent ?? 0;
  const awayToday = onLeave + absent;
  const lateCount = todayWorkforce?.lateCount ?? 0;

  const presentPercent = todayWorkforce?.presentPercent ?? (total > 0 ? ((present / total) * 100).toFixed(1) : "100.0");
  const leavePercent = todayWorkforce?.leavePercent ?? (total > 0 ? ((onLeave / total) * 100).toFixed(1) : "0.0");
  const absentPercent = todayWorkforce?.absentPercent ?? (total > 0 ? ((absent / total) * 100).toFixed(1) : "0.0");

  const now = new Date();
  const todayStr = `${now.getDate()} ${now.toLocaleString("en-US", { month: "short" })}, ${now.toLocaleString("en-US", { weekday: "short" })}`;

  return (
    <Card className="h-full flex flex-col justify-between p-4 sm:p-5 bg-white">
      <div>
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
            Attendance & Leave Today
          </h3>
          <span className="text-xs font-medium text-zinc-500">{todayStr}</span>
        </div>

        {/* Big Metric Display */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-semibold text-zinc-950 tracking-tight font-mono">
              {present}
            </span>
            <span className="text-base sm:text-lg font-medium text-zinc-400 font-mono">
              / {total}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-md bg-payroll-primary-light border border-payroll-border px-2.5 py-1 text-xs font-medium text-payroll-navy">
            <span className="h-1.5 w-1.5 rounded-full bg-payroll-primary" />
            <span>{presentPercent}% present</span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="mt-1 text-xs font-medium text-zinc-500">
          {awayToday} away today · {onLeave} on leave, {absent} absent
        </p>

        {/* Segmented Progress Bar */}
        <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 flex overflow-hidden">
          <div
            className="h-full bg-payroll-primary transition-all duration-300"
            style={{ width: `${presentPercent}%` }}
            title={`Present: ${present} (${presentPercent}%)`}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${leavePercent}%` }}
            title={`On leave: ${onLeave} (${leavePercent}%)`}
          />
          <div
            className="h-full bg-zinc-300 transition-all duration-300"
            style={{ width: `${absentPercent}%` }}
            title={`Absent: ${absent} (${absentPercent}%)`}
          />
        </div>

        {/* Key Metrics Three-Column Row */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-200 pt-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-payroll-primary" />
              <span>Present</span>
            </div>
            <p className="mt-0.5 text-lg sm:text-xl font-semibold text-zinc-950 font-mono">
              {present}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>On leave</span>
            </div>
            <p className="mt-0.5 text-lg sm:text-xl font-semibold text-zinc-950 font-mono">
              {onLeave}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              <span>Absent</span>
            </div>
            <p className="mt-0.5 text-lg sm:text-xl font-semibold text-zinc-950 font-mono">
              {absent}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Row */}
      <div className="mt-4 pt-3 border-t border-zinc-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          <span>{lateCount} late check-in{lateCount === 1 ? "" : "s"}</span>
        </div>

        <Link
          href="/timeAndLeave/attendance"
          className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-950 transition-colors"
        >
          <span>View attendance</span>
        </Link>
      </div>
    </Card>
  );
}
