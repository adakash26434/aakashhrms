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
import { PAYROLL_COLORS } from "@/lib/constants/colors";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import type { AttendanceDay } from "@/lib/types/dashboard";

interface AttendanceLeaveChartProps {
  data: AttendanceDay[];
}

export function AttendanceLeaveChart({ data }: AttendanceLeaveChartProps) {
  const ready = useClientReady();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1b3a1f]">
              Attendance & leave — this week
            </h3>
            <p className="text-xs text-gray-500">
              % of active employees · device + manual entries reconciled
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PAYROLL_COLORS.primary }}
              />
              Present
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Leave
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Absent
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-55 min-w-0 w-full">
          {ready ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PAYROLL_COLORS.light} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: PAYROLL_COLORS.primary }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: PAYROLL_COLORS.primary }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${PAYROLL_COLORS.light}`,
                  }}
                />
                <Bar dataKey="present" stackId="a" fill={PAYROLL_COLORS.primary} radius={[0, 0, 0, 0]} />
                <Bar dataKey="leave" stackId="a" fill="#FBBF24" />
                <Bar dataKey="absent" stackId="a" fill="#F87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-[#d7e8d0]" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
