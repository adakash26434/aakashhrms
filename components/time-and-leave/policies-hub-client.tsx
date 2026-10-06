"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Plus, RefreshCw, ScrollText, Timer } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Notice } from "@/components/kit/notice";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { LeavePolicy } from "@/components/leave-policy/leave-policy";
import { CompanyLeaveTypes, type CompanyTypePermissions } from "@/components/leave-policy/company-leave-types";
import { LeaveRulesClient } from "@/components/leave-rules/leave-rules-client";
import { OtRulesClient } from "@/components/ot-rules/ot-rules-client";
import type { LeaveTypeRecord, LeaveTypeKPIs } from "@/lib/types/leave-type";
import type { LeaveRule, LeaveRuleKPIs } from "@/lib/types/leave-rule";
import type { OtRule, OtRuleKPIs } from "@/lib/types/ot-rule";
import type { LeavePolicyPageData } from "@/lib/types/leave-policy";

export type PolicyTab = "types" | "rules" | "ot-rules";

interface PoliciesHubClientProps {
  allowedTabs: PolicyTab[];
  activeTab: PolicyTab;
  typesData?: {
    types: LeaveTypeRecord[];
    kpis: LeaveTypeKPIs;
  } | null;
  /** Statutory leave settings with their changes (4.6c). */
  policyData?: LeavePolicyPageData | null;
  /** What this user may do with the company's own leave types. */
  typePermissions?: CompanyTypePermissions;
  rulesData?: {
    rules: LeaveRule[];
    kpis: LeaveRuleKPIs;
    leaveTypes: { id: string; name: string; code: string }[];
  } | null;
  otData?: {
    rules: OtRule[];
    kpis: OtRuleKPIs;
    otMultiplierOfficeDay?: number;
    otMultiplierOffDay?: number;
  } | null;
}

/**
 * Time & Leave → Policies, laid out like Leaves and Attendance: the page bar,
 * then folder tabs. Leave types: statutory leave (the Labour Act's minimum,
 * changes approved by a second person) and the company's own types; Leave
 * rules and Overtime rules keep their screens until they are redesigned.
 */
export function PoliciesHubClient({ allowedTabs, activeTab, typesData, policyData, typePermissions, rulesData, otData }: PoliciesHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshing, startRefresh] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const all: (TabItem & { id: PolicyTab })[] = [
    { id: "types", label: "Leave types", icon: CalendarDays, badge: policyData?.waitingForMe || undefined },
    { id: "rules", label: "Leave rules", icon: ScrollText },
    { id: "ot-rules", label: "Overtime rules", icon: Timer },
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
        description={policyData?.waitingForMe ? `${policyData.waitingForMe} leave policy change${policyData.waitingForMe === 1 ? "" : "s"} waiting for you` : "Leave types, leave rules and overtime rules"}
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
              <CompanyLeaveTypes types={typesData.types} permissions={typePermissions ?? { add: false, edit: false, delete: false }} creating={creating} onCloseCreate={() => setCreating(false)} onDone={done} />
            )}
          </div>
        )}
        {activeTab === "rules" && rulesData && (
          <div className="p-3">
            <LeaveRulesClient initialRules={rulesData.rules} initialKpis={rulesData.kpis} leaveTypes={rulesData.leaveTypes} embedded={true} />
          </div>
        )}
        {activeTab === "ot-rules" && otData && (
          <div className="p-3">
            <OtRulesClient initialOtRules={otData.rules} initialOtKPIs={otData.kpis} otMultiplierOfficeDay={otData.otMultiplierOfficeDay} otMultiplierOffDay={otData.otMultiplierOffDay} embedded={true} />
          </div>
        )}
      </Tabs>
    </div>
  );
}
