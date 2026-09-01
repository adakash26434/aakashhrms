"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import type {
  LeaveApplication,
  LeaveApplicationFormData,
  LeaveFilter,
  LeaveKPIs,
} from "@/lib/types/leave";
import {
  saveLeaveApplicationAction,
  deleteLeaveApplicationAction,
  updateLeaveStatusAction,
  getLeaveApplicationsAction,
  getLeaveLookupDataAction,
  getEmployeeLeaveBalancesAction,
} from "@/app/actions/leave.actions";

import dynamic from "next/dynamic";
import type { LeaveLookupData } from "@/lib/services/leave.service";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import { LeaveKPIGrid } from "./leave-kpi-cards";
import { LeaveFilters } from "./leave-filters";
import { LeaveApplicationsTable } from "./leave-applications-table";

const LeaveDetailPanel = dynamic(
  () => import("./leave-detail-panel").then((m) => m.LeaveDetailPanel),
  { ssr: false }
);

const LeaveFormModal = dynamic(
  () => import("./leave-form-modal").then((m) => m.LeaveFormModal),
  { ssr: false }
);

const ConfirmDeleteDialog = dynamic(
  () => import("./confirm-delete-dialog").then((m) => m.ConfirmDeleteDialog),
  { ssr: false }
);

interface EnrichedApplication extends LeaveApplication {
  employeeName: string;
}

interface LeaveApplicationClientProps {
  initialApplications: EnrichedApplication[];
  initialKpis: LeaveKPIs;
}

