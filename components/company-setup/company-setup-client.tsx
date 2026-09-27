"use client";

import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { CompanyMasterSetupData } from "@/lib/types/company-setup";
import type { Department, DepartmentFormData } from "@/lib/types/department";
import type { Designation, DesignationFormData } from "@/lib/types/designation";
import type { Branch, BranchFormData } from "@/lib/types/branch";

// Shared Layout Primitives
import { PageFrame } from "@/components/layout/page-frame";

// Sub-components
import { ShreniManagerTab } from "./shreni-manager-tab";
import { EmploymentTypesTab } from "./employment-types-tab";
import { WorkScheduleTab } from "./work-schedule-tab";
import { CompanyProfileTab } from "./company-profile-tab";
import { OrganizationShortcutsCard } from "./organization-shortcuts-card";
import { LegacyOrgTabNotice } from "./legacy-org-tab-notice";
import { CompanySetupInnerNav, type CompanySetupSection } from "./company-setup-inner-nav";
import type { PayrollRuleTab } from "@/components/setup/payroll-rules-hub-client";
import { normalizePayrollRuleTab } from "@/components/setup/payroll-rules-hub-client";
import { FiscalYearClient } from "@/components/fiscal-year/fiscal-year-client";
import { TaxRateClient } from "@/components/tax-rate/tax-rate-client";
import { PayHeadClient } from "@/components/pay-head/pay-head-client";
import { SystemControlClient } from "@/components/system-control/system-control-client";
import type { FiscalYearData } from "@/lib/types/fiscal-year";
import type { TaxRateData } from "@/lib/types/tax-rate";
import type { PayHeadData } from "@/lib/types/pay-head";
import type { SystemControlData } from "@/lib/types/system-control";

// Reusable Department / Branch / Designation Components (for backward-compatible tab views)
import { DepartmentsCard } from "@/components/department/departments-card";
import { DepartmentDetailPanel } from "@/components/department/department-detail-panel";
import { DepartmentFormModal } from "@/components/department/department-form-modal";
import { ConfirmDeleteDialog as ConfirmDeleteDeptDialog } from "@/components/department/confirm-delete-dialog";

import { DesignationsTable } from "@/components/designation/designations-table";
import { DesignationDetailPanel } from "@/components/designation/designation-detail-panel";
import { DesignationFormModal } from "@/components/designation/designation-form-modal";
import { ConfirmDeleteDialog as ConfirmDeleteDesigDialog } from "@/components/designation/confirm-delete-dialog";

import { BranchesTable } from "@/components/branch/branches-table";
import { BranchDetailPanel } from "@/components/branch/branch-detail-panel";
import { BranchFormModal } from "@/components/branch/branch-form-modal";
import { ConfirmDeleteDialog as ConfirmDeleteBranchDialog } from "@/components/branch/confirm-delete-dialog";

import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/app/actions/department.actions";
import {
  createDesignationAction,
  updateDesignationAction,
  deleteDesignationAction,
} from "@/app/actions/designation.actions";
import {
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
} from "@/app/actions/branch.actions";
import { useToast } from "@/components/ui/toast";

export type MasterSetupTab =
  | CompanySetupSection
  | "branches"
  | "departments"
  | "designations";

const VALID_TABS: MasterSetupTab[] = [
  "company_profile",
  "work_schedule",
  "employment_types",
  "shreni",
  "fiscal_year",
  "tax_rates",
  "pay_heads",
  "system_control",
  "payroll_rules",
  "organization",
  "branches",
  "departments",
  "designations",
];

interface CompanySetupClientProps {
  initialData: CompanyMasterSetupData;
  initialSection?: string;
  initialTab?: string;
  payrollRulesData?: {
    allowedTabs: PayrollRuleTab[];
    fiscalYearData?: FiscalYearData | null;
    taxRateData?: TaxRateData | null;
    payHeadData?: PayHeadData | null;
    systemControlData?: SystemControlData | null;
    isSuperAdmin?: boolean;
  };
}

