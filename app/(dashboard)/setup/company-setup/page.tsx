export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { CompanySetupClient } from "@/components/company-setup/company-setup-client";
import { getCompanyMasterSetupBundle } from "@/lib/repositories/company-setup.repository";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Company & Work Policy | AakashHRMS",
  description:
    "Master setup module for custom Shreni grade levels, branch registries, departments, designations, and Nepal Labour Act parameters.",
};

interface PageProps {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function CompanySetupPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  await checkPermission("VIEW", "ORG_STRUCTURE");

  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const initialTab = resolvedParams?.tab;

  const bundle = await getCompanyMasterSetupBundle();
  return <CompanySetupClient initialData={bundle} initialTab={initialTab} />;
}
