export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { CompanySetupClient } from "@/components/company-setup/company-setup-client";
import { getCompanyMasterSetupBundle } from "@/lib/repositories/company-setup.repository";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Company Setup | AakashHRMS",
  description:
    "Unified organizational administration center for company legal identity, work schedules, employment classifications, Shreni grades, and payroll statutory controls.",
};

interface PageProps {
  searchParams?: Promise<{ section?: string; tab?: string }> | { section?: string; tab?: string };
}

export default async function CompanySetupPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  await checkPermission("VIEW", "ORG_STRUCTURE");

  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const initialSection = resolvedParams?.section;
  const initialTab = resolvedParams?.tab;

  // Fiscal years, tax slabs, rules & controls and pay heads have their own pages under Setup (4.12).
  const bundle = await getCompanyMasterSetupBundle();

  return (
    <CompanySetupClient initialData={bundle} initialSection={initialSection} initialTab={initialTab} />
  );
}

