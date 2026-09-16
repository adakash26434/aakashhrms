export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { SystemControlClient } from "@/components/system-control/system-control-client";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { verifyPlatformSession } from "@/lib/platform/auth";

export const metadata: Metadata = {
  title: "System Control | AakashHRMS",
  description:
    "Configure office hours, overtime rules, statutory deduction limits, insurance thresholds, and employee category permissions.",
};

export default async function SystemControlPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SYSTEM_CONTROL");

  const [data, impersonation, platformUser] = await Promise.all([
    getSystemControlData(),
    getImpersonationSession(),
    verifyPlatformSession(),
  ]);

  const isSuperAdmin = Boolean(impersonation || platformUser);

  return <SystemControlClient initialData={data} isSuperAdmin={isSuperAdmin} />;
}
