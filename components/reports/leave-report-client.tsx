"use client";

import { useState, useTransition, useMemo } from "react";
import type {
  LeaveReportFilter,
  LeaveReportData,
  LeaveBalanceRow,
  ReportFilterLookupData,
} from "@/lib/types/report";
import { LeaveBalanceTable } from "./leave-balance-table";
import { LeaveApplicationsTable } from "./leave-applications-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportDataTableShell } from "./report-data-table-shell";
import { ReportPreviewModal } from "./report-preview-modal";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
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
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [leaveMode, setLeaveMode] = useState<
    "BALANCES" | "TAKEN" | "APPLICATIONS" | "APPROVED" | "REJECTED"
  >("BALANCES");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [singleEmployeeRow, setSingleEmployeeRow] = useState<LeaveBalanceRow | null>(null);
  const [isIndividualSlipsView, setIsIndividualSlipsView] = useState(false);

  const activeTab = leaveMode === "BALANCES" || leaveMode === "TAKEN" ? "BALANCES" : "APPLICATIONS";

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

  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [filter, setFilter] = useState<LeaveReportFilter>({
    fiscalYearId: initialLookups.fiscalYears[0]?.id || "",
    leaveTypeId: "",
    branchId: "",
    departmentId: "",
    employeeSearch: "",
  });

  const selectedFyLabel =
    initialLookups.fiscalYears.find((fy) => fy.id === filter.fiscalYearId)?.label ||
    "Selected FY";

  const handleApplyFilter = (currentFilter: LeaveReportFilter = filter) => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await getLeaveReportAction(currentFilter);
      if (res.success && res.data) {
        setReportData(res.data);
        toast.success("Leave report refreshed.");
      } else {
        const msg = res.error || "Failed to load leave report.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    });
  };

  const handleExportCsv = async (rowsToExport?: LeaveBalanceRow[]) => {
    startTransition(async () => {
      if (activeTab === "BALANCES") {
        if (rowsToExport && rowsToExport.length === 1) {
          const row = rowsToExport[0];
          let csv =
            "SN,Code,EmployeeName,Department,LeaveType,Allotted,Taken,CarriedForward,Balance,Encashable\n";
          csv += `1,"${row.employeeCode}","${row.employeeName}","${row.departmentName}","${row.leaveTypeName}",${row.allotted},${row.taken},${row.carriedForward},${row.balance},"${row.isEncashable ? "Yes" : "No"}"\n`;

          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `leave-balance-${row.employeeCode}.csv`);
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Single employee leave CSV exported.");
          return;
        }

        const res = await exportLeaveBalancesCsvAction(filter);
        if (res.success && res.data) {
          const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", res.filename || "leave-balances.csv");
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Leave balances exported successfully.");
        } else {
          toast.error(res.error || "Failed to export CSV.");
        }
      } else {
        const res = await exportLeaveApplicationsCsvAction(filter);
        if (res.success && res.data) {
          const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", res.filename || "leave-applications.csv");
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Leave applications exported successfully.");
        } else {
          toast.error(res.error || "Failed to export CSV.");
        }
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

  // Derive filtered report data based on local client filters
  const activeReportData: LeaveReportData | null = useMemo(() => {
    if (!reportData) return null;
    let bRows = reportData.balanceRows;
    let aRows = reportData.applicationRows;

    if (selectedEmployeeId) {
      const selectedEmp = initialLookups.employees?.find((e) => e.id === selectedEmployeeId);
      if (selectedEmp) {
        bRows = bRows.filter(
          (r) =>
            r.employeeCode.toLowerCase() === selectedEmp.employeeCode.toLowerCase() ||
            r.employeeName.toLowerCase() === selectedEmp.name.toLowerCase()
        );
        aRows = aRows.filter(
          (r) =>
            r.employeeCode.toLowerCase() === selectedEmp.employeeCode.toLowerCase() ||
            r.employeeName.toLowerCase() === selectedEmp.name.toLowerCase()
        );
      }
    }

    const totalAllotted = bRows.reduce((acc, r) => acc + Number(r.allotted || 0), 0);
    const totalTaken = bRows.reduce((acc, r) => acc + Number(r.taken || 0), 0);
    const totalEncashable = bRows
      .filter((r) => r.isEncashable)
      .reduce((acc, r) => acc + Number(r.balance || 0), 0);

    return {
      ...reportData,
      balanceRows: bRows,
      applicationRows: aRows,
      totalEmployees: new Set(bRows.map((r) => r.employeeCode)).size,
      totalDaysAllotted: totalAllotted.toString(),
      totalDaysTaken: totalTaken.toString(),
      totalEncashableBalance: totalEncashable.toString(),
    };
  }, [reportData, selectedEmployeeId, initialLookups.employees]);

  const previewDisplayData: LeaveReportData | null = useMemo(() => {
    if (singleEmployeeRow && reportData) {
      return {
        ...reportData,
        balanceRows: [singleEmployeeRow],
        applicationRows: reportData.applicationRows.filter(
          (r) => r.employeeCode === singleEmployeeRow.employeeCode
        ),
        totalEmployees: 1,
        totalDaysAllotted: singleEmployeeRow.allotted,
        totalDaysTaken: singleEmployeeRow.taken,
        totalEncashableBalance: singleEmployeeRow.isEncashable ? singleEmployeeRow.balance : "0",
      };
    }
    return activeReportData;
  }, [singleEmployeeRow, reportData, activeReportData]);

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
    <PageFrame size="wide" spacing="default">
      {/* Canonical Standard Page Header */}
      <PageHeader
        title="Leave Ledger & Balances"
        description="Annual leave balances ledger, taken days, carried forward, encashable counts, and 5-mode application views."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-3 py-1 text-xs font-bold text-payroll-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Statutory Leave Ledger</span>
          </span>
        </div>
      </PageHeader>

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
          const nextFilter: LeaveReportFilter = {
            fiscalYearId: newFilters.fiscalYearId || filter.fiscalYearId,
            leaveTypeId: newFilters.leaveTypeId || "",
            branchId: newFilters.branchId || "",
            departmentId: newFilters.departmentId || "",
            employeeSearch: newFilters.search || "",
          };
          setFilter(nextFilter);
          setSelectedEmployeeId(newFilters.employeeId || "");
          setSingleEmployeeRow(null);
          handleApplyFilter(nextFilter);
        }}
        isLoading={isPending}
      />

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Executive KPI Summary Widgets */}
      {activeReportData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-payroll-primary/10 p-2.5 text-payroll-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Employees Covered</p>
                <p className="text-lg font-bold text-payroll-navy">
                  {activeReportData.totalEmployees}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Total Allotted Days</p>
                <p className="text-lg font-bold text-emerald-800">
                  {activeReportData.totalDaysAllotted}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Total Days Taken</p>
                <p className="text-lg font-bold text-purple-800">
                  {activeReportData.totalDaysTaken}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Encashable Balance</p>
                <p className="text-lg font-bold text-amber-800">
                  {activeReportData.totalEncashableBalance}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Data Body */}
      {activeReportData && (
        <div className={isPreviewOpen ? "print:hidden space-y-4" : "space-y-4"}>
          {/* Top Action Toolbar with 5-Mode Switcher */}
          <ReportActionToolbar
            onPrint={handlePrint}
            onExport={() => handleExportCsv()}
            onPreview={() => {
              setSingleEmployeeRow(null);
              setIsPreviewOpen(true);
            }}
            isExporting={isPending}
            hasData={Boolean(activeReportData)}
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  FY: {selectedFyLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  Staff: {activeReportData.totalEmployees}
                </span>
              </div>
            }
          >
            {/* 5-Mode Sub-Tab Switcher */}
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-payroll-light bg-payroll-cream p-1 shadow-payroll-xs">
              <button
                type="button"
                onClick={() => setLeaveMode("BALANCES")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  leaveMode === "BALANCES"
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Balances ({activeReportData.balanceRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("TAKEN")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  leaveMode === "TAKEN"
                    ? "bg-purple-600 text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Taken ({modeFilteredBalances.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("APPLICATIONS")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  leaveMode === "APPLICATIONS"
                    ? "bg-payroll-navy text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                All Apps ({activeReportData.applicationRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("APPROVED")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  leaveMode === "APPROVED"
                    ? "bg-emerald-600 text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Approved (
                {
                  activeReportData.applicationRows.filter(
                    (r) => r.status.toUpperCase() === "APPROVED"
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("REJECTED")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  leaveMode === "REJECTED"
                    ? "bg-red-600 text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Rejected (
                {
                  activeReportData.applicationRows.filter(
                    (r) => r.status.toUpperCase() === "REJECTED"
                  ).length
                }
                )
              </button>
            </div>
          </ReportActionToolbar>

          {/* Tables inside Report Shell */}
          <ReportDataTableShell>
            {leaveMode === "BALANCES" || leaveMode === "TAKEN" ? (
              <LeaveBalanceTable
                rows={modeFilteredBalances}
                onSingleEmployeeAction={handleSingleEmployeeAction}
              />
            ) : (
              <LeaveApplicationsTable rows={modeFilteredApplications} />
            )}
          </ReportDataTableShell>
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
        title={
          singleEmployeeRow || selectedEmployeeId
            ? `Single Employee Leave Ledger — ${
                singleEmployeeRow?.employeeName ||
                activeReportData?.balanceRows[0]?.employeeName ||
                "Employee"
              }`
            : isIndividualSlipsView
            ? "Leave Balance Statements (Individual A4 Pages)"
            : "Leave Ledger & Balances Statement"
        }
        subtitle={`Fiscal Year: ${selectedFyLabel}`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isPending}
        isSingleEmployee={
          singleEmployeeRow !== null ||
          Boolean(selectedEmployeeId) ||
          previewDisplayData?.balanceRows.length === 1
        }
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={activeTab === "BALANCES" ? handlePrintIndividualSlips : undefined}
        company={initialLookups.company}
        metaDetails={[
          { label: "Fiscal Year", value: selectedFyLabel },
          {
            label: "Scope",
            value:
              singleEmployeeRow || selectedEmployeeId
                ? "Single Employee"
                : isIndividualSlipsView
                ? "Individual Slips (Page-by-Page)"
                : "All Selected Employees",
          },
          { label: "Total Days Taken", value: previewDisplayData?.totalDaysTaken || "0" },
          {
            label: "Encashable Balance",
            value: previewDisplayData?.totalEncashableBalance || "0",
          },
        ]}
      >
        {previewDisplayData &&
          (isIndividualSlipsView ? (
            <LeaveIndividualSlips
              rows={previewDisplayData.balanceRows}
              periodLabel={selectedFyLabel}
            />
          ) : (
            <div className="space-y-6">
              {activeTab === "BALANCES" ? (
                <LeaveBalanceTable rows={previewDisplayData.balanceRows} />
              ) : (
                <LeaveApplicationsTable rows={previewDisplayData.applicationRows} />
              )}
            </div>
          ))}
      </ReportPreviewModal>
    </PageFrame>
  );
}
