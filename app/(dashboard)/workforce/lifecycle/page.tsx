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

export default async function LifecyclePage({ searchParams }: { searchParams?: Promise<{ new?: string; employee?: string }> }) {
  const params = (await searchParams) ?? {};
  await ensureTenantContext();
  // Events change the employee record, so they live under EMPLOYEES.
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [add, issueLetter] = await Promise.all([hasPermission("EDIT", "EMPLOYEES"), hasPermission("ADD", "HR_LETTERS")]);
  const data = await eventsPage(scope, { add, cancel: add, issueLetter });
  // Deep link from the promotion ranking: open the new-event window pre-filled (the server still validates everything).
  const preset = add && params.new === 'promotion' && typeof params.employee === 'string' && /^[0-9a-f-]{36}$/i.test(params.employee) ? { kind: 'promotion', employeeId: params.employee } : null;
  return <LifecycleClient data={data} preset={preset} />;
}
