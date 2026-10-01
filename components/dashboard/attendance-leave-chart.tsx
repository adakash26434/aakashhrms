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
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Leave
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
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
                  stroke="#f4f4f5"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #e4e4e7",
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 2px 4px 0 rgba(0, 0, 0, 0.05)",
                  }}
                />
                <Bar
                  dataKey="present"
                  stackId="a"
                  fill="#065f46"
                  radius={[0, 0, 0, 0]}
                />
                <Bar dataKey="leave" stackId="a" fill="#f59e0b" />
                <Bar
                  dataKey="absent"
                  stackId="a"
                  fill="#f43f5e"
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
