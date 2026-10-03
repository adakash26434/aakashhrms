export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/organization-client";
import { getOrganizationData } from "@/lib/services/organization.service";
import { canChangeMasters, resolveOrgTab } from "@/lib/engines/organization.engine";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Organization | AakashHRMS",
  description: "Branches, departments, designations, grade levels and employment types, the structure matrix and the reporting chart.",
};

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "ORG_STRUCTURE");
  const { tab } = await searchParams;
  const [add, edit, remove, viewPeople] = await Promise.all([
    hasPermission("ADD", "ORG_STRUCTURE"),
    hasPermission("EDIT", "ORG_STRUCTURE"),
    hasPermission("DELETE", "ORG_STRUCTURE"),
    hasPermission("VIEW", "EMPLOYEES"),
  ]);
  // Names of people (reporting chart, department heads) follow the Employees permission and scope.
  const peopleScope = viewPeople ? await checkPermissionWithScope("VIEW", "EMPLOYEES") : null;
  const data = await getOrganizationData({
    tab: resolveOrgTab(tab),
    peopleScope,
    permissions: { add, edit, delete: remove, companyWide: canChangeMasters(scope) },
  });
  return <OrganizationClient data={data} />;
}
