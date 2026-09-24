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
    <Card className="h-full flex flex-col justify-between bg-white border-payroll-border shadow-payroll-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-950">
              Upcoming statutory & ops
            </h3>
            <p className="text-xs text-gray-500">
              Next 30 days · Bikram Sambat calendar
            </p>
          </div>
          <Link
            href="/setup/holidays"
            className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-border bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
            <span>Calendar</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-500">
            <CheckCircle2 className="h-4 w-4 text-payroll-primary shrink-0" />
            <span>No urgent statutory filing deadlines due this week.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg border border-payroll-border/80 bg-white p-2.5 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-100 text-center font-mono">
                  <span className="text-[9px] font-semibold uppercase text-gray-500">
                    {event.monthCode}
                  </span>
                  <span className="text-xs font-semibold text-gray-900 leading-none">
                    {event.day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">
                    {event.title}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    Owner · {event.owner}
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
