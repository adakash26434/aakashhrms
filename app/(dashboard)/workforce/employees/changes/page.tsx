export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { DetailChangesClient } from "@/components/employee/employee-detail-changes";
import { changesPage } from "@/lib/services/employee-detail.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { isUuid } from "@/lib/utils/uuid";

export const metadata: Metadata = {
  title: "Detail changes | AakashHRMS",
  description: "Changes to bank accounts, PAN and tax status, approved by a second person (maker-checker).",
};

/** Detail changes (4.8 / F13): every change in the viewer's employee scope; deciding needs Employees → Approve. */
export default async function EmployeeDetailChangesPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [canApprove, canEdit, { id }] = await Promise.all([hasPermission("APPROVE", "EMPLOYEES"), hasPermission("EDIT", "EMPLOYEES"), searchParams]);
  const data = await changesPage({ scope, userId: scope.userId, canApprove, canEdit });
  return <DetailChangesClient data={data} initialId={isUuid(id) ? id : null} />;
}
