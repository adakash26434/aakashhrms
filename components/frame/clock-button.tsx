"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { clockStatusAction } from "@/app/actions/checkin.actions";
import { ClockCard } from "@/components/attendance/clock-card";
import { localClock } from "@/lib/engines/attendance-day.engine";
import type { ClockStatus } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

/**
 * Clock button (4.5c) in the title bar, for staff who are also employees:
 * opens the same clock card as self-service. The label shows today's state
 * ("In 09:02"), loaded with the page.
 */
export function ClockButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Today's state for the label ("In 09:02") as soon as the page loads, not only once opened.
  useEffect(() => {
    let alive = true;
    clockStatusAction().then((res) => {
      if (alive && res.success) setStatus(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

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

  const isIn = status?.next === "out";
  const label = status ? (isIn ? `In ${localClock(status.firstIn)}` : status.lastOut ? `Out ${localClock(status.lastOut)}` : "Clock in") : "Clock in";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Clock in or out"
        className="flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-2 text-xs font-medium text-ink hover:bg-surface-sunken"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", isIn ? "bg-success" : "bg-ink-faint")} aria-hidden />
        <Clock3 className="h-3.5 w-3.5 text-brand" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Clock in or out" className="absolute right-0 top-full z-40 mt-1 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-line bg-surface p-3 shadow-lg">
          <ClockCard compact initial={status} onChanged={setStatus} />
        </div>
      )}
    </div>
  );
}
