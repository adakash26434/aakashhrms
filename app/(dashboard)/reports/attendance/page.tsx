export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { attendanceReport } from "@/lib/services/report.service";
import { AttendanceReportClient } from "@/components/reports/attendance-report-client";

export const metadata: Metadata = {
  title: "Attendance report | AakashHRMS",
  description: "A month from the attendance rules: the summary, the day register or attendance cards.",
};

export default async function AttendanceReportPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  await ensureTenantContext();
  // S22 / S48: the viewer's employees only; pay figures only for viewers of the salary sheet.
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_ATTENDANCE");
  const [query, canExport, showAmounts] = await Promise.all([searchParams, hasPermission("EXPORT", "REPORTS_ATTENDANCE"), hasPermission("VIEW", "REPORTS_SALARY_SHEET")]);
  const data = await attendanceReport({ userId: scope.userId, scope, canExport }, { month: query.month, view: query.view }, { showAmounts });
  return <AttendanceReportClient initial={data} />;
}
