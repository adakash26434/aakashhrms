import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { buildEmployeeScopeCondition } from "@/lib/auth/scope-filter";
import * as reportService from "@/lib/services/report.service";
import { LoanReportClient } from "@/components/reports/loan-report-client";
import { ensureTenantContext } from "@/lib/db";

export const metadata = {
  title: "Loan Report | AakashHRMS",
  description: "Enterprise Loan Outstanding Summary & Repayment Ledger Report.",
};

export default async function LoanReportPage() {
  await ensureTenantContext();

  // The loan report follows the viewer's employee scope (4.10).
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_LOAN");

  const lookups = await reportService.getReportFilterLookupData();

  let initialReportData = null;
  let initialError: string | null = null;

  try {
    initialReportData = await reportService.getLoanReportData({ status: "ALL" }, buildEmployeeScopeCondition(scope));
  } catch (err: unknown) {
    initialError = err instanceof Error ? err.message : "Failed to load initial loan report.";
  }

  return (
    <LoanReportClient
      initialLookups={lookups}
      initialReportData={initialReportData}
      initialError={initialError}
    />
  );
}
