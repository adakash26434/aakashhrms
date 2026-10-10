export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { leaveSalaryPage } from "@/lib/services/leave-salary.service";
import { LeaveSalaryClient } from "@/components/leave-salary/leave-salary-client";
import { LEAVE_SALARY_STATUSES } from "@/lib/engines/leave-salary.engine";

export const metadata: Metadata = {
  title: "Leave salary | AakashHRMS",
  description: "Leave paid out in money: days over the limit at year end and encashments from the balance, paid with the pay run.",
};

export default async function LeaveSalaryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await ensureTenantContext();
  // Leave salary follows the user's employee scope (4.9).
  const scope = await checkPermissionWithScope("VIEW", "LEAVE_SALARY");
  const { status } = await searchParams;
  const [add, edit, remove, approve] = await Promise.all([
    hasPermission("ADD", "LEAVE_SALARY"),
    hasPermission("EDIT", "LEAVE_SALARY"),
    hasPermission("DELETE", "LEAVE_SALARY"),
    hasPermission("APPROVE", "LEAVE_SALARY"),
  ]);
  // Platform support looks, never changes (the actions refuse it too).
  const writes = !scope.isImpersonation;
  const data = await leaveSalaryPage(
    { userId: scope.userId, actorEmployeeId: scope.employeeId, scope },
    { add: add && writes, edit: edit && writes, remove: remove && writes, approve: approve && writes }
  );
  return <LeaveSalaryClient data={data} initialStatus={(LEAVE_SALARY_STATUSES as readonly string[]).includes(status ?? "") ? status : undefined} />;
}
