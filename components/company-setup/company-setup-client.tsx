"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  Layers,
  FileBadge2,
  Clock,
  ShieldCheck,
  Search,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyMasterSetupData } from "@/lib/types/company-setup";
import type { Department, DepartmentFormData } from "@/lib/types/department";
import type { Designation, DesignationFormData } from "@/lib/types/designation";
import type { Branch, BranchFormData } from "@/lib/types/branch";

// Shared Layout Primitives
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";

// Sub-components
import { ShreniManagerTab } from "./shreni-manager-tab";
import { EmploymentTypesTab } from "./employment-types-tab";
import { WorkScheduleTab } from "./work-schedule-tab";
import { CompanyProfileTab } from "./company-profile-tab";
import { OrganizationShortcutsCard } from "./organization-shortcuts-card";
import { LegacyOrgTabNotice } from "./legacy-org-tab-notice";

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
  | "company_profile"
  | "work_schedule"
  | "employment_types"
  | "shreni"
  | "organization"
  | "branches"
  | "departments"
  | "designations";

const VALID_TABS: MasterSetupTab[] = [
  "company_profile",
  "work_schedule",
  "employment_types",
  "shreni",
  "organization",
  "branches",
  "departments",
  "designations",
];

interface CompanySetupClientProps {
  initialData: CompanyMasterSetupData;
  initialTab?: string;
}

export function CompanySetupClient({ initialData, initialTab }: CompanySetupClientProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<MasterSetupTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as MasterSetupTab)) {
      return initialTab as MasterSetupTab;
    }
    return "company_profile";
  });

  const handleTabClick = (tabId: MasterSetupTab) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
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

  // Clean 5 Primary Sections (Section 6.2 of Guide)
  const PRIMARY_SECTIONS = [
    {
      id: "company_profile" as MasterSetupTab,
      label: "Company Profile",
      sublabel: "Legal Identity & Signatories",
      icon: Building2,
      count: null,
    },
    {
      id: "work_schedule" as MasterSetupTab,
      label: "Work Schedule",
      sublabel: "Timing & Shifts",
      icon: Clock,
      count: `${workSchedule.workingDaysPerWeek}d`,
    },
    {
      id: "employment_types" as MasterSetupTab,
      label: "Employment Types",
      sublabel: "Contracts & Eligibility",
      icon: FileBadge2,
      count: employmentTypes.length,
    },
    {
      id: "shreni" as MasterSetupTab,
      label: "Shreni Levels",
      sublabel: "Grade Ladders & Bands",
      icon: Layers,
      count: shreniLevels.length,
    },
    {
      id: "organization" as MasterSetupTab,
      label: "Organization Shortcuts",
      sublabel: "Branches, Depts, Desigs",
      icon: Network,
      count: branches.length + departments.length + designations.length,
    },
  ];

  const isLegacyOrgTab =
    activeTab === "branches" ||
    activeTab === "departments" ||
    activeTab === "designations";

  return (
    <PageFrame size="wide" spacing="default">
      {/* Page Header */}
      <PageHeader
        title="Company & Work Policy"
        description={`Master configuration for legal identity, work rules, employment classifications, and policy parameters for ${companyProfile.displayName || companyProfile.legalName}.`}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-cream px-3 py-1 text-xs font-bold text-payroll-primary border border-payroll-primary/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Nepal Labour Act Compliant</span>
          </span>
        </div>
      </PageHeader>

      {/* Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-payroll-light bg-payroll-cream/40 px-4 py-2.5 text-xs text-payroll-navy shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-payroll-navy">
            {companyProfile.displayName || companyProfile.legalName}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600 font-mono text-[11px]">
            {companyProfile.panVatNumber ? `PAN: ${companyProfile.panVatNumber}` : "No PAN"}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600 font-mono text-[11px]">
            Industry: {companyProfile.industryType || "General"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-payroll-primary">
          <span>Schedule: {workSchedule.workingDaysPerWeek}d/wk ({workSchedule.coreStartTime} - {workSchedule.coreEndTime})</span>
        </div>
      </div>

      {/* Primary Section Navigation Tabs */}
      <div className="overflow-x-auto pb-1">
        <div
          role="tablist"
          className="inline-flex min-w-full sm:min-w-0 rounded-xl border border-payroll-light bg-white p-1 shadow-2xs gap-1"
        >
          {PRIMARY_SECTIONS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(tab.id)}
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

      {/* Backward-Compatibility Transition Banner if old query tab is active */}
      {isLegacyOrgTab && (
        <LegacyOrgTabNotice
          entityType={activeTab}
          onBackToCompanySetup={() => handleTabClick("company_profile")}
        />
      )}

      {/* Main Tab Panels */}
      <div className="space-y-6">
        {/* Section 1: Company Profile */}
        {activeTab === "company_profile" && (
          <CompanyProfileTab
            profile={companyProfile}
            onProfileChange={(updated) => setCompanyProfile(updated)}
          />
        )}

        {/* Section 2: Work Schedule */}
        {activeTab === "work_schedule" && (
          <WorkScheduleTab
            schedule={workSchedule}
            onScheduleChange={(updated) => setWorkSchedule(updated)}
          />
        )}

        {/* Section 3: Employment Types */}
        {activeTab === "employment_types" && (
          <EmploymentTypesTab
            types={employmentTypes}
            onTypesChange={(updated) => setEmploymentTypes(updated)}
          />
        )}

        {/* Section 4: Shreni Levels */}
        {activeTab === "shreni" && (
          <ShreniManagerTab
            levels={shreniLevels}
            onLevelsChange={(updated) => setShreniLevels(updated)}
          />
        )}

        {/* Section 5: Organization Shortcuts */}
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
                <h3 className="text-sm font-bold text-payroll-navy">
                  Branches &amp; Office Locations
                </h3>
                <p className="text-xs text-gray-500">
                  Manage physical branch locations and head office assignment.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search branches..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="h-8.5 w-56 rounded-lg border border-payroll-light bg-white pl-8 pr-3 text-xs text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setIsBranchFormOpen(true);
                  }}
                  className="h-8.5 px-3 rounded-lg bg-payroll-primary hover:bg-payroll-navy text-white text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>+ Add Branch</span>
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
                <h3 className="text-sm font-bold text-payroll-navy">
                  Departments &amp; Units
                </h3>
                <p className="text-xs text-gray-500">
                  Manage organizational units and branch associations.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    className="h-8.5 w-56 rounded-lg border border-payroll-light bg-white pl-8 pr-3 text-xs text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setIsDeptFormOpen(true);
                  }}
                  className="h-8.5 px-3 rounded-lg bg-payroll-primary hover:bg-payroll-navy text-white text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>+ Add Department</span>
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
                <h3 className="text-sm font-bold text-payroll-navy">
                  Job Designations &amp; Roles
                </h3>
                <p className="text-xs text-gray-500">
                  Manage standard job titles and department assignments.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search designations..."
                    value={desigSearch}
                    onChange={(e) => setDesigSearch(e.target.value)}
                    className="h-8.5 w-56 rounded-lg border border-payroll-light bg-white pl-8 pr-3 text-xs text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDesig(null);
                    setIsDesigFormOpen(true);
                  }}
                  className="h-8.5 px-3 rounded-lg bg-payroll-primary hover:bg-payroll-navy text-white text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>+ Add Designation</span>
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
