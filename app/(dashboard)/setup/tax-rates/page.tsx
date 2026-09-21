export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function TaxRatesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "TAX_RATES");

  redirect("/setup/payroll-rules?tab=tax-rates");
}
