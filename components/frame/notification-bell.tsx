"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, CalendarClock, CheckCircle2, ClipboardCheck, RefreshCw, Wallet, type LucideIcon } from "lucide-react";
import { getNotificationsAction } from "@/app/actions/notification.actions";
import type { NotificationCentre, NotificationGroup, NotificationItem, NotificationTone } from "@/lib/types/notification";
import { cn } from "@/lib/utils";

/**
 * Notification centre (F17): the title-bar bell. The number is what waits for this person —
 * requests to decide and pay-run steps; a dot means a statutory deposit is due within three
 * days. The list comes with the page and is read again whenever the panel opens.
 */

const GROUPS: { id: NotificationGroup; title: string; icon: LucideIcon }[] = [
  { id: "approvals", title: "Waiting for you", icon: ClipboardCheck },
  { id: "payroll", title: "Pay runs", icon: Wallet },
  { id: "deadlines", title: "Deposits due", icon: CalendarClock },
];

const TAG_TONE: Record<NotificationTone, string> = {
  danger: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning",
  neutral: "bg-surface-sunken text-ink-muted",
};

function bellLabel(c: NotificationCentre): string {
  if (c.total > 0) return `Notifications: ${c.total} waiting for you`;
  return c.urgent ? "Notifications: a deposit is due soon" : "Notifications";
}

export function NotificationBell({ initial }: { initial: NotificationCentre }) {
  const [open, setOpen] = useState(false);
  // A fresher read replaces the page's list until the page brings a newer one.
  const [fresh, setFresh] = useState<{ from: NotificationCentre; data: NotificationCentre } | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, startLoading] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const centre = fresh && fresh.from === initial ? fresh.data : initial;

  const reload = () =>
    startLoading(async () => {
      const res = await getNotificationsAction();
      setFailed(!res.success);
      if (res.success) setFresh({ from: initial, data: res.data });
    });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open) reload();
    setOpen(!open);
  };

  const label = bellLabel(centre);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn("relative flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken cursor-pointer", open && "bg-surface-sunken")}
      >
        <Bell className="h-4 w-4" />
        {centre.total > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-3xs font-semibold text-white tabular-nums">
            {centre.total > 99 ? "99+" : centre.total}
          </span>
        ) : (
          centre.urgent && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-chrome" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-12 z-50 rounded-lg border border-line bg-surface shadow-lg animate-[dialogIn_140ms_var(--ease-out-quint)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <p className="flex-1 text-sm font-semibold text-ink">Notifications</p>
            {failed && <span className="text-2xs text-ink-faint">Couldn&apos;t refresh</span>}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh notifications"
              title="Refresh"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink disabled:cursor-default cursor-pointer"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>

          <div className="max-h-[min(70vh,32rem)] overflow-y-auto py-1" aria-busy={loading}>
            {centre.items.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
                <p className="text-sm font-medium text-ink">Nothing needs you right now</p>
                <p className="text-xs text-ink-muted">Requests to decide, pay-run steps and deposits due will show here.</p>
              </div>
            ) : (
              GROUPS.map((group) => {
                const items = centre.items.filter((i) => i.group === group.id);
                if (!items.length) return null;
                const Icon = group.icon;
                return (
                  <section key={group.id} aria-label={group.title} className="py-1">
                    <h3 className="flex items-center gap-1.5 px-3 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                      <Icon className="h-3.5 w-3.5" aria-hidden /> {group.title}
                    </h3>
                    <ul>
                      {items.map((item) => (
                        <li key={item.id}>
                          <ItemLink item={item} onNavigate={() => setOpen(false)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemLink({ item, onNavigate }: { item: NotificationItem; onNavigate: () => void }) {
  return (
    <Link href={item.href} onClick={onNavigate} className="flex items-start gap-3 px-3 py-1.5 hover:bg-surface-sunken focus-visible:bg-surface-sunken">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{item.label}</span>
        <span className="line-clamp-2 text-xs text-ink-muted">{item.detail}</span>
      </span>
      {item.tag ? (
        <span className={cn("mt-0.5 shrink-0 whitespace-nowrap rounded px-1.5 text-2xs font-medium leading-4", TAG_TONE[item.tone])}>{item.tag}</span>
      ) : (
        item.count > 0 && (
          <span className="mt-0.5 rounded-full bg-brand-red px-1.5 text-3xs font-semibold leading-4 text-white tabular-nums" aria-label={`${item.count} waiting`}>
            {item.count > 99 ? "99+" : item.count}
          </span>
        )
      )}
    </Link>
  );
}
