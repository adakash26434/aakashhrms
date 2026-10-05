export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { getLeavePage } from "@/lib/services/leave.service";
import { leaveCalendar, substituteSuggestions } from "@/lib/services/leave-entitlement.service";
import { LeaveClient } from "@/components/leave/leave-client";
import { LEAVE_TABS, type LeaveTabId } from "@/lib/types/leave";

export const metadata: Metadata = {
  title: "Leaves | AakashHRMS",
  description: "Leave requests and approvals, balances from the leave ledger, substitute leave and the leave calendar.",
};

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ tab?: string; y?: string; m?: string }> }) {
  await ensureTenantContext();
  // Leave follows the user's employee scope (S24): Leave requests → View, or Leave approvals → View.
  const scope = (await hasPermission("VIEW", "LEAVE_APPLICATIONS"))
    ? await checkPermissionWithScope("VIEW", "LEAVE_APPLICATIONS")
    : await checkPermissionWithScope("VIEW", "LEAVE_APPROVALS");
  const sp = await searchParams;
  const tab: LeaveTabId = (LEAVE_TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as LeaveTabId) : "requests";
  const [add, edit, approve] = await Promise.all([hasPermission("ADD", "LEAVE_APPLICATIONS"), hasPermission("EDIT", "LEAVE_APPLICATIONS"), hasPermission("APPROVE", "LEAVE_APPROVALS")]);
  // Opening a leave year changes everyone's balances: company-wide editors only (S24).
  const openYear = edit && scope.scopeType === "GLOBAL";
  const data = await getLeavePage({ tab, scope, userId: scope.userId, permissions: { add, edit, approve, openYear } });
  if (tab === "substitute") data.substitute = await substituteSuggestions(scope);
  if (tab === "calendar") data.calendar = await leaveCalendar(scope, Number(sp.y), Number(sp.m));
  return <LeaveClient data={data} />;
}
