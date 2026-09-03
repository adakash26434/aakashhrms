import React from "react";
import { getMyAttendanceSummary } from "@/lib/services/self-service.service";
import { Clock, CalendarDays, Timer, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Attendance | Self-Service Portal",
  description: "View monthly attendance telemetry, overtime, and leave deductions",
};

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashar", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export default async function MyAttendancePage() {
  let summaries;
  try {
    summaries = await getMyAttendanceSummary();
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<Clock className="h-10 w-10 text-payroll-primary" />}
            title="Attendance Telemetry Unavailable"
            description={error?.message || "Failed to load attendance records. Please contact HR."}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Attendance & Overtime Summary
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Monthly working days, presence ratio, approved paid leaves, and statutory overtime calculation hours.
          </p>
        </div>

        <span className="text-xs font-bold text-gray-500 bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light">
          {summaries.length} month(s) calculated
        </span>
      </div>

      {summaries.length === 0 ? (
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="py-16">
            <EmptyState
              icon={<CalendarDays className="h-10 w-10 text-payroll-primary" />}
              title="No attendance records found"
              description="Attendance telemetry for the active fiscal year will be processed at the end of each monthly payroll cycle."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaries.map((month) => {
            const totalDays = Number(month.totalWorkingDays) || 30;
            const presentDays = Number(month.presentDays) || 0;
            const absentDays = Number(month.absentDays) || 0;
            const payLeave = Number(month.payLeaveDays) || 0;
            const nonPayLeave = Number(month.nonPayLeaveDays) || 0;
            const otHours =
              (Number(month.totalOtHoursOffice) || 0) +
              (Number(month.totalOtHoursOff) || 0);
            const attendancePercent =
              totalDays > 0
                ? Math.min(100, Math.round((presentDays / totalDays) * 100))
                : 0;

            return (
              <Card
                key={month.id}
                className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-payroll-cream text-payroll-primary border border-payroll-light shadow-2xs">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold text-payroll-navy">
                        {BS_MONTHS[(Number(month.bsMonth) || 1) - 1]}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {month.isLocked && (
                        <Badge variant="neutral" size="sm" className="font-bold text-[10px]">
                          LOCKED
                        </Badge>
                      )}
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md border ${
                          attendancePercent >= 90
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : attendancePercent >= 70
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {attendancePercent}% Present
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-payroll-cream/50 rounded-xl border border-payroll-light/70 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Present
                      </span>
                      <strong className="text-sm font-bold text-payroll-navy font-mono">
                        {presentDays}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Paid Leave
                      </span>
                      <strong className="text-sm font-bold text-blue-700 font-mono">
                        {payLeave}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Absent
                      </span>
                      <strong className="text-sm font-bold text-rose-600 font-mono">
                        {absentDays}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Working Days
                      </span>
                      <strong className="text-sm font-bold text-gray-700 font-mono">
                        {totalDays}
                      </strong>
                    </div>
                  </div>

                  {/* Overtime Telemetry Strip */}
                  {otHours > 0 && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
                      <div className="flex items-center gap-2 text-amber-900">
                        <Timer className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="font-semibold">
                          Overtime Logged: <strong>{otHours.toFixed(1)} hrs</strong>
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200 font-bold">
                        Office: {month.totalOtHoursOffice || 0}h / Off: {month.totalOtHoursOff || 0}h
                      </span>
                    </div>
                  )}

                  {/* Progress Meter */}
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-payroll-cream overflow-hidden border border-payroll-light/60">
                      <div
                        className={`h-full rounded-full transition-all ${
                          attendancePercent >= 90
                            ? "bg-payroll-primary"
                            : attendancePercent >= 70
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(attendancePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
