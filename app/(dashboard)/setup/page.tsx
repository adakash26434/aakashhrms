export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { SetupOverviewClient } from "@/components/setup/setup-overview-client";
import { getCompanyMasterSetupBundle } from "@/lib/repositories/company-setup.repository";
import { findAllFiscalYears } from "@/lib/repositories/fiscal-year.repository";
import { findAllSlabs } from "@/lib/repositories/tax-rate.repository";
import { findAllPayHeads } from "@/lib/repositories/pay-head.repository";
import { findAllHolidays } from "@/lib/repositories/holiday.repository";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Setup Overview | AakashHRMS",
  description:
    "Executive administration center for company identity, work schedules, Labour Act parameters, and statutory masters.",
};

export default async function SetupRootPage() {
  await ensureTenantContext();

  const canViewOrg = await hasPermission("VIEW", "ORG_STRUCTURE");
  const canViewSys = await hasPermission("VIEW", "SYSTEM_CONTROL");

  if (!canViewOrg && !canViewSys) {
    throw new Error("Unauthorized: You do not have permission to access Setup.");
  }

  const [bundle, fiscalYears, taxRates, payHeads, holidays] = await Promise.all([
    getCompanyMasterSetupBundle(),
    findAllFiscalYears().catch(() => []),
    findAllSlabs().catch(() => []),
    findAllPayHeads().catch(() => []),
    findAllHolidays().catch(() => []),
  ]);

  const statutoryCounts = {
    fiscalYearsCount: fiscalYears.length,
    taxSlabsCount: taxRates.length,
    payHeadsCount: payHeads.length,
    holidaysCount: holidays.length,
  };

  return <SetupOverviewClient data={bundle} statutoryCounts={statutoryCounts} />;
}
