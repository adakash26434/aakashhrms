export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { HolidayClient } from "@/components/holiday/holiday-client";
import { getHolidayData } from "@/lib/services/holiday.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Holidays | AakashHRMS",
  description:
    "Configure festival holidays and date ranges for the active fiscal year. Apply to all branches or specific branches.",
};

/**
 * Server component for the Holiday Setup page.
 *
 * Fetches the initial dataset through the **service layer**
 * (which in turn calls the repository and the static branch
 * mock). The page itself is server-rendered; the client
 * component takes over from there and owns all subsequent
 * mutations via the same service.
 *
 * This pattern means: when the backend goes live, only the
 * `getHolidayData()` body changes (it will hit the DB or call a
 * Server Action). The server-component file and its imports stay
 * identical.
 */
export default async function HolidaysPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "HOLIDAYS");

  const data = await getHolidayData();
  return <HolidayClient initialData={data} />;
}
