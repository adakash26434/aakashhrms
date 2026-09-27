"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatNPR, formatPayrollCycleMonth } from "@/lib/utils";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import type { TrendDataPoint } from "@/lib/types/dashboard";

interface MonthlyPayrollTrendProps {
  data: TrendDataPoint[];
  latestNet?: number;
  periodLabel?: string;
}

export function MonthlyPayrollTrend({
  data,
  latestNet,
  periodLabel,
}: MonthlyPayrollTrendProps) {
  const ready = useClientReady();
  const [showTable, setShowTable] = useState(false);
  const { calendar } = useDateFormat();

  // Map real payroll runs from database with localized month names (BS Nepali / AD English)
  const chartData =
    data && data.length > 0
      ? data.map((d) => {
          let label = d.month;
          if (d.monthNum) {
            label = formatPayrollCycleMonth(d.monthNum, undefined, undefined, calendar);
          }
          return {
            month: label.slice(0, 7),
            fullMonth: label,
            net: d.net,
            isEstimated: d.isEstimated ?? false,
          };
        })
      : [];

  const displayAmount =
    latestNet !== undefined && latestNet > 0
      ? formatNPR(latestNet).replace(/\.00$/, "")
      : chartData.length > 0
      ? formatNPR(chartData[chartData.length - 1].net).replace(/\.00$/, "")
      : "NPR 0.00";

  return (
    <Card className="h-full flex flex-col justify-between p-4 sm:p-5 bg-white">
      <div>
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
              Payroll Trend
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Net payout history by monthly cycle (NPR)
            </p>
          </div>

          <Link
            href="/reports/salary-sheet"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 transition-colors"
          >
            <span>Salary sheet</span>
          </Link>
        </div>

        {/* Big Metric Display */}
        <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
          <span className="text-xl sm:text-2xl font-semibold text-zinc-950 font-mono tracking-tight">
            {displayAmount}
          </span>
          <span className="text-xs font-medium text-emerald-800">
            {periodLabel ? `${periodLabel}` : "Latest cycle"}
          </span>
        </div>

        {/* Vertical Bar Chart */}
        <div className="mt-4 h-44 min-w-0 w-full">
          {ready ? (
            chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  barSize={32}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f4f4f5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) =>
                      val >= 100000 ? `${(val / 100000).toFixed(0)}L` : String(val)
                    }
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [
                      formatNPR(Number(val)),
                      "Net Payout",
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #e4e4e7",
                      backgroundColor: "#FFFFFF",
                      boxShadow: "0 2px 4px 0 rgba(0, 0, 0, 0.05)",
                    }}
                  />
                  <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isEstimated ? "#94a3b8" : "#065f46"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-md p-4">
                <p className="font-medium text-zinc-700">No payroll runs recorded yet</p>
                <p className="text-[11px] mt-0.5">Generate your first payroll cycle to begin tracking disbursement trends.</p>
              </div>
            )
          ) : (
            <div className="h-full w-full animate-pulse rounded-md bg-zinc-100" />
          )}
        </div>

        {/* Legend Row */}
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-200">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#065f46]" />
              <span>Paid</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#94a3b8]" />
              <span>Estimated</span>
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">L = 100,000 NPR</span>
        </div>
      </div>

      {/* Collapsible Chart Data Toggle */}
      <div className="mt-3 pt-2 border-t border-zinc-200">
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer transition-colors"
        >
          {showTable ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Hide data</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>View data</span>
            </>
          )}
        </button>

        {showTable && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
                <tr className="border-b border-zinc-300 bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-500">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Net Payout</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {chartData.map((d) => (
                  <tr key={d.month} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-3 py-2 font-medium text-zinc-900">
                      {d.month}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-800">
                      {formatNPR(d.net)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                          d.isEstimated
                            ? "border-emerald-200/50 bg-emerald-50/70 text-emerald-800"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {d.isEstimated ? "Estimated" : "Paid"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
