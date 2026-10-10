export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { loanReport } from "@/lib/services/report.service";
import { LoanReportClient } from "@/components/reports/loan-report-client";

export const metadata: Metadata = {
  title: "Loan report | AakashHRMS",
  description: "The loan register, repayments in a period and loans given in a period.",
};

export default async function LoanReportPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string }> }) {
  await ensureTenantContext();
  // S47 / S48: the viewer's employees only, never a SELF role.
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_LOAN");
  const [query, canExport] = await Promise.all([searchParams, hasPermission("EXPORT", "REPORTS_LOAN")]);
  const data = await loanReport({ userId: scope.userId, scope, canExport }, { view: query.view, status: query.status });
  return <LoanReportClient initial={data} />;
}
