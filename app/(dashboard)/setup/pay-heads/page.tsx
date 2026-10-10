export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission, checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { payHeadsPage } from "@/lib/services/pay-head.service";
import { PayHeadsClient } from "@/components/pay-head/pay-heads-client";

export const metadata: Metadata = {
  title: "Pay heads | AakashHRMS",
  description: "Allowances and deductions: what each is, how its amount is worked out, and who it is for.",
};

export default async function PayHeadsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "PAY_HEADS");
  // The permissions show the buttons; every change re-checks a company-wide role on the server (checkCompanyControl).
  const [add, edit, del, salaryView] = await Promise.all([hasPermission("ADD", "PAY_HEADS"), hasPermission("EDIT", "PAY_HEADS"), hasPermission("DELETE", "PAY_HEADS"), hasPermission("VIEW", "SALARY_MAPPING")]);
  // Who still holds an amount on a label head is salary data: Salary structure → View, within its scope (4.12e).
  const salaryScope = salaryView ? await checkPermissionWithScope("VIEW", "SALARY_MAPPING") : null;
  return <PayHeadsClient initial={await payHeadsPage({ add, edit, delete: del }, salaryScope)} />;
}
