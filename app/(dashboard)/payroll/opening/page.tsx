export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { OpeningBalancesClient } from "@/components/opening-balance/opening-balance-client";
import { openingPage } from "@/lib/services/opening-balance.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Opening balances | AakashHRMS",
  description: "What an old system paid before payroll started here mid-year, counted for tax and on the tax certificate.",
};

/** Opening balances (4.8 / F15): the active fiscal year's, for employees in the viewer's scope. */
export default async function OpeningBalancesPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "PAYROLL_GENERATE");
  const [canImport, canRemove] = await Promise.all([hasPermission("ADD", "PAYROLL_GENERATE"), hasPermission("DELETE", "PAYROLL_GENERATE")]);
  const data = await openingPage({ scope, userId: scope.userId }, { import: canImport, remove: canRemove });
  return <OpeningBalancesClient data={data} />;
}
