import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UpcomingEvent } from "@/lib/types/dashboard";

interface UpcomingEventsProps {
  items: UpcomingEvent[];
}

export function UpcomingEvents({ items }: UpcomingEventsProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-payroll-navy">
              Upcoming statutory & ops
            </h3>
            <p className="text-xs text-gray-500">
              Next 30 days · Bikram Sambat aware
            </p>
          </div>
          <Button variant="outline" size="sm">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-lg border border-payroll-light/60 p-3 hover:bg-payroll-cream/80"
          >
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-payroll-light text-center">
              <span className="text-xs font-semibold uppercase text-gray-500">
                {event.monthCode}
              </span>
              <span className="text-sm font-bold text-payroll-navy">
                {event.day}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-payroll-navy">
                {event.title}
              </p>
              <p className="text-sm text-gray-500">Owner · {event.owner}</p>
            </div>
            <Badge variant={event.priority}>{event.priority}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
