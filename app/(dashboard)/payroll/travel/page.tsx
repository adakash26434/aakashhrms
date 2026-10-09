export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { travelPage } from "@/lib/services/travel.service";
import { TravelClient } from "@/components/travel/travel-client";

export const metadata: Metadata = {
  title: "Travel / TA-DA | AakashHRMS",
  description: "Field-visit claims, the TA-DA rate card, approval and settlement.",
};

export default async function TravelPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "TRAVEL");
  const [add, manage, approve, settle] = await Promise.all([hasPermission("ADD", "TRAVEL"), hasPermission("EDIT", "TRAVEL"), hasPermission("APPROVE", "TRAVEL"), hasPermission("LOCK", "TRAVEL")]);
  const data = await travelPage({ userId: scope.userId, actorEmployeeId: scope.employeeId, scope }, { add, manage, approve, settle });
  return <TravelClient data={data} />;
}
