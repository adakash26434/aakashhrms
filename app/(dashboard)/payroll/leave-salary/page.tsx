export const dynamic = "force-dynamic";
import LeaveSalaryClient from "@/components/leave-salary/leave-salary-client";
import { getLeaveSalaryHistory, getLeaveSalaryLookupData } from "@/lib/services/leave-salary.service";
import { getUserLeaveSalaryPermissionsAction } from "@/app/actions/leave-salary.actions";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Leave Salary Encashment | AakashHRMS",
  description: "Calculate and pay accumulated leave balances.",
};

export default async function LeaveSalaryPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_SALARY");

  const [runs, lookupData, userPermissions] = await Promise.all([
    getLeaveSalaryHistory(),
    getLeaveSalaryLookupData(),
    getUserLeaveSalaryPermissionsAction(),
  ]);

  const mappedEmps = lookupData.employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName} (${e.employeeCode})` }));
  const mappedTypes = lookupData.leaveTypes.map(t => ({ id: t.id, name: t.name }));
  const mappedFiscalYears = (lookupData.fiscalYears || []).map(f => ({ id: f.id, label: f.label, status: f.status }));

  return (
    <LeaveSalaryClient
      initialRuns={runs}
      employees={mappedEmps}
      leaveTypes={mappedTypes}
      fiscalYears={mappedFiscalYears}
      permissions={userPermissions}
    />
  );
}
