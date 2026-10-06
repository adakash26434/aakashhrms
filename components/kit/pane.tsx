"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, CircleDot, Dot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalActionKind, ApprovalTimelineEntry } from "@/lib/types/approval";

// Detail pane content (4.6e): the same blocks in every SplitView pane, top to
// bottom: the record's buttons (PaneActions), what the record is (a
// PaneSection without a title, or with one), its details (PaneSection +
// PaneFields), lists (useShowAll), and its approval timeline or history last.
// Sections are divided by a line; there are no boxes inside the pane's box.

/** The record's buttons, at the top of the pane; `hint` explains a missing or disabled action. */
export function PaneActions({ children, hint, hintTone = "muted" }: { children?: ReactNode; hint?: ReactNode; hintTone?: "muted" | "warning" }) {
  if (!children && !hint) return null;
  return (
    <div className="border-b border-line px-4 py-3">
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
      {hint && <p className={cn("text-2xs", children && "mt-1.5", hintTone === "warning" ? "text-warning" : "text-ink-muted")}>{hint}</p>}
    </div>
  );
}

/**
 * A titled block in a detail pane. `count` and a "Show all" toggle keep long
 * lists short; `collapsed` starts it folded (for things that no longer apply,
 * e.g. past exceptions); without a title it is the record's summary.
 */
export function PaneSection({
  title,
  aside,
  count,
  collapsed,
  tone = "default",
  children,
}: {
  title?: string;
  aside?: ReactNode;
  count?: number;
  /** Starts folded; the title opens it. */
  collapsed?: boolean;
  tone?: "default" | "warning";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsed);
  const heading = title ? (
    <>
      <span>
        {title}
        {count !== undefined && <span className="ml-1 font-normal text-ink-faint">({count})</span>}
      </span>
      {aside && <span className="font-normal normal-case tracking-normal text-ink">{aside}</span>}
    </>
  ) : null;
  return (
    <section aria-label={title} className={cn("border-b border-line px-4 py-3 text-xs last:border-0", tone === "warning" && "bg-warning-subtle/40")}>
      {heading &&
        (collapsed ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-1 text-left text-2xs font-semibold uppercase tracking-wide text-ink-muted hover:text-ink">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
            {heading}
          </button>
        ) : (
          <h3 className="flex items-baseline justify-between gap-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">{heading}</h3>
        ))}
      {open && <div className={cn(heading && "mt-2")}>{children}</div>}
    </section>
  );
}

export interface PaneField {
  label: string;
  value: ReactNode;
  /** A quieter line under the value (e.g. "Law: at least 90 days"). */
  note?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  href?: string;
}

