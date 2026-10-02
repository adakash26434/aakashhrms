import Link from "next/link";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UpcomingEvent } from "@/lib/types/dashboard";

interface UpcomingEventsProps {
  items: UpcomingEvent[];
}

export function UpcomingEvents({ items }: UpcomingEventsProps) {
  return (
    <Card className="h-full flex flex-col justify-between bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
              Upcoming Deadlines & Operations
            </h3>
            <p className="text-xs text-zinc-500">
              Statutory schedule and operational events (BS / AD)
            </p>
          </div>
          <Link
            href="/setup/holidays"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
            <span>Calendar</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-800 shrink-0" />
            <span>No urgent statutory filing deadlines due this week.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-md border border-zinc-200/80 bg-white p-2.5 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-zinc-100 text-center font-mono">
                  <span className="text-3xs font-medium uppercase text-zinc-500">
                    {event.monthCode}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 leading-none">
                    {event.day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-900">
                    {event.title}
                  </p>
                  <p className="text-2xs text-zinc-500 truncate">
                    Owner: {event.owner}
                  </p>
                </div>
                <Badge variant={event.priority} size="sm">
                  {event.priority}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
