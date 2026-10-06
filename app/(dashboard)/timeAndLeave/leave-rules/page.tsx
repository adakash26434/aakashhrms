export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

/** Leave rules were retired in 4.6e (each leave type holds its own rules): old links open Policies → Leave types. */
export default async function LeaveRulesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_TYPES");

  redirect("/timeAndLeave/policies?tab=types");
}
