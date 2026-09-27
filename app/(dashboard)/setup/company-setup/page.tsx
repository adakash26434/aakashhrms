export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { CompanySetupClient } from "@/components/company-setup/company-setup-client";
import { getCompanyMasterSetupBundle } from "@/lib/repositories/company-setup.repository";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { getFiscalYearData } from "@/lib/services/fiscal-year.service";
import { getTaxRateData } from "@/lib/services/tax-rate.service";
import { getPayHeadData } from "@/lib/services/pay-head.service";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { verifyPlatformSession } from "@/lib/platform/auth";
import type { PayrollRuleTab } from "@/components/setup/payroll-rules-hub-client";

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

  // Check permissions for payroll sub-modules in parallel
  const [canViewFY, canViewTax, canViewPayHead, canViewSystem] = await Promise.all([
    hasPermission("VIEW", "FISCAL_YEAR"),
    hasPermission("VIEW", "TAX_RATES"),
    hasPermission("VIEW", "PAY_HEADS"),
    hasPermission("VIEW", "SYSTEM_CONTROL"),
  ]);

  const allowedPayrollTabs: PayrollRuleTab[] = [];
  if (canViewFY) allowedPayrollTabs.push("fiscal-year");
  if (canViewTax) allowedPayrollTabs.push("tax-rates");
  if (canViewPayHead) allowedPayrollTabs.push("pay-heads");
  if (canViewSystem) allowedPayrollTabs.push("rules-defaults");

  // Fetch bundles concurrently
  const [
    bundle,
    fiscalYearData,
    taxRateData,
    payHeadData,
    systemControlData,
    impersonation,
    platformUser,
  ] = await Promise.all([
    getCompanyMasterSetupBundle(),
    canViewFY ? getFiscalYearData().catch(() => null) : Promise.resolve(null),
    canViewTax ? getTaxRateData().catch(() => null) : Promise.resolve(null),
    canViewPayHead ? getPayHeadData().catch(() => null) : Promise.resolve(null),
    canViewSystem ? getSystemControlData().catch(() => null) : Promise.resolve(null),
    canViewSystem ? getImpersonationSession().catch(() => null) : Promise.resolve(null),
    canViewSystem ? verifyPlatformSession().catch(() => null) : Promise.resolve(null),
  ]);

  const isSuperAdmin = Boolean(impersonation || platformUser);

  return (
    <CompanySetupClient
      initialData={bundle}
      initialSection={initialSection}
      initialTab={initialTab}
      payrollRulesData={{
        allowedTabs: allowedPayrollTabs,
        fiscalYearData,
        taxRateData,
        payHeadData,
        systemControlData,
        isSuperAdmin,
      }}
    />
  );
}

