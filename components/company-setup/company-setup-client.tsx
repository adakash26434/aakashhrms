"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyMasterSetupData } from "@/lib/types/company-setup";

// Shared Layout Primitives
import { PageFrame } from "@/components/layout/page-frame";

// Sub-components
import { WorkScheduleTab } from "./work-schedule-tab";
import { CompanyProfileTab } from "./company-profile-tab";
import { CompanySetupInnerNav, type CompanySetupSection } from "./company-setup-inner-nav";
import { PayHeadClient } from "@/components/pay-head/pay-head-client";
import type { PayHeadData } from "@/lib/types/pay-head";

export type MasterSetupTab = CompanySetupSection;

/** The payroll sub-tabs older links name (?section=payroll_rules&tab=…). */
export type PayrollRuleTab = "fiscal-year" | "tax-rates" | "pay-heads" | "rules-defaults";

function normalizePayrollRuleTab(rawTab?: string | null): PayrollRuleTab {
  const t = (rawTab ?? "").toLowerCase().replace(/_/g, "-");
  if (["tax-rates", "taxrates", "tax"].includes(t)) return "tax-rates";
  if (["pay-heads", "payheads"].includes(t)) return "pay-heads";
  if (["rules-defaults", "rules", "system-control", "systemcontrol", "defaults"].includes(t)) return "rules-defaults";
  return "fiscal-year";
}

/**
 * Sections that moved to their own pages: organization units to Workforce →
 * Organization (4.3), fiscal years and tax slabs to Setup (4.12).
 */
const MOVED: Record<string, string> = {
  organization: "/workforce/organization?tab=structure",
  branches: "/workforce/organization?tab=branches",
  departments: "/workforce/organization?tab=departments",
  designations: "/workforce/organization?tab=designations",
  shreni: "/workforce/organization?tab=levels",
  employment_types: "/workforce/organization?tab=types",
  fiscal_year: "/setup/fiscal-year",
  tax_rates: "/setup/tax-rates",
  system_control: "/setup/system-control",
};

const VALID_TABS: MasterSetupTab[] = [
  "company_profile",
  "work_schedule",
  "fiscal_year",
  "tax_rates",
  "pay_heads",
  "system_control",
  "payroll_rules",
];

interface CompanySetupClientProps {
  initialData: CompanyMasterSetupData;
  initialSection?: string;
  initialTab?: string;
  payrollRulesData?: {
    allowedTabs: PayrollRuleTab[];
    payHeadData?: PayHeadData | null;
  };
}

