export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { getJobsPageAction } from "@/app/actions/jobs.actions";
import { JobsClient } from "@/components/jobs/jobs-client";

export const metadata: Metadata = {
  title: "Scheduled jobs | AakashHRMS",
  description: "Reminder and automation jobs: status, run log, enable/disable.",
};

export default async function JobsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SYSTEM_CONTROL");
  const [canEdit, result] = await Promise.all([hasPermission("EDIT", "SYSTEM_CONTROL"), getJobsPageAction()]);
  if (!result.success) throw new Error(result.error);
  return <JobsClient jobs={result.data.jobs} runs={result.data.runs} secretConfigured={result.data.secretConfigured} canEdit={canEdit} />;
}
