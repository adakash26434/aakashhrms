"use client";

import Link from "next/link";
import {
  Building2,
  Clock,
  Layers,
  CalendarDays,
  Percent,
  FileText,
  Settings,
  ShieldCheck,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip, type KpiMetric } from "@/components/layout/kpi-strip";
import type { CompanyMasterSetupData } from "@/lib/types/company-setup";

interface SetupOverviewClientProps {
  data: CompanyMasterSetupData;
  statutoryCounts?: {
    fiscalYearsCount: number;
    taxSlabsCount: number;
    payHeadsCount: number;
    holidaysCount: number;
  };
}

export function SetupOverviewClient({
  data,
  statutoryCounts = {
    fiscalYearsCount: 1,
    taxSlabsCount: 5,
    payHeadsCount: 10,
    holidaysCount: 12,
  },
}: SetupOverviewClientProps) {
  const { companyProfile, workSchedule, shreniLevels, employmentTypes, branches, departments, designations } = data;

  const kpiMetrics: KpiMetric[] = [
    {
      title: "Company Identity",
      value: companyProfile.displayName || companyProfile.legalName || "Organization",
      subtext: companyProfile.panVatNumber ? `PAN: ${companyProfile.panVatNumber}` : "Pending PAN/VAT setup",
      icon: Building2,
      badge: companyProfile.panVatNumber ? "Verified" : "Action Needed",
    },
    {
      title: "Work Schedule",
      value: `${workSchedule.workingDaysPerWeek} Days/Wk`,
      subtext: `Core: ${workSchedule.coreStartTime} - ${workSchedule.coreEndTime}`,
      icon: Clock,
    },
    {
      title: "Policy Levels",
      value: `${shreniLevels.length} Shreni`,
      subtext: `${employmentTypes.length} Employment Types`,
      icon: Layers,
    },
    {
      title: "Organization Scope",
      value: `${branches.length} Branches`,
      subtext: `${departments.length} Depts · ${designations.length} Desigs`,
      icon: ShieldCheck,
    },
  ];

  return (
    <PageFrame size="wide" spacing="default">
      {/* Header */}
      <PageHeader
        title="Setup & Administration Overview"
        description="Centralized administration dashboard to manage organizational identity, Labour Act parameters, work schedules, and statutory masters."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-cream px-3 py-1 text-xs font-bold text-payroll-primary border border-payroll-primary/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Nepal Labour Act 2074 Aligned</span>
          </span>
        </div>
      </PageHeader>

      {/* KPI Overview Strip */}
      <KpiStrip metrics={kpiMetrics} columns={4} />

      {/* Structured Configuration Hub (5 Master Cards) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Company Profile & Identity */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                Core Identity
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-payroll-navy">
                Company Profile &amp; Legal Identity
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Legal entity name, PAN/VAT registration, official contacts, and authorized signatories for reports.
              </p>
            </div>

            <div className="rounded-lg bg-payroll-cream/50 p-3 text-xs space-y-1.5 border border-payroll-light/60 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Legal Name:</span>
                <span className="font-bold text-payroll-navy truncate max-w-42.5">
                  {companyProfile.legalName}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">PAN / VAT:</span>
                <span className="font-semibold text-payroll-navy">
                  {companyProfile.panVatNumber || "Not configured"}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Reg No:</span>
                <span className="font-semibold text-payroll-navy">
                  {companyProfile.registrationNumber || "Not configured"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3">
            <Link
              href="/setup/company-setup?tab=company_profile"
              className="inline-flex items-center justify-between w-full text-xs font-bold text-payroll-primary hover:text-payroll-navy transition-colors"
            >
              <span>Configure Profile</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Work Schedule & Shifts */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Clock className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-payroll-cream px-2 py-0.5 text-[10px] font-bold text-payroll-primary border border-payroll-light/80">
                Attendance Rules
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-payroll-navy">
                Work Schedule &amp; Shifts
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Office working days, weekly-off policy, standard core hours, and attendance grace period thresholds.
              </p>
            </div>

            <div className="rounded-lg bg-payroll-cream/50 p-3 text-xs space-y-1.5 border border-payroll-light/60 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Weekly Days:</span>
                <span className="font-bold text-payroll-navy">
                  {workSchedule.workingDaysPerWeek} Days / Week
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Weekly Off:</span>
                <span className="font-semibold text-payroll-navy">
                  {workSchedule.weeklyOffDays.join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Office Hours:</span>
                <span className="font-semibold text-payroll-navy">
                  {workSchedule.coreStartTime} - {workSchedule.coreEndTime}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3">
            <Link
              href="/setup/company-setup?tab=work_schedule"
              className="inline-flex items-center justify-between w-full text-xs font-bold text-payroll-primary hover:text-payroll-navy transition-colors"
            >
              <span>Configure Work Schedule</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: People Policy & Classification */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Layers className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-payroll-cream px-2 py-0.5 text-[10px] font-bold text-payroll-primary border border-payroll-light/80">
                Grades &amp; Contracts
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-payroll-navy">
                People Policy &amp; Classification
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Custom Shreni grade ladders, salary ranges, and employment contracts with statutory benefit eligibility.
              </p>
            </div>

            <div className="rounded-lg bg-payroll-cream/50 p-3 text-xs space-y-1.5 border border-payroll-light/60 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Shreni Levels:</span>
                <span className="font-bold text-payroll-navy">
                  {shreniLevels.length} Active Tiers
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Contract Types:</span>
                <span className="font-semibold text-payroll-navy">
                  {employmentTypes.length} Configured Types
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Compliance:</span>
                <span className="font-semibold text-emerald-700">
                  SSF &amp; Labour Act Mapped
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3 flex items-center justify-between gap-3">
            <Link
              href="/setup/company-setup?tab=shreni"
              className="text-xs font-bold text-payroll-primary hover:underline"
            >
              Shreni Levels →
            </Link>
            <Link
              href="/setup/company-setup?tab=employment_types"
              className="text-xs font-bold text-payroll-primary hover:underline"
            >
              Employment Types →
            </Link>
          </div>
        </div>

        {/* Card 4: Statutory Masters & Financial Rules */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm md:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-payroll-navy">
                    Statutory Masters &amp; Financial Parameters
                  </h3>
                  <p className="text-xs text-gray-500">
                    Nepal tax brackets, fiscal year sequences, salary pay heads, and system control toggles.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                Finance &amp; Tax
              </span>
            </div>

            {/* Quick Links Grid */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 pt-2">
              <Link
                href="/setup/payroll-rules?tab=fiscal-year"
                className="flex items-center justify-between rounded-lg border border-payroll-light bg-white p-2.5 transition-all hover:border-payroll-primary hover:bg-payroll-cream/40"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-payroll-primary" />
                  <div>
                    <span className="text-xs font-bold text-payroll-navy block">Fiscal Year</span>
                    <span className="text-[10px] text-gray-500 font-mono">{statutoryCounts.fiscalYearsCount} configured</span>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
              </Link>

              <Link
                href="/setup/payroll-rules?tab=tax-rates"
                className="flex items-center justify-between rounded-lg border border-payroll-light bg-white p-2.5 transition-all hover:border-payroll-primary hover:bg-payroll-cream/40"
              >
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-payroll-primary" />
                  <div>
                    <span className="text-xs font-bold text-payroll-navy block">Tax Slabs</span>
                    <span className="text-[10px] text-gray-500 font-mono">{statutoryCounts.taxSlabsCount} slabs</span>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
              </Link>

              <Link
                href="/setup/payroll-rules?tab=pay-heads"
                className="flex items-center justify-between rounded-lg border border-payroll-light bg-white p-2.5 transition-all hover:border-payroll-primary hover:bg-payroll-cream/40"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-payroll-primary" />
                  <div>
                    <span className="text-xs font-bold text-payroll-navy block">Pay Heads</span>
                    <span className="text-[10px] text-gray-500 font-mono">{statutoryCounts.payHeadsCount} heads</span>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
              </Link>

              <Link
                href="/setup/holidays"
                className="flex items-center justify-between rounded-lg border border-payroll-light bg-white p-2.5 transition-all hover:border-payroll-primary hover:bg-payroll-cream/40"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-payroll-primary" />
                  <div>
                    <span className="text-xs font-bold text-payroll-navy block">Holidays</span>
                    <span className="text-[10px] text-gray-500 font-mono">{statutoryCounts.holidaysCount} events</span>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
              </Link>
            </div>
          </div>

          <div className="mt-4 border-t border-payroll-light/60 pt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              Maintain tax rules, payroll allowances, and calendar dates across the system.
            </span>
            <Link
              href="/setup/payroll-rules?tab=rules-defaults"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-payroll-primary hover:text-payroll-navy"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Payroll Rules &amp; Defaults →</span>
            </Link>
          </div>
        </div>

        {/* Card 5: Organization Structure Hub */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-payroll-cream px-2 py-0.5 text-[10px] font-bold text-payroll-primary border border-payroll-light/80">
                Workforce Hub
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-payroll-navy">
                Organization Structure
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Centralized registry for physical branches, operational departments, and designations.
              </p>
            </div>

            <div className="rounded-lg bg-payroll-cream/50 p-3 text-xs space-y-1.5 border border-payroll-light/60 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Branches:</span>
                <span className="font-bold text-payroll-navy">
                  {branches.length} Locations
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Departments:</span>
                <span className="font-semibold text-payroll-navy">
                  {departments.length} Units
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Designations:</span>
                <span className="font-semibold text-payroll-navy">
                  {designations.length} Roles
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3">
            <Link
              href="/workforce/organization"
              className="inline-flex items-center justify-between w-full text-xs font-bold text-payroll-primary hover:text-payroll-navy transition-colors"
            >
              <span>Open Organization Hub</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
