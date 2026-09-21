"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Percent,
  FileText,
  Sliders,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { FiscalYearClient } from "@/components/fiscal-year/fiscal-year-client";
import { TaxRateClient } from "@/components/tax-rate/tax-rate-client";
import { PayHeadClient } from "@/components/pay-head/pay-head-client";
import { SystemControlClient } from "@/components/system-control/system-control-client";
import type { FiscalYearData } from "@/lib/types/fiscal-year";
import type { TaxRateData } from "@/lib/types/tax-rate";
import type { PayHeadData } from "@/lib/types/pay-head";
import type { SystemControlData } from "@/lib/types/system-control";

export type PayrollRuleTab =
  | "fiscal-year"
  | "tax-rates"
  | "pay-heads"
  | "rules-defaults";

export const VALID_PAYROLL_RULE_TABS: PayrollRuleTab[] = [
  "fiscal-year",
  "tax-rates",
  "pay-heads",
  "rules-defaults",
];

/**
 * Normalizes legacy, shorthand, or underscore-delimited tab parameters into
 * the canonical PayrollRuleTab identifier.
 */
export function normalizePayrollRuleTab(rawTab?: string | null): PayrollRuleTab {
  if (!rawTab) return "fiscal-year";
  const normalized = rawTab.toLowerCase().replace(/_/g, "-");
  if (normalized === "fiscal-year" || normalized === "fiscalyear" || normalized === "fy") {
    return "fiscal-year";
  }
  if (normalized === "tax-rates" || normalized === "taxrates" || normalized === "tax") {
    return "tax-rates";
  }
  if (normalized === "pay-heads" || normalized === "payheads") {
    return "pay-heads";
  }
  if (
    normalized === "rules-defaults" ||
    normalized === "rules" ||
    normalized === "system-control" ||
    normalized === "systemcontrol" ||
    normalized === "defaults"
  ) {
    return "rules-defaults";
  }
  return "fiscal-year";
}

interface TabMeta {
  id: PayrollRuleTab;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  count?: string | number | null;
}

interface PayrollRulesHubClientProps {
  initialTab?: string;
  allowedTabs: PayrollRuleTab[];
  fiscalYearData?: FiscalYearData | null;
  taxRateData?: TaxRateData | null;
  payHeadData?: PayHeadData | null;
  systemControlData?: SystemControlData | null;
  isSuperAdmin?: boolean;
}

export function PayrollRulesHubClient({
  initialTab,
  allowedTabs,
  fiscalYearData,
  taxRateData,
  payHeadData,
  systemControlData,
  isSuperAdmin = false,
}: PayrollRulesHubClientProps) {
  const searchParams = useSearchParams();

  // Resolve initial tab safely against permissions
  const resolvedInitialTab: PayrollRuleTab = (() => {
    const fromProps = normalizePayrollRuleTab(initialTab || searchParams.get("tab"));
    if (allowedTabs.includes(fromProps)) {
      return fromProps;
    }
    return allowedTabs[0] || "fiscal-year";
  })();

  const [activeTab, setActiveTab] = useState<PayrollRuleTab>(resolvedInitialTab);

  const handleTabChange = (nextTab: PayrollRuleTab) => {
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const tabs: TabMeta[] = [
    {
      id: "fiscal-year",
      label: "Fiscal Year",
      sublabel: "B.S. Periods & Active Calendar",
      icon: CalendarDays,
      count: fiscalYearData?.fiscalYears?.length
        ? `${fiscalYearData.fiscalYears.length} FY`
        : null,
    },
    {
      id: "tax-rates",
      label: "Tax Rates",
      sublabel: "Nepal TDS Slabs & Rebates",
      icon: Percent,
      count: taxRateData?.slabs?.length
        ? `${taxRateData.slabs.length} Slabs`
        : null,
    },
    {
      id: "pay-heads",
      label: "Pay Heads",
      sublabel: "Earnings & Deductions Master",
      icon: FileText,
      count: payHeadData?.payHeads?.length
        ? `${payHeadData.payHeads.length} Heads`
        : null,
    },
    {
      id: "rules-defaults",
      label: "Rules & Defaults",
      sublabel: "Statutory Limits & Operations",
      icon: Sliders,
      count: null,
    },
  ];

  const visibleTabs = tabs.filter((t) => allowedTabs.includes(t.id));

  return (
    <PageFrame size="wide" spacing="default">
      <PageHeader
        title="Payroll Rules &amp; Statutory Controls"
        description="Unified configuration for Bikram Sambat fiscal periods, progressive tax slabs, salary pay head components, and organizational payroll policies."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-cream px-3 py-1 text-xs font-bold text-payroll-primary border border-payroll-primary/20 shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Nepal Payroll &amp; Tax Compliant</span>
          </span>
        </div>
      </PageHeader>

      {/* Navigation Tab Bar */}
      {visibleTabs.length > 1 && (
        <div className="overflow-x-auto pb-1">
          <div
            role="tablist"
            aria-label="Payroll Rules Configuration Tabs"
            className="inline-flex min-w-full sm:min-w-0 rounded-xl border border-payroll-light bg-white p-1 shadow-2xs gap-1"
          >
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`payroll-rules-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`payroll-rules-panel-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap select-none",
                    isActive
                      ? "bg-payroll-primary text-white shadow-xs"
                      : "text-gray-600 hover:bg-payroll-cream/50 hover:text-payroll-navy"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.2 text-[10px] font-mono font-bold",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-payroll-cream text-payroll-navy border border-payroll-light/70"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === "fiscal-year" && fiscalYearData && (
          <div
            id="payroll-rules-panel-fiscal-year"
            role="tabpanel"
            aria-labelledby="payroll-rules-tab-fiscal-year"
          >
            <FiscalYearClient initialData={fiscalYearData} embedded={true} />
          </div>
        )}

        {activeTab === "tax-rates" && taxRateData && (
          <div
            id="payroll-rules-panel-tax-rates"
            role="tabpanel"
            aria-labelledby="payroll-rules-tab-tax-rates"
          >
            <TaxRateClient initialData={taxRateData} embedded={true} />
          </div>
        )}

        {activeTab === "pay-heads" && payHeadData && (
          <div
            id="payroll-rules-panel-pay-heads"
            role="tabpanel"
            aria-labelledby="payroll-rules-tab-pay-heads"
          >
            <PayHeadClient initialData={payHeadData} embedded={true} />
          </div>
        )}

        {activeTab === "rules-defaults" && systemControlData && (
          <div
            id="payroll-rules-panel-rules-defaults"
            role="tabpanel"
            aria-labelledby="payroll-rules-tab-rules-defaults"
          >
            <SystemControlClient
              initialData={systemControlData}
              isSuperAdmin={isSuperAdmin}
              embedded={true}
            />
          </div>
        )}
      </div>
    </PageFrame>
  );
}
