"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus } from "lucide-react";

import type { EmployeeKPIs, Employee, EmployeeFilter, EmployeeFormData, EmployeeValidationErrors } from "@/lib/types/employee";
import { buildEmployeeLookups, type RawLookupData } from "@/lib/constants/employee-lookups";

import { saveEmployeeAction, deleteEmployeeAction, getEmployeesAction, getEmployeeLookupDataAction } from "@/app/actions/employee.actions";

import dynamic from "next/dynamic";
import { EmployeeKPIsGrid } from "./employee-kpi-cards";
import { EmployeeFilters } from "./employee-filters";
import { EmployeeTable } from "./employee-table";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { TableShell } from "@/components/ui/table-shell";

const EmployeeDetailPanel = dynamic(
  () => import("./employee-detail-panel").then((m) => m.EmployeeDetailPanel),
  { ssr: false }
);

const EmployeeFormModal = dynamic(
  () => import("./employee-form-modal").then((m) => m.EmployeeFormModal),
  { ssr: false }
);

const ConfirmDeleteEmployeeDialog = dynamic(
  () => import("./confirm-delete-dialog").then((m) => m.ConfirmDeleteEmployeeDialog),
  { ssr: false }
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
  const [employees, setEmployees] = useState(initialEmployees);
  const [kpis, setKpis] = useState(initialKpis);
  const [loading, setLoading] = useState(false);
  const [lookupData, setLookupData] = useState<RawLookupData | null>(initialLookupData ?? null);
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
  
  // To force remount the modal
  const [modalKey, setModalKey] = useState(0);

  const lookups = useMemo(() => buildEmployeeLookups(employees, lookupData ?? undefined), [employees, lookupData]);

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

  // Fetch lookup data on mount
  useEffect(() => {
    async function fetchLookups() {
      const result = await getEmployeeLookupDataAction();
      if (result.success && result.data) {
        setLookupData(result.data);
      }
    }
    fetchLookups();
  }, []);

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
    // Only run if it's not the initial mount to save a network call
    if (lookupData !== null) {
      fetchFiltered();
    }
  }, [filters, lookupData]);

  async function handleSaveEmployee(formData: EmployeeFormData) {
    try {
      const result = await saveEmployeeAction(editingEmpId, formData);
      if (!result.success) {
        const errorMsg = result.validationErrors ? Object.values(result.validationErrors)[0] : (result.error || "Failed to save employee");
        toast.error(errorMsg);
        return {
          success: false,
          validationErrors: result.validationErrors as EmployeeValidationErrors | undefined,
          error: result.error,
        };
      }
      
      toast.success(editingEmpId ? "Employee updated successfully!" : "Employee added successfully!");
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
      const msg = err instanceof Error ? err.message : "Failed to save employee";
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
      const msg = err instanceof Error ? err.message : "Could not delete employee";
      toast.error(msg);
    }
  }

  return (
    <PageFrame size="wide" spacing="default">
      <PageHeader
        title="Employee Directory"
        description="Manage employee records, personal information, employment details, and salary mappings across branches."
      >
        <Button
          onClick={() => {
            setEditingEmpId(null);
            setModalKey(Date.now());
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </PageHeader>

      <EmployeeKPIsGrid kpis={kpis} />

      <TableShell
        totalCount={kpis.total}
        filteredCount={employees.length}
        toolbar={
          <EmployeeFilters
            filters={filters}
            setFilters={setFilters}
            branches={lookupData?.branches ?? []}
            departments={lookupData?.departments ?? []}
          />
        }
      >
        <EmployeeTable
          employees={employees}
          isLoading={loading}
          lookups={lookups}
          onSelect={(id) => setSelectedEmpId(id)}
          onEdit={(id) => {
            setEditingEmpId(id);
            setModalKey(Date.now());
            setIsModalOpen(true);
          }}
          onDelete={(id) => setDeleteTargetId(id)}
        />
      </TableShell>

      <EmployeeDetailPanel
        open={!!selectedEmpId}
        employeeId={selectedEmpId}
        lookups={lookups}
        onClose={() => setSelectedEmpId(null)}
        onEdit={(id) => {
          setSelectedEmpId(null);
          setEditingEmpId(id);
          setModalKey(Date.now());
          setIsModalOpen(true);
        }}
      />

      <EmployeeFormModal
        key={editingEmpId ? `edit-${editingEmpId}` : `new-${modalKey}`}
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

      <ConfirmDeleteEmployeeDialog
        open={!!deleteTargetId}
        employee={deleteTarget}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteEmployee}
      />
    </PageFrame>
  );
}