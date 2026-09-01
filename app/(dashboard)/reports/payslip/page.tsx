import { checkPermission } from "@/lib/auth/check-permission";
import { getReportFilterLookupData } from "@/lib/services/report.service";
import { PayslipClient } from "@/components/reports/payslip-client";
import { ensureTenantContext } from "@/lib/db";

export const metadata = {
  title: "Employee Payslips & Print | AakashHRMS",
  description: "Generate A4 printable confidential payslips.",
};

export default async function PayslipPage() {
  await ensureTenantContext();

  await checkPermission("VIEW", "REPORTS_PAYSLIP");
  const lookupData = await getReportFilterLookupData();
  return <PayslipClient lookupData={lookupData} />;
}
