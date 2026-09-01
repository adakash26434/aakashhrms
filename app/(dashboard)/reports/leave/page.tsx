import { checkPermission } from "@/lib/auth/check-permission";
import * as reportService from "@/lib/services/report.service";
import { LeaveReportClient } from "@/components/reports/leave-report-client";
import { ensureTenantContext } from "@/lib/db";

export const metadata = {
  title: "Leave Report | AakashHRMS",
  description: "Enterprise Leave Balances Ledger & Applications Log Report.",
};

export default async function LeaveReportPage() {
  await ensureTenantContext();

  await checkPermission("VIEW", "REPORTS_LEAVE");

  const lookups = await reportService.getReportFilterLookupData();
  const defaultFyId = lookups.fiscalYears[0]?.id || "";

  let initialReportData = null;
  let initialError: string | null = null;

  if (defaultFyId) {
    try {
      initialReportData = await reportService.getLeaveReportData({
        fiscalYearId: defaultFyId,
      });
    } catch (err: unknown) {
      initialError = err instanceof Error ? err.message : "Failed to load initial leave report.";
    }
  }

  return (
    <LeaveReportClient
      initialLookups={lookups}
      initialReportData={initialReportData}
      initialError={initialError}
    />
  );
}
