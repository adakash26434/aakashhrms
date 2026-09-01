import { checkPermission } from "@/lib/auth/check-permission";
import { getReportFilterLookupData } from "@/lib/services/report.service";
import { AttendanceReportClient } from "@/components/reports/attendance-report-client";
import { ensureTenantContext } from "@/lib/db";

export const metadata = {
  title: "Attendance & OT Report | AakashHRMS",
  description: "Monthly working days, present/absent days, leave deductions, and overtime summary.",
};

export default async function AttendanceReportPage() {
  await ensureTenantContext();

  await checkPermission("VIEW", "REPORTS_ATTENDANCE");
  const lookupData = await getReportFilterLookupData();
  return <AttendanceReportClient lookupData={lookupData} />;
}
