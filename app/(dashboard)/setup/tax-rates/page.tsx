export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { taxSlabsPage } from "@/lib/services/tax-rate.service";
import { TaxSlabsClient } from "@/components/tax-rate/tax-slabs-client";

export const metadata: Metadata = {
  title: "Tax slabs | AakashHRMS",
  description: "Income tax bands per fiscal year for individuals, couples and persons with disability.",
};

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function TaxRatesPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  await checkPermission("VIEW", "TAX_RATES");
  const { year } = await searchParams;
  // Edit shows the buttons; every save re-checks a company-wide role on the server (checkCompanyControl).
  const data = await taxSlabsPage(typeof year === "string" ? year : null, await hasPermission("EDIT", "TAX_RATES"));
  return <TaxSlabsClient initial={data} />;
}
