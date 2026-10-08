export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { SalaryStructureClient } from "@/components/salary-mapping/salary-structure-client";
import { getStructureData } from "@/lib/services/salary-structure.service";
import { resolveStructureTab } from "@/lib/engines/salary-structure.engine";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Salary structure | AakashHRMS",
  description: "Each employee's pay as dated revisions: single changes, the bulk table, approvals, templates and printable revisions.",
};

export default async function SalaryStructurePage({ searchParams }: { searchParams: Promise<{ tab?: string; employee?: string }> }) {
  await ensureTenantContext();
  // Salary data follows the user's employee scope (S20).
  const scope = await checkPermissionWithScope("VIEW", "SALARY_MAPPING");
  const { tab, employee } = await searchParams;
  const [add, edit, remove, approve, exportAllowed] = await Promise.all([
    hasPermission("ADD", "SALARY_MAPPING"),
    hasPermission("EDIT", "SALARY_MAPPING"),
    hasPermission("DELETE", "SALARY_MAPPING"),
    hasPermission("APPROVE", "SALARY_MAPPING"),
    hasPermission("EXPORT", "SALARY_MAPPING"),
  ]);
  const data = await getStructureData({
    tab: resolveStructureTab(tab),
    scope,
    userId: scope.userId,
    permissions: { add, edit, delete: remove, approve, export: exportAllowed },
  });
  // ?employee=<id> (from the employee form) opens with that person selected.
  return <SalaryStructureClient data={data} initialEmployeeId={typeof employee === "string" ? employee : null} />;
}
