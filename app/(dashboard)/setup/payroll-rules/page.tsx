export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission } from "@/lib/auth/check-permission";
import { getFiscalYearData } from "@/lib/services/fiscal-year.service";
import { getTaxRateData } from "@/lib/services/tax-rate.service";
import { getPayHeadData } from "@/lib/services/pay-head.service";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { verifyPlatformSession } from "@/lib/platform/auth";
import {
  PayrollRulesHubClient,
  type PayrollRuleTab,
} from "@/components/setup/payroll-rules-hub-client";

export const metadata: Metadata = {
  title: "Payroll Rules & Statutory Controls | AakashHRMS",
  description:
    "Manage Bikram Sambat fiscal years, Nepal tax brackets, salary pay heads, and system control defaults.",
};

interface PageProps {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function PayrollRulesPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});

  // 1. Module permission verification
  const [canViewFY, canViewTax, canViewPayHead, canViewSystem] = await Promise.all([
    hasPermission("VIEW", "FISCAL_YEAR"),
    hasPermission("VIEW", "TAX_RATES"),
    hasPermission("VIEW", "PAY_HEADS"),
    hasPermission("VIEW", "SYSTEM_CONTROL"),
  ]);

  const allowedTabs: PayrollRuleTab[] = [];
  if (canViewFY) allowedTabs.push("fiscal-year");
  if (canViewTax) allowedTabs.push("tax-rates");
  if (canViewPayHead) allowedTabs.push("pay-heads");
  if (canViewSystem) allowedTabs.push("rules-defaults");

  if (allowedTabs.length === 0) {
    throw new Error("Unauthorized: Access to Payroll Rules requires permission to at least one configuration module.");
  }

  // 2. Fetch data in parallel for permitted modules
  const [
    fiscalYearData,
    taxRateData,
    payHeadData,
    systemControlData,
    impersonation,
    platformUser,
  ] = await Promise.all([
    canViewFY ? getFiscalYearData() : Promise.resolve(null),
    canViewTax ? getTaxRateData() : Promise.resolve(null),
    canViewPayHead ? getPayHeadData() : Promise.resolve(null),
    canViewSystem ? getSystemControlData() : Promise.resolve(null),
    canViewSystem ? getImpersonationSession() : Promise.resolve(null),
    canViewSystem ? verifyPlatformSession() : Promise.resolve(null),
  ]);

  const isSuperAdmin = Boolean(impersonation || platformUser);

  return (
    <PayrollRulesHubClient
      initialTab={resolvedParams.tab}
      allowedTabs={allowedTabs}
      fiscalYearData={fiscalYearData}
      taxRateData={taxRateData}
      payHeadData={payHeadData}
      systemControlData={systemControlData}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
