export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function PayHeadsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "PAY_HEADS");

  redirect("/setup/company-setup?section=payroll_rules&tab=pay-heads");
}