export function CompanySetupClient({
  initialData,
  initialSection,
  initialTab,
  payrollRulesData,
}: CompanySetupClientProps) {
  const toast = useToast();

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
  const [activeTab, setActiveTab] = useState<MasterSetupTab>(initialResolved.section);
  const [payrollSubTab] = useState<PayrollRuleTab | undefined>(
    initialResolved.payrollSubTab
  );

  const handleSectionClick = (tabId: MasterSetupTab) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", tabId);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // State
  const [shreniLevels, setShreniLevels] = useState(initialData.shreniLevels);
  const [branches, setBranches] = useState<Branch[]>(initialData.branches);
  const [departments, setDepartments] = useState<Department[]>(initialData.departments);
  const [designations, setDesignations] = useState<Designation[]>(initialData.designations);
  const [employmentTypes, setEmploymentTypes] = useState(initialData.employmentTypes);
  const [workSchedule, setWorkSchedule] = useState(initialData.workSchedule);
  const [companyProfile, setCompanyProfile] = useState(initialData.companyProfile);

  // Departments UI State (for backward-compatible view)
  const [deptSearch, setDeptSearch] = useState("");
  const [viewingDept, setViewingDept] = useState<Department | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  // Designations UI State (for backward-compatible view)
  const [desigSearch, setDesigSearch] = useState("");
  const [viewingDesig, setViewingDesig] = useState<Designation | null>(null);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [isDesigFormOpen, setIsDesigFormOpen] = useState(false);
  const [deletingDesig, setDeletingDesig] = useState<Designation | null>(null);

  // Branches UI State (for backward-compatible view)
  const [branchSearch, setBranchSearch] = useState("");
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const branchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of branches) m.set(b.id, b.name);
    return m;
  }, [branches]);

  const departmentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, [departments]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.location && b.location.toLowerCase().includes(q))
    );
  }, [branches, branchSearch]);

  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const q = deptSearch.toLowerCase();
    return departments.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
    );
  }, [departments, deptSearch]);

  const filteredDesignations = useMemo(() => {
    if (!desigSearch.trim()) return designations;
    const q = desigSearch.toLowerCase();
    return designations.filter((d) => d.name.toLowerCase().includes(q));
  }, [designations, desigSearch]);

  // Department Actions
  async function handleSubmitDept(payload: DepartmentFormData) {
    try {
      if (editingDept) {
        const res = await updateDepartmentAction(editingDept.id, payload);
        if (res.success && res.data) {
          setDepartments((all) => all.map((d) => (d.id === res.data!.id ? res.data! : d)));
          toast.success(`Department "${res.data.name}" updated.`);
          setIsDeptFormOpen(false);
        } else {
          toast.error(res.error || "Failed to update department");
        }
      } else {
        const res = await createDepartmentAction(payload);
        if (res.success && res.data) {
          setDepartments((all) => [...all, res.data!]);
          toast.success(`Department "${res.data.name}" created.`);
          setIsDeptFormOpen(false);
        } else {
          toast.error(res.error || "Failed to create department");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving department";
      toast.error(msg);
    }
  }

  async function handleDeleteDept() {
    if (!deletingDept) return;
    try {
      const res = await deleteDepartmentAction(deletingDept.id);
      if (res.success) {
        setDepartments((all) => all.filter((d) => d.id !== deletingDept.id));
        toast.success(`Department "${deletingDept.name}" deleted.`);
        setDeletingDept(null);
      } else {
        toast.error(res.error || "Failed to delete department");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting department";
      toast.error(msg);
    }
  }

  // Designation Actions
  async function handleSubmitDesig(payload: DesignationFormData) {
    try {
      if (editingDesig) {
        const res = await updateDesignationAction(editingDesig.id, payload);
        if (res.success && res.data) {
          setDesignations((all) => all.map((d) => (d.id === res.data!.id ? res.data! : d)));
          toast.success(`Designation "${res.data.name}" updated.`);
          setIsDesigFormOpen(false);
        } else {
          toast.error(res.error || "Failed to update designation");
        }
      } else {
        const res = await createDesignationAction(payload);
        if (res.success && res.data) {
          setDesignations((all) => [...all, res.data!]);
          toast.success(`Designation "${res.data.name}" created.`);
          setIsDesigFormOpen(false);
        } else {
          toast.error(res.error || "Failed to create designation");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving designation";
      toast.error(msg);
    }
  }

  async function handleDeleteDesig() {
    if (!deletingDesig) return;
    try {
      const res = await deleteDesignationAction(deletingDesig.id);
      if (res.success) {
        setDesignations((all) => all.filter((d) => d.id !== deletingDesig.id));
        toast.success(`Designation "${deletingDesig.name}" deleted.`);
        setDeletingDesig(null);
      } else {
        toast.error(res.error || "Failed to delete designation");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting designation";
      toast.error(msg);
    }
  }

  // Branch Actions
  async function handleSubmitBranch(payload: BranchFormData) {
    try {
      if (editingBranch) {
        const res = await updateBranchAction(editingBranch.id, payload);
        if (res.success && res.data) {
          setBranches((all) => all.map((b) => (b.id === res.data!.id ? res.data! : b)));
          toast.success(`Branch "${res.data.name}" updated.`);
          setIsBranchFormOpen(false);
        } else {
          toast.error(res.error || "Failed to update branch");
        }
      } else {
        const res = await createBranchAction(payload);
        if (res.success && res.data) {
          setBranches((all) => [...all, res.data!]);
          toast.success(`Branch "${res.data.name}" created.`);
          setIsBranchFormOpen(false);
        } else {
          toast.error(res.error || "Failed to create branch");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving branch";
      toast.error(msg);
    }
  }

  async function handleDeleteBranch() {
    if (!deletingBranch) return;
    try {
      const res = await deleteBranchAction(deletingBranch.id);
      if (res.success) {
        setBranches((all) => all.filter((b) => b.id !== deletingBranch.id));
        toast.success(`Branch "${deletingBranch.name}" deleted.`);
        setDeletingBranch(null);
      } else {
        toast.error(res.error || "Failed to delete branch");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting branch";
      toast.error(msg);
    }
  }

  const isLegacyOrgTab =
    activeTab === "branches" ||
    activeTab === "departments" ||
    activeTab === "designations";

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
            <div className="text-[11px] text-slate-500 font-medium">
              {branches.length} branches, {departments.length} departments, {designations.length} designations
            </div>
          </div>
        </div>
      </header>

      {/* Settings Workspace Grid: Left Navigation Rail + Right Active Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6">
        {/* Left Settings Rail (3 cols on lg+) */}
        <div className="lg:col-span-4 xl:col-span-3">
          <CompanySetupInnerNav
            activeSection={
              activeTab === "branches" || activeTab === "departments" || activeTab === "designations"
                ? "organization"
                : (activeTab as CompanySetupSection)
            }
            onSelectSection={(sec) => handleSectionClick(sec)}
            sectionCounts={{
              workDays: workSchedule.workingDaysPerWeek,
              employmentTypesCount: employmentTypes.length,
              shreniCount: shreniLevels.length,
            }}
          />
        </div>

        {/* Right Active Settings Canvas (8-9 cols on lg+) */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
          <div className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs min-h-160">
            {/* Backward-Compatibility Transition Banner if old query tab is active */}
            {isLegacyOrgTab && (
              <div className="mb-6">
                <LegacyOrgTabNotice
                  entityType={activeTab as "branches" | "departments" | "designations"}
                  onBackToCompanySetup={() => handleSectionClick("company_profile")}
                />
              </div>
            )}

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

            {/* General Section 3: Employment Types */}
            {activeTab === "employment_types" && (
              <EmploymentTypesTab
                types={employmentTypes}
                onTypesChange={(updated) => setEmploymentTypes(updated)}
              />
            )}

            {/* General Section 4: Shreni Levels */}
            {activeTab === "shreni" && (
              <ShreniManagerTab
                levels={shreniLevels}
                onLevelsChange={(updated) => setShreniLevels(updated)}
              />
            )}

            {/* Payroll Section 1: Fiscal Year Cycles */}
            {(activeTab === "fiscal_year" || (activeTab === "payroll_rules" && (!payrollSubTab || payrollSubTab === "fiscal-year"))) && (
              payrollRulesData?.fiscalYearData ? (
                <FiscalYearClient initialData={payrollRulesData.fiscalYearData} embedded={true} />
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  You do not have permission to view fiscal year cycles.
                </div>
              )
            )}

            {/* Payroll Section 2: Tax Brackets */}
            {(activeTab === "tax_rates" || (activeTab === "payroll_rules" && payrollSubTab === "tax-rates")) && (
              payrollRulesData?.taxRateData ? (
                <TaxRateClient initialData={payrollRulesData.taxRateData} embedded={true} />
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  You do not have permission to view tax brackets.
                </div>
              )
            )}

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

            {/* Payroll Section 4: Statutory Rules & System Defaults */}
            {(activeTab === "system_control" || (activeTab === "payroll_rules" && payrollSubTab === "rules-defaults")) && (
              payrollRulesData?.systemControlData ? (
                <SystemControlClient
                  initialData={payrollRulesData.systemControlData}
                  isSuperAdmin={payrollRulesData.isSuperAdmin}
                  embedded={true}
                />
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  You do not have permission to view rules & controls.
                </div>
              )
            )}

            {/* Structure Shortcuts */}
            {activeTab === "organization" && (
              <OrganizationShortcutsCard
                branches={branches}
                departments={departments}
                designations={designations}
              />
            )}

        {/* Backward Compatibility View: Branches */}
        {activeTab === "branches" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Branches &amp; office locations
                </h3>
                <p className="text-xs text-slate-500">
                  Manage physical branch locations and head office assignment.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search branches..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="h-9 w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setIsBranchFormOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium cursor-pointer shadow-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Add branch</span>
                </button>
              </div>
            </div>
            <BranchesTable
              branches={filteredBranches}
              onView={(b) => setViewingBranch(b)}
              onEdit={(b) => {
                setEditingBranch(b);
                setIsBranchFormOpen(true);
              }}
              onDelete={(b) => setDeletingBranch(b)}
            />
          </div>
        )}

        {/* Backward Compatibility View: Departments */}
        {activeTab === "departments" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Departments &amp; units
                </h3>
                <p className="text-xs text-slate-500">
                  Manage organizational units and branch associations.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    className="h-9 w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setIsDeptFormOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium cursor-pointer shadow-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Add department</span>
                </button>
              </div>
            </div>
            <DepartmentsCard
              departments={filteredDepartments}
              branchNameById={branchNameById}
              onView={(d) => setViewingDept(d)}
              onEdit={(d) => {
                setEditingDept(d);
                setIsDeptFormOpen(true);
              }}
              onDelete={(d) => setDeletingDept(d)}
            />
          </div>
        )}

        {/* Backward Compatibility View: Designations */}
        {activeTab === "designations" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Job designations &amp; roles
                </h3>
                <p className="text-xs text-slate-500">
                  Manage standard job titles and department assignments.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search designations..."
                    value={desigSearch}
                    onChange={(e) => setDesigSearch(e.target.value)}
                    className="h-9 w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDesig(null);
                    setIsDesigFormOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium cursor-pointer shadow-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Add designation</span>
                </button>
              </div>
            </div>
            <DesignationsTable
              designations={filteredDesignations}
              departmentNameById={departmentNameById}
              onView={(d) => setViewingDesig(d)}
              onEdit={(d) => {
                setEditingDesig(d);
                setIsDesigFormOpen(true);
              }}
              onDelete={(d) => setDeletingDesig(d)}
            />
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Modals & Panels for Departments (Backward Compatibility) */}
      {viewingDept && (
        <DepartmentDetailPanel
          open={Boolean(viewingDept)}
          department={viewingDept}
          branchName={branchNameById.get(viewingDept.branchId) || "Main / Head Office"}
          onClose={() => setViewingDept(null)}
          onEdit={(dept) => {
            setEditingDept(dept);
            setViewingDept(null);
            setIsDeptFormOpen(true);
          }}
        />
      )}

      {isDeptFormOpen && (
        <DepartmentFormModal
          open={isDeptFormOpen}
          editingDepartment={editingDept}
          branches={branches}
          onClose={() => setIsDeptFormOpen(false)}
          onSubmit={handleSubmitDept}
        />
      )}

      {deletingDept && (
        <ConfirmDeleteDeptDialog
          open={Boolean(deletingDept)}
          department={deletingDept}
          onClose={() => setDeletingDept(null)}
          onConfirm={handleDeleteDept}
        />
      )}

      {/* Modals & Panels for Designations (Backward Compatibility) */}
      {viewingDesig && (
        <DesignationDetailPanel
          open={Boolean(viewingDesig)}
          designation={viewingDesig}
          departmentName={departmentNameById.get(viewingDesig.departmentId) || "General"}
          onClose={() => setViewingDesig(null)}
          onEdit={(desig) => {
            setEditingDesig(desig);
            setViewingDesig(null);
            setIsDesigFormOpen(true);
          }}
        />
      )}

      {isDesigFormOpen && (
        <DesignationFormModal
          open={isDesigFormOpen}
          editingDesignation={editingDesig}
          departments={departments}
          onClose={() => setIsDesigFormOpen(false)}
          onSubmit={handleSubmitDesig}
        />
      )}

      {deletingDesig && (
        <ConfirmDeleteDesigDialog
          open={Boolean(deletingDesig)}
          designation={deletingDesig}
          onClose={() => setDeletingDesig(null)}
          onConfirm={handleDeleteDesig}
        />
      )}

      {/* Modals & Panels for Branches (Backward Compatibility) */}
      {viewingBranch && (
        <BranchDetailPanel
          open={Boolean(viewingBranch)}
          branch={viewingBranch}
          onClose={() => setViewingBranch(null)}
          onEdit={(b) => {
            setEditingBranch(b);
            setViewingBranch(null);
            setIsBranchFormOpen(true);
          }}
        />
      )}

      {isBranchFormOpen && (
        <BranchFormModal
          open={isBranchFormOpen}
          editingBranch={editingBranch}
          onClose={() => setIsBranchFormOpen(false)}
          onSubmit={handleSubmitBranch}
        />
      )}

          {deletingBranch && (
            <ConfirmDeleteBranchDialog
              open={Boolean(deletingBranch)}
              branch={deletingBranch}
              onClose={() => setDeletingBranch(null)}
              onConfirm={handleDeleteBranch}
            />
          )}
    </PageFrame>
  );
}
