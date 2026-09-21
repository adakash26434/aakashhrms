export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function LeaveRulesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_RULES");

  redirect("/timeAndLeave/policies?tab=rules");
}
