export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { certificateList, statutoryMonth } from "@/lib/services/statutory.service";
import { StatutoryClient } from "@/components/payroll/statutory-client";

export const metadata: Metadata = {
  title: "Statutory returns | AakashHRMS",
  description: "Monthly eTDS, SSF, Provident Fund and CIT schedules, upload files and annual tax certificates.",
};

export default async function StatutoryPage({ searchParams }: { searchParams: Promise<{ period?: string; fy?: string }> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_TAX_IRD");
  const ctx = { userId: scope.userId, scope };
  const params = await searchParams;
  const canExport = await hasPermission("EXPORT", "REPORTS_TAX_IRD");
  const [month, certificates] = await Promise.all([statutoryMonth(ctx, params.period, { export: canExport }), certificateList(ctx, params.fy)]);
  return <StatutoryClient initialMonth={month} initialCertificates={certificates} />;
}
