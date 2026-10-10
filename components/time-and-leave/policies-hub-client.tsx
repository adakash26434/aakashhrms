"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Plus, RefreshCw, Timer } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Notice } from "@/components/kit/notice";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { LeavePolicy } from "@/components/leave-policy/leave-policy";
import { CompanyLeaveTypes, type CompanyTypePermissions } from "@/components/leave-policy/company-leave-types";
import { OvertimePolicyView } from "@/components/overtime/overtime-policy";
import { OtRulesClient } from "@/components/ot-rules/ot-rules-client";
import type { CompanyTypeChange, LeaveTypeRecord } from "@/lib/types/leave-type";
import type { OvertimePolicyData } from "@/lib/types/overtime";
import type { LeavePolicyPageData } from "@/lib/types/leave-policy";

export type PolicyTab = "types" | "overtime" | "ot-rules";

interface PoliciesHubClientProps {
  allowedTabs: PolicyTab[];
  activeTab: PolicyTab;
  typesData?: {
    types: LeaveTypeRecord[];
    history: Record<string, CompanyTypeChange[]>;
    departments: { id: string; name: string }[];
    designations: { id: string; name: string }[];
  } | null;
  /** Statutory leave settings with their changes (4.6c). */
  policyData?: LeavePolicyPageData | null;
  /** What this user may do with the company's own leave types. */
  typePermissions?: CompanyTypePermissions;
  /** The company's overtime policy (4.7): approval and rounding. */
  otData?: OvertimePolicyData | null;
  /** The team's OT rules: the rates payroll uses (never below the Labour Act's 1.5). */
  otRulesData?: { rules: Parameters<typeof OtRulesClient>[0]["initialOtRules"]; kpis: Parameters<typeof OtRulesClient>[0]["initialOtKPIs"]; otMultiplierOfficeDay?: number; otMultiplierOffDay?: number } | null;
}

/**
 * Time & Leave → Policies, laid out like Leaves and Attendance: the page bar,
 * then folder tabs. Leave types: statutory leave (the Labour Act's minimum,
 * changes approved by a second person) and the company's own types (how
 * leave is given, counted and paid out is set on each type; the old Leave
 * rules tab is retired). Overtime: the company's one overtime policy (4.7).
 */
export function PoliciesHubClient({ allowedTabs, activeTab, typesData, policyData, typePermissions, otData, otRulesData }: PoliciesHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshing, startRefresh] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const all: (TabItem & { id: PolicyTab })[] = [
    { id: "types", label: "Leave types", icon: CalendarDays, badge: policyData?.waitingForMe || undefined },
    { id: "overtime", label: "Overtime", icon: Timer },
    { id: "ot-rules", label: "Overtime rates", icon: Timer },
  ];
  const tabs = all.filter((t) => allowedTabs.includes(t.id));
  const changeTab = (next: string) => {
    if (next === activeTab) return;
    setNotice(null);
    startRefresh(() => router.push(`${pathname}?tab=${next}`, { scroll: false }));
  };
  const done = (text: string) => {
    setNotice(text);
    router.refresh();
  };

  return (
    <div>
      <PageBar
        title="Policies"
        description={policyData?.waitingForMe ? `${policyData.waitingForMe} leave policy change${policyData.waitingForMe === 1 ? "" : "s"} waiting for you` : "Leave types, the overtime policy and the overtime rates"}
        actions={[
          { id: "new-type", label: "New leave type", icon: Plus, group: "create", primary: true, hidden: activeTab !== "types" || !typePermissions?.add, onClick: () => setCreating(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <Tabs variant="folder" items={tabs} value={activeTab} onChange={changeTab} label="Policy views">
        {activeTab === "types" && (
          <div>
            {policyData && <LeavePolicy data={policyData} onDone={done} />}
            {typesData && (
              <CompanyLeaveTypes types={typesData.types} history={typesData.history} departments={typesData.departments} designations={typesData.designations} permissions={typePermissions ?? { add: false, edit: false, delete: false }} creating={creating} onCloseCreate={() => setCreating(false)} onDone={done} />
            )}
          </div>
        )}
        {activeTab === "overtime" && otData && <OvertimePolicyView key={JSON.stringify(otData.policy)} data={otData} onDone={done} />}
        {activeTab === "ot-rules" && otRulesData && (
          <div className="p-3">
            <OtRulesClient initialOtRules={otRulesData.rules} initialOtKPIs={otRulesData.kpis} otMultiplierOfficeDay={otRulesData.otMultiplierOfficeDay} otMultiplierOffDay={otRulesData.otMultiplierOffDay} embedded={true} />
          </div>
        )}
      </Tabs>
    </div>
  );
}
