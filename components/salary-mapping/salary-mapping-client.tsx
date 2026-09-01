"use client";

import { useMemo, useState } from "react";
import { Plus, Upload, Download, UserMinus } from "lucide-react";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type {
  SalaryMapping,
  SalaryMappingData,
  SalaryMappingFormData,
  SalaryMappingFilter,
} from "@/lib/types/salary-mapping";
import {
  saveSalaryMappingAction,
  deleteSalaryMappingAction,
  getSalaryMappingDataAction
} from "@/app/actions/salary-mapping.actions";
import { SalaryMappingKPIsGrid } from "./salary-mapping-kpi-cards";
import { SalaryMappingFilters } from "./salary-mapping-filters";
import { SalaryMappingTabs, type SalaryMappingTab } from "./salary-mapping-tabs";
import { SalaryMappingTable } from "./salary-mapping-table";
import { SalaryMappingFormModal } from "./salary-mapping-form-modal";
import { SalaryMappingDetailPanel } from "./salary-mapping-detail-panel";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { SalaryMappingBulkActions } from "./salary-mapping-bulk-actions";
import { Card } from "@/components/ui/card";

interface SalaryMappingClientProps {
  initialData: SalaryMappingData;
}

interface BannerState {
  visible: boolean;
  message: string;
  tone: BannerTone;
}

const DEFAULT_FILTER: SalaryMappingFilter = {
  search: "",
  departmentId: "all",
  branchId: "all",
  unmappedOnly: false,
  fiscalYearId: "fy-1",
};

