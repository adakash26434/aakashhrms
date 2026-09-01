export const dynamic = "force-dynamic";
import type { LeaveKPIs } from "@/lib/types/leave";
import { LeaveApplicationClient } from "@/components/leave/leave-application-client";
import { getLeaveApplications } from "@/lib/services/leave.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Leave Applications | AakashHRMS",
  description: "Manage employee leave requests and approvals.",
};

export default async function LeaveApplicationsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_APPLICATIONS");

  const { applications, kpis } = await getLeaveApplications({
    search: "",
    status: "all",
    leaveTypeId: "all",
    dateFrom: "",
    dateTo: "",
  });

  return (
    <LeaveApplicationClient
      initialApplications={applications}
      initialKpis={kpis}
    />
  );
}
