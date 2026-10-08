export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { policyPage } from "@/lib/services/leave-policy.service";
import { auth } from "@/lib/auth";
import { resolvePlatformCompanyForTenant } from "@/lib/platform/company-resolver";
import { companyTypesData } from "@/lib/services/leave-type.service";
import { getPolicyData as overtimePolicyData } from "@/lib/services/overtime.service";
import { PoliciesHubClient, type PolicyTab } from "@/components/time-and-leave/policies-hub-client";

export const metadata: Metadata = {
  title: "Policies | AakashHRMS",
  description: "Statutory and company leave types, and the overtime policy.",
};

interface PoliciesPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function PoliciesPage({ searchParams }: PoliciesPageProps) {
  await ensureTenantContext();
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Permission checks
  // Leave rules were retired in 4.6e: how leave is given, counted and paid out is set on each leave type.
  const canTypes = await hasPermission("VIEW", "LEAVE_TYPES");
  const canOt = await hasPermission("VIEW", "OT_RULES");

  const allowedTabs: PolicyTab[] = [];
  if (canTypes) allowedTabs.push("types");
  if (canOt) allowedTabs.push("overtime");

  if (allowedTabs.length === 0) {
    throw new Error("Unauthorized: You do not have permission to view Policies.");
  }

  // 2. Active Tab resolution (defaulting to first allowed tab)
  // "ot-rules" is the old name of the Overtime tab (links from before 4.7).
  const requestedTab = (resolvedParams.tab === "ot-rules" ? "overtime" : resolvedParams.tab) as PolicyTab;
  const activeTab: PolicyTab =
    requestedTab && allowedTabs.includes(requestedTab)
      ? requestedTab
      : allowedTabs[0];

  // 3. Only fetch data for the active tab!
  let typesData = null;
  let policyData = null;
  let typePermissions = { add: false, edit: false, delete: false };
  let otData = null;

  if (activeTab === "types") {
    // Statutory leave settings: changes proposed with Leave types → Edit and approved by a second person (4.6c).
    const scope = await checkPermissionWithScope("VIEW", "LEAVE_TYPES");
    const [canEdit, canApprove, impersonation] = await Promise.all([hasPermission("EDIT", "LEAVE_TYPES"), hasPermission("APPROVE", "LEAVE_TYPES"), getImpersonationSession()]);
    // The company on the platform, for exception requests (4.6d); leave works without it.
    const session = await auth();
    const companyId = await resolvePlatformCompanyForTenant(session?.user?.tenantSlug || undefined).then((c) => c.id, () => null);
    [typesData, policyData] = await Promise.all([companyTypesData(), policyPage({ scope, userId: scope.userId, canEdit, canApprove, impersonation: !!impersonation, companyId })]);
    // Company types apply to everyone: changing them needs a company-wide role (the server checks again).
    const companyWide = scope.scopeType === "GLOBAL";
    typePermissions = { add: companyWide && (await hasPermission("ADD", "LEAVE_TYPES")), edit: companyWide && canEdit, delete: companyWide && (await hasPermission("DELETE", "LEAVE_TYPES")) };
  } else if (activeTab === "overtime") {
    // The overtime policy is a company-wide control (the action checks again, 4.7).
    const scope = await checkPermissionWithScope("VIEW", "OT_RULES");
    const [canEdit, impersonation] = await Promise.all([hasPermission("EDIT", "OT_RULES"), getImpersonationSession()]);
    otData = await overtimePolicyData(canEdit && scope.scopeType === "GLOBAL" && !impersonation);
  }

  return (
    <PoliciesHubClient
      allowedTabs={allowedTabs}
      activeTab={activeTab}
      typesData={typesData}
      policyData={policyData}
      typePermissions={typePermissions}
      otData={otData}
    />
  );
}
