export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { leaveReport } from "@/lib/services/report.service";
import { LeaveReportClient } from "@/components/reports/leave-report-client";

export const metadata: Metadata = {
  title: "Leave report | AakashHRMS",
  description: "A leave year from the leave ledger: balances, movement by type, leave taken and requests.",
};

export default async function LeaveReportPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await ensureTenantContext();
  // S48: the viewer's employees only, never a SELF role (the self-service role holds this View).
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_LEAVE");
  const [query, canExport] = await Promise.all([searchParams, hasPermission("EXPORT", "REPORTS_LEAVE")]);
  const data = await leaveReport({ userId: scope.userId, scope, canExport }, { view: query.view });
  return <LeaveReportClient initial={data} />;
}
