export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { targetsPage } from "@/lib/services/target.service";
import { TargetsClient } from "@/components/targets/targets-client";
import { TARGET_STATUSES } from "@/lib/engines/target.engine";

export const metadata: Metadata = {
  title: "Targets | AakashHRMS",
  description: "Monthly and yearly employee targets, reported achievements and supervisor review.",
};

export default async function TargetsPageRoute({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "TARGETS");
  // The bell opens the achievements waiting to be closed (?status=forwarded).
  const { status } = await searchParams;
  const [add, manage, decide] = await Promise.all([hasPermission("ADD", "TARGETS"), hasPermission("EDIT", "TARGETS"), hasPermission("APPROVE", "TARGETS")]);
  const data = await targetsPage({ userId: scope.userId, actorEmployeeId: scope.employeeId, scope }, { add, manage, decide });
  return <TargetsClient data={data} initialStatus={(TARGET_STATUSES as readonly string[]).includes(status ?? "") ? status : undefined} />;
}
