"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS_TICK, CHART_THEME, CHART_TOOLTIP_STYLE } from "@/lib/constants/colors";
import type { AttendanceDayCounts } from "@/lib/types/dashboard";
import { ATTENDANCE_SERIES } from "./dashboard-chart-series";

/** Attendance for each day of the current BS month (4.1); unrecorded days show as a grey gap, not as present. */
export function DashboardAttendanceChart({ days }: { days: AttendanceDayCounts[] }) {
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 220 }}>
        <BarChart data={days} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
          <XAxis dataKey="day" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(day) => `Day ${day}`} cursor={{ fill: CHART_THEME.grid, opacity: 0.6 }} />
          {ATTENDANCE_SERIES.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="day" fill={s.color} radius={i === ATTENDANCE_SERIES.length - 1 ? [2, 2, 0, 0] : undefined} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
