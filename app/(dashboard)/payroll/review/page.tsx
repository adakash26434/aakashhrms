export const dynamic = "force-dynamic";
import PayrollClient from "@/components/payroll/payroll-client";
import { getPayrollGeneratePageData } from "@/lib/services/payroll.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Review & Approve Payroll | AakashHRMS",
  description: "Verify, audit and lock monthly payroll runs.",
};

export default async function ReviewPayrollPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "PAYROLL_REVIEW");

  const {
    runs,
    branches,
    departments,
    designations,
    employees,
    occasionalAllowances,
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
      userRole={userRole}
    />
  );
}
