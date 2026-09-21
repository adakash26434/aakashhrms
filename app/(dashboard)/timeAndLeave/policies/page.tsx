export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission } from "@/lib/auth/check-permission";
import { getLeaveTypesWithKPIs } from "@/lib/services/leave-type.service";
import { getLeaveRulesWithKPIs } from "@/lib/services/leave-rule.service";
import { getActiveLeaveTypes } from "@/lib/services/leave-type.service";
import { getOtRulesWithKPIs } from "@/lib/services/ot-rule.service";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { PoliciesHubClient, type PolicyTab } from "@/components/time-and-leave/policies-hub-client";

export const metadata: Metadata = {
  title: "Leave & OT Policies | AakashHRMS",
  description: "Configure statutory and custom leave categories, accrual rules, and overtime multipliers.",
};

interface PoliciesPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function PoliciesPage({ searchParams }: PoliciesPageProps) {
  await ensureTenantContext();
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Permission checks
  const canTypes = await hasPermission("VIEW", "LEAVE_TYPES");
  const canRules = await hasPermission("VIEW", "LEAVE_RULES");
  const canOt = await hasPermission("VIEW", "OT_RULES");

  const allowedTabs: PolicyTab[] = [];
  if (canTypes) allowedTabs.push("types");
  if (canRules) allowedTabs.push("rules");
  if (canOt) allowedTabs.push("ot-rules");

  if (allowedTabs.length === 0) {
    throw new Error("Unauthorized: You do not have permission to view Policies.");
  }

  // 2. Active Tab resolution (defaulting to first allowed tab)
  const requestedTab = resolvedParams.tab as PolicyTab;
  const activeTab: PolicyTab =
    requestedTab && allowedTabs.includes(requestedTab)
      ? requestedTab
      : allowedTabs[0];

  // 3. Only fetch data for the active tab!
  let typesData = null;
  let rulesData = null;
  let otData = null;

  if (activeTab === "types") {
    typesData = await getLeaveTypesWithKPIs();
  } else if (activeTab === "rules") {
    const [rData, activeTypes] = await Promise.all([
      getLeaveRulesWithKPIs(),
      getActiveLeaveTypes(),
    ]);
    rulesData = {
      rules: rData.rules,
      kpis: rData.kpis,
      leaveTypes: activeTypes.map((t) => ({ id: t.id, name: t.name, code: t.code })),
    };
  } else if (activeTab === "ot-rules") {
    const [otRulesData, systemData] = await Promise.all([
      getOtRulesWithKPIs(),
      getSystemControlData(),
    ]);
    otData = {
      rules: otRulesData.rules,
      kpis: otRulesData.kpis,
      otMultiplierOfficeDay: systemData.officeTime?.otMultiplierOfficeDay,
      otMultiplierOffDay: systemData.officeTime?.otMultiplierOffDay,
    };
  }

  return (
    <PoliciesHubClient
      allowedTabs={allowedTabs}
      activeTab={activeTab}
      typesData={typesData}
      rulesData={rulesData}
      otData={otData}
    />
  );
}