export function LeaveApplicationClient({
  initialApplications,
  initialKpis,
}: LeaveApplicationClientProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [kpis, setKpis] = useState(initialKpis);
  const [loading, setLoading] = useState(false);
  const [lookupData, setLookupData] = useState<LeaveLookupData | null>(null);
  const [employeeBalances, setEmployeeBalances] = useState<
    { leaveTypeId: string; balance: number }[]
  >([]);

  const [filters, setFilters] = useState<LeaveFilter>({
    search: "",
    status: "all",
    leaveTypeId: "all",
    dateFrom: "",
    dateTo: "",
  });

  const [selectedApp, setSelectedApp] = useState<EnrichedApplication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const toast = useToast();
  const [banner, setBanner] = useState<{
    visible: boolean;
    message: string;
    tone: "success" | "info";
  }>({ visible: false, message: "", tone: "success" });

  const leaveTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (lookupData) {
      for (const lt of lookupData.leaveTypes) {
        map[lt.id] = lt.name;
      }
    }
    return map;
  }, [lookupData]);

  const showBanner = (message: string, tone: "success" | "info" = "success") => {
    setBanner({ visible: true, message, tone });
    if (tone === "success") {
      toast.success(message);
    } else {
      toast.info(message);
    }
  };

  useEffect(() => {
    getLeaveLookupDataAction().then((res) => {
      if (res.success && res.data) setLookupData(res.data);
    });
  }, []);

  useEffect(() => {
    async function fetchFiltered() {
      setLoading(true);
      try {
        const res = await getLeaveApplicationsAction(filters);
        if (res.success && res.data) {
          setApplications(res.data.applications as EnrichedApplication[]);
          setKpis(res.data.kpis);
        } else {
          showBanner("Failed to fetch leave applications", "info");
        }
      } catch {
        showBanner("Failed to fetch leave applications", "info");
      } finally {
        setLoading(false);
      }
    }
    fetchFiltered();
  }, [filters]);

  const handleOpenNewModal = async () => {
    setEditingAppId(null);
    setEmployeeBalances([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (app: EnrichedApplication) => {
    setEditingAppId(app.id);
    try {
      const res = await getEmployeeLeaveBalancesAction(app.employeeId);
      if (res.success && res.data) {
        setEmployeeBalances(
          res.data.map((b: { leaveTypeId: string; balance: number }) => ({
            leaveTypeId: b.leaveTypeId,
            balance: b.balance,
          })),
        );
      } else {
        setEmployeeBalances([]);
      }
    } catch {
      setEmployeeBalances([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (formData: LeaveApplicationFormData) => {
    try {
      const res = await saveLeaveApplicationAction(editingAppId, formData);
      if (!res.success) {
        if (res.validationErrors) {
          const errorMessages = Object.values(res.validationErrors).join("; ");
          showBanner(errorMessages || "Validation failed", "info");
        } else {
          showBanner(res.error || "Failed to save application", "info");
        }
        return;
      }
      showBanner(
        editingAppId
          ? "Leave application updated successfully"
          : "Leave application submitted successfully",
      );
      setIsModalOpen(false);
      setEditingAppId(null);
      
      const refresh = await getLeaveApplicationsAction(filters);
      if (refresh.success && refresh.data) {
        setApplications(refresh.data.applications as EnrichedApplication[]);
        setKpis(refresh.data.kpis);
      }
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : "Failed to save application", "info");
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await deleteLeaveApplicationAction(deleteTargetId);
      if (!res.success) {
        showBanner(res.error || "Failed to delete application", "info");
        return;
      }
      showBanner("Leave application deleted successfully");
      setDeleteTargetId(null);
      const refresh = await getLeaveApplicationsAction(filters);
      if (refresh.success && refresh.data) {
        setApplications(refresh.data.applications as EnrichedApplication[]);
        setKpis(refresh.data.kpis);
      }
    } catch (err: unknown) {
      showBanner(
        err instanceof Error ? err.message : "Failed to delete application",
        "info",
      );
      setDeleteTargetId(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    try {
      const res = await updateLeaveStatusAction(
        selectedApp.id,
        "Approved",
        "emp-3",
        "Approved.",
      );
      if (!res.success) {
        showBanner(res.error || "Failed to approve", "info");
        return;
      }
      showBanner("Leave application approved");
      setSelectedApp(null);
      const refresh = await getLeaveApplicationsAction(filters);
      if (refresh.success && refresh.data) {
        setApplications(refresh.data.applications as EnrichedApplication[]);
        setKpis(refresh.data.kpis);
      }
    } catch (err: unknown) {
      showBanner(
        err instanceof Error ? err.message : "Failed to approve",
        "info",
      );
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    try {
      const res = await updateLeaveStatusAction(
        selectedApp.id,
        "Rejected",
        "emp-3",
        "Rejected.",
      );
      if (!res.success) {
        showBanner(res.error || "Failed to reject", "info");
        return;
      }
      showBanner("Leave application rejected");
      setSelectedApp(null);
      const refresh = await getLeaveApplicationsAction(filters);
      if (refresh.success && refresh.data) {
        setApplications(refresh.data.applications as EnrichedApplication[]);
        setKpis(refresh.data.kpis);
      }
    } catch (err: unknown) {
      showBanner(
        err instanceof Error ? err.message : "Failed to reject",
        "info",
      );
    }
  };

  const deleteTarget = useMemo(
    () => applications.find((a) => a.id === deleteTargetId) ?? null,
    [applications, deleteTargetId],
  );

  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={() => setBanner({ ...banner, visible: false })}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-payroll-navy">
            Leave Applications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee leave requests and approvals
          </p>
        </div>
        <Button onClick={handleOpenNewModal} size="md">
          <Plus className="h-4 w-4" />
          New Application
        </Button>
      </div>

      <LeaveKPIGrid kpis={kpis} />

      <LeaveFilters
        filter={filters}
        leaveTypeOptions={lookupData?.leaveTypes || []}
        onChange={setFilters}
      />

      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-payroll-primary border-t-transparent" />
        </div>
      )}

      {!loading && (
        <LeaveApplicationsTable
          applications={applications}
          leaveTypeMap={leaveTypeMap}
          onView={setSelectedApp}
          onEdit={handleOpenEditModal}
          onDelete={setDeleteTargetId}
        />
      )}

      <LeaveDetailPanel
        open={selectedApp !== null}
        application={selectedApp}
        leaveTypeName={
          selectedApp
            ? leaveTypeMap[selectedApp.leaveTypeId] || selectedApp.leaveTypeId
            : ""
        }
        onClose={() => setSelectedApp(null)}
        onApprove={selectedApp?.status === "Pending" ? handleApprove : undefined}
        onReject={selectedApp?.status === "Pending" ? handleReject : undefined}
      />

      <LeaveFormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAppId(null);
        }}
        onSave={handleSave}
        editingId={editingAppId}
        employees={lookupData?.employees || []}
        leaveTypes={lookupData?.leaveTypes || []}
        employeeBalances={employeeBalances}
      />

      <ConfirmDeleteDialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDelete}
        title="Delete Leave Application"
        description={
          deleteTarget
            ? `Are you sure you want to delete the leave application from ${deleteTarget.employeeName}? This action cannot be undone.`
            : "Are you sure you want to delete this leave application?"
        }
      />
    </div>
  );
}