export function SalaryMappingClient({ initialData }: SalaryMappingClientProps) {
  // -- Data ----------------------------------------------------------------
  const [mappings, setMappings] = useState<SalaryMapping[]>(initialData.mappings);
  const [kpis, setKpis] = useState(initialData.kpis);

  // -- Filter state --------------------------------------------------------
  const [filter, setFilter] = useState<SalaryMappingFilter>(DEFAULT_FILTER);

  // -- Tab state -----------------------------------------------------------
  const [activeTab, setActiveTab] = useState<SalaryMappingTab>("all");

  // -- Selected mapping (for view detail panel) ----------------------------
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);

  // -- Modal state ---------------------------------------------------------
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // -- Bulk actions state --------------------------------------------------
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // -- Banner --------------------------------------------------------------
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    message: "",
    tone: "success",
  });

  // -- Derived: lookup maps ------------------------------------------------
  const employeeMap = useMemo(() => {
    const m = new Map(initialData.employees.map((e) => [e.id, e]));
    return m;
  }, [initialData.employees]);

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of initialData.departments) m.set(d.id, d.name);
    return m;
  }, [initialData.departments]);

  const branchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of initialData.branches) m.set(b.id, b.name);
    return m;
  }, [initialData.branches]);

  // -- Derived: tab counts -------------------------------------------------
  const tabCounts = useMemo(() => {
    const allCount = mappings.length;
    const allowancesCount = mappings.filter((m) =>
      m.salaryHeads.some((h) => h.payHeadType === "allowance"),
    ).length;
    const withLoansCount = mappings.filter(
      (m) => m.loan1Deduction > 0 || m.loan2Deduction > 0,
    ).length;
    const unmappedCount = initialData.employees.length - mappings.length;
    return { allCount, allowancesCount, withLoansCount, unmappedCount };
  }, [mappings, initialData.employees.length]);

  // -- Derived: unfiltered list of unmapped employees ----------------------
  const unmappedEmployees = useMemo(() => {
    const mappedIds = new Set(mappings.map((m) => m.employeeId));
    return initialData.employees.filter((e) => !mappedIds.has(e.id));
  }, [mappings, initialData.employees]);

  // -- Derived: filtered mappings ------------------------------------------
  const filteredMappings = useMemo(() => {
    // First apply tab filter
    let tabFiltered = mappings;
    switch (activeTab) {
      case "allowances":
        tabFiltered = mappings.filter((m) =>
          m.salaryHeads.some((h) => h.payHeadType === "allowance"),
        );
        break;
      case "with-loans":
        tabFiltered = mappings.filter(
          (m) => m.loan1Deduction > 0 || m.loan2Deduction > 0,
        );
        break;
      case "unmapped":
        // Show nothing in the table — we show the unmapped list instead
        tabFiltered = [];
        break;
      default:
        break;
    }

    // Then apply search/filter
    const q = filter.search.trim().toLowerCase();
    return tabFiltered.filter((m) => {
      const emp = employeeMap.get(m.employeeId);
      if (!emp) return false;

      if (q) {
        const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        const code = emp.employeeCode.toLowerCase();
        if (!name.includes(q) && !code.includes(q)) return false;
      }

      if (filter.departmentId !== "all" && emp.departmentId !== filter.departmentId) {
        return false;
      }

      if (filter.branchId !== "all" && emp.branchId !== filter.branchId) {
        return false;
      }

      return true;
    });
  }, [mappings, employeeMap, filter, activeTab]);

  // -- Derived: filtered unmapped employees (for the unmapped tab) ----------
  const filteredUnmapped = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    return unmappedEmployees.filter((emp) => {
      if (q) {
        const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        const code = emp.employeeCode.toLowerCase();
        if (!name.includes(q) && !code.includes(q)) return false;
      }
      if (filter.departmentId !== "all" && emp.departmentId !== filter.departmentId) {
        return false;
      }
      if (filter.branchId !== "all" && emp.branchId !== filter.branchId) {
        return false;
      }
      return true;
    });
  }, [unmappedEmployees, filter]);

  const toast = useToast();

  // -- Banner helpers ------------------------------------------------------
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

  function dismissBanner() {
    setBanner((b) => ({ ...b, visible: false }));
  }

  // -- Selected mapping ----------------------------------------------------
  const selectedMapping = useMemo(
    () => mappings.find((m) => m.id === selectedMappingId) ?? null,
    [mappings, selectedMappingId],
  );

  const editingMapping = useMemo(
    () => mappings.find((m) => m.id === editingMappingId) ?? null,
    [mappings, editingMappingId],
  );

  const deleteTarget = useMemo(
    () => mappings.find((m) => m.id === deleteTargetId) ?? null,
    [mappings, deleteTargetId],
  );

  // -- Tab change handler --------------------------------------------------
  function handleTabChange(next: SalaryMappingTab) {
    setActiveTab(next);
  }

  // -- Handlers ------------------------------------------------------------
  async function handleSaveMapping(formData: SalaryMappingFormData) {
    try {
      // Execute via Server Action bridge
      const result = await saveSalaryMappingAction(editingMappingId, formData);

      if (!result.success) {
        const errMsg = result.validationErrors
          ? Object.values(result.validationErrors)[0]
          : result.error || "Failed to save salary mapping";
        showBanner(`Could not save: ${errMsg}`, "info");
        return;
      }

      showBanner(
        editingMappingId
          ? "Salary mapping updated successfully"
          : "Salary mapping created successfully"
      );
      setIsFormOpen(false);
      setEditingMappingId(null);

      // Re-fetch updated dataset from Server Action to refresh state & KPIs
      const refresh = await getSalaryMappingDataAction();
      if (refresh.success && refresh.data) {
        setMappings(refresh.data.mappings);
        setKpis(refresh.data.kpis);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      showBanner(`Could not save: ${msg}`, "info");
    }
  }


  async function handleDeleteMapping(id: string) {
    setDeleteTargetId(id);
  }

  async function confirmDeleteMapping() {
    if (!deleteTargetId) return;
    try {
      const result = await deleteSalaryMappingAction(deleteTargetId);

      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
        return;
      }

      showBanner("Salary mapping deleted successfully");
      setMappings((all) => all.filter((m) => m.id !== deleteTargetId));
      setKpis((prev) => ({
        ...prev,
        totalMappings: prev.totalMappings - 1,
        unmappedCount: prev.unmappedCount + 1,
      }));
      setSelectedMappingId(null);
      setDeleteTargetId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      showBanner(`Could not delete: ${msg}`, "info");
    }
  }


  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1b3a1f]">Salary Mapping</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Define employee salary structures — basic salary, grade %, allowances,
            deductions, and loan deductions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsBulkOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Bulk
          </Button>
          <Button
            onClick={() => {
              setEditingMappingId(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Mapping
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <SalaryMappingKPIsGrid kpis={kpis} />

      {/* Tabs */}
      <SalaryMappingTabs
        active={activeTab}
        allCount={tabCounts.allCount}
        allowancesCount={tabCounts.allowancesCount}
        withLoansCount={tabCounts.withLoansCount}
        unmappedCount={tabCounts.unmappedCount}
        onChange={handleTabChange}
      />

      {/* Filters */}
      <Card className="overflow-hidden">
        <div className="space-y-4 border-b border-[#d7e8d0]/80 p-5">
          <SalaryMappingFilters
            filter={filter}
            setFilter={setFilter}
            departments={initialData.departments}
            branches={initialData.branches}
          />
        </div>

        {/* Table — show mappings or unmapped employees based on tab */}
        {activeTab === "unmapped" ? (
          <UnmappedEmployeesTable
            employees={filteredUnmapped}
            onAddMapping={(empId) => {
              setEditingMappingId(null);
              setIsFormOpen(true);
            }}
          />
        ) : (
          <SalaryMappingTable
            mappings={filteredMappings}
            employeeMap={employeeMap}
            onSelect={(id) => setSelectedMappingId(id)}
            onEdit={(id) => {
              setEditingMappingId(id);
              setIsFormOpen(true);
            }}
            onDelete={handleDeleteMapping}
          />
        )}
      </Card>

      {/* Detail Panel */}
      <SalaryMappingDetailPanel
        open={!!selectedMappingId}
        mapping={selectedMapping}
        employeeMap={employeeMap}
        onClose={() => setSelectedMappingId(null)}
        onEdit={(id) => {
          setSelectedMappingId(null);
          setEditingMappingId(id);
          setIsFormOpen(true);
        }}
      />

      {/* Form Modal */}
      <SalaryMappingFormModal
        key={editingMappingId ? `edit-${editingMappingId}` : "new"}
        open={isFormOpen}
        editingMapping={editingMapping}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMappingId(null);
        }}
        onSave={handleSaveMapping}
        employees={initialData.employees}
        allowanceHeads={initialData.allowanceHeads}
        deductionHeads={initialData.deductionHeads}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTargetId}
        mapping={deleteTarget}
        employeeName={
          deleteTarget
            ? (() => {
              const emp = employeeMap.get(deleteTarget.employeeId);
              return emp
                ? `${emp.firstName} ${emp.lastName}`
                : "Unknown";
            })()
            : ""
        }
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteMapping}
      />

      {/* Bulk Actions Modal */}
      <SalaryMappingBulkActions
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        employees={initialData.employees}
        departments={initialData.departments}
        branches={initialData.branches}
        allowanceHeads={initialData.allowanceHeads}
        deductionHeads={initialData.deductionHeads}
        onSaved={() => {
          setIsBulkOpen(false);

          getSalaryMappingDataAction().then((res) => {
            if (res.success && res.data) {
              setMappings(res.data.mappings);
              setKpis(res.data.kpis);
            }
          });
          showBanner("Bulk salary mappings updated successfully");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unmapped employees sub-table
// ---------------------------------------------------------------------------

function UnmappedEmployeesTable({
  employees,
  onAddMapping,
}: {
  employees: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    departmentName: string;
    branchName: string;
    designationName: string;
    gradePercent: number;
    gradeAmount: number;
  }[];
  onAddMapping: (empId: string) => void;
}) {
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <UserMinus className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">All employees have mappings</p>
        <p className="mt-1 text-xs text-gray-500">
          Every employee has a salary mapping configured.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6] text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Designation</th>
            <th className="px-4 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr
              key={emp.id}
              className="border-b border-[#d7e8d0]/60 transition-colors hover:bg-amber-50/30"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#1b3a1f]">
                    {emp.firstName} {emp.lastName}
                  </span>
                  <span className="text-[11px] text-gray-400">{emp.employeeCode}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{emp.departmentName}</td>
              <td className="px-4 py-3 text-gray-600">{emp.branchName}</td>
              <td className="px-4 py-3 text-gray-600">{emp.designationName}</td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => onAddMapping(emp.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1b3a1f]"
                >
                  <Plus className="h-3 w-3" />
                  Add Mapping
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}