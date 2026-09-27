"use client";

import { useMemo, useState } from "react";
import { Briefcase, Building2, CheckCircle2, Plus, Users } from "lucide-react";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

import type { Department, DepartmentData, DepartmentFormData } from "@/lib/types/department";
import type { Designation, DesignationFormData } from "@/lib/types/designation";
import type { Branch, BranchFormData } from "@/lib/types/branch";
import type { OrgTab } from "./department-tabs";

import { countDepartments, filterDepartments } from "@/lib/engines/department.engine";
import { countDesignations, filterDesignations } from "@/lib/engines/designation.engine";
import { countBranches, filterBranches } from "@/lib/engines/branch.engine";

import { createBranchAction, updateBranchAction, deleteBranchAction, getBranchDataAction } from "@/app/actions/branch.actions";
import { createDepartmentAction, updateDepartmentAction, deleteDepartmentAction, getDepartmentDataAction } from "@/app/actions/department.actions";
import { createDesignationAction, updateDesignationAction, deleteDesignationAction, getDesignationDataAction } from "@/app/actions/designation.actions";

import { DepartmentHero } from "./department-hero";
import { DepartmentKpiCards } from "./department-kpi-cards";
import { DepartmentTabs } from "./department-tabs";
import { DepartmentSearch } from "./department-search";
import { DepartmentsCard } from "./departments-card";
import { DepartmentDetailPanel } from "./department-detail-panel";
import { DepartmentFormModal } from "./department-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { HowDepartmentsWork } from "./how-departments-work";

import { DesignationsTable } from "@/components/designation/designations-table";
import { DesignationDetailPanel } from "@/components/designation/designation-detail-panel";
import { DesignationFormModal } from "@/components/designation/designation-form-modal";
import { ConfirmDeleteDialog as ConfirmDeleteDesignationDialog } from "@/components/designation/confirm-delete-dialog";
import { HowDesignationsWork } from "@/components/designation/how-designations-work";

import { BranchesTable } from "@/components/branch/branches-table";
import { BranchDetailPanel } from "@/components/branch/branch-detail-panel";
import { BranchFormModal } from "@/components/branch/branch-form-modal";
import { ConfirmDeleteDialog as ConfirmDeleteBranchDialog } from "@/components/branch/confirm-delete-dialog";
import { HowBranchesWork } from "@/components/branch/how-branches-work";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { TableShell } from "@/components/ui/table-shell";

interface DepartmentClientProps {
  initialData: DepartmentData;
  initialTab?: OrgTab;
}

interface BannerState {
  visible: boolean;
  message: string;
  tone: BannerTone;
}

