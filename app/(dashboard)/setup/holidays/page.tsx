export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { holidaysPage } from "@/lib/services/holiday.service";
import { HolidaysClient } from "@/components/holiday/holidays-client";

export const metadata: Metadata = {
  title: "Holiday calendar | AakashHRMS",
  description: "Public and company holidays: the days attendance and leave count as holidays, by branch.",
};

export default async function HolidaysPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "HOLIDAYS");
  // The permissions show the buttons; every change re-checks the scope and closed months on the server.
  const [add, edit, del] = await Promise.all([hasPermission("ADD", "HOLIDAYS"), hasPermission("EDIT", "HOLIDAYS"), hasPermission("DELETE", "HOLIDAYS")]);
  return <HolidaysClient initial={await holidaysPage(scope, { add, edit, delete: del })} />;
}
