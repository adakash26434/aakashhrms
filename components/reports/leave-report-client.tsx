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
import { authorizeExportAction } from "@/app/actions/export.actions";
import { rowsToCsv } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";

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
          const gate = await authorizeExportAction({ module: "REPORTS_LEAVE", label: `Leave balance ${row.employeeCode} (CSV)`, rowCount: 1 });
          if (!gate.allowed) {
            toast.error(gate.error ?? "Export not allowed");
            return;
          }
          downloadTextFile(
            `leave-balance-${row.employeeCode}.csv`,
            rowsToCsv(
              ["SN", "Code", "EmployeeName", "Department", "LeaveType", "Allotted", "Taken", "CarriedForward", "Balance", "Encashable"],
              [[1, row.employeeCode, row.employeeName, row.departmentName, row.leaveTypeName, row.allotted, row.taken, row.carriedForward, row.balance, row.isEncashable ? "Yes" : "No"]]
            )
          );
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
    <PageFrame size="wide" spacing="default" className="print:space-y-0">
      {/* Canonical Standard Page Header — screen only */}
      <div className="print:hidden">
        <PageHeader
          title="Leave Ledger & Balances"
          description="Annual leave balances ledger, taken days, carried forward, encashable counts, and 5-mode application views."
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Statutory leave ledger</span>
            </span>
          </div>
        </PageHeader>
      </div>

      {/* Filter Bar — screen only */}
      <div className="print:hidden">
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
      </div>

      {/* Error Message — screen only */}
      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700 print:hidden">
          {errorMessage}
        </div>
      )}

      {/* Executive KPI Summary Metrics — screen only, never printed */}
      {activeReportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2 print:hidden">
          {/* Employees Covered */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Employees covered</p>
                <Users className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {activeReportData.totalEmployees}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Assigned to leave cycle
            </div>
          </div>

          {/* Total Allotted Days */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Total allotted days</p>
                <Calendar className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {activeReportData.totalDaysAllotted}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Entitled annual pool
            </div>
          </div>

          {/* Total Days Taken */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Total days taken</p>
                <CalendarCheck className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {activeReportData.totalDaysTaken}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Utilized by workforce
            </div>
          </div>

          {/* Encashable Balance */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Encashable balance</p>
                <CheckSquare className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {activeReportData.totalEncashableBalance}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Available for settlement
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
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  FY: {selectedFyLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Staff: {activeReportData.totalEmployees}
                </span>
              </div>
            }
          >
            {/* 5-Mode Sub-Tab Switcher */}
            <div className="inline-flex flex-wrap items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100/70 p-0.5">
              <button
                type="button"
                onClick={() => setLeaveMode("BALANCES")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  leaveMode === "BALANCES"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Balances ({activeReportData.balanceRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("TAKEN")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  leaveMode === "TAKEN"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Taken ({modeFilteredBalances.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("APPLICATIONS")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  leaveMode === "APPLICATIONS"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                All apps ({activeReportData.applicationRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode("APPROVED")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  leaveMode === "APPROVED"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
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
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  leaveMode === "REJECTED"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
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
