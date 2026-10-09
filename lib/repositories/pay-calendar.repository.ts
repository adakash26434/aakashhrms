import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { parseCalendar } from "@/lib/engines/pay-calendar.engine";
import type { PeriodCalendar } from "@/lib/engines/pay-period.engine";

// Pay calendar (4.8b): the company pays in BS or AD months; one value in system_config.

export const PAY_CALENDAR_KEY = "payroll.calendar";

/** The company's pay calendar (BS until it chooses AD). */
export async function getPayCalendar(): Promise<PeriodCalendar> {
  const [row] = await (await getDb()).select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, PAY_CALENDAR_KEY)).limit(1);
  return parseCalendar(row?.value);
}

export async function setPayCalendar(calendar: PeriodCalendar): Promise<void> {
  await (await getDb())
    .insert(systemConfig)
    .values({ key: PAY_CALENDAR_KEY, value: calendar, dataType: "string" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: calendar, dataType: "string", updatedAt: new Date() } });
}
