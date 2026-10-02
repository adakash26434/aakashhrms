"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TOOLTIP_STYLE } from "@/lib/constants/colors";
import { formatAmount } from "@/lib/kit/amount";
import type { BreakdownSegment } from "@/lib/types/dashboard";
import { BREAKDOWN_COLORS } from "./dashboard-chart-series";

/** Where the payroll cost went (4.1): a donut with the total in the middle. */
export function DashboardCostBreakdownChart({ total, segments }: { total: number; segments: BreakdownSegment[] }) {
  return (
    <div className="relative h-44 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 220 }}>
        <PieChart>
          <Pie data={segments} dataKey="amount" nameKey="label" innerRadius="64%" outerRadius="96%" paddingAngle={1} stroke="none" isAnimationActive={false}>
            {segments.map((s) => (
              <Cell key={s.id} fill={BREAKDOWN_COLORS[s.id]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [`${formatAmount(Number(value))} (${total ? Math.round((Number(value) / total) * 1000) / 10 : 0}%)`, String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xs uppercase tracking-wide text-ink-faint">Total cost</span>
        <span className="text-base font-semibold tabular-nums text-ink" title={formatAmount(total, { prefix: "NPR" })}>
          {formatAmount(total, { compact: true })}
        </span>
      </div>
    </div>
  );
}
