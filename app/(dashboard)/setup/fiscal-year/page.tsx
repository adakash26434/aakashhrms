export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { fiscalYearsPage } from "@/lib/services/fiscal-year.service";
import { FiscalYearsClient } from "@/components/fiscal-year/fiscal-years-client";

export const metadata: Metadata = {
  title: "Fiscal years | AakashHRMS",
  description: "Nepali fiscal years (Shrawan to Asar): the current year, closing and reopening, and each year's tax slabs.",
};

export default async function FiscalYearPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "FISCAL_YEAR");
  // The permissions show the buttons; every change re-checks a company-wide role on the server (checkCompanyControl).
  const [add, edit, lock] = await Promise.all([hasPermission("ADD", "FISCAL_YEAR"), hasPermission("EDIT", "FISCAL_YEAR"), hasPermission("LOCK", "FISCAL_YEAR")]);
  const data = await fiscalYearsPage({ add, edit, lock });
  return <FiscalYearsClient initial={data} />;
}
