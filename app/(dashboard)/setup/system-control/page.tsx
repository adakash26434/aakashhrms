export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/auth/check-permission";
import { rulesPage } from "@/lib/services/system-control.service";
import { RulesClient } from "@/components/system-control/rules-client";

export const metadata: Metadata = {
  title: "Rules & controls | AakashHRMS",
  description: "Tax deduction limits, SSF, overtime multipliers and the grade policy payroll works with.",
};

export default async function SystemControlPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SYSTEM_CONTROL");
  // The permissions show the controls; every save re-checks a company-wide role on the server (checkCompanyControl).
  const [edit, grades] = await Promise.all([hasPermission("EDIT", "SYSTEM_CONTROL"), hasPermission("EDIT", "SALARY_MAPPING")]);
  return <RulesClient initial={await rulesPage({ edit, grades })} />;
}