export function DepartmentClient({ initialData, initialTab = "branches" }: DepartmentClientProps) {
  // -- Data State --
  const [departments, setDepartments] = useState<Department[]>(initialData.departments);
  const [designations, setDesignations] = useState<Designation[]>(initialData.designations ?? []);
  const [designationsLoaded, setDesignationsLoaded] = useState(Boolean(initialData.designations?.length));
  const [branches, setBranches] = useState<Branch[]>(initialData.branches ?? []);
  const [branchesLoaded, setBranchesLoaded] = useState(Boolean(initialData.branches?.length));

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

  // -- Server Action Loaders --
  async function loadDesignations() {
    if (designationsLoaded) return;
    const result = await getDesignationDataAction();
    if (result.success && result.data) {
      setDesignations(result.data.designations);
      setDesignationsLoaded(true);
    } else {
      showBanner("Failed to load designations.", "info");
    }
  }

  async function loadBranches() {
    if (branchesLoaded) return;
    const result = await getBranchDataAction();
    if (result.success && result.data) {
      setBranches(result.data);
      setBranchesLoaded(true);
    } else {
      showBanner("Failed to load branches.", "info");
    }
  }

  // -- UI State --
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [orgTab, setOrgTab] = useState<OrgTab>(initialTab || "branches");

  const [viewingDepartment, setViewingDepartment] = useState<Department | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  const [viewingDesignation, setViewingDesignation] = useState<Designation | null>(null);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [isDesigFormOpen, setIsDesigFormOpen] = useState(false);
  const [deletingDesignation, setDeletingDesignation] = useState<Designation | null>(null);
  const [desigSearch, setDesigSearch] = useState("");
  const [desigDeptFilter, setDesigDeptFilter] = useState("");

  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [branchSearch, setBranchSearch] = useState("");

  const toast = useToast();
  const [banner, setBanner] = useState<BannerState>({ visible: false, message: "", tone: "success" });

  function showBanner(message: string, tone: BannerTone = "success") {
    setBanner({ visible: true, message, tone });
    if (tone === "success") {
      toast.success(message);
    } else if (
      message.toLowerCase().includes("error") ||
      message.toLowerCase().includes("failed") ||
      message.toLowerCase().includes("could not")
    ) {
      toast.error(message);
    } else {
      toast.info(message);
    }
  }
  function dismissBanner() { setBanner((b) => ({ ...b, visible: false })); }

  // -- Derived Data --
  const filtered = useMemo(() => filterDepartments({ departments, search, branchId: branchFilter }), [departments, search, branchFilter]);
  const deptCounts = useMemo(() => countDepartments(departments), [departments]);
  const filteredDesignations = useMemo(() => filterDesignations({ designations, search: desigSearch, departmentId: desigDeptFilter }), [designations, desigSearch, desigDeptFilter]);
  const desigCounts = useMemo(() => countDesignations(designations), [designations]);
  const filteredBranches = useMemo(() => filterBranches({ branches, search: branchSearch }), [branches, branchSearch]);
  const branchCounts = useMemo(() => countBranches(branches), [branches]);

  // -- Handlers --
  function handleOpenCreateDept() { setEditingDepartment(null); setIsDeptFormOpen(true); }
  function handleOpenViewDept(d: Department) { setViewingDepartment(d); }
  function handleCloseViewDept() { setViewingDepartment(null); }
  function handleOpenEditDeptFromTable(d: Department) { setViewingDepartment(null); setEditingDepartment(d); setIsDeptFormOpen(true); }
  function handleOpenEditDeptFromPanel(d: Department) { setViewingDepartment(null); setEditingDepartment(d); setIsDeptFormOpen(true); }
  function handleCloseDeptForm() { setIsDeptFormOpen(false); setEditingDepartment(null); }
  function handleOpenDeleteDept(d: Department) { setDeletingDepartment(d); }
  function handleCloseDeleteDept() { setDeletingDepartment(null); }

  function handleOpenCreateDesig() { setEditingDesignation(null); setIsDesigFormOpen(true); }
  function handleOpenViewDesig(d: Designation) { setViewingDesignation(d); }
  function handleCloseViewDesig() { setViewingDesignation(null); }
  function handleOpenEditDesigFromTable(d: Designation) { setViewingDesignation(null); setEditingDesignation(d); setIsDesigFormOpen(true); }
  function handleOpenEditDesigFromPanel(d: Designation) { setViewingDesignation(null); setEditingDesignation(d); setIsDesigFormOpen(true); }
  function handleCloseDesigForm() { setIsDesigFormOpen(false); setEditingDesignation(null); }
  function handleOpenDeleteDesig(d: Designation) { setDeletingDesignation(d); }
  function handleCloseDeleteDesig() { setDeletingDesignation(null); }

  function handleOpenCreateBranch() { setEditingBranch(null); setIsBranchFormOpen(true); }
  function handleOpenViewBranch(b: Branch) { setViewingBranch(b); }
  function handleCloseViewBranch() { setViewingBranch(null); }
  function handleOpenEditBranchFromTable(b: Branch) { setViewingBranch(null); setEditingBranch(b); setIsBranchFormOpen(true); }
  function handleOpenEditBranchFromPanel(b: Branch) { setViewingBranch(null); setEditingBranch(b); setIsBranchFormOpen(true); }
  function handleCloseBranchForm() { setIsBranchFormOpen(false); setEditingBranch(null); }
  function handleOpenDeleteBranch(b: Branch) { setDeletingBranch(b); }
  function handleCloseDeleteBranch() { setDeletingBranch(null); }

  // ==========================================================
  // SERVER ACTION MUTATIONS
  // ==========================================================

  // -- Departments --
  async function handleSubmitDeptForm(payload: DepartmentFormData) {
    try {
      if (editingDepartment) {
        const result = await updateDepartmentAction(editingDepartment.id, payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setDepartments((all) => all.map((d) => (d.id === result.data!.id ? result.data! : d)));
        showBanner(`Department "${result.data!.name}" updated.`);
      } else {
        const result = await createDepartmentAction(payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setDepartments((all) => [...all, result.data!]);
        showBanner(`Department "${result.data!.name}" created.`);
      }
      handleCloseDeptForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${message}`, "info");
    }
  }

  async function handleConfirmDeleteDept() {
    if (!deletingDepartment) return;
    const name = deletingDepartment.name;
    try {
      const result = await deleteDepartmentAction(deletingDepartment.id);
      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
      } else {
        setDepartments((all) => all.filter((d) => d.id !== deletingDepartment.id));
        showBanner(`Department "${name}" deleted.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${message}`, "info");
    } finally { handleCloseDeleteDept(); }
  }

  // -- Designations --
  async function handleSubmitDesigForm(payload: DesignationFormData) {
    try {
      if (editingDesignation) {
        const result = await updateDesignationAction(editingDesignation.id, payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setDesignations((all) => all.map((d) => (d.id === result.data!.id ? result.data! : d)));
        showBanner(`Designation "${result.data!.name}" updated.`);
      } else {
        const result = await createDesignationAction(payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setDesignations((all) => [...all, result.data!]);
        showBanner(`Designation "${result.data!.name}" created.`);
        
        // 🚀 NEW: Refresh departments to get the new designation count!
        const deptRefresh = await getDepartmentDataAction();
        if (deptRefresh.success && deptRefresh.data) {
          setDepartments(deptRefresh.data.departments);
        }
      }
      handleCloseDesigForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${msg}`, "info");
    }
  }

  async function handleConfirmDeleteDesig() {
    if (!deletingDesignation) return;
    const name = deletingDesignation.name;
    try {
      const result = await deleteDesignationAction(deletingDesignation.id);
      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
      } else {
        setDesignations((all) => all.filter((d) => d.id !== deletingDesignation.id));
        showBanner(`Designation "${name}" deleted.`);
        
        // 🚀 NEW: Refresh departments to get the new designation count!
        const deptRefresh = await getDepartmentDataAction();
        if (deptRefresh.success && deptRefresh.data) {
          setDepartments(deptRefresh.data.departments);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not delete: ${msg}`, "info");
    } finally { handleCloseDeleteDesig(); }
  }

  // -- Branches --
  async function handleSubmitBranchForm(payload: BranchFormData) {
    try {
      if (editingBranch) {
        const result = await updateBranchAction(editingBranch.id, payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setBranches((all) => all.map((b) => (b.id === result.data!.id ? result.data! : b)));
        showBanner(`Branch "${result.data!.name}" updated.`);
      } else {
        const result = await createBranchAction(payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setBranches((all) => [...all, result.data!]);
        showBanner(`Branch "${result.data!.name}" created.`);
      }
      handleCloseBranchForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${message}`, "info");
    }
  }

  async function handleConfirmDeleteBranch() {
    if (!deletingBranch) return;
    const name = deletingBranch.name;
    try {
      const result = await deleteBranchAction(deletingBranch.id);
      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
      } else {
        setBranches((all) => all.filter((b) => b.id !== deletingBranch.id));
        showBanner(`Branch "${name}" deleted.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${message}`, "info");
    } finally { handleCloseDeleteBranch(); }
  }

  function handleTabChange(next: OrgTab) {
    setOrgTab(next);
    if (next === "designations") loadDesignations();
    if (next === "branches") loadBranches();
  }

  const showDepartmentsTab = orgTab === "departments";

  return (
    <PageFrame size="wide" spacing="default">
      <Banner visible={banner.visible} message={banner.message} tone={banner.tone} onDismiss={dismissBanner} />

      <PageHeader
        title="Organization Hub"
        description="Manage office branches, departments, and job designations across your organization."
      />

      <DepartmentTabs
        active={orgTab}
        departmentCount={deptCounts.total}
        designationCount={designations.length > 0 ? desigCounts.total : deptCounts.totalDesignations}
        branchCount={branches.length > 0 ? branchCounts.total : initialData.branches.length}
        onChange={handleTabChange}
      />

      {orgTab === "designations" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-payroll-navy">Designations</h2>
              <p className="max-w-3xl text-xs text-gray-500">
                Manage job positions (designations) across departments.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" onClick={handleOpenCreateDesig} size="md">
                <Plus className="h-4 w-4" /> Add Designation
              </Button>
            </div>
          </div>

          {/* Top Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
            <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500">Total designations</p>
                  <Briefcase className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                    {desigCounts.total}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                Defined organization roles
              </div>
            </div>

            <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500">Active positions</p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                    {desigCounts.active}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                Available for employee assignment
              </div>
            </div>

            <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500">Assigned personnel</p>
                  <Users className="h-4 w-4 text-zinc-600" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                    {desigCounts.totalEmployees}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                Staff holding designations
              </div>
            </div>
          </div>

          <TableShell
            totalCount={designations.length}
            filteredCount={filteredDesignations.length}
            toolbar={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
                <input
                  type="search"
                  value={desigSearch}
                  onChange={(e) => setDesigSearch(e.target.value)}
                  placeholder="Search designations..."
                  className="h-9 w-full max-w-md rounded-xl border border-payroll-light bg-white px-3 text-xs sm:text-sm text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                />
              </div>
            }
          >
            <DesignationsTable
              designations={filteredDesignations}
              departmentNameById={departmentNameById}
              onView={handleOpenViewDesig}
              onEdit={handleOpenEditDesigFromTable}
              onDelete={handleOpenDeleteDesig}
            />
          </TableShell>
          <HowDesignationsWork />
        </div>
      ) : orgTab === "branches" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-payroll-navy">Branches</h2>
              <p className="max-w-3xl text-xs text-gray-500">
                Manage office locations. Branches define where departments and employees are situated.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" onClick={handleOpenCreateBranch} size="md">
                <Plus className="h-4 w-4" /> Add Branch
              </Button>
            </div>
          </div>

          {/* Top Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
            <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500">Total branches</p>
                  <Building2 className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                    {branchCounts.total}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                Configured operating locations
              </div>
            </div>

            <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500">Active branches</p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                    {branchCounts.active}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                Operational offices
              </div>
            </div>

            <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500">Inactive branches</p>
                  <Building2 className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                    {branchCounts.inactive}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
                Decommissioned or pending setup
              </div>
            </div>
          </div>

          <TableShell
            totalCount={branches.length}
            filteredCount={filteredBranches.length}
            toolbar={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
                <input
                  type="search"
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  placeholder="Search branches..."
                  className="h-9 w-full max-w-md rounded-xl border border-payroll-light bg-white px-3 text-xs sm:text-sm text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                />
              </div>
            }
          >
            <BranchesTable
              branches={filteredBranches}
              onView={handleOpenViewBranch}
              onEdit={handleOpenEditBranchFromTable}
              onDelete={handleOpenDeleteBranch}
            />
          </TableShell>
          <HowBranchesWork />
        </div>
      ) : (
        <div className="space-y-4">
          <DepartmentHero onNew={handleOpenCreateDept} />

          <DepartmentKpiCards
            counts={{
              ...deptCounts,
              totalDesignations: designations.length > 0 ? desigCounts.total : deptCounts.totalDesignations,
              totalEmployees: designations.length > 0 ? desigCounts.totalEmployees : deptCounts.totalEmployees,
            }}
          />

          <TableShell
            totalCount={departments.length}
            filteredCount={filtered.length}
            toolbar={
              <DepartmentSearch
                search={search}
                onSearchChange={setSearch}
                branches={branches.length > 0 ? branches : initialData.branches}
                branchFilter={branchFilter}
                onBranchFilterChange={setBranchFilter}
                totalCount={departments.length}
                filteredCount={filtered.length}
              />
            }
          >
            <DepartmentsCard
              departments={filtered}
              branchNameById={branchNameById}
              onView={handleOpenViewDept}
              onEdit={handleOpenEditDeptFromTable}
              onDelete={handleOpenDeleteDept}
            />
          </TableShell>
          <HowDepartmentsWork />
        </div>
      )}

      {showDepartmentsTab }

      {/* Department modals */}
      <DepartmentDetailPanel open={Boolean(viewingDepartment)} department={viewingDepartment}
        branchName={viewingDepartment ? branchNameById.get(viewingDepartment.branchId) ?? "—" : ""}
        onClose={handleCloseViewDept} onEdit={handleOpenEditDeptFromPanel} />
      <DepartmentFormModal key={editingDepartment ? `edit-dept-${editingDepartment.id}` : "new-dept"}
        open={isDeptFormOpen} editingDepartment={editingDepartment} branches={initialData.branches}
        onClose={handleCloseDeptForm} onSubmit={handleSubmitDeptForm} />
      <ConfirmDeleteDialog open={Boolean(deletingDepartment)} department={deletingDepartment}
        onClose={handleCloseDeleteDept} onConfirm={handleConfirmDeleteDept} />

      {/* Designation modals */}
      <DesignationDetailPanel open={Boolean(viewingDesignation)} designation={viewingDesignation}
        departmentName={viewingDesignation ? departmentNameById.get(viewingDesignation.departmentId) ?? "—" : ""}
        onClose={handleCloseViewDesig} onEdit={handleOpenEditDesigFromPanel} />
      <DesignationFormModal key={editingDesignation ? `edit-desig-${editingDesignation.id}` : "new-desig"}
        open={isDesigFormOpen} editingDesignation={editingDesignation} departments={initialData.departments}
        onClose={handleCloseDesigForm} onSubmit={handleSubmitDesigForm} />
      <ConfirmDeleteDesignationDialog open={Boolean(deletingDesignation)} designation={deletingDesignation}
        onClose={handleCloseDeleteDesig} onConfirm={handleConfirmDeleteDesig} />

      {/* Branch modals */}
      <BranchDetailPanel open={Boolean(viewingBranch)} branch={viewingBranch}
        onClose={handleCloseViewBranch} onEdit={handleOpenEditBranchFromPanel} />
      <BranchFormModal key={editingBranch ? `edit-branch-${editingBranch.id}` : "new-branch"}
        open={isBranchFormOpen} editingBranch={editingBranch}
        onClose={handleCloseBranchForm} onSubmit={handleSubmitBranchForm} />
      <ConfirmDeleteBranchDialog open={Boolean(deletingBranch)} branch={deletingBranch}
        onClose={handleCloseDeleteBranch} onConfirm={handleConfirmDeleteBranch} />
    </PageFrame>
  );
}