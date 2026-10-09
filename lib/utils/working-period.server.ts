import { cookies } from "next/headers";
import { getPayCalendar } from "@/lib/repositories/pay-calendar.repository";
import { WORKING_PERIOD_KEY, parseWorkingPeriod } from "@/lib/utils/working-period-pref";
import type { PeriodCalendar } from "@/lib/engines/pay-period.engine";
import type { WorkingPeriod } from "@/lib/types/payroll-run";

/** The title bar's working period for this request (validated; null when unset or of the other calendar), with the company's pay calendar. */
export async function readWorkingPeriod(): Promise<{ calendar: PeriodCalendar; period: WorkingPeriod | null }> {
  let calendar: PeriodCalendar = "BS";
  try {
    calendar = await getPayCalendar();
  } catch {
    calendar = "BS";
  }
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(WORKING_PERIOD_KEY)?.value;
  } catch {
    raw = undefined;
  }
  return { calendar, period: parseWorkingPeriod(raw, calendar) };
}
