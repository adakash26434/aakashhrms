export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { FiscalYearClient } from "@/components/fiscal-year/fiscal-year-client";
import { getFiscalYearData } from "@/lib/services/fiscal-year.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Fiscal Year | AakashHRMS",
  description:
    "Manage Bikram Sambat fiscal years. Edit and delete are disabled after payslips are generated for a period.",
};

export default async function FiscalYearPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "FISCAL_YEAR");

  const data = await getFiscalYearData();

  return <FiscalYearClient initialData={data} />;
}
