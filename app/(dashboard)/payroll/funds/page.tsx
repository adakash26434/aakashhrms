export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { fundsPage } from "@/lib/services/fund.service";
import { FundsClient } from "@/components/funds/funds-client";

export const metadata: Metadata = {
  title: "Welfare funds | AakashHRMS",
  description: "Staff welfare, medical and gratuity funds: contributions, balances and payouts.",
};

export default async function FundsPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "WELFARE_FUNDS");
  const [post, manageTypes] = await Promise.all([hasPermission("ADD", "WELFARE_FUNDS"), hasPermission("EDIT", "WELFARE_FUNDS")]);
  const ctx = { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
  const data = await fundsPage(ctx, { post, manageTypes });
  return <FundsClient data={data} />;
}
