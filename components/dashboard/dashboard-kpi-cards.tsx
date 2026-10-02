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
  const lastIndex = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop() ?? 0;
  const lastY = h - 2 - (((values[lastIndex] as number) - min) / span) * (h - 4);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-hidden>
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
    <span
      className={cn("inline-flex items-center gap-0.5 text-2xs font-medium tabular-nums", kpi.tone === "warning" ? "text-warning" : "text-ink-muted")}
      title={kpi.tone === "warning" ? "A change of 10% or more: worth a second look" : undefined}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {kpi.changePct > 0 ? "+" : ""}
      {kpi.changePct}% <span className="font-normal text-ink-faint">{compareLabel}</span>
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
    <ul aria-label="Key figures" className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.id];
        const value = display(kpi);
        return (
          <li key={kpi.id} className="min-w-0 last:col-span-2 md:last:col-span-1">
            <Link
              href={kpi.href}
              className="group flex h-full min-w-0 flex-col rounded-lg border border-line bg-surface px-3.5 pb-2.5 pt-3 transition-colors hover:border-line-strong"
            >
              <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-faint">
                <Icon aria-hidden className="h-3.5 w-3.5" />
                <span className="truncate">{kpi.label}</span>
              </span>
              <span className="mt-1 truncate text-2xl font-semibold leading-tight tabular-nums text-ink" title={value.full}>
                {value.text}
              </span>
              <span className="mt-0.5 min-h-4 truncate">
                <Change kpi={kpi} compareLabel={compareLabel} />
              </span>
              <span className="mt-1.5">
                <Sparkline values={kpi.sparkline} warning={kpi.tone === "warning"} />
              </span>
              <span className="mt-1 truncate text-2xs text-ink-muted group-hover:text-ink">{kpi.hint}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
