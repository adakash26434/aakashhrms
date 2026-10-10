export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { loansPage } from "@/lib/services/loan.service";
import { REQUEST_STATUSES } from "@/lib/engines/loan.engine";
import { LoansClient } from "@/components/loans/loans-client";

export const metadata: Metadata = {
  title: "Loans & advances | AakashHRMS",
  description: "Staff loans and salary advances: requests approved by someone else, disbursement, recovery through payroll.",
};

const TABS = ["loans", "requests", "types"] as const;

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  await ensureTenantContext();
  // Loans follow the user's employee scope (4.10).
  const scope = await checkPermissionWithScope("VIEW", "LOANS");
  const { tab, status } = await searchParams;
  const [add, edit, remove, approve] = await Promise.all([
    hasPermission("ADD", "LOANS"),
    hasPermission("EDIT", "LOANS"),
    hasPermission("DELETE", "LOANS"),
    hasPermission("APPROVE", "LOANS"),
  ]);
  // Platform support looks, never changes (the actions refuse it too); loan types and the
  // approval settings are a company control (company-wide users only).
  const writes = !scope.isImpersonation;
  const company = writes && scope.scopeType === "GLOBAL";
  const data = await loansPage(
    { userId: scope.userId, scope, canApprove: approve },
    { add: add && writes, edit: edit && writes, remove: remove && writes, approve: approve && writes, settings: approve && company, types: edit && company }
  );
  const initialTab = (TABS as readonly string[]).includes(tab ?? "") ? (tab as (typeof TABS)[number]) : status ? "requests" : undefined;
  const initialStatus = status === "mine" || (REQUEST_STATUSES as readonly string[]).includes(status ?? "") ? status : undefined;
  return <LoansClient data={data} initialTab={initialTab} initialStatus={initialStatus} />;
}
