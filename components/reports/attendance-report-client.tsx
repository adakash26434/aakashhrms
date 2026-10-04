"use client";

import { useState, useMemo } from "react";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { AttendanceReportTable } from "./attendance-report-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportDataTableShell } from "./report-data-table-shell";
import { ReportPreviewModal } from "./report-preview-modal";
import { AttendanceIndividualSlips } from "./individual-report-slips";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import type {
  ReportFilterLookupData,
  AttendanceReportData,
  AttendanceReportRow,
} from "@/lib/types/report";
import { getAttendanceReportAction } from "@/app/actions/report.actions";
import { AlertCircle, CalendarCheck, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getTodayBS } from "@/lib/utils/bs-calendar";
import { authorizeExportAction } from "@/app/actions/export.actions";
import { rowsToCsv } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";

interface AttendanceReportClientProps {
  lookupData: ReportFilterLookupData;
}

export function AttendanceReportClient({ lookupData }: AttendanceReportClientProps) {
  const [filterState, setFilterState] = useState<ReportFilterState>({
    fiscalYearId: lookupData.fiscalYears[0]?.id || "",
    bsMonth: getTodayBS().month,
  });
  const [reportData, setReportData] = useState<AttendanceReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [singleEmployeeRow, setSingleEmployeeRow] = useState<AttendanceReportRow | null>(null);
  const [isIndividualSlipsView, setIsIndividualSlipsView] = useState(false);

  const toast = useToast();

  const fetchReport = async (filters: ReportFilterState) => {
    if (!filters.fiscalYearId || !filters.bsMonth) {
      setError("Please select both Fiscal Year and BS Month.");
      toast.error("Please select both Fiscal Year and BS Month.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await getAttendanceReportAction({
        fiscalYearId: filters.fiscalYearId,
        bsMonth: filters.bsMonth,
        reportFormat: filters.reportFormat,
        branchId: filters.branchId,
        departmentId: filters.departmentId,
        designationId: filters.designationId,
        employeeId: filters.employeeId,
      });

      if (!res.success) {
        const msg = res.error || "Failed to load attendance report.";
        setError(msg);
        toast.error(msg);
        setReportData(null);
      } else {
        setReportData(res.data);
        toast.success("Attendance report loaded successfully.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading attendance report.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };



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

  const handleFilterChange = (newFilters: ReportFilterState) => {
    setFilterState(newFilters);
    setSingleEmployeeRow(null);
    fetchReport(newFilters);
  };

  // Derive filtered rows based on employeeId
  const activeReportData: AttendanceReportData | null = useMemo(() => {
    if (!reportData) return null;
    let filteredRows = reportData.rows;

    if (filterState.employeeId && filterState.employeeId !== "ALL") {
      const selectedEmp = lookupData.employees.find((e) => e.id === filterState.employeeId);
      if (selectedEmp) {
        filteredRows = filteredRows.filter(
          (r) => r.employeeCode.toLowerCase() === selectedEmp.employeeCode.toLowerCase()
        );
      }
    }

    return {
      ...reportData,
      rows: filteredRows,
    };
  }, [reportData, filterState.employeeId, lookupData.employees]);

  const handleExportCsv = async (rowsToExport?: AttendanceReportRow[]) => {
    if (!filterState.fiscalYearId || !reportData) return;
    setIsExporting(true);
    try {
      const exportRows = rowsToExport || activeReportData?.rows || reportData.rows;
      const gate = await authorizeExportAction({ module: "REPORTS_ATTENDANCE", label: `Attendance ${reportData.monthLabel} (CSV)`, rowCount: exportRows.length });
      if (!gate.allowed) {
        toast.error(gate.error ?? "Export not allowed");
        return;
      }
      const csv = rowsToCsv(
        ["SN", "Code", "EmployeeName", "Department", "DaysEmployed", "Present", "PayLeave", "NonPayLeave", "AbsentDays", "OfficeOT", "OffDayOT", "OTEarned", "LeaveDeduction"],
        exportRows.map((r, idx) => [
          idx + 1, r.employeeCode, r.employeeName, r.departmentName, r.totalWorkingDays, r.presentDays, r.payLeaveDays,
          r.nonPayLeaveDays, r.absentDays, r.totalOtHoursOffice, r.totalOtHoursOff, r.otEarnedAmount, r.leaveDeductionAmount,
        ])
      );
      downloadTextFile(
        exportRows.length === 1
          ? `attendance-${exportRows[0].employeeCode}.csv`
          : `attendance-report-${reportData.monthLabel.replace(/[^a-zA-Z0-9]/g, "-")}.csv`,
        csv
      );
      toast.success("Attendance CSV exported successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export CSV";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSingleEmployeeAction = (
    row: AttendanceReportRow,
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

  const fyLabel =
    lookupData.fiscalYears.find((f) => f.id === filterState.fiscalYearId)?.label ||
    "Selected FY";

  const previewDisplayData: AttendanceReportData | null = useMemo(() => {
    if (singleEmployeeRow && reportData) {
      return {
        ...reportData,
        rows: [singleEmployeeRow],
        totalEmployees: 1,
      };
    }
    return activeReportData;
  }, [singleEmployeeRow, reportData, activeReportData]);

  return (
    <PageFrame size="wide" spacing="default" className="print:space-y-0">
      {/* Canonical Standard Page Header — screen only */}
      <div className="print:hidden">
        <PageHeader
          title="Attendance & Overtime Ledger"
          description="Daily punch logs, presence matrix, monthly working days, and statutory overtime breakdown."
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Nepal Labour Act standards</span>
            </span>
          </div>
        </PageHeader>
      </div>

      {/* Filter Bar — screen only */}
      <div className="print:hidden">
        <ReportFilterBar
          lookupData={lookupData}
          showFYSelector={true}
          showMonthSelector={true}
          showReportFormatToggle={true}
          showBranchFilter={true}
          showDepartmentFilter={true}
          showDesignationFilter={true}
          showEmployeeFilter={true}
          showSearchFilter={false}
          onFilterChange={handleFilterChange}
          isLoading={isLoading}
        />
      </div>

      {/* Error Alert — screen only */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3.5 text-xs font-medium text-rose-700 border border-rose-200 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Result Section */}
      <div className="space-y-4">
        {/* Standard Action Toolbar */}
        <ReportActionToolbar
          onPrint={handlePrint}
          onExport={() => handleExportCsv()}
          onPreview={() => {
            setSingleEmployeeRow(null);
            setIsPreviewOpen(true);
          }}
          isExporting={isExporting}
          hasData={Boolean(activeReportData)}
          meta={
            activeReportData ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Period: {reportData?.monthLabel || ""} ({fyLabel})
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    reportData?.isLocked
                      ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
                      : "border-amber-200/80 bg-amber-50 text-amber-800"
                  }`}
                >
                  {reportData?.isLocked ? "Locked payroll period" : "Active live attendance"}
                </span>
              </div>
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-zinc-100 text-zinc-700">
              <CalendarCheck className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-zinc-900">
              Attendance matrix
            </span>
          </div>
        </ReportActionToolbar>

        {/* Report Table inside Shell */}
        <div className={isPreviewOpen ? "print:hidden" : ""}>
          {activeReportData ? (
            <AttendanceReportTable
              data={activeReportData}
              onExportCsv={() => handleExportCsv()}
              isExporting={isExporting}
              onSingleEmployeeAction={handleSingleEmployeeAction}
            />
          ) : (
            <ReportDataTableShell
              isEmpty={true}
              emptyTitle="No Attendance Records Loaded"
              emptyDescription="Select Fiscal Year and BS Month from the filter bar above and click &quot;Generate Report&quot;."
            >
              <div />
            </ReportDataTableShell>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSingleEmployeeRow(null);
          setIsIndividualSlipsView(false);
        }}
        title={
          singleEmployeeRow || filterState.employeeId
            ? `Single Employee Attendance — ${
                singleEmployeeRow?.employeeName ||
                activeReportData?.rows[0]?.employeeName ||
                "Employee"
              }`
            : isIndividualSlipsView
            ? "Attendance & OT Statements (Individual A4 Pages)"
            : "Attendance & OT Statement"
        }
        subtitle={`Period: ${reportData?.monthLabel || ""} (${fyLabel})`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isExporting}
        isSingleEmployee={
          singleEmployeeRow !== null ||
          Boolean(filterState.employeeId) ||
          previewDisplayData?.rows.length === 1
        }
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={handlePrintIndividualSlips}
        company={lookupData.company}
        metaDetails={[
          { label: "Fiscal Year", value: fyLabel },
          { label: "Period", value: reportData?.monthLabel || "N/A" },
          {
            label: "Scope",
            value:
              singleEmployeeRow || filterState.employeeId
                ? "Single Employee"
                : isIndividualSlipsView
                ? "Individual Slips (Page-by-Page)"
                : "All Selected Employees",
          },
          { label: "Lock Status", value: reportData?.isLocked ? "LOCKED" : "UNLOCKED" },
        ]}
      >
        {previewDisplayData &&
          (isIndividualSlipsView ? (
            <AttendanceIndividualSlips
              rows={previewDisplayData.rows}
              periodLabel={`${reportData?.monthLabel || ""} (${fyLabel})`}
            />
          ) : (
            <AttendanceReportTable data={previewDisplayData} />
          ))}
      </ReportPreviewModal>
    </PageFrame>
  );
}
