export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { casePage } from "@/lib/services/case.service";
import { CaseClient } from "@/components/discipline/case-client";

export const metadata: Metadata = {
  title: "Discipline & grievance | AakashHRMS",
  description: "Confidential disciplinary and grievance cases.",
};

export default async function DisciplinePage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "DISCIPLINE");
  const [open, manage, decide] = await Promise.all([hasPermission("ADD", "DISCIPLINE"), hasPermission("EDIT", "DISCIPLINE"), hasPermission("APPROVE", "DISCIPLINE")]);
  const data = await casePage({ userId: scope.userId, actorEmployeeId: scope.employeeId, scope }, { open, manage, decide });
  return <CaseClient data={data} />;
}
