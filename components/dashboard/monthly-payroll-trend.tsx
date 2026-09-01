"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PAYROLL_COLORS } from "@/lib/constants/colors";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import type { TrendDataPoint } from "@/lib/types/dashboard";

interface MonthlyPayrollTrendProps {
  data: TrendDataPoint[];
}

export function MonthlyPayrollTrend({ data }: MonthlyPayrollTrendProps) {
  const ready = useClientReady();

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-payroll-navy">
              Monthly payroll trend
            </h3>
            <p className="text-xs text-gray-500">
              Gross vs Net (NPR Crore) — last 5 months
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PAYROLL_COLORS.navy }}
              />
              Gross
            </span>
            <span className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PAYROLL_COLORS.primary }}
              />
              Net
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              TDS
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-60 min-w-0 w-full">
          {ready ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={data}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="grossGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={PAYROLL_COLORS.primary}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={PAYROLL_COLORS.primary}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={PAYROLL_COLORS.light}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
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
                <Area
                  type="monotone"
                  dataKey="gross"
                  stroke={PAYROLL_COLORS.navy}
                  strokeWidth={2}
                  fill="url(#grossGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke={PAYROLL_COLORS.primary}
                  strokeWidth={2}
                  fill="transparent"
                />
                <Line
                  type="monotone"
                  dataKey="tds"
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-payroll-light" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
