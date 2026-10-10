"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { BS_MONTHS_EN, adToBS } from "@/lib/utils/bs-calendar";
import { WORKING_PERIOD_KEY, formatWorkingPeriod, shiftWorkingPeriod, workingPeriodLabel } from "@/lib/utils/working-period-pref";
import type { PeriodCalendar } from "@/lib/engines/pay-period.engine";
import type { WorkingPeriod } from "@/lib/types/payroll-run";
import { cn } from "@/lib/utils";

const AD_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function thisMonth(calendar: PeriodCalendar): WorkingPeriod {
  const now = new Date();
  if (calendar === "AD") return { calendar, year: now.getFullYear(), month: now.getMonth() + 1 };
  const bs = adToBS(now);
  return { calendar, year: bs.year, month: bs.month };
}

/**
 * E1: the working period in the title bar ("Period · Aswin 2083"). Payroll's
 * New run, Attendance's month and the report month default to it. Kept in a
 * cookie; the pages read it on the server, so choosing a month refreshes them.
 */
export function WorkingPeriodPill({ period, calendar }: { period: WorkingPeriod | null; calendar: PeriodCalendar }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkingPeriod>(period ?? thisMonth(calendar));
  const ref = useRef<HTMLDivElement>(null);
  const current = period ?? thisMonth(calendar);
  const months = (calendar === "AD" ? AD_MONTHS : BS_MONTHS_EN).slice(1);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (p: WorkingPeriod) => {
    document.cookie = `${WORKING_PERIOD_KEY}=${formatWorkingPeriod(p)}; path=/; max-age=31536000; samesite=lax`;
    setDraft(p);
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => {
          setDraft(current);
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Working period: Payroll, Attendance and Reports open on this month"
        className={cn("flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium text-ink hover:bg-surface-sunken", period ? "border-brand/40 bg-brand-subtle" : "border-line")}
      >
        <CalendarRange className="h-3.5 w-3.5 text-brand" />
        <span className="text-ink-muted">Period ·</span> {workingPeriodLabel(current)}
      </button>
      {open && (
        <div role="dialog" aria-label="Working period" className="absolute right-0 z-40 mt-1 w-64 rounded-md border border-line bg-surface p-2 shadow-lg">
          <div className="flex items-center justify-between gap-1">
            <button type="button" className="rounded p-1 text-ink-muted hover:bg-surface-sunken" aria-label="Previous month" onClick={() => setDraft((d) => shiftWorkingPeriod(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-ink">{workingPeriodLabel(draft)}</span>
            <button type="button" className="rounded p-1 text-ink-muted hover:bg-surface-sunken" aria-label="Next month" onClick={() => setDraft((d) => shiftWorkingPeriod(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex gap-1.5">
            <select aria-label="Month" className="h-7 flex-1 rounded border border-line bg-surface px-1 text-xs" value={draft.month} onChange={(e) => setDraft((d) => ({ ...d, month: Number(e.target.value) }))}>
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input aria-label="Year" type="number" className="h-7 w-20 rounded border border-line bg-surface px-1 text-xs" value={draft.year} onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) || d.year }))} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" className="text-2xs text-ink-muted underline-offset-2 hover:underline" onClick={() => choose(thisMonth(calendar))}>
              This month
            </button>
            <button type="button" className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:opacity-90" onClick={() => choose(draft)}>
              Use this period
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
