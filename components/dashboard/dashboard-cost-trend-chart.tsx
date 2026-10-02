"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS_TICK, CHART_COLORS, CHART_THEME, CHART_TOOLTIP_STYLE } from "@/lib/constants/colors";
import { formatAmount } from "@/lib/kit/amount";
import { isSwing } from "@/lib/engines/dashboard.engine";
import type { CostTrendPoint } from "@/lib/types/dashboard";
import { COST_TREND_SERIES } from "./dashboard-chart-series";

const SERIES = COST_TREND_SERIES;

function compactAxis(value: number) {
  return value === 0 ? "0" : formatAmount(value, { compact: true });
}

interface TooltipEntry {
  payload?: CostTrendPoint;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE} className="px-4 py-2">
      <p className="mb-1 text-xs font-semibold text-ink">
        {point.label} {!point.locked && point.hasData && <span className="font-normal text-warning">(not locked)</span>}
      </p>
      {point.hasData ? (
        <dl className="space-y-0.5 text-2xs">
          {SERIES.map((s) => (
            <div key={s.key} className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </dt>
              <dd className="tabular-nums text-ink">{formatAmount(point[s.key])}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1 font-semibold">
            <dt className="text-ink">Payroll cost</dt>
            <dd className="tabular-nums text-ink">{formatAmount(point.employerCost)}</dd>
          </div>
          {point.changePct !== null && (
            <p className={isSwing(point.changePct) ? "text-warning" : "text-ink-faint"}>
              {point.changePct > 0 ? "+" : ""}
              {point.changePct}% on the month before
            </p>
          )}
        </dl>
      ) : (
        <p className="text-2xs text-ink-muted">No payroll this month</p>
      )}
    </div>
  );
}

/**
 * Payroll cost by month (4.1): net pay + deductions + employer PF stacked, so
 * the bar height is the cost to the company. Months not yet locked are drawn
 * lighter; swings of 10% or more get a marker above the bar.
 */
export function DashboardCostTrendChart({ points }: { points: CostTrendPoint[] }) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 220 }}>
        <BarChart data={points} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
          <XAxis dataKey="shortLabel" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={48} />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: CHART_THEME.grid, opacity: 0.6 }} />
          {SERIES.map((s, si) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="cost"
              fill={s.color}
              radius={si === SERIES.length - 1 ? [3, 3, 0, 0] : undefined}
              isAnimationActive={false}
              label={
                si === SERIES.length - 1
                  ? (props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
                      const p = points[props.index ?? -1];
                      if (!p || !isSwing(p.changePct)) return <g />;
                      const x = Number(props.x) + Number(props.width) / 2;
                      return (
                        <text x={x} y={Number(props.y) - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill={CHART_COLORS.warning}>
                          {p.changePct! > 0 ? "▲" : "▼"} {Math.abs(p.changePct!)}%
                        </text>
                      );
                    }
                  : undefined
              }
            >
              {points.map((p) => (
                <Cell key={p.key} fillOpacity={p.locked ? 1 : 0.45} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

