import { checkPermission } from "@/lib/auth/check-permission";
import { getReportFilterLookupData } from "@/lib/services/report.service";
import { SalarySheetClient } from "@/components/reports/salary-sheet-client";
import { ensureTenantContext } from "@/lib/db";

export const metadata = {
  title: "Salary Sheet Report | AakashHRMS",
  description: "Detailed salary sheet with dynamic pay head columns and bank account details.",
};

export default async function SalarySheetPage() {
  await ensureTenantContext();

  await checkPermission("VIEW", "REPORTS_SALARY_SHEET");
  const lookupData = await getReportFilterLookupData();
  return <SalarySheetClient lookupData={lookupData} />;
}
