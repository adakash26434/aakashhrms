"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Upload } from "lucide-react";

import type {
  EmployeeKPIs,
  Employee,
  EmployeeFilter,
  EmployeeFormData,
  EmployeeValidationErrors,
} from "@/lib/types/employee";
import {
  buildEmployeeLookups,
  resolveBranchName,
  resolveDepartmentName,
  resolveDesignationName,
  type RawLookupData,
} from "@/lib/constants/employee-lookups";

import {
  saveEmployeeAction,
  deleteEmployeeAction,
  getEmployeesAction,
  getEmployeeLookupDataAction,
} from "@/app/actions/employee.actions";

import dynamic from "next/dynamic";
import { EmployeeKPIsGrid } from "./employee-kpi-cards";
import { EmployeeFilters } from "./employee-filters";
import { EmployeeTable } from "./employee-table";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/layout/page-frame";

const EmployeeDetailPanel = dynamic(
  () => import("./employee-detail-panel").then((m) => m.EmployeeDetailPanel),
  { ssr: false },
);

const EmployeeFormModal = dynamic(
  () => import("./employee-form-modal").then((m) => m.EmployeeFormModal),
  { ssr: false },
);

const ConfirmDeleteEmployeeDialog = dynamic(
  () =>
    import("./confirm-delete-dialog").then(
      (m) => m.ConfirmDeleteEmployeeDialog,
    ),
  { ssr: false },
);

import { useToast } from "@/components/ui/toast";

interface EmployeeClientProps {
  initialEmployees: Employee[];
  initialKpis: EmployeeKPIs;
  initialLookupData?: RawLookupData | null;
}

