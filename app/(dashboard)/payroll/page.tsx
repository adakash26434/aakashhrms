export const dynamic = "force-dynamic";

import PayrollClient from "@/components/payroll/payroll-client";
import { getPayrollGeneratePageData } from "@/lib/services/payroll.service";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Payroll Workspace | AakashHRMS",
  description: "Unified workspace to generate, audit, review and lock monthly payroll runs.",
};

interface PayrollRootPageProps {
  searchParams?: Promise<{
    tab?: string;
    runId?: string;
  }>;
}

export default async function PayrollRootPage({ searchParams }: PayrollRootPageProps) {
  await ensureTenantContext();

  const canGenerate = await hasPermission("VIEW", "PAYROLL_GENERATE");
  const canReview = await hasPermission("VIEW", "PAYROLL_REVIEW");

  if (!canGenerate && !canReview) {
    throw new Error("Unauthorized: You do not have permission to access the Payroll Workspace.");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const requestedTab = resolvedParams.tab;
  const initialRunId = resolvedParams.runId || null;

  let initialMode: "generate" | "review" | "list" = "list";
  if (requestedTab === "generate" && canGenerate) {
    initialMode = "generate";
  } else if (requestedTab === "review" && canReview) {
    initialMode = "review";
  } else if (!canReview && canGenerate) {
    initialMode = "generate";
  }

  const {
    runs,
    branches,
    departments,
    designations,
    employees,
    occasionalAllowances,
    allPayHeads,
    userRole,
  } = await getPayrollGeneratePageData();

  return (
    <PayrollClient
      initialRuns={runs}
      branches={branches}
      departments={departments}
      designations={designations}
      employees={employees}
      occasionalAllowances={occasionalAllowances}
      allPayHeads={allPayHeads}
      userRole={userRole}
      initialMode={initialMode}
      initialRunId={initialRunId}
      canGenerate={canGenerate}
      canReview={canReview}
    />
  );
}
