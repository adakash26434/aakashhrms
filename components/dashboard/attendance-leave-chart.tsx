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
    <Card className="h-full flex flex-col justify-between bg-white border-payroll-border shadow-payroll-xs">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-950">
              Attendance & leave pulse
            </h3>
            <p className="text-xs text-gray-500">
              Weekly verified presence · biometric + manual
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-payroll-primary" />
              Present
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Leave
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-400" />
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
                  stroke="#E4E7E4"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #E4E7E4",
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  }}
                />
                <Bar
                  dataKey="present"
                  stackId="a"
                  fill="#1B6B54"
                  radius={[0, 0, 0, 0]}
                />
                <Bar dataKey="leave" stackId="a" fill="#F59E0B" />
                <Bar
                  dataKey="absent"
                  stackId="a"
                  fill="#EF4444"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-gray-100" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
