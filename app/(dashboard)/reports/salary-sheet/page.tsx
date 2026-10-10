export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { salarySheet } from "@/lib/services/report.service";
import { SalarySheetClient } from "@/components/reports/salary-sheet-client";

export const metadata: Metadata = {
  title: "Salary sheet | AakashHRMS",
  description: "Approved and locked pay runs as printed for signature: every pay line, a summary, pay-line totals and the bank transfer list.",
};

export default async function SalarySheetPage({ searchParams }: { searchParams: Promise<{ run?: string; view?: string }> }) {
  await ensureTenantContext();
  // S48: the viewer's employees only (BRANCH / DEPARTMENT scope), never a SELF role.
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_SALARY_SHEET");
  const [query, canExport] = await Promise.all([searchParams, hasPermission("EXPORT", "REPORTS_SALARY_SHEET")]);
  const data = await salarySheet({ userId: scope.userId, scope, canExport }, { runId: query.run, view: query.view });
  return <SalarySheetClient initial={data} />;
}
