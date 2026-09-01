import { getMyAttendanceSummary } from "@/lib/services/self-service.service";
import { Clock, CalendarDays, Timer, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Attendance | Self-Service Portal",
  description: "View your monthly attendance and overtime summary",
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
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-gray-200 bg-white">
        <Clock className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Attendance Unavailable</h2>
        <p className="text-sm text-gray-500">{error?.message || "Failed to load attendance data."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a1f]">My Attendance</h1>
        <span className="text-xs text-gray-400">{summaries.length} month(s) recorded</span>
      </div>

      {summaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-gray-200 bg-white text-center">
          <CalendarDays className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No attendance records found for the current fiscal year.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaries.map((month) => {
            const totalDays = Number(month.totalWorkingDays) || 30;
            const presentDays = Number(month.presentDays) || 0;
            const absentDays = Number(month.absentDays) || 0;
            const payLeave = Number(month.payLeaveDays) || 0;
            const nonPayLeave = Number(month.nonPayLeaveDays) || 0;
            const totalLeave = payLeave + nonPayLeave;
            const otHours = (Number(month.totalOtHoursOffice) || 0) + (Number(month.totalOtHoursOff) || 0);
            const attendancePercent = totalDays > 0 ? Math.min(100, Math.round((presentDays / totalDays) * 100)) : 0;

            return (
              <div
                key={month.id}
                className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-[#1b3a1f]">
                      {BS_MONTHS[(Number(month.bsMonth) || 1) - 1]}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {month.isLocked && (
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                        LOCKED
                      </span>
                    )}
                    <span className={`text-xs font-bold ${
                      attendancePercent >= 90 ? 'text-emerald-600' : attendancePercent >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {attendancePercent}%
                    </span>
                  </div>
                </div>

                {/* Attendance Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <AttendanceStat label="Present Days" value={presentDays} color="text-emerald-600" icon={CheckCircle2} />
                  <AttendanceStat label="Absent Days" value={absentDays} color="text-red-500" icon={Clock} />
                  <AttendanceStat label="Paid Leave" value={payLeave} color="text-blue-500" icon={CalendarDays} />
                  <AttendanceStat label="Working Days" value={totalDays} color="text-purple-500" icon={CalendarDays} />
                </div>

                {/* OT Hours */}
                {otHours > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5">
                    <Timer className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs text-amber-700">
                      <strong>{otHours.toFixed(1)}</strong> overtime hours
                    </span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      attendancePercent >= 90 ? 'bg-emerald-400' : attendancePercent >= 70 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(attendancePercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttendanceStat({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <div>
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
