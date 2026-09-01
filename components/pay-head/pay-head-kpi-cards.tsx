import {
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldCheck,
  Layers,
} from "lucide-react";
import type { PayHeadCounts } from "@/lib/engines/pay-head.engine";

interface PayHeadKpiCardsProps {
  counts: PayHeadCounts;
}

/**
 * Four KPI cards for the Pay Head Setup page:
 *   1. Total Heads    — `counts.total`
 *   2. Allowances     — `counts.allowances` (green up arrow)
 *   3. Deductions     — `counts.deductions` (red down arrow)
 *   4. Statutory      — `counts.statutory`   (violet shield)
 *
 * The numbers are pre-computed by the parent (via the engine's
 * `countByType`) — this keeps the engine as the single source
 * of truth for the rules and lets the same numbers be reused
 * elsewhere.
 */
export function PayHeadKpiCards({ counts }: PayHeadKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={<Layers className="h-5 w-5 text-[#2e7d32]" />}
        label="Total Heads"
        value={counts.total}
        tone="blue"
      />
      <KpiCard
        icon={<ArrowUpCircle className="h-5 w-5 text-emerald-600" />}
        label="Allowances"
        value={counts.allowances}
        tone="emerald"
      />
      <KpiCard
        icon={<ArrowDownCircle className="h-5 w-5 text-red-500" />}
        label="Deductions"
        value={counts.deductions}
        tone="red"
      />
      <KpiCard
        icon={<ShieldCheck className="h-5 w-5 text-violet-600" />}
        label="Statutory"
        value={counts.statutory}
        tone="violet"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  /** Tints the icon background. Purely decorative. */
  tone: "blue" | "emerald" | "red" | "violet";
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneBg: Record<KpiCardProps["tone"], string> = {
    blue: "bg-green-50",
    emerald: "bg-emerald-50",
    red: "bg-red-50",
    violet: "bg-violet-50",
  };

  return (
    <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneBg[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-semibold text-[#1b3a1f] tabular-nums">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
