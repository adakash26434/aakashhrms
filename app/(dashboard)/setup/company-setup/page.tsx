export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { CompanySetupClient, type PayrollRuleTab } from "@/components/company-setup/company-setup-client";
import { getCompanyMasterSetupBundle } from "@/lib/repositories/company-setup.repository";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { getPayHeadData } from "@/lib/services/pay-head.service";

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

  // Fiscal years, tax slabs and rules & controls have their own pages under Setup (4.12).
  const canViewPayHead = await hasPermission("VIEW", "PAY_HEADS");

  const allowedPayrollTabs: PayrollRuleTab[] = [];
  if (canViewPayHead) allowedPayrollTabs.push("pay-heads");

  // Fetch bundles concurrently
  const [bundle, payHeadData] = await Promise.all([
    getCompanyMasterSetupBundle(),
    canViewPayHead ? getPayHeadData().catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <CompanySetupClient
      initialData={bundle}
      initialSection={initialSection}
      initialTab={initialTab}
      payrollRulesData={{
        allowedTabs: allowedPayrollTabs,
        payHeadData,
      }}
    />
  );
}

