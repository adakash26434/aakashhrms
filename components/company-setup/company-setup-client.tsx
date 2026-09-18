"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Layers,
  Users,
  Briefcase,
  FileBadge2,
  Clock,
  Settings2,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyMasterSetupData } from "@/lib/types/company-setup";
import type { Department, DepartmentFormData } from "@/lib/types/department";
import type { Designation, DesignationFormData } from "@/lib/types/designation";
import type { Branch, BranchFormData } from "@/lib/types/branch";

// Sub-components
import { ShreniManagerTab } from "./shreni-manager-tab";
import { EmploymentTypesTab } from "./employment-types-tab";
import { WorkScheduleTab } from "./work-schedule-tab";
import { CompanyProfileTab } from "./company-profile-tab";

// Reusable Department / Branch / Designation Components
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
  | "shreni"
  | "branches"
  | "departments"
  | "designations"
  | "employment_types"
  | "work_schedule"
  | "company_profile";

const VALID_TABS: MasterSetupTab[] = [
  "shreni",
  "branches",
  "departments",
  "designations",
  "employment_types",
  "work_schedule",
  "company_profile",
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
    return "shreni";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && VALID_TABS.includes(tab as MasterSetupTab)) {
        setActiveTab(tab as MasterSetupTab);
      }
    }
  }, []);

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

  // Departments UI State
  const [deptSearch, setDeptSearch] = useState("");
  const [deptBranchFilter, setDeptBranchFilter] = useState("");
  const [viewingDept, setViewingDept] = useState<Department | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  // Designations UI State
  const [desigSearch, setDesigSearch] = useState("");
  const [desigDeptFilter, setDesigDeptFilter] = useState("");
  const [viewingDesig, setViewingDesig] = useState<Designation | null>(null);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [isDesigFormOpen, setIsDesigFormOpen] = useState(false);
  const [deletingDesig, setDeletingDesig] = useState<Designation | null>(null);

  // Branches UI State
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
    return departments.filter((d) => {
      const matchesBranch = !deptBranchFilter || d.branchId === deptBranchFilter;
      const matchesSearch =
        !deptSearch.trim() ||
        d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
        d.code.toLowerCase().includes(deptSearch.toLowerCase());
      return matchesBranch && matchesSearch;
    });
  }, [departments, deptBranchFilter, deptSearch]);

  const filteredDesignations = useMemo(() => {
    return designations.filter((d) => {
      const matchesDept = !desigDeptFilter || d.departmentId === desigDeptFilter;
      const matchesSearch =
        !desigSearch.trim() || d.name.toLowerCase().includes(desigSearch.toLowerCase());
      return matchesDept && matchesSearch;
    });
  }, [designations, desigDeptFilter, desigSearch]);

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

  // Tabs metadata
  const TABS = [
    { id: "shreni" as MasterSetupTab, label: "Shreni / Grade Levels", labelNepali: "तह / श्रेणी", count: shreniLevels.length, icon: Layers },
    { id: "branches" as MasterSetupTab, label: "Branches", labelNepali: "शाखा", count: branches.length, icon: Users },
    { id: "departments" as MasterSetupTab, label: "Departments", labelNepali: "विभाग", count: departments.length, icon: Building2 },
    { id: "designations" as MasterSetupTab, label: "Designations", labelNepali: "पद", count: designations.length, icon: Briefcase },
    { id: "employment_types" as MasterSetupTab, label: "Employment Types", labelNepali: "रोजगार प्रकार", count: employmentTypes.length, icon: FileBadge2 },
    { id: "work_schedule" as MasterSetupTab, label: "Work Timing & Shifts", labelNepali: "कार्य समय", count: `${workSchedule.workingDaysPerWeek}d`, icon: Clock },
    { id: "company_profile" as MasterSetupTab, label: "Company Profile", labelNepali: "संस्था विवरण", count: null, icon: Settings2 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            <span>Configuration &amp; Administration</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span>Master Setup</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Company &amp; Organizational Setup (संस्थागत मास्टर सेटअप)
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Configure internal organizational structures, custom Shreni grade levels, branch registries, and Labour Act parameters for {companyProfile.displayName || companyProfile.legalName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Nepal Labour Act Compliant</span>
          </span>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="overflow-x-auto pb-1">
        <div
          role="tablist"
          className="inline-flex min-w-full sm:min-w-0 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs gap-1"
        >
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap",
                  isActive
                    ? "bg-[#1e7e47] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
                {t.count !== null && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.2 text-[10px] font-mono font-bold",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "shreni" && (
          <ShreniManagerTab
            levels={shreniLevels}
            onLevelsChange={(updated) => setShreniLevels(updated)}
          />
        )}

        {activeTab === "employment_types" && (
          <EmploymentTypesTab
            types={employmentTypes}
            onTypesChange={(updated) => setEmploymentTypes(updated)}
          />
        )}

        {activeTab === "work_schedule" && (
          <WorkScheduleTab
            schedule={workSchedule}
            onScheduleChange={(updated) => setWorkSchedule(updated)}
          />
        )}

        {activeTab === "company_profile" && (
          <CompanyProfileTab
            profile={companyProfile}
            onProfileChange={(updated) => setCompanyProfile(updated)}
          />
        )}

        {activeTab === "branches" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Branches &amp; Office Locations (शाखा तथा कार्यालयहरू)
                </h3>
                <p className="text-xs text-slate-500">
                  Manage physical branch locations, regional offices, and head office branch assignment.
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
                    className="h-8.5 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setIsBranchFormOpen(true);
                  }}
                  className="h-8.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
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

        {activeTab === "departments" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Departments &amp; Functional Units (विभागहरू)
                </h3>
                <p className="text-xs text-slate-500">
                  Configure corporate departments, assign branch locations, and map lead personnel.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    className="h-8.5 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                {branches.length > 1 && (
                  <select
                    value={deptBranchFilter}
                    onChange={(e) => setDeptBranchFilter(e.target.value)}
                    className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setIsDeptFormOpen(true);
                  }}
                  className="h-8.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
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

        {activeTab === "designations" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Designations &amp; Job Roles (पद तथा ओहोदाहरू)
                </h3>
                <p className="text-xs text-slate-500">
                  Define job titles and map them to their parent department.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search designations..."
                    value={desigSearch}
                    onChange={(e) => setDesigSearch(e.target.value)}
                    className="h-8.5 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                {departments.length > 0 && (
                  <select
                    value={desigDeptFilter}
                    onChange={(e) => setDesigDeptFilter(e.target.value)}
                    className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingDesig(null);
                    setIsDesigFormOpen(true);
                  }}
                  className="h-8.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
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

      {/* Modals & Panels for Departments */}
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

      {/* Modals & Panels for Designations */}
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

      {/* Modals & Panels for Branches */}
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
    </div>
  );
}
