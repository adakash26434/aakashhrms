export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function LeaveApplicationsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_APPLICATIONS");

  redirect("/timeAndLeave/leaves?tab=requests");
}
