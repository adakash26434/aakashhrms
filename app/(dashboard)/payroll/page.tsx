export const dynamic = "force-dynamic";

import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { pageData } from "@/lib/services/payroll-run.service";
import { PayrollRunsClient } from "@/components/payroll/payroll-runs-client";
import { readWorkingPeriod } from "@/lib/utils/working-period.server";

export const metadata = {
  title: "Payroll | AakashHRMS",
  description: "Monthly pay runs: pre-flight, calculation, variance review, approval and lock.",
};

/**
 * Payroll (4.8a, template C): the runs and the selected run's steps. The
 * server works out what the user may do; every action checks again.
 */
export default async function PayrollPage({ searchParams }: { searchParams?: Promise<{ run?: string; tab?: string }> }) {
  await ensureTenantContext();
  const sp = searchParams ? await searchParams : {};
  const [canGenerate, canReview] = await Promise.all([hasPermission("VIEW", "PAYROLL_GENERATE"), hasPermission("VIEW", "PAYROLL_REVIEW")]);
  const scope = await checkPermissionWithScope("VIEW", canGenerate ? "PAYROLL_GENERATE" : "PAYROLL_REVIEW");
  const [add, edit, approve, lock, del, exp] = await Promise.all([
    hasPermission("ADD", "PAYROLL_GENERATE"),
    hasPermission("EDIT", "PAYROLL_GENERATE"),
    hasPermission("APPROVE", "PAYROLL_REVIEW"),
    hasPermission("LOCK", "PAYROLL_REVIEW"),
    hasPermission("DELETE", "PAYROLL_GENERATE"),
    hasPermission("EXPORT", "PAYROLL_GENERATE"),
  ]);
  const data = await pageData(
    {
      scope,
      userId: scope.userId,
      canApprove: approve && canReview,
      permissions: { generate: add, edit, approve: approve && canReview, lock, delete: del, export: exp, settings: scope.scopeType === "GLOBAL" && !scope.isImpersonation && approve },
    },
    typeof sp.run === "string" ? sp.run : null,
    (await readWorkingPeriod()).period
  );
  return <PayrollRunsClient data={data} initialTab={sp.tab === "run" && data.selected ? "run" : "runs"} />;
}
