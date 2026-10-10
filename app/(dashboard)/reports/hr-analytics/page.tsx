export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { hrAnalytics } from "@/lib/services/hr-analytics.service";
import { HrAnalyticsClient } from "@/components/hr-analytics/hr-analytics-client";
import { Notice } from "@/components/kit/notice";
import { UserFacingError } from "@/lib/errors/action-error";
import type { HrAnalyticsData } from "@/lib/types/hr-analytics";

export const metadata: Metadata = {
  title: "HR analytics | AakashHRMS",
  description: "Headcount, movement, tenure, training and the DoC / COPOMIS staff return.",
};

export default async function HrAnalyticsPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [canSeeCases, canExport] = await Promise.all([hasPermission("VIEW", "DISCIPLINE"), hasPermission("EXPORT", "EMPLOYEES")]);
  let data: HrAnalyticsData | null = null;
  let problem: string | null = null;
  try {
    data = await hrAnalytics(null, { scope, canSeeCases, canExport });
  } catch (error: unknown) {
    if (!(error instanceof UserFacingError)) throw error;
    problem = error.message;
  }
  if (!data) return <Notice tone="warning">{problem}</Notice>;
  return <HrAnalyticsClient initial={data} />;
}
