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
  embedded?: boolean;
  onSubTabChange?: (tab: PayrollRuleTab) => void;
}

export function PayrollRulesHubClient({
  initialTab,
  allowedTabs,
  fiscalYearData,
  taxRateData,
  payHeadData,
  systemControlData,
  isSuperAdmin = false,
  embedded = false,
  onSubTabChange,
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
    if (onSubTabChange) {
      onSubTabChange(nextTab);
    } else if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const tabs: TabMeta[] = [
    {
      id: "fiscal-year",
      label: "Fiscal year",
      sublabel: "B.S. calendar periods",
      icon: CalendarDays,
      count: fiscalYearData?.fiscalYears?.length
        ? `${fiscalYearData.fiscalYears.length} FY`
        : null,
    },
    {
      id: "tax-rates",
      label: "Tax brackets",
      sublabel: "Progressive TDS slabs & rebates",
      icon: Percent,
      count: taxRateData?.slabs?.length
        ? `${taxRateData.slabs.length} Slabs`
        : null,
    },
    {
      id: "pay-heads",
      label: "Pay heads",
      sublabel: "Earnings & deductions master",
      icon: FileText,
      count: payHeadData?.payHeads?.length
        ? `${payHeadData.payHeads.length} Heads`
        : null,
    },
    {
      id: "rules-defaults",
      label: "Rules & statutory defaults",
      sublabel: "Deduction limits & operations",
      icon: Sliders,
      count: null,
    },
  ];

  const visibleTabs = tabs.filter((t) => allowedTabs.includes(t.id));

  const bodyContent = (
    <div className="space-y-6">
      {/* Navigation Sub-Tab Bar */}
      {visibleTabs.length > 1 && (
        <div className="overflow-x-auto pb-1">
          <div
            role="tablist"
            aria-label="Payroll rules configuration tabs"
            className="inline-flex min-w-full sm:min-w-0 rounded-lg border border-slate-200/80 bg-slate-100/70 p-1 shadow-xs gap-1"
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
                    "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-all whitespace-nowrap select-none",
                    isActive
                      ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-emerald-800" : "text-slate-400",
                    )}
                  />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-2xs font-mono",
                        isActive
                          ? "bg-emerald-50 text-emerald-800 font-medium"
                          : "bg-slate-200/70 text-slate-600",
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
      <div>
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
    </div>
  );

  if (embedded) {
    return bodyContent;
  }

  return (
    <PageFrame size="wide" spacing="default">
      <header className="pb-6 border-b border-slate-200/80 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Payroll rules &amp; statutory controls
              </h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200/60">
                <ShieldCheck className="h-3 w-3" />
                <span>Nepal statutory compliant</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Unified configuration for Bikram Sambat fiscal periods, progressive tax brackets, salary pay head components, and organizational payroll policies.
            </p>
          </div>
        </div>
      </header>

      {bodyContent}
    </PageFrame>
  );
}
