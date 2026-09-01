export const dynamic = "force-dynamic";
import { LeaveTypesClient } from "@/components/leave-types/leave-types-client";
import { getLeaveTypesWithKPIs } from "@/lib/services/leave-type.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Leave Types | AakashHRMS",
  description: "Configure statutory and custom leave categories.",
};

export default async function LeaveTypesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_TYPES");

  const { types, kpis } = await getLeaveTypesWithKPIs();

  return (
    <LeaveTypesClient
      initialTypes={types}
      initialKpis={kpis}
    />
  );
}
