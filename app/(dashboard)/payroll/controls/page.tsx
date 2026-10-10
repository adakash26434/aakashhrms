export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { getPayrollControlSettingsAction } from "@/app/actions/payroll-control.actions";
import { PayrollControlSettingsClient } from "@/components/payroll/payroll-control-settings";

export const metadata: Metadata = {
  title: "Payroll controls | AakashHRMS",
  description: "Maker-checker mode, variance threshold and attendance rule for pay runs.",
};

export default async function PayrollControlsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SYSTEM_CONTROL");
  const [canEdit, result] = await Promise.all([hasPermission("EDIT", "SYSTEM_CONTROL"), getPayrollControlSettingsAction()]);
  if (!result.success) throw new Error(result.error);
  return <PayrollControlSettingsClient initial={result.data} canEdit={canEdit} />;
}
