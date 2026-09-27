import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";

export interface KpiMetric {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
    positive?: boolean;
  };
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | ReactNode;
  badge?: string;
}

export interface KpiStripProps extends React.HTMLAttributes<HTMLDivElement> {
  metrics: KpiMetric[];
  columns?: 2 | 3 | 4 | 5;
}

function renderKpiIcon(icon: KpiMetric["icon"]) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === "function") {
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className="h-4 w-4 text-zinc-400" />;
  }
  return null;
}

export function KpiStrip({
  metrics,
  columns,
  className,
  ...props
}: KpiStripProps) {
  const getGridCols = (cols?: number, count = metrics.length) => {
    if (cols === 2) return "grid-cols-1 sm:grid-cols-2";
    if (cols === 3) return "grid-cols-1 sm:grid-cols-3";
    if (cols === 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
    if (cols === 5) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5";
    // Automatic based on count:
    if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
    if (count === 3) return "grid-cols-1 sm:grid-cols-3";
    if (count === 5) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  };

  return (
    <div
      className={cn(
        "grid divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2",
        getGridCols(columns, metrics.length),
        className,
      )}
      {...props}
    >
      {metrics.map((metric, idx) => {
        const renderedIcon = renderKpiIcon(metric.icon);

        return (
          <div
            key={idx}
            className="flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500 line-clamp-1">
                {metric.title}
              </span>
              {renderedIcon && (
                <div className="text-zinc-400 shrink-0">
                  {renderedIcon}
                </div>
              )}
            </div>

            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {metric.value}
              </span>
              {metric.badge && (
                <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {metric.badge}
                </span>
              )}
            </div>

            {(metric.subtext || metric.trend) && (
              <div className="mt-3 flex items-center justify-between gap-1.5 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                {metric.subtext && (
                  <span className="truncate">{metric.subtext}</span>
                )}
                {metric.trend && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-medium shrink-0 ml-auto",
                      metric.trend.direction === "neutral"
                        ? "text-zinc-500"
                        : metric.trend.positive ?? (metric.trend.direction === "up")
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {metric.trend.direction === "up" && (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                    {metric.trend.direction === "down" && (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {metric.trend.direction === "neutral" && (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    {metric.trend.label}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
