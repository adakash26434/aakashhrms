"use client";

import { Award, CalendarDays, Cake, PartyPopper, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";
import { DateCell } from "@/components/kit/date-cell";
import type { UpcomingEvent, UpcomingKind } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

const KIND: Record<UpcomingKind, { icon: LucideIcon; tile: string }> = {
  holiday: { icon: PartyPopper, tile: "bg-warning-subtle text-warning" },
  birthday: { icon: Cake, tile: "bg-info-subtle text-info" },
  anniversary: { icon: Award, tile: "bg-brand-subtle text-brand-strong" },
};

function when(daysAway: number) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

/** Holidays, birthdays and work anniversaries in the next 30 days (BS dates). */
export function DashboardUpcomingCard({ events }: { events: UpcomingEvent[] }) {
  return (
    <Panel level={3} id="dashboard-upcoming" title="Coming up" icon={<CalendarDays />} meta="Next 30 days" href="/setup/holidays" hrefLabel="Holidays">
      {events.length === 0 ? (
        <EmptyState className="flex-1 py-6" icon={<CalendarDays className="h-5 w-5" />} title="Nothing coming up" description="No holidays, birthdays or work anniversaries in the next 30 days." />
      ) : (
        <ul className="divide-y divide-line">
          {events.map((e) => {
            const kind = KIND[e.kind];
            const Icon = kind.icon;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", kind.tile)}>
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{e.title}</span>
                  <span className="block truncate text-2xs text-ink-muted">
                    {e.detail} · <DateCell value={e.date} variant="long" />
                  </span>
                </span>
                <span className={cn("shrink-0 text-2xs tabular-nums", e.daysAway <= 1 ? "font-semibold text-brand-strong" : "text-ink-faint")}>{when(e.daysAway)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
