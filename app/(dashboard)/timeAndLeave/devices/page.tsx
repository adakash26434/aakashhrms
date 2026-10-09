export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { devicesPage } from "@/lib/services/device.service";
import { DevicesClient } from "@/components/devices/devices-client";

export const metadata: Metadata = {
  title: "Attendance devices | AakashHRMS",
  description: "ZKTeco ADMS device registry, PIN mapping, unknown-PIN punches and imports.",
};

export default async function DevicesPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "ATTENDANCE");
  const manage = await hasPermission("EDIT", "ATTENDANCE");
  const data = await devicesPage({ userId: scope.userId, scope }, { manage });
  return <DevicesClient data={data} />;
}
