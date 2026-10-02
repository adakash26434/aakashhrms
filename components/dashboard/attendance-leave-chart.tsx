"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import type { AttendanceDay } from "@/lib/types/dashboard";
import { CHART_COLORS, CHART_THEME, CHART_TOOLTIP_STYLE, CHART_AXIS_TICK } from "@/lib/constants/colors";

interface AttendanceLeaveChartProps {
  data: AttendanceDay[];
}

export function AttendanceLeaveChart({ data }: AttendanceLeaveChartProps) {
  const ready = useClientReady();

  return (
    <Card className="h-full flex flex-col justify-between bg-white">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
              Attendance & Leave Pulse
            </h3>
            <p className="text-xs text-zinc-500">
              Weekly verified presence (biometric and manual)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-payroll-primary" />
              Present
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-chart-warning" />
              Leave
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-chart-danger" />
              Absent
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 min-w-0 w-full">
          {ready ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_THEME.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="present"
                  stackId="a"
                  fill={CHART_COLORS.primary}
                  radius={[0, 0, 0, 0]}
                />
                <Bar dataKey="leave" stackId="a" fill={CHART_COLORS.warning} />
                <Bar
                  dataKey="absent"
                  stackId="a"
                  fill={CHART_COLORS.danger}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-md bg-zinc-100" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
