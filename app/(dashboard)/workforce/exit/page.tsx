export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { exitPage } from "@/lib/services/exit.service";
import { ExitClient } from "@/components/exit/exit-client";

export const metadata: Metadata = {
  title: "Exit | AakashHRMS",
  description: "Resignations and other exits: clearance by unit, completion, experience letter.",
};

export default async function ExitPage() {
  await ensureTenantContext();
  // Exits change the employee record, so they live under EMPLOYEES.
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [manage, issueLetter] = await Promise.all([hasPermission("EDIT", "EMPLOYEES"), hasPermission("ADD", "HR_LETTERS")]);
  const ctx = { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
  const data = await exitPage(ctx, { manage, issueLetter });
  return <ExitClient data={data} />;
}
