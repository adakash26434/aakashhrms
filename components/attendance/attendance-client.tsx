"use client";

import { useState, useMemo } from "react";
import { Plus, Upload, Lock } from "lucide-react";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { AttendanceData, AttendanceRecord, AttendanceFilter, AttendanceFormData, AttendanceBulkItem } from "@/lib/types/attendance";
import dynamic from "next/dynamic";
import { AttendanceKPIsGrid } from "./attendance-kpi-cards";
import { AttendanceFilters } from "./attendance-filters";
import { AttendanceTabs, type AttendanceTab } from "./attendance-tabs";
import { AttendanceTable } from "./attendance-table";

const AttendanceFormModal = dynamic(
  () => import("./attendance-form-modal").then((m) => m.AttendanceFormModal),
  { ssr: false }
);

const AttendanceBulkModal = dynamic(
  () => import("./attendance-bulk-modal").then((m) => m.AttendanceBulkModal),
  { ssr: false }
);

const AttendanceLockModal = dynamic(
  () => import("./attendance-lock-modal").then((m) => m.AttendanceLockModal),
  { ssr: false }
);

const AttendanceDetailPanel = dynamic(
  () => import("./attendance-detail-panel").then((m) => m.AttendanceDetailPanel),
  { ssr: false }
);

const ConfirmDeleteDialog = dynamic(
  () => import("./confirm-delete-dialog").then((m) => m.ConfirmDeleteDialog),
  { ssr: false }
);

import {
  saveAttendancePunchAction,
  bulkPostAttendanceAction,
  deleteAttendancePunchAction,
  runAndLockMonthlyCalculationAction,
  getAttendanceDataAction,
} from "@/app/actions/attendance.actions";