const TONE: Record<NonNullable<PaneField["tone"]>, string> = {
  default: "text-ink",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

/**
 * Label / value rows. `layout="columns"` (default): the label in a column of
 * its own when the pane is wide enough, above the value when narrow — for
 * settings and words. `layout="figures"`: label left, value right on one line
 * — for amounts and counts that are read down a column.
 */
export function PaneFields({ rows, layout = "columns" }: { rows: PaneField[]; layout?: "columns" | "figures" }) {
  const valueOf = (r: PaneField) => {
    const v = <span className={cn("font-medium", layout === "figures" && "tabular-nums", TONE[r.tone ?? "default"])}>{r.value}</span>;
    return r.href ? (
      <Link href={r.href} className="inline-flex items-center gap-0.5 hover:underline">
        {v}
        <ChevronRight className="h-3 w-3 text-ink-faint" />
      </Link>
    ) : (
      v
    );
  };
  if (layout === "figures") {
    return (
      <dl className="space-y-1 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 text-ink-muted">{r.label}</dt>
            <dd className="shrink-0 text-right">
              {valueOf(r)}
              {r.note && <span className="block text-2xs text-ink-muted">{r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className="divide-y divide-line text-xs">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-1 gap-x-3 gap-y-0.5 py-1.5 first:pt-0 last:pb-0 @min-[30rem]:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-2xs text-ink-muted @min-[30rem]:pt-px @min-[30rem]:text-xs">{r.label}</dt>
          <dd className="min-w-0">
            {valueOf(r)}
            {r.note && <span className="mt-0.5 block text-2xs text-ink-muted">{r.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A few numbers side by side (e.g. the monthly effect of a salary change). */
export function PaneFigures({ items }: { items: { label: string; value: ReactNode; tone?: PaneField["tone"]; strong?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-1.5 @min-[26rem]:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className={cn("rounded-md px-2 py-1.5", i.strong ? "bg-brand-subtle" : "bg-surface-sunken")}>
          <dt className="text-3xs font-medium uppercase tracking-wide text-ink-muted">{i.label}</dt>
          <dd className={cn("text-sm font-semibold tabular-nums", TONE[i.tone ?? "default"])}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Show all (12)" under a list cut to its first few items. */
export function useShowAll<T>(items: T[], limit = 3): { shown: T[]; toggle: ReactNode } {
  const [all, setAll] = useState(false);
  if (items.length <= limit) return { shown: items, toggle: null };
  return {
    shown: all ? items : items.slice(0, limit),
    toggle: (
      <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 cursor-pointer text-2xs font-medium text-brand hover:underline">
        {all ? "Show fewer" : `Show all (${items.length})`}
      </button>
    ),
  };
}

// ---------------------------------------------------------------------------
// Approval timeline
// ---------------------------------------------------------------------------

export interface TimelineStep {
  id: string;
  /** "Approved", "Waiting", … */
  label: string;
  /** e.g. "Level 2" */
  detail?: string;
  who?: string;
  /** Already formatted for the user's calendar. */
  when?: string;
  note?: string;
  tone: "done" | "rejected" | "neutral" | "waiting" | "next";
}

const STEP_ICON: Record<TimelineStep["tone"], { icon: typeof Check; className: string }> = {
  done: { icon: Check, className: "bg-success-subtle text-success" },
  rejected: { icon: X, className: "bg-danger-subtle text-danger" },
  neutral: { icon: Dot, className: "bg-surface-sunken text-ink-muted" },
  waiting: { icon: CircleDot, className: "bg-warning-subtle text-warning" },
  next: { icon: CircleDot, className: "bg-surface-sunken text-ink-faint" },
};

/** Who did what and when, then what it waits for (the same on every approval pane). */
export function PaneTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol aria-label="Approval timeline" className="space-y-2 text-xs">
      {steps.map((s) => {
        const { icon: Icon, className } = STEP_ICON[s.tone];
        return (
          <li key={s.id} className="flex gap-2">
            <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", className)}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <p className={s.tone === "next" ? "text-ink-muted" : "text-ink"}>
                <span className="font-medium">{s.label}</span>
                {s.detail && <span className="text-ink-muted"> · {s.detail}</span>}
                {s.who && <span className="text-ink-muted"> · {s.who}</span>}
              </p>
              {s.when && <p className="text-3xs text-ink-faint">{s.when}</p>}
              {s.note && <p className="text-2xs text-ink-muted">{s.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const ACTION_TONE: Record<ApprovalActionKind, TimelineStep["tone"]> = {
  submitted: "done",
  approved: "done",
  final_approved: "done",
  not_required: "done",
  rejected: "rejected",
  withdrawn: "neutral",
  skipped: "neutral",
};

/** Timeline steps from approval entries; `waiting` adds the step it is waiting for. */
export function approvalSteps(entries: ApprovalTimelineEntry[], o: { label: Partial<Record<ApprovalActionKind, string>>; dateText: (iso: string) => string; waiting?: string | null }): TimelineStep[] {
  // "Submitted" first: older rows mix database and app clocks (time zones), so time alone can misorder it.
  const ordered = [...entries.filter((t) => t.action === "submitted"), ...entries.filter((t) => t.action !== "submitted")];
  const steps: TimelineStep[] = ordered.map((t) => ({
    id: t.id,
    label: o.label[t.action] ?? t.action,
    detail: t.level > 0 ? `Level ${t.level}` : undefined,
    who: t.action === "skipped" ? undefined : `${t.actorName}${t.onBehalfOfName ? ` on behalf of ${t.onBehalfOfName}` : ""}`,
    when: o.dateText(t.at),
    note: t.note ? (t.action === "skipped" ? t.note : `“${t.note}”`) : undefined,
    tone: ACTION_TONE[t.action] ?? "neutral",
  }));
  if (o.waiting) steps.push({ id: "waiting", label: "Waiting", who: o.waiting, tone: "waiting" });
  return steps;
}
