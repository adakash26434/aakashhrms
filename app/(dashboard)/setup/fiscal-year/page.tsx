export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function FiscalYearPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "FISCAL_YEAR");

  redirect("/setup/company-setup?section=payroll_rules&tab=fiscal-year");
}
