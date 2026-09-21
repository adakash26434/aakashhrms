export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission } from "@/lib/auth/check-permission";
import { getLeaveApplications } from "@/lib/services/leave.service";
import * as reportService from "@/lib/services/report.service";
import { LeavesHubClient, type LeaveTab } from "@/components/time-and-leave/leaves-hub-client";

export const metadata: Metadata = {
  title: "Leave Management | AakashHRMS",
  description: "Unified portal for employee leave requests, team approvals, and entitlement balance records.",
};

interface LeavesPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function LeavesPage({ searchParams }: LeavesPageProps) {
  await ensureTenantContext();
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Permission checks
  const canRequests = await hasPermission("VIEW", "LEAVE_APPLICATIONS");
  const canApprovals = await hasPermission("VIEW", "LEAVE_APPROVALS");
  const canBalances = canRequests || (await hasPermission("VIEW", "REPORTS_LEAVE"));

  const allowedTabs: LeaveTab[] = [];
  if (canRequests) allowedTabs.push("requests");
  if (canApprovals) allowedTabs.push("approvals");
  if (canBalances) allowedTabs.push("balances");

  if (allowedTabs.length === 0) {
    throw new Error("Unauthorized: You do not have permission to view Leave Management.");
  }

  // 2. Resolve active tab (defaulting to first allowed tab if requested tab is unauthorized or absent)
  const requestedTab = resolvedParams.tab as LeaveTab;
  const activeTab: LeaveTab =
    requestedTab && allowedTabs.includes(requestedTab)
      ? requestedTab
      : allowedTabs[0];

  // 3. Only fetch data for the active tab!
  let requestsData = null;
  let balancesData = null;

  if (activeTab === "requests") {
    requestsData = await getLeaveApplications({
      search: "",
      status: "all",
      leaveTypeId: "all",
      dateFrom: "",
      dateTo: "",
    });
  } else if (activeTab === "balances") {
    const lookups = await reportService.getReportFilterLookupData();
    const defaultFyId = lookups.fiscalYears[0]?.id || "";
    let reportData = null;
    if (defaultFyId) {
      try {
        reportData = await reportService.getLeaveReportData({
          fiscalYearId: defaultFyId,
        });
      } catch {
        reportData = null;
      }
    }
    balancesData = {
      lookups,
      reportData,
    };
  }

  return (
    <LeavesHubClient
      allowedTabs={allowedTabs}
      activeTab={activeTab}
      requestsData={requestsData}
      balancesData={balancesData}
    />
  );
}
