export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { targetsPage } from "@/lib/services/target.service";
import { TargetsClient } from "@/components/targets/targets-client";

export const metadata: Metadata = {
  title: "Targets | AakashHRMS",
  description: "Monthly and yearly employee targets, reported achievements and supervisor review.",
};

export default async function TargetsPageRoute() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "TARGETS");
  const [add, manage, decide] = await Promise.all([hasPermission("ADD", "TARGETS"), hasPermission("EDIT", "TARGETS"), hasPermission("APPROVE", "TARGETS")]);
  const data = await targetsPage({ userId: scope.userId, actorEmployeeId: scope.employeeId, scope }, { add, manage, decide });
  return <TargetsClient data={data} />;
}
