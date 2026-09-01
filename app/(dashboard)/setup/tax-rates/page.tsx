export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { TaxRateClient } from "@/components/tax-rate/tax-rate-client";
import { getTaxRateData } from "@/lib/services/tax-rate.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Tax Rates | AakashHRMS",
  description:
    "Configure slab-based TDS rates per fiscal year for Normal Single, Married, Widow, and Handicapped categories.",
};

/**
 * Server component for the Tax Rate Setup page.
 *
 * Fetches the initial dataset through the **service layer**
 * (which in turn calls the repository). The page itself is
 * server-rendered; the client component takes over from there
 * and owns all subsequent mutations via the same service.
 *
 * This pattern means: when the backend goes live, only the
 * `getTaxRateData()` body changes (it will hit the DB or call a
 * Server Action). The server-component file and its imports stay
 * identical.
 */
export default async function TaxRatesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "TAX_RATES");

  const data = await getTaxRateData();

  return <TaxRateClient initialData={data} />;
}
