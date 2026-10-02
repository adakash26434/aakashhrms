"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, CalendarRange, Loader2 } from "lucide-react";
import type { DashboardFilters as Filters, DashboardPeriodOption } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

const PERIODS: { id: DashboardPeriodOption; label: string }[] = [
  { id: "latest", label: "Latest month" },
  { id: "fy", label: "This fiscal year" },
  { id: "12m", label: "Last 12 months" },
];

function query(period: DashboardPeriodOption, branchId: string | null): string {
  const params = new URLSearchParams();
  if (period !== "latest") params.set("period", period);
  if (branchId) params.set("branch", branchId);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * Period and branch filters. They live in the URL so the dashboard renders
 * on the server for the chosen view and the link can be shared; the server
 * re-validates both (unknown values fall back to the defaults).
 */
export function DashboardFilters({ filters }: { filters: Filters }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { period, branchId, branches } = filters;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="group" aria-label="Period" className="inline-flex rounded-md border border-line bg-surface p-0.5">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            href={`${pathname}${query(p.id, branchId)}`}
            aria-current={period.option === p.id ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              startTransition(() => router.push(`${pathname}${query(p.id, branchId)}`, { scroll: false }));
            }}
            className={cn(
              "inline-flex h-7 items-center rounded px-2.5 text-xs font-medium",
              period.option === p.id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
        <span className="font-medium text-ink">{period.label}</span>
        <span className="hidden sm:inline">· {period.compareLabel}</span>
      </p>
      {branches.length > 1 && (
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <Building2 className="h-3.5 w-3.5" />
          <span className="sr-only">Branch</span>
          <select
            value={branchId ?? ""}
            onChange={(e) => startTransition(() => router.push(`${pathname}${query(period.option, e.target.value || null)}`, { scroll: false }))}
            className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
