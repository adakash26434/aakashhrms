export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function SystemControlPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SYSTEM_CONTROL");

  redirect("/setup/payroll-rules?tab=rules-defaults");
}
