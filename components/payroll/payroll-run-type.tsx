"use client";

import { CalendarDays, Gift, History } from "lucide-react";
import { RUN_TYPE_LABEL, RUN_TYPES, type RunType } from "@/lib/constants/run-types";
import { cn } from "@/lib/utils";

// Run type picker for the New pay run window (4.8 / F6): the monthly salary, or an off-cycle
// run in the same month — the festival allowance (with its heads and the Labour Act proration)
// or arrears — each taxed on its own.

const ICON: Record<RunType, typeof CalendarDays> = { REGULAR: CalendarDays, FESTIVAL: Gift, ARREARS: History };

export function PayrollRunTypePicker({
  value,
  onChange,
  festivalHeads,
  selectedFestivalHeads,
  onToggleFestivalHead,
  prorate,
  onProrate,
  className,
}: {
  value: RunType;
  onChange: (next: RunType) => void;
  festivalHeads: { id: string; name: string }[];
  selectedFestivalHeads: string[];
  onToggleFestivalHead: (id: string) => void;
  prorate: boolean;
  onProrate: (next: boolean) => void;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface p-3", className)} aria-labelledby="run-type-heading">
      <h2 id="run-type-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Run type
      </h2>
      <div role="radiogroup" aria-labelledby="run-type-heading" className="grid gap-2 sm:grid-cols-3">
        {RUN_TYPES.map((type) => {
          const Icon = ICON[type];
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(type)}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                active ? "border-brand bg-brand-subtle" : "border-line hover:bg-surface-sunken",
              )}
            >
              <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-brand" : "text-ink-faint")} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {RUN_TYPE_LABEL[type].en} <span className="font-normal text-ink-faint">· {RUN_TYPE_LABEL[type].np}</span>
                </span>
                <span className="block text-xs text-ink-muted">{RUN_TYPE_LABEL[type].hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {value === "FESTIVAL" && (
        <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
          {festivalHeads.length === 0 ? (
            <p className="text-xs text-warning">No festival allowance head is set up. Add one under Setup → Pay heads (festival allowance, on basic salary).</p>
          ) : (
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-ink-muted">Pay these heads</legend>
              <div className="flex flex-wrap gap-2">
                {festivalHeads.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5">
                    <input type="checkbox" checked={selectedFestivalHeads.includes(h.id)} onChange={() => onToggleFestivalHead(h.id)} />
                    {h.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={prorate} onChange={(e) => onProrate(e.target.checked)} />
            <span>
              Pay in proportion for service under a year
              <span className="block text-xs text-ink-muted">Labour Act 2074 §37: one month&apos;s basic remuneration a year; completed months ÷ 12 before the first year.</span>
            </span>
          </label>
        </div>
      )}
      {value === "ARREARS" && (
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
          Pays the back pay owed for salary revisions dated into approved or locked months — once: a month paid here is never paid again by the regular run.
        </p>
      )}
    </section>
  );
}