export function EmployeeClient({
  initialEmployees,
  initialKpis,
  initialLookupData,
}: EmployeeClientProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState(initialEmployees);
  const [kpis, setKpis] = useState(initialKpis);
  const [loading, setLoading] = useState(false);
  const [lookupData, setLookupData] = useState<RawLookupData | null>(
    initialLookupData ?? null,
  );
  const toast = useToast();

  const [filters, setFilters] = useState<EmployeeFilter>({
    search: "",
    departmentId: "all",
    branchId: "all",
    category: "all",
    status: "all",
  });

  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const lookups = useMemo(
    () => buildEmployeeLookups(employees, lookupData ?? undefined),
    [employees, lookupData],
  );

  const deleteTarget = useMemo(
    () => employees.find((e) => e.id === deleteTargetId) ?? null,
    [employees, deleteTargetId],
  );

  const modalEmployees = useMemo(() => {
    return employees.length > 0
      ? employees.map((e) => ({
          id: e.id,
          name: e.fullName,
          employeeCode: e.employeeCode,
          attendanceCode: e.attendanceCode,
          isSupervisor: e.isSupervisor,
        }))
      : lookupData?.employees ?? [];
  }, [employees, lookupData?.employees]);

  // Fetch lookup data on mount if not already present
  useEffect(() => {
    async function fetchLookups() {
      const result = await getEmployeeLookupDataAction();
      if (result.success && result.data) {
        setLookupData(result.data);
      }
    }
    if (!initialLookupData) {
      fetchLookups();
    }
  }, [initialLookupData]);

  // Fetch filtered employees when filters change
  useEffect(() => {
    async function fetchFiltered() {
      setLoading(true);
      const result = await getEmployeesAction(filters);
      if (result.success && result.data) {
        setEmployees(result.data.employees);
        setKpis(result.data.kpis);
      }
      setLoading(false);
    }
    if (lookupData !== null) {
      fetchFiltered();
    }
  }, [filters, lookupData]);

  // Quick export all filtered employees to CSV
  function handleExportAll() {
    if (employees.length === 0) {
      toast.info("No employees to export");
      return;
    }

    const headers = [
      "Employee Code",
      "Attendance Code",
      "Name",
      "Department",
      "Designation",
      "Branch",
      "Category",
      "Status",
      "Email",
      "Mobile",
    ];
    const csvRows = [headers.join(",")];

    for (const emp of employees) {
      const dept = resolveDepartmentName(
        emp.departmentId,
        lookups.departmentNameById,
      );
      const desig = resolveDesignationName(
        emp.designationId,
        lookups.designationNameById,
      );
      const branch = resolveBranchName(emp.branchId, lookups.branchNameById);
      const name = `"${emp.fullName}"`;
      const row = [
        emp.employeeCode,
        emp.attendanceCode,
        name,
        `"${dept}"`,
        `"${desig}"`,
        `"${branch}"`,
        emp.category,
        emp.status,
        emp.email,
        emp.mobileNo,
      ];
      csvRows.push(row.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Employee list exported successfully");
  }

  async function handleSaveEmployee(formData: EmployeeFormData) {
    try {
      const result = await saveEmployeeAction(editingEmpId, formData);
      if (!result.success) {
        const errorMsg = result.validationErrors
          ? Object.values(result.validationErrors)[0]
          : result.error || "Failed to save employee";
        toast.error(errorMsg);
        return {
          success: false,
          validationErrors: result.validationErrors as
            | EmployeeValidationErrors
            | undefined,
          error: result.error,
        };
      }

      toast.success(
        editingEmpId
          ? "Employee updated successfully!"
          : "Employee added successfully!",
      );
      setIsModalOpen(false);
      setEditingEmpId(null);

      // Refresh list
      const refresh = await getEmployeesAction(filters);
      if (refresh.success && refresh.data) {
        setEmployees(refresh.data.employees);
        setKpis(refresh.data.kpis);
      }
      return { success: true };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save employee";
      toast.error(msg);
      return { success: false, error: msg };
    }
  }

  async function confirmDeleteEmployee() {
    if (!deleteTargetId) return;
    try {
      const result = await deleteEmployeeAction(deleteTargetId);
      if (!result.success) {
        toast.error(result.error || "Could not delete employee");
        return;
      }

      toast.success("Employee removed successfully");
      setSelectedEmpId(null);
      setDeleteTargetId(null);

      // Refresh list
      const refresh = await getEmployeesAction(filters);
      if (refresh.success && refresh.data) {
        setEmployees(refresh.data.employees);
        setKpis(refresh.data.kpis);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not delete employee";
      toast.error(msg);
    }
  }

  return (
    <PageFrame size="wide" spacing="none" className="space-y-4 sm:space-y-5">
      {/* Page Header matching mockup */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-payroll-ink">
            Employee Directory
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            Manage your workforce — search, review, and update employee records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="h-9 gap-1.5 rounded-lg border-payroll-border bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            <span>Export</span>
          </Button>

          {/* Import Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.info("Employee CSV import wizard is available in Company Setup.")}
            className="h-9 gap-1.5 rounded-lg border-payroll-border bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs"
          >
            <Upload className="h-3.5 w-3.5 text-gray-500" />
            <span>Import</span>
          </Button>

          {/* Primary + Add Employee Button (routes to full-page flow) */}
          <Button
            type="button"
            size="sm"
            onClick={() => router.push("/workforce/employees/new")}
            className="h-9 gap-1.5 rounded-lg bg-[#1e7e47] hover:bg-[#165a3d] text-xs font-semibold text-white shadow-2xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <EmployeeKPIsGrid kpis={kpis} />

      {/* Filter Row */}
      <EmployeeFilters
        filters={filters}
        setFilters={setFilters}
        branches={lookupData?.branches ?? []}
        departments={lookupData?.departments ?? []}
        count={employees.length}
      />

      {/* Employee Table */}
      <EmployeeTable
        employees={employees}
        isLoading={loading}
        lookups={lookups}
        onSelect={(id) => setSelectedEmpId(id)}
        onEdit={(id) => router.push(`/workforce/employees/${id}/edit`)}
        onDelete={(id) => setDeleteTargetId(id)}
        onClearFilters={() =>
          setFilters({
            search: "",
            departmentId: "all",
            branchId: "all",
            category: "all",
            status: "all",
          })
        }
        hasActiveFilters={Boolean(
          (filters.search && filters.search.trim()) ||
            filters.departmentId !== "all" ||
            filters.branchId !== "all" ||
            filters.category !== "all" ||
            filters.status !== "all",
        )}
      />

      {/* Record Inspection Side Panel Drawer */}
      <EmployeeDetailPanel
        open={!!selectedEmpId}
        employeeId={selectedEmpId}
        lookups={lookups}
        onClose={() => setSelectedEmpId(null)}
        onEdit={(id) => {
          setSelectedEmpId(null);
          router.push(`/workforce/employees/${id}/edit`);
        }}
      />

      {/* Modal Fallback for Backward Compatibility */}
      <EmployeeFormModal
        key={editingEmpId ? `edit-${editingEmpId}` : "new-employee"}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmpId(null);
        }}
        editingId={editingEmpId}
        onSave={handleSaveEmployee}
        branches={lookupData?.branches ?? []}
        departments={lookupData?.departments ?? []}
        designations={lookupData?.designations ?? []}
        industryType={lookupData?.industryType}
        employees={modalEmployees}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteEmployeeDialog
        open={!!deleteTargetId}
        employee={deleteTarget}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteEmployee}
      />
    </PageFrame>
  );
}