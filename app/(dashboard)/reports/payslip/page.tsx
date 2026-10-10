export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { payslipReport } from "@/lib/services/report.service";
import { PayslipClient } from "@/components/reports/payslip-client";

export const metadata: Metadata = {
  title: "Payslips | AakashHRMS",
  description: "Payslips of a locked pay run, one per page, in English, Nepali or both.",
};

export default async function PayslipPage({ searchParams }: { searchParams: Promise<{ run?: string; employee?: string }> }) {
  await ensureTenantContext();
  // S48 / F11: locked runs, the viewer's employees only, never a SELF role.
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_PAYSLIP");
  const query = await searchParams;
  const data = await payslipReport({ userId: scope.userId, scope, canExport: false }, { runId: query.run, employeeId: query.employee });
  return <PayslipClient initial={data} />;
}
