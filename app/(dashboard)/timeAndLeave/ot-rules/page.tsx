export const dynamic = "force-dynamic";
import { OtRulesClient } from "@/components/ot-rules/ot-rules-client";
import { getOtRulesWithKPIs } from "@/lib/services/ot-rule.service";
import { getSystemControlData } from "@/lib/services/system-control.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "OT Rules | AakashHRMS",
  description: "Configure overtime calculation rules.",
};

export default async function OtRulesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "OT_RULES");

  const [otData, systemData] = await Promise.all([
    getOtRulesWithKPIs(),
    getSystemControlData(),
  ]);

  return (
    <OtRulesClient
      initialOtRules={otData.rules}
      initialOtKPIs={otData.kpis}
      otMultiplierOfficeDay={systemData.officeTime.otMultiplierOfficeDay}
      otMultiplierOffDay={systemData.officeTime.otMultiplierOffDay}
    />
  );
}