export function AttendanceClient({ initialData }: { initialData: AttendanceData }) {
  const [data, setData] = useState<AttendanceData>(initialData);
  const [filter, setFilter] = useState<AttendanceFilter>({
    search: "",
    departmentId: "all",
    branchId: "all",
    date: initialData.selectedDate || new Date().toISOString().split("T")[0],
    status: "all",
    isLateOnly: false,
  });
  const [activeTab, setActiveTab] = useState<AttendanceTab>("all");
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isLockOpen, setIsLockOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const toast = useToast();
  const [banner, setBanner] = useState<{ visible: boolean; message: string; tone: BannerTone }>({
    visible: false, message: "", tone: "success",
  });

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

  // Reload data from server action
  async function refreshData(newFilter?: AttendanceFilter) {
    const res = await getAttendanceDataAction(newFilter || filter);
    if (res.success && res.data) {
      setData(res.data);
    }
  }

  // Filter & tab derive
  const filteredRecords = useMemo(() => {
    let list = data.records;
    if (activeTab === "present") list = list.filter((r) => r.status === "Present" || r.status === "Half Day");
    else if (activeTab === "absent") list = list.filter((r) => r.status === "Absent" || r.status === "LWOP");
    else if (activeTab === "late") list = list.filter((r) => r.isLate);
    else if (activeTab === "ot") list = list.filter((r) => r.otHoursOfficeDay > 0 || r.otHoursOffDay > 0);

    const q = filter.search.trim().toLowerCase();
    return list.filter((r) => {
      if (q && !r.employeeName.toLowerCase().includes(q) && !r.attendanceCode.toLowerCase().includes(q)) return false;
      if (filter.departmentId !== "all" && r.departmentId !== filter.departmentId) return false;
      if (filter.branchId !== "all" && r.branchId !== filter.branchId) return false;
      if (filter.status !== "all" && r.status !== filter.status) return false;
      if (filter.isLateOnly && !r.isLate) return false;
      return true;
    });
  }, [data.records, filter, activeTab]);

  async function handleSavePunch(formData: AttendanceFormData) {
    const res = await saveAttendancePunchAction(editingRecord?.id || null, formData);
    if (!res.success) {
      showBanner(`Error: ${res.error}`, "info");
    } else {
      showBanner(editingRecord ? "Punch updated successfully" : "Punch logged successfully");
      setIsFormOpen(false);
      setEditingRecord(null);
      await refreshData();
    }
  }

  async function handleBulkPost(date: string, items: AttendanceBulkItem[]) {
    const res = await bulkPostAttendanceAction(date, items);
    if (!res.success) {
      showBanner(`Bulk Error: ${res.error}`, "info");
    } else {
      showBanner(`Bulk attendance posted! ${res.data?.successCount} successful.`);
      setIsBulkOpen(false);
      await refreshData();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await deleteAttendancePunchAction(deleteId);
    if (!res.success) {
      showBanner(`Delete Error: ${res.error}`, "info");
    } else {
      showBanner("Record deleted successfully");
      setDeleteId(null);
      await refreshData();
    }
  }

  async function handleRunEngine(bsMonth: number, datePrefix: string) {
    let count = 0;
    for (const emp of data.employees) {
      await runAndLockMonthlyCalculationAction(emp.id, bsMonth, datePrefix);
      count++;
    }
    showBanner(`Pre-Payroll Engine executed! Locked monthly calculation for ${count} active employees.`, "success");
    setIsLockOpen(false);
    await refreshData();
  }

  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={() => setBanner((b) => ({ ...b, visible: false }))}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-payroll-navy">Attendance & OT Engine</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Active Fiscal Year: <span className="font-semibold text-payroll-primary">{data.activeFiscalYear.label}</span>. 
            Track daily attendance punches, evaluate grace windows, and lock calculations for Phase 6 payroll.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)}>
            <Upload className="h-4 w-4" /> 1-Click Bulk Entry
          </Button>
          <Button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Log Single Punch
          </Button>
          <Button
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-50 font-semibold"
            onClick={() => setIsLockOpen(true)}
          >
            <Lock className="h-4 w-4 mr-1 text-amber-600" /> Run Pre-Payroll Lock
          </Button>
        </div>
      </div>

      <AttendanceKPIsGrid kpis={data.kpis} />

      <AttendanceTabs
        active={activeTab}
        allCount={data.records.length}
        presentCount={data.records.filter((r) => r.status === "Present" || r.status === "Half Day").length}
        absentCount={data.records.filter((r) => r.status === "Absent" || r.status === "LWOP").length}
        lateCount={data.records.filter((r) => r.isLate).length}
        otCount={data.records.filter((r) => r.otHoursOfficeDay > 0 || r.otHoursOffDay > 0).length}
        onChange={(next) => setActiveTab(next)}
      />

      <Card className="overflow-hidden">
        <div className="space-y-4 border-b border-payroll-light/80 p-5">
          <AttendanceFilters
            filter={filter}
            setFilter={(newF) => {
              setFilter(newF);
              // Trigger reload when date changes
              if (typeof newF === "function") {
                setFilter((prev) => {
                  const updated = newF(prev);
                  if (updated.date !== prev.date) refreshData(updated);
                  return updated;
                });
              } else {
                if (newF.date !== filter.date) refreshData(newF);
              }
            }}
            departments={data.departments}
            branches={data.branches}
          />
        </div>

        <AttendanceTable
          records={filteredRecords}
          onSelect={(rec) => setSelectedRecord(rec)}
          onEdit={(rec) => {
            setEditingRecord(rec);
            setIsFormOpen(true);
          }}
          onDelete={(id) => setDeleteId(id)}
        />
      </Card>

      <AttendanceFormModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSavePunch}
        initialData={editingRecord}
        employees={data.employees}
        selectedDate={filter.date}
      />

      <AttendanceBulkModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        onSave={handleBulkPost}
        employees={data.employees.map((e) => ({ ...e, departmentName: e.departmentName }))}
        selectedDate={filter.date}
      />

      <AttendanceLockModal
        open={isLockOpen}
        onClose={() => setIsLockOpen(false)}
        onRunEngine={handleRunEngine}
        employeesCount={data.employees.length}
      />

      <AttendanceDetailPanel
        open={!!selectedRecord}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}