export function CompanySetupClient({
  initialData,
  initialSection,
  initialTab,
  payrollRulesData,
}: CompanySetupClientProps) {
  const router = useRouter();

  const resolveInitialState = (): { section: MasterSetupTab; payrollSubTab?: PayrollRuleTab } => {
    const s = (initialSection || "").toLowerCase().replace(/[- ]/g, "_");
    const t = (initialTab || "").toLowerCase().replace(/[- ]/g, "_");

    if (s === "fiscal_year" || s === "fy") return { section: "fiscal_year" };
    if (s === "tax_rates" || s === "tax") return { section: "tax_rates" };
    if (s === "pay_heads" || s === "payheads") return { section: "pay_heads" };
    if (s === "system_control" || s === "rules_defaults" || s === "rules") return { section: "system_control" };

    if (t === "fiscal_year" || t === "fiscalyear" || t === "fy") return { section: "fiscal_year" };
    if (t === "tax_rates" || t === "taxrates" || t === "tax") return { section: "tax_rates" };
    if (t === "pay_heads" || t === "payheads") return { section: "pay_heads" };
    if (t === "rules_defaults" || t === "system_control" || t === "systemcontrol" || t === "rules" || t === "defaults") {
      return { section: "system_control" };
    }

    if (s === "payroll_rules" || s === "payroll") {
      const sub = normalizePayrollRuleTab(initialTab);
      if (sub === "tax-rates") return { section: "tax_rates" };
      if (sub === "pay-heads") return { section: "pay_heads" };
      if (sub === "rules-defaults") return { section: "system_control" };
      return { section: "fiscal_year" };
    }

    if (s && VALID_TABS.includes(s as MasterSetupTab)) {
      return { section: s as MasterSetupTab };
    }
    if (t && VALID_TABS.includes(t as MasterSetupTab)) {
      return { section: t as MasterSetupTab };
    }
    return { section: "company_profile" };
  };

  const initialResolved = resolveInitialState();
  const movedTo =
    MOVED[initialResolved.section] ??
    [initialSection, initialTab].map((v) => MOVED[(v || "").toLowerCase().replace(/[- ]/g, "_")]).find(Boolean);
  React.useEffect(() => {
    if (movedTo) router.replace(movedTo);
  }, [movedTo, router]);
  const [activeTab, setActiveTab] = useState<MasterSetupTab>(initialResolved.section);
  const [payrollSubTab] = useState<PayrollRuleTab | undefined>(
    initialResolved.payrollSubTab
  );

  const handleSectionClick = (tabId: MasterSetupTab) => {
    if (MOVED[tabId]) {
      router.push(MOVED[tabId]);
      return;
    }
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", tabId);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // State
  const [workSchedule, setWorkSchedule] = useState(initialData.workSchedule);
  const [companyProfile, setCompanyProfile] = useState(initialData.companyProfile);

  return (
    <PageFrame size="wide" spacing="default">
      {/* Institutional Page Masthead */}
      <header className="pb-6 border-b border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Company setup
              </h1>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200/60">
                Active organization
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Legal identity credentials, operating schedules, employment classifications, Shreni career progression, and statutory payroll configuration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2">
            <div>
              <span className="text-slate-400 mr-1.5">Entity:</span>
              <span className="font-semibold text-slate-900">
                {companyProfile.displayName || companyProfile.legalName}
              </span>
            </div>
            {companyProfile.panVatNumber && (
              <div>
                <span className="text-slate-400 mr-1.5">PAN / VAT:</span>
                <span className="font-mono font-medium text-slate-800">
                  {companyProfile.panVatNumber}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Settings Workspace Grid: Left Navigation Rail + Right Active Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6">
        {/* Left Settings Rail (3 cols on lg+) */}
        <div className="lg:col-span-4 xl:col-span-3">
          <CompanySetupInnerNav
            activeSection={activeTab}
            onSelectSection={(sec) => handleSectionClick(sec)}
            sectionCounts={{
              workDays: workSchedule.workingDaysPerWeek,
            }}
          />
        </div>

        {/* Right Active Settings Canvas (8-9 cols on lg+) */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
          <div className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs min-h-160">
            {/* General Section 1: Company Profile */}
            {activeTab === "company_profile" && (
              <CompanyProfileTab
                profile={companyProfile}
                onProfileChange={(updated) => setCompanyProfile(updated)}
              />
            )}

            {/* General Section 2: Work Schedule */}
            {activeTab === "work_schedule" && (
              <WorkScheduleTab
                schedule={workSchedule}
                onScheduleChange={(updated) => setWorkSchedule(updated)}
              />
            )}

            {/* Fiscal years and tax slabs have their own pages under Setup (4.12): see MOVED. */}

            {/* Payroll Section 3: Salary Pay Heads */}
            {(activeTab === "pay_heads" || (activeTab === "payroll_rules" && payrollSubTab === "pay-heads")) && (
              payrollRulesData?.payHeadData ? (
                <PayHeadClient initialData={payrollRulesData.payHeadData} embedded={true} />
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  You do not have permission to view salary pay heads.
                </div>
              )
            )}

            {/* Rules & controls has its own page under Setup (4.12b): see MOVED. */}
          </div>
        </div>
      </div>

    </PageFrame>
  );
}
