"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-mode building blocks for record pages (4.2), after the profile pages of
 * payroll and HR software (BambooHR, greytHR, Keka, Zoho Payroll): topic
 * cards whose values are plain, bold text under a small label, so the value
 * is what the eye lands on and nothing looks editable.
 */

export function InfoCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  id,
}: {
  title: string;
  icon?: LucideIcon;
  /** Right side of the title bar, e.g. an "Edit" link. */
  action?: { label: string; href: string } | ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const actionNode =
    action && typeof action === "object" && "href" in (action as object) ? (
      <Link href={(action as { href: string }).href} className="text-2xs font-medium text-brand-strong hover:underline">
        {(action as { label: string }).label}
      </Link>
    ) : (
      (action as ReactNode)
    );
  return (
    <section id={id} aria-label={title} className={cn("flex min-w-0 flex-col rounded-lg border border-line-card bg-surface shadow-sm", className)}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        {Icon && (
          <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-strong">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</h3>
        {actionNode}
      </header>
      <div className="flex-1 px-4 py-3">{children}</div>
    </section>
  );
}

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  /** Monospaced, for codes, numbers and dates. */
  mono?: boolean;
  tone?: "warning" | "danger" | "success" | "muted";
  /** Spread across the whole card (addresses, reasons). */
  wide?: boolean;
  /** Text copied by the copy button (shown on hover / focus). */
  copy?: string;
}

/** Copies a value (phone, email, code); visible on hover or focus of its group. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      title={done ? "Copied" : `Copy ${label.toLowerCase()}`}
      aria-label={done ? "Copied" : `Copy ${label.toLowerCase()}`}
      className="ml-1 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-surface-sunken hover:text-ink focus:opacity-100 group-hover:opacity-100"
    >
      {done ? <Check aria-hidden className="h-3 w-3 text-success" /> : <Copy aria-hidden className="h-3 w-3" />}
    </button>
  );
}

/** Label above value, in two or three columns. Empty values show a faint dash. */
export function DescriptionList({ items, columns = 2, className }: { items: DescriptionItem[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3.5", columns >= 2 && "sm:grid-cols-2", columns === 3 && "xl:grid-cols-3", className)}>
      {items.map((item) => {
        const empty = item.value === null || item.value === undefined || item.value === "";
        return (
          <div key={item.label} className={cn("group min-w-0", item.wide && columns >= 2 && "sm:col-span-2", item.wide && columns === 3 && "xl:col-span-3")}>
            <dt className="text-3xs font-semibold uppercase tracking-wider text-ink-faint">{item.label}</dt>
            <dd
              className={cn(
                "mt-0.5 flex min-w-0 items-center text-sm font-medium leading-snug",
                empty ? "text-ink-faint" : "text-ink",
                item.mono && "font-code tabular-nums",
                item.tone === "warning" && "text-warning",
                item.tone === "danger" && "text-danger",
                item.tone === "success" && "text-success",
                item.tone === "muted" && "font-normal text-ink-muted"
              )}
            >
              <span className={cn("min-w-0", item.wide ? "break-words" : "truncate")}>{empty ? "—" : item.value}</span>
              {!empty && item.copy && <CopyButton text={item.copy} label={item.label} />}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * One headline figure on a record's Overview (a person's base pay, last net
 * pay, leave left). Module screens keep to registers: KPI tiles appear only on
 * the dashboard and on a single record's Overview.
 */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: "warning" | "success";
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        {Icon && <Icon aria-hidden className={cn("h-4 w-4", tone === "warning" ? "text-warning" : "text-brand")} />}
      </div>
      <p className={cn("mt-1.5 truncate text-xl font-semibold leading-tight tabular-nums", tone === "warning" ? "text-warning" : "text-ink")}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-2xs text-ink-muted">{sub}</p>}
    </>
  );
  const cls = "min-w-0 rounded-lg border border-line-card bg-surface px-4 py-3 text-left shadow-sm";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "cursor-pointer transition-colors hover:border-brand/50 hover:bg-brand-subtle/40")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
