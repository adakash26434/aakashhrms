export const dynamic = "force-dynamic";
import { LeaveApprovalClient } from "@/components/leave/leave-approval-client";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Leave Approvals | AakashHRMS",
  description: "Review and manage pending leave requests from your team.",
};

export default async function LeaveApprovalsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_APPROVALS");

  return <LeaveApprovalClient />;
}