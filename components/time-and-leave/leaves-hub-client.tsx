"use client";

import { useRouter } from "next/navigation";
import { CalendarCheck, CheckSquare, Award, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveApplicationClient } from "@/components/leave/leave-application-client";
import { LeaveApprovalClient } from "@/components/leave/leave-approval-client";
import { LeaveBalancesPanel } from "./leave-balances-panel";
import type { LeaveApplication, LeaveKPIs } from "@/lib/types/leave";
import type { LeaveReportData, ReportFilterLookupData } from "@/lib/types/report";

export type LeaveTab = "requests" | "approvals" | "balances";

interface LeaveTabMeta {
  id: LeaveTab;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface EnrichedApplication extends LeaveApplication {
  employeeName: string;
}

interface LeavesHubClientProps {
  allowedTabs: LeaveTab[];
  activeTab: LeaveTab;
  requestsData?: {
    applications: EnrichedApplication[];
    kpis: LeaveKPIs;
  } | null;
  balancesData?: {
    lookups: ReportFilterLookupData;
    reportData: LeaveReportData | null;
  } | null;
}

export function LeavesHubClient({
  allowedTabs,
  activeTab,
  requestsData,
  balancesData,
}: LeavesHubClientProps) {
  const router = useRouter();

  const allTabs: LeaveTabMeta[] = [
    {
      id: "requests",
      label: "Requests",
      icon: CalendarCheck,
      count: requestsData?.applications?.length,
    },
    {
      id: "approvals",
      label: "Approvals",
      icon: CheckSquare,
    },
    {
      id: "balances",
      label: "Balances",
      icon: Award,
    },
  ];

  // Filter tabs strictly to user's permissions
  const visibleTabs = allTabs.filter((t) => allowedTabs.includes(t.id));

  const handleTabChange = (next: LeaveTab) => {
    if (next === activeTab) return;
    router.push(`/timeAndLeave/leaves?tab=${next}`);
  };

  return (
    <PageFrame size="wide" spacing="default">
      <PageHeader
        title="Leave Management"
        description="Unified hub to track employee leave requests, review supervisor approvals, and audit entitlement balances."
      />

      {/* Tab bar (only rendered if user has more than 1 tab permission, or always to show context) */}
      {visibleTabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Leave Hub Tabs"
          className="inline-flex w-full max-w-xl rounded-2xl border border-payroll-light/80 bg-white p-1.5 shadow-payroll-xs"
        >
          {visibleTabs.map((t) => {
            const isActive = t.id === activeTab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer select-none",
                  isActive
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-gray-400")} />
                <span>{t.label}</span>
                {typeof t.count === "number" && (
                  <span
                    className={cn(
                      "ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-payroll-light/60 text-payroll-navy",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Tab Panel Only — strict isolation */}
      <div className="pt-1">
        {activeTab === "requests" && requestsData && (
          <LeaveApplicationClient
            initialApplications={requestsData.applications}
            initialKpis={requestsData.kpis}
            embedded={true}
          />
        )}

        {activeTab === "approvals" && (
          <LeaveApprovalClient embedded={true} />
        )}

        {activeTab === "balances" && (
          <LeaveBalancesPanel
            initialData={balancesData?.reportData}
            lookups={balancesData?.lookups}
          />
        )}
      </div>
    </PageFrame>
  );
}
