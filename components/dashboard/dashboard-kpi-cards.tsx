import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Landmark, ReceiptText, ShieldCheck, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { formatAmount } from "@/lib/kit/amount";
import type { DashboardKpi } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

const ICONS: Record<DashboardKpi["id"], LucideIcon> = {
  cost: Landmark,
  net: ReceiptText,
  statutory: ShieldCheck,
  headcount: UsersRound,
  average: UserRound,
};

function display(kpi: DashboardKpi): { text: string; full?: string } {
  if (kpi.value === null) return { text: "—" };
  if (kpi.format === "count") return { text: kpi.value.toLocaleString("en-IN") };
  return { text: formatAmount(kpi.value, { compact: true }), full: formatAmount(kpi.value, { prefix: "NPR" }) };
}

/** A 12-month line drawn as SVG; gaps where a month has no payroll. */
function Sparkline({ values, warning }: { values: (number | null)[]; warning: boolean }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <span className="block h-8" aria-hidden />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const step = w / Math.max(values.length - 1, 1);
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    const x = i * step;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    pen = true;
  });
  const indices = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  const firstIndex = indices[0] ?? 0;
  const lastIndex = indices[indices.length - 1] ?? 0;
  const lastY = h - 2 - (((values[lastIndex] as number) - min) / span) * (h - 4);
  // Soft area under the line (only when the series has no gaps, so it never bridges a missing month).
  const continuous = indices.length === lastIndex - firstIndex + 1;
  const area = continuous ? `${d}L${(lastIndex * step).toFixed(1)},${h} L${(firstIndex * step).toFixed(1)},${h} Z` : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-hidden>
      {area && <path d={area} className={warning ? "fill-warning/10" : "fill-brand/10"} />}
      <path d={d} fill="none" strokeWidth={1.6} vectorEffect="non-scaling-stroke" className={warning ? "stroke-warning" : "stroke-brand"} />
      <circle cx={lastIndex * step} cy={lastY} r={2.2} className={warning ? "fill-warning" : "fill-brand"} />
    </svg>
  );
}

function Change({ kpi, compareLabel }: { kpi: DashboardKpi; compareLabel: string }) {
  if (kpi.changeNote) return <span className="text-2xs font-medium text-ink-muted">{kpi.changeNote}</span>;
  if (kpi.changePct === null) return <span className="text-2xs text-ink-faint">No earlier figure to compare</span>;
  const Icon = kpi.changePct > 0 ? ArrowUpRight : kpi.changePct < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-2xs">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px font-semibold tabular-nums",
          kpi.tone === "warning" ? "bg-warning-subtle text-warning" : "bg-surface-sunken text-ink-muted"
        )}
        title={kpi.tone === "warning" ? "A change of 10% or more: worth a second look" : undefined}
      >
        <Icon aria-hidden className="h-3 w-3" />
        {kpi.changePct > 0 ? "+" : ""}
        {kpi.changePct}%
      </span>
      <span className="truncate text-ink-faint">{compareLabel}</span>
    </span>
  );
}

/**
 * Headline figures (4.1): value, change against the comparison period and a
 * 12-month sparkline. Direction is never coloured good or bad on its own; a
 * swing of 10% or more turns amber.
 */
export function DashboardKpiCards({ kpis, compareLabel }: { kpis: DashboardKpi[]; compareLabel: string }) {
  return (
    <ul aria-label="Key figures" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.id];
        const value = display(kpi);
        return (
          <li key={kpi.id} className="min-w-0 last:col-span-2 md:last:col-span-1">
            <Link
              href={kpi.href}
              className="group flex h-full min-w-0 flex-col rounded-lg border border-line-card bg-surface px-4 pb-3.5 pt-4 shadow-sm transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-md"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-strong">
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="truncate">{kpi.label}</span>
              </span>
              <span className="mt-3 flex min-w-0 items-baseline gap-1.5" title={value.full}>
                {kpi.format === "amount" && kpi.value !== null && <span className="text-2xs font-medium text-ink-faint">NPR</span>}
                <span className="truncate text-2xl font-semibold leading-tight tabular-nums text-ink">{value.text}</span>
              </span>
              <span className="mt-1.5 flex min-h-5 min-w-0 items-center">
                <Change kpi={kpi} compareLabel={compareLabel} />
              </span>
              <span className="mt-3">
                <Sparkline values={kpi.sparkline} warning={kpi.tone === "warning"} />
              </span>
              <span className="mt-2 truncate border-t border-line pt-2 text-2xs text-ink-muted group-hover:text-ink">{kpi.hint}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
