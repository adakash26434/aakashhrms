"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ScrollText, Timer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveTypesClient } from "@/components/leave-types/leave-types-client";
import { LeaveRulesClient } from "@/components/leave-rules/leave-rules-client";
import { OtRulesClient } from "@/components/ot-rules/ot-rules-client";
import type { LeaveTypeRecord, LeaveTypeKPIs } from "@/lib/types/leave-type";
import type { LeaveRule, LeaveRuleKPIs } from "@/lib/types/leave-rule";
import type { OtRule, OtRuleKPIs } from "@/lib/types/ot-rule";

export type PolicyTab = "types" | "rules" | "ot-rules";

interface PolicyTabMeta {
  id: PolicyTab;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface PoliciesHubClientProps {
  allowedTabs: PolicyTab[];
  activeTab: PolicyTab;
  typesData?: {
    types: LeaveTypeRecord[];
    kpis: LeaveTypeKPIs;
  } | null;
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

export function PoliciesHubClient({
  allowedTabs,
  activeTab,
  typesData,
  rulesData,
  otData,
}: PoliciesHubClientProps) {
  const router = useRouter();

  const allTabs: PolicyTabMeta[] = [
    {
      id: "types",
      label: "Leave Types",
      icon: CalendarDays,
      count: typesData?.types?.length,
    },
    {
      id: "rules",
      label: "Leave Rules",
      icon: ScrollText,
      count: rulesData?.rules?.length,
    },
    {
      id: "ot-rules",
      label: "Overtime (OT) Rules",
      icon: Timer,
      count: otData?.rules?.length,
    },
  ];

  // Filter tabs strictly to user's permissions
  const visibleTabs = allTabs.filter((t) => allowedTabs.includes(t.id));

  const handleTabChange = (next: PolicyTab) => {
    if (next === activeTab) return;
    router.push(`/timeAndLeave/policies?tab=${next}`);
  };

  return (
    <PageFrame size="wide" spacing="default">
      <PageHeader
        title="Leave & Overtime Policies"
        description="Configure statutory and custom leave entitlements, rule calculations, and corporate overtime multipliers."
      />

      {/* Tab bar */}
      {visibleTabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Policy Hub Tabs"
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
        {activeTab === "types" && typesData && (
          <LeaveTypesClient
            initialTypes={typesData.types}
            initialKpis={typesData.kpis}
            embedded={true}
          />
        )}

        {activeTab === "rules" && rulesData && (
          <LeaveRulesClient
            initialRules={rulesData.rules}
            initialKpis={rulesData.kpis}
            leaveTypes={rulesData.leaveTypes}
            embedded={true}
          />
        )}

        {activeTab === "ot-rules" && otData && (
          <OtRulesClient
            initialOtRules={otData.rules}
            initialOtKPIs={otData.kpis}
            otMultiplierOfficeDay={otData.otMultiplierOfficeDay}
            otMultiplierOffDay={otData.otMultiplierOffDay}
            embedded={true}
          />
        )}
      </div>
    </PageFrame>
  );
}
