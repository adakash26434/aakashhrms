export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { ReimbursementClient } from "@/components/reimbursement/reimbursement-client";
import { reimbursementPage } from "@/lib/services/reimbursement.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Reimbursements | AakashHRMS",
  description: "Medical, mobile, fuel and similar claims with a bill: approval and payment through the pay run.",
};

/** Reimbursements (4.8 / F16): claims of employees in the viewer's scope, and the types. */
export default async function ReimbursementsPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "REIMBURSEMENTS");
  const [add, manage, approve, settle] = await Promise.all([
    hasPermission("ADD", "REIMBURSEMENTS"),
    hasPermission("EDIT", "REIMBURSEMENTS"),
    hasPermission("APPROVE", "REIMBURSEMENTS"),
    hasPermission("LOCK", "REIMBURSEMENTS"),
  ]);
  const data = await reimbursementPage({ userId: scope.userId, actorEmployeeId: scope.employeeId, scope }, { add, manage, approve, settle });
  return <ReimbursementClient data={data} />;
}
