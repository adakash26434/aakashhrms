"use client";

import { useMemo, useState, useEffect } from "react";
import type {
  LeaveApplication,
  LeaveFilter,
} from "@/lib/types/leave";
import {
  updateLeaveStatusAction,
  getLeaveApplicationsAction,
  getLeaveLookupDataAction,
} from "@/app/actions/leave.actions";
import dynamic from "next/dynamic";
// NOTICE: import type erases this from browser bundle completely!
import type { LeaveLookupData } from "@/lib/services/leave.service";
import { Banner } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import { LeaveApprovalKPIGrid } from "./leave-approval-kpi-cards";
import { LeaveApprovalFilters } from "./leave-approval-filters";
import { LeaveApprovalTable } from "./leave-approval-table";

const LeaveApprovalActionModal = dynamic(
  () => import("./leave-approval-action-modal").then((m) => m.LeaveApprovalActionModal),
  { ssr: false }
);

const LeaveDetailPanel = dynamic(
  () => import("./leave-detail-panel").then((m) => m.LeaveDetailPanel),
  { ssr: false }
);

interface EnrichedApplication extends LeaveApplication {
  employeeName: string;
}

interface ApprovalFilter {
  search: string;
  leaveTypeId: string;
  dateFrom: string;
  dateTo: string;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export function LeaveApprovalClient() {
  const [applications, setApplications] = useState<EnrichedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupData, setLookupData] = useState<LeaveLookupData | null>(null);

  const [filters, setFilters] = useState<ApprovalFilter>({
    search: "",
    leaveTypeId: "all",
    dateFrom: "",
    dateTo: "",
  });

  const [selectedApp, setSelectedApp] = useState<EnrichedApplication | null>(null);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    action: "approve" | "reject";
    target: EnrichedApplication | null;
  }>({ open: false, action: "approve", target: null });

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

  const kpis = useMemo(() => {
    const todayApps = applications.filter((app) => {
      if (app.status === "Approved" && app.reviewedAt) return isToday(new Date(app.reviewedAt));
      if (app.status === "Rejected" && app.reviewedAt) return isToday(new Date(app.reviewedAt));
      return false;
    });

    return {
      totalPending: applications.filter((a) => a.status === "Pending").length,
      approvedToday: applications.filter((a) => a.status === "Approved" && a.reviewedAt && isToday(new Date(a.reviewedAt))).length,
      rejectedToday: applications.filter((a) => a.status === "Rejected" && a.reviewedAt && isToday(new Date(a.reviewedAt))).length,
      awaitingMyReview: applications.filter((a) => a.status === "Pending").length,
    };
  }, [applications]);

  useEffect(() => {
    getLeaveLookupDataAction().then((res) => {
      if (res.success && res.data) setLookupData(res.data);
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const allTodayFilter: LeaveFilter = {
          search: "",
          status: "all",
          leaveTypeId: "all",
          dateFrom: "",
          dateTo: "",
        };
        const res = await getLeaveApplicationsAction(allTodayFilter);
        if (res.success && res.data) {
          setApplications(res.data.applications as EnrichedApplication[]);
        } else {
          showBanner("Failed to fetch leave applications", "info");
        }
      } catch {
        showBanner("Failed to fetch leave applications", "info");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [filters]);

  const filteredPending = useMemo(() => {
    return applications.filter((app) => {
      if (app.status !== "Pending") return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!app.employeeName.toLowerCase().includes(s)) return false;
      }
      if (filters.leaveTypeId !== "all" && app.leaveTypeId !== filters.leaveTypeId) return false;
      if (filters.dateFrom && new Date(app.appliedDate) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(app.appliedDate) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [applications, filters]);

  const handleApproveClick = (app: EnrichedApplication) => {
    setActionModal({ open: true, action: "approve", target: app });
  };

  const handleRejectClick = (app: EnrichedApplication) => {
    setActionModal({ open: true, action: "reject", target: app });
  };

  const handleConfirmAction = async (remarks: string) => {
    const target = actionModal.target;
    if (!target) return;

    try {
      const res = await updateLeaveStatusAction(
        target.id,
        actionModal.action === "approve" ? "Approved" : "Rejected",
        "emp-3",
        remarks || undefined,
      );

      if (!res.success) {
        showBanner(`Failed to process action: ${res.error}`, "info");
        return;
      }

      showBanner(
        actionModal.action === "approve"
          ? `Leave application approved for ${target.employeeName}`
          : `Leave application rejected for ${target.employeeName}`,
      );

      setActionModal({ open: false, action: "approve", target: null });
      setSelectedApp(null);

      const refresh = await getLeaveApplicationsAction({
        search: "",
        status: "all",
        leaveTypeId: "all",
        dateFrom: "",
        dateTo: "",
      });
      if (refresh.success && refresh.data) {
        setApplications(refresh.data.applications as EnrichedApplication[]);
      }
    } catch (err: unknown) {
      showBanner(
        err instanceof Error ? err.message : "Failed to process action",
        "info",
      );
    }
  };

  const handleActionModalClose = () => {
    setActionModal({ open: false, action: "approve", target: null });
  };

  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={() => setBanner({ ...banner, visible: false })}
      />

      <div>
        <h1 className="text-xl font-bold text-payroll-navy">Leave Approvals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and act on pending employee leave applications
        </p>
      </div>

      <LeaveApprovalKPIGrid kpis={kpis} />

      <LeaveApprovalFilters
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
        <LeaveApprovalTable
          applications={filteredPending}
          leaveTypeMap={leaveTypeMap}
          onView={setSelectedApp}
          onApprove={handleApproveClick}
          onReject={handleRejectClick}
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
        onApprove={
          selectedApp?.status === "Pending"
            ? () => handleApproveClick(selectedApp)
            : undefined
        }
        onReject={
          selectedApp?.status === "Pending"
            ? () => handleRejectClick(selectedApp)
            : undefined
        }
      />

      <LeaveApprovalActionModal
        open={actionModal.open}
        onClose={handleActionModalClose}
        onConfirm={handleConfirmAction}
        action={actionModal.action}
        target={
          actionModal.target
            ? {
                id: actionModal.target.id,
                employeeName: actionModal.target.employeeName,
                leaveTypeName:
                  leaveTypeMap[actionModal.target.leaveTypeId] ||
                  actionModal.target.leaveTypeId,
                noOfDays: actionModal.target.noOfDays,
                duration: actionModal.target.duration,
              }
            : null
        }
      />
    </div>
  );
}