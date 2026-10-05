"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { SelectField } from "@/components/kit/select-field";
import { WindowButton } from "@/components/kit/window";
import { fmt } from "@/lib/engines/leave.engine";
import type { LeaveCalendarCell, LeavePageData } from "@/lib/types/leave";
import { cn } from "@/lib/utils";

const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const short = (code: string) => code.slice(0, 2).toUpperCase();

function cellTitle(name: string, date: string, c: LeaveCalendarCell | undefined) {
  if (!c) return `${name} · ${date}`;
  const parts = [name, date];
  if (c.leave) parts.push(`${c.leave.name}${c.leave.half ? " (half day)" : ""}${c.leave.unpaid ? ", unpaid" : ""} · ${c.leave.status === "Approved" ? "approved" : "waiting"}`);
  if (c.off) parts.push(c.offName ?? (c.off === "holiday" ? "Holiday" : "Weekly off"));
  return parts.join(" · ");
}

/**
 * Who is on leave in a BS month: one row per person in scope, approved leave
 * solid, waiting requests lighter and dashed, weekly offs and holidays
 * shaded (from each person's own shift, roster and branch holidays).
 */
export function LeaveCalendar({ data }: { data: LeavePageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const [moving, startMove] = useTransition();
  const [branch, setBranch] = useState("");
  const [onlyLeave, setOnlyLeave] = useState(false);
  const cal = data.calendar;

  const rows = useMemo(
    () => (cal?.rows ?? []).filter((r) => (!branch || r.employee.branchId === branch) && (!onlyLeave || Object.values(r.cells).some((c) => c.leave))),
    [cal, branch, onlyLeave]
  );
  const usedTypes = useMemo(() => {
    const codes = new Set(rows.flatMap((r) => Object.values(r.cells).flatMap((c) => (c.leave ? [c.leave.code] : []))));
    return (cal?.types ?? []).filter((t) => codes.has(t.code));
  }, [rows, cal]);

  if (!cal) {
    return (
      <p className="flex items-center gap-1.5 p-4 text-xs text-ink-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the calendar…
      </p>
    );
  }

  const go = (year: number, month: number) => startMove(() => router.push(`${pathname}?tab=calendar&y=${year}&m=${month}`, { scroll: false }));
  const step = (delta: number) => {
    const i = cal.period.year * 12 + (cal.period.month - 1) + delta;
    go(Math.floor(i / 12), (i % 12) + 1);
  };
  const onLeaveToday = rows.filter((r) => r.cells[data.today]?.leave?.status === "Approved").length;

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <WindowButton onClick={() => step(-1)} disabled={moving} aria-label="Previous month">
            <ChevronLeft className="h-3.5 w-3.5" />
          </WindowButton>
          <span className="min-w-36 text-center text-sm font-semibold text-ink" aria-live="polite">
            {moving ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : cal.period.label}
          </span>
          <WindowButton onClick={() => step(1)} disabled={moving} aria-label="Next month">
            <ChevronRight className="h-3.5 w-3.5" />
          </WindowButton>
          {!(data.today >= cal.period.start && data.today <= cal.period.end) && (
            <WindowButton onClick={() => startMove(() => router.push(`${pathname}?tab=calendar`, { scroll: false }))} disabled={moving}>
              This month
            </WindowButton>
          )}
        </div>
        <div className="w-56">
          <SelectField name="calendar-branch" options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={branch} onChange={setBranch} placeholder="All branches" allowEmpty />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
          <input type="checkbox" checked={onlyLeave} onChange={(e) => setOnlyLeave(e.target.checked)} className="h-3.5 w-3.5 accent-brand" />
          Only people on leave
        </label>
        <span className="ml-auto text-2xs text-ink-muted">
          {rows.length} {rows.length === 1 ? "person" : "people"}
          {onLeaveToday ? ` · ${onLeaveToday} on leave today` : ""}
        </span>
      </div>

      <ul className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-muted" aria-label="Key">
        {usedTypes.map((t) => (
          <li key={t.id} className="flex items-center gap-1">
            <span className="rounded bg-brand-subtle px-1 font-semibold text-brand-strong">{short(t.code)}</span> {t.name}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="rounded border border-dashed border-brand/50 px-1 font-semibold text-brand-strong opacity-70">··</span> Waiting
        </li>
        <li className="flex items-center gap-1">
          <span className="rounded bg-danger-subtle px-1 font-semibold text-danger">··</span> Unpaid
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded-sm bg-line/60" /> Weekly off
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded-sm bg-warning-subtle" /> Holiday
        </li>
        <li className="ml-auto text-ink-faint">Point at a box to see the leave, its status and the holiday name.</li>
      </ul>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-xs text-ink-muted">{onlyLeave ? "Nobody is on leave this month." : "Nobody in your scope was employed this month."}</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-surface">
          <table className="w-full border-separate border-spacing-0 text-2xs" aria-label={`Leave calendar, ${cal.period.label}`}>
            <thead className="sticky top-0 z-20 bg-surface-panel">
              <tr>
                <th scope="col" className="sticky left-0 z-30 min-w-44 border-b border-r border-line bg-surface-panel px-2 py-1 text-left font-semibold text-ink">
                  Employee
                </th>
                {cal.days.map((d) => (
                  <th key={d.date} scope="col" title={d.date === data.today ? `Today, ${d.date}` : d.date} className={cn("w-7 min-w-7 border-b border-line px-0 py-1 text-center font-medium", d.date === data.today ? "bg-brand-subtle font-bold text-brand-strong" : d.weekday === 6 ? "text-ink-muted" : "text-ink")}>
                    <span className="block tabular-nums">{d.bsDay}</span>
                    <span className="block text-3xs opacity-75">{DAY_LETTER[d.weekday]}</span>
                  </th>
                ))}
                <th scope="col" className="border-b border-l border-line px-2 py-1 text-right font-semibold text-ink" title="Approved leave days this month">
                  Days
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const total = Object.values(r.cells).reduce((n, c) => n + (c.leave?.status === "Approved" ? (c.leave.half ? 0.5 : 1) : 0), 0);
                return (
                  <tr key={r.employee.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-line bg-surface px-2 py-1 text-left font-medium text-ink">
                      <span className="block max-w-48 truncate">{r.employee.fullName}</span>
                      <span className="block truncate text-3xs font-normal text-ink-faint">{r.employee.departmentName || r.employee.branchName}</span>
                    </th>
                    {cal.days.map((d) => {
                      const c = r.cells[d.date];
                      return (
                        <td
                          key={d.date}
                          title={cellTitle(r.employee.fullName, d.date, c)}
                          className={cn("h-8 border-b border-line p-0.5 text-center", c?.off === "weekly" && "bg-line/60", c?.off === "holiday" && "bg-warning-subtle", d.date === data.today && "ring-1 ring-inset ring-brand/40")}
                        >
                          {c?.leave && (
                            <span
                              className={cn(
                                "flex h-full items-center justify-center rounded font-semibold",
                                c.leave.unpaid ? "bg-danger-subtle text-danger" : "bg-brand-subtle text-brand-strong",
                                c.leave.status === "Pending" && "border border-dashed border-brand/50 bg-transparent opacity-70"
                              )}
                            >
                              {short(c.leave.code)}
                              {c.leave.half && <span className="text-3xs">½</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-line px-2 py-1 text-right font-semibold tabular-nums text-ink">{total ? fmt(total) : <span className="font-normal text-ink-faint">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
