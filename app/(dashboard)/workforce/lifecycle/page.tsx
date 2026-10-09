export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { eventsPage } from "@/lib/services/employee-event.service";
import { LifecycleClient } from "@/components/lifecycle/lifecycle-client";

export const metadata: Metadata = {
  title: "Lifecycle events | AakashHRMS",
  description: "Promotions, transfers and confirmations as dated records with letters.",
};

export default async function LifecyclePage() {
  await ensureTenantContext();
  // Events change the employee record, so they live under EMPLOYEES.
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [add, issueLetter] = await Promise.all([hasPermission("EDIT", "EMPLOYEES"), hasPermission("ADD", "HR_LETTERS")]);
  const data = await eventsPage(scope, { add, cancel: add, issueLetter });
  return <LifecycleClient data={data} />;
}
