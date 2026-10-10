export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { CompanySetupClient, type PayrollRuleTab } from "@/components/company-setup/company-setup-client";
import { getCompanyMasterSetupBundle } from "@/lib/repositories/company-setup.repository";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { getPayHeadData } from "@/lib/services/pay-head.service";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { verifyPlatformSession } from "@/lib/platform/auth";

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

  // Check permissions for payroll sub-modules in parallel (fiscal years and tax slabs have their own pages, 4.12)
  const [canViewPayHead, canViewSystem] = await Promise.all([
    hasPermission("VIEW", "PAY_HEADS"),
    hasPermission("VIEW", "SYSTEM_CONTROL"),
  ]);

  const allowedPayrollTabs: PayrollRuleTab[] = [];
  if (canViewPayHead) allowedPayrollTabs.push("pay-heads");
  if (canViewSystem) allowedPayrollTabs.push("rules-defaults");

  // Fetch bundles concurrently
  const [
    bundle,
    payHeadData,
    systemControlData,
    impersonation,
    platformUser,
  ] = await Promise.all([
    getCompanyMasterSetupBundle(),
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
        payHeadData,
        systemControlData,
        isSuperAdmin,
      }}
    />
  );
}

