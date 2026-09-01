"use client";

import { useState, useTransition, useMemo } from "react";
import type { LeaveReportFilter, LeaveReportData, LeaveBalanceRow, ReportFilterLookupData } from "@/lib/types/report";
import { LeaveBalanceTable } from "./leave-balance-table";
import { LeaveApplicationsTable } from "./leave-applications-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportPreviewModal } from "./report-preview-modal";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import {
  getLeaveReportAction,
  exportLeaveBalancesCsvAction,
  exportLeaveApplicationsCsvAction,
} from "@/app/actions/report.actions";
import { useToast } from "@/components/ui/toast";
import {
  Users,
  Calendar,
  CheckSquare,
  Search,
  Filter,
  CalendarCheck
} from "lucide-react";

import { LeaveIndividualSlips } from "./individual-report-slips";

interface LeaveReportClientProps {
  initialLookups: ReportFilterLookupData;
  initialReportData: LeaveReportData | null;
  initialError?: string | null;
}

export function LeaveReportClient({
  initialLookups,
  initialReportData,
  initialError,
}: LeaveReportClientProps) {
  const [reportData, setReportData] = useState<LeaveReportData | null>(initialReportData);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [activeTab, setActiveTab] = useState<"BALANCES" | "APPLICATIONS">("BALANCES");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [singleEmployeeRow, setSingleEmployeeRow] = useState<LeaveBalanceRow | null>(null);
  const [isIndividualSlipsView, setIsIndividualSlipsView] = useState(false);

  const handlePrintSummary = () => {
    setIsIndividualSlipsView(false);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintIndividualSlips = () => {
    setIsIndividualSlipsView(true);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const defaultFyId = initialLookups.fiscalYears[0]?.id || "";

  const [filter, setFilter] = useState<LeaveReportFilter & { employeeId?: string }>({
    fiscalYearId: defaultFyId,
    leaveTypeId: "",
    branchId: "",
    departmentId: "",
    employeeSearch: "",
    employeeId: "",
  });

  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const handleApplyFilter = () => {
    setErrorMessage(null);
    setSingleEmployeeRow(null);
    startTransition(async () => {
      const res = await getLeaveReportAction(filter);
      if (res.success && res.data) {
        setReportData(res.data);
        toast.success("Leave report loaded successfully.");
      } else {
        const msg = res.error || "Failed to load leave report.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    });
  };

  // Filter leave report data for single employee selection
  const activeReportData: LeaveReportData | null = useMemo(() => {
    if (!reportData) return null;
    let filteredBalances = reportData.balanceRows;
    let filteredApplications = reportData.applicationRows;

    if (filter.employeeId) {
      const selectedEmp = initialLookups.employees.find((e) => e.id === filter.employeeId);
      if (selectedEmp) {
        filteredBalances = filteredBalances.filter(
          (r) => r.employeeCode === selectedEmp.employeeCode || r.employeeName === selectedEmp.name
        );
        filteredApplications = filteredApplications.filter(
          (r) => r.employeeCode === selectedEmp.employeeCode || r.employeeName === selectedEmp.name
        );
      }
    }

    if (filteredBalances.length === reportData.balanceRows.length && filteredApplications.length === reportData.applicationRows.length) {
      return reportData;
    }

    const totalDaysTaken = filteredBalances.reduce((acc, r) => acc + Number(r.taken), 0);
    const totalDaysAllotted = filteredBalances.reduce((acc, r) => acc + Number(r.allotted), 0);
    const totalEncashable = filteredBalances.filter((r) => r.isEncashable).reduce((acc, r) => acc + Number(r.balance), 0);

    return {
      ...reportData,
      balanceRows: filteredBalances,
      applicationRows: filteredApplications,
      totalEmployees: new Set(filteredBalances.map((r) => r.employeeCode)).size || filteredBalances.length,
      totalDaysTaken: String(totalDaysTaken),
      totalDaysAllotted: String(totalDaysAllotted),
      totalEncashableBalance: String(totalEncashable),
    };
  }, [reportData, filter.employeeId, initialLookups.employees]);

  const handleExportCsv = (customRows?: LeaveBalanceRow[]) => {
    startTransition(async () => {
      if (customRows) {
        let csv = "SN,Code,EmployeeName,Department,Category,Statutory,Allotted,Taken,CarriedFwd,Balance,Encashable\n";
        customRows.forEach((r, idx) => {
          csv += `${idx + 1},"${r.employeeCode}","${r.employeeName}","${r.departmentName}","${r.leaveTypeName}",${r.isStatutory ? "Yes" : "No"},${r.allotted},${r.taken},${r.carriedForward},${r.balance},${r.isEncashable ? "Yes" : "No"}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `leave-balance-${customRows[0].employeeCode}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Leave balance CSV exported successfully.");
        return;
      }

      let res;
      if (activeTab === "BALANCES") {
        res = await exportLeaveBalancesCsvAction(filter);
      } else {
        res = await exportLeaveApplicationsCsvAction(filter);
      }

      if (res.success && res.data && res.filename) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Leave report CSV exported successfully.");
      } else {
        toast.error(res?.error || "Failed to export CSV");
      }
    });
  };

  const handleSingleEmployeeAction = (
    row: LeaveBalanceRow,
    action: "preview" | "print" | "export"
  ) => {
    if (action === "export") {
      handleExportCsv([row]);
    } else if (action === "preview") {
      setSingleEmployeeRow(row);
      setIsPreviewOpen(true);
    } else if (action === "print") {
      setSingleEmployeeRow(row);
      setTimeout(() => {
        window.print();
      }, 100);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedFyLabel = initialLookups.fiscalYears.find((f) => f.id === filter.fiscalYearId)?.label || "Selected FY";

  const previewDisplayData: LeaveReportData | null = useMemo(() => {
    if (singleEmployeeRow && reportData) {
      return {
        ...reportData,
        balanceRows: [singleEmployeeRow],
        applicationRows: reportData.applicationRows.filter((r) => r.employeeCode === singleEmployeeRow.employeeCode),
        totalEmployees: 1,
        totalDaysTaken: singleEmployeeRow.taken,
        totalDaysAllotted: singleEmployeeRow.allotted,
        totalEncashableBalance: singleEmployeeRow.isEncashable ? singleEmployeeRow.balance : "0",
      };
    }
    return activeReportData;
  }, [singleEmployeeRow, reportData, activeReportData]);

  const [leaveMode, setLeaveMode] = useState<"BALANCES" | "TAKEN" | "APPLICATIONS" | "APPROVED" | "REJECTED">("BALANCES");

  // Derive filtered rows based on 5 leave modes
  const modeFilteredBalances = useMemo(() => {
    if (!activeReportData) return [];
    if (leaveMode === "TAKEN") {
      return activeReportData.balanceRows.filter((r) => Number(r.taken) > 0);
    }
    return activeReportData.balanceRows;
  }, [activeReportData, leaveMode]);

  const modeFilteredApplications = useMemo(() => {
    if (!activeReportData) return [];
    if (leaveMode === "APPROVED") {
      return activeReportData.applicationRows.filter((r) => r.status.toUpperCase() === "APPROVED");
    }
    if (leaveMode === "REJECTED") {
      return activeReportData.applicationRows.filter((r) => r.status.toUpperCase() === "REJECTED");
    }
    if (leaveMode === "TAKEN") {
      return activeReportData.applicationRows.filter((r) => r.status.toUpperCase() === "APPROVED");
    }
    return activeReportData.applicationRows;
  }, [activeReportData, leaveMode]);

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <ReportActionToolbar
        title="Leave Ledger & Balances Report"
        subtitle="Comprehensive annual leave balances ledger, statutory usage, and historical application logs."
        onPrint={handlePrint}
        onExport={() => handleExportCsv()}
        onPreview={() => {
          setSingleEmployeeRow(null);
          setIsPreviewOpen(true);
        }}
        isExporting={isPending}
        hasData={!!activeReportData}
        badge="Leave Ledger"
        meta={
          activeReportData ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-[#d7e8d0]/60 px-2.5 py-0.5 text-xs font-semibold text-[#1b3a1f]">
                FY: {selectedFyLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-[#d7e8d0]/60 px-2.5 py-0.5 text-xs font-semibold text-[#1b3a1f]">
                Covered: {activeReportData.totalEmployees} Staff
              </span>
            </>
          ) : undefined
        }
      />

      {/* Filter Bar with Leave Type and Designation Enabled */}
      <ReportFilterBar
        lookupData={initialLookups}
        showFYSelector={true}
        showBranchFilter={true}
        showDepartmentFilter={true}
        showDesignationFilter={true}
        showLeaveTypeFilter={true}
        showEmployeeFilter={true}
        showSearchFilter={true}
        onFilterChange={(newFilters: ReportFilterState) => {
          setFilter((prev) => ({
            ...prev,
            fiscalYearId: newFilters.fiscalYearId || prev.fiscalYearId,
            leaveTypeId: newFilters.leaveTypeId || "",
            branchId: newFilters.branchId || "",
            departmentId: newFilters.departmentId || "",
            employeeId: newFilters.employeeId || "",
            employeeSearch: newFilters.search || "",
          }));
          setSingleEmployeeRow(null);
          handleApplyFilter();
        }}
        isLoading={isPending}
      />

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Report Data Body */}
      {activeReportData && (
        <div className={isPreviewOpen ? "print:hidden space-y-6" : "space-y-6"}>
          {/* Executive KPI Summary Widgets */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2 text-[#2e7d32]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Employees Covered</p>
                  <p className="text-lg font-bold text-[#1b3a1f]">{activeReportData.totalEmployees}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Total Allotted Days</p>
                  <p className="text-lg font-bold text-emerald-800">{activeReportData.totalDaysAllotted}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Total Days Taken</p>
                  <p className="text-lg font-bold text-purple-800">{activeReportData.totalDaysTaken}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Encashable Balance</p>
                  <p className="text-lg font-bold text-amber-800">{activeReportData.totalEncashableBalance}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Mode Sub-Tab Control */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6faf6] p-2 rounded-xl border border-[#d7e8d0]">
              <div className="inline-flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLeaveMode("BALANCES")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    leaveMode === "BALANCES" ? "bg-[#2e7d32] text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Leave Balances ({activeReportData.balanceRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveMode("TAKEN")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    leaveMode === "TAKEN" ? "bg-purple-600 text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Leave Taken ({modeFilteredBalances.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveMode("APPLICATIONS")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    leaveMode === "APPLICATIONS" ? "bg-[#1b3a1f] text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  All Applications ({activeReportData.applicationRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveMode("APPROVED")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    leaveMode === "APPROVED" ? "bg-emerald-600 text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Approved Only ({activeReportData.applicationRows.filter(r => r.status.toUpperCase() === "APPROVED").length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveMode("REJECTED")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    leaveMode === "REJECTED" ? "bg-red-600 text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Rejected Only ({activeReportData.applicationRows.filter(r => r.status.toUpperCase() === "REJECTED").length})
                </button>
              </div>
            </div>

            {leaveMode === "BALANCES" || leaveMode === "TAKEN" ? (
              <LeaveBalanceTable
                rows={modeFilteredBalances}
                onSingleEmployeeAction={handleSingleEmployeeAction}
              />
            ) : (
              <LeaveApplicationsTable rows={modeFilteredApplications} />
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSingleEmployeeRow(null);
          setIsIndividualSlipsView(false);
        }}
        title={singleEmployeeRow || filter.employeeId ? `Single Employee Leave Ledger — ${singleEmployeeRow?.employeeName || activeReportData?.balanceRows[0]?.employeeName || "Employee"}` : isIndividualSlipsView ? "Leave Balance Statements (Individual A4 Pages)" : "Leave Ledger & Balances Statement"}
        subtitle={`Fiscal Year: ${selectedFyLabel}`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isPending}
        isSingleEmployee={singleEmployeeRow !== null || !!filter.employeeId || previewDisplayData?.balanceRows.length === 1}
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={activeTab === "BALANCES" ? handlePrintIndividualSlips : undefined}
        metaDetails={[
          { label: "Fiscal Year", value: selectedFyLabel },
          { label: "Scope", value: (singleEmployeeRow || filter.employeeId) ? `Single Employee` : isIndividualSlipsView ? "Individual Slips (Page-by-Page)" : "All Selected Employees" },
          { label: "Total Days Taken", value: previewDisplayData?.totalDaysTaken || "0" },
          { label: "Encashable Balance", value: previewDisplayData?.totalEncashableBalance || "0" },
        ]}
      >
        {previewDisplayData && (
          isIndividualSlipsView ? (
            <LeaveIndividualSlips rows={previewDisplayData.balanceRows} periodLabel={selectedFyLabel} />
          ) : (
            <div className="space-y-6">
              {activeTab === "BALANCES" ? (
                <LeaveBalanceTable rows={previewDisplayData.balanceRows} />
              ) : (
                <LeaveApplicationsTable rows={previewDisplayData.applicationRows} />
              )}
            </div>
          )
        )}
      </ReportPreviewModal>
    </div>
  );
}
