import { checkPermission } from "@/lib/auth/check-permission";
import { getReportFilterLookupData } from "@/lib/services/report.service";
import { TDSReportClient } from "@/components/reports/tds-report-client";
import { ensureTenantContext } from "@/lib/db";

export const metadata = {
  title: "TDS / IRD Tax Report | AakashHRMS",
  description: "Nepal Inland Revenue Department (IRD) ETDS tax deduction statements and PAN validation.",
};

export default async function TaxIrdReportPage() {
  await ensureTenantContext();

  await checkPermission("VIEW", "REPORTS_TAX_IRD");
  const lookupData = await getReportFilterLookupData();
  return <TDSReportClient lookupData={lookupData} />;
}
