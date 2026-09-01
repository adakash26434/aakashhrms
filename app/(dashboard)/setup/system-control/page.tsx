export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { SystemControlClient } from "@/components/system-control/system-control-client";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "System Control | AakashHRMS",
  description:
    "Configure office hours, overtime rules, statutory deduction limits, insurance thresholds, and employee category permissions.",
};

export default async function SystemControlPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SYSTEM_CONTROL");

  const data = await getSystemControlData();

  return <SystemControlClient initialData={data} />;
}
