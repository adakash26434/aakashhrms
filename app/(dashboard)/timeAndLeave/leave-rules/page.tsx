export const dynamic = "force-dynamic";
import { LeaveRulesClient } from "@/components/leave-rules/leave-rules-client";
import { getLeaveRulesWithKPIs } from "@/lib/services/leave-rule.service";
import { getActiveLeaveTypes } from "@/lib/services/leave-type.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Leave Rules | AakashHRMS",
  description: "Configure statutory and corporate leave rules.",
};

export default async function LeaveRulesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LEAVE_RULES");

  const [rulesData, activeTypes] = await Promise.all([
    getLeaveRulesWithKPIs(),
    getActiveLeaveTypes(),
  ]);

  const mappedTypes = activeTypes.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
  }));

  return (
    <LeaveRulesClient
      initialRules={rulesData.rules}
      initialKpis={rulesData.kpis}
      leaveTypes={mappedTypes}
    />
  );
}
