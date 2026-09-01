"use client";

import { useEffect, useState } from "react";
import {
  adToBS,
  formatBSDate,
  formatBSDateWithDay,
  getFiscalYear,
  isCurrentBSMonth,
  type BSDateObject,
  type FiscalYearInfo,
} from "@/lib/utils/bs-calendar";

export interface UseBSDateResult {
  /** Current AD date as a {@link BSDateObject}. */
  today: BSDateObject;
  /** Fiscal-year info for `today`. */
  fiscalYear: FiscalYearInfo;
  /** Formatted today, e.g. "Mangsir 15, 2081". */
  todayFormatted: string;
  /** Formatted today with weekday, e.g. "Mangsir 15, 2081 · Monday". */
  todayFormattedWithDay: string;
  /** "Mangsir 2081" — used in dropdowns and headers. */
  monthYearLabel: string;
  /** `true` when today is in Asar (the last month of the Nepali FY). */
  isLastFYMonth: boolean;
}

/**
 * Client-side hook that provides the current BS date and fiscal-year info.
 *
 * Internally schedules a midnight rollover so the date stays accurate
 * across long-running sessions (e.g. a dashboard open overnight).
 */
export function useBSDate(): UseBSDateResult {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function scheduleNextMidnight() {
      const next = new Date();
      next.setHours(24, 0, 5, 0); // a few seconds after midnight
      const ms = next.getTime() - Date.now();
      timer = setTimeout(() => {
        setNow(new Date());
        scheduleNextMidnight();
      }, ms);
    }

    scheduleNextMidnight();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const today = adToBS(now);
  const fiscalYear = getFiscalYear(now);

  return {
    today,
    fiscalYear,
    todayFormatted: formatBSDate(now),
    todayFormattedWithDay: formatBSDateWithDay(now),
    monthYearLabel: formatBSDate(now, "month-year"),
    isLastFYMonth: isCurrentBSMonth(today.year, 3), // Asar = month 3
  };
}
