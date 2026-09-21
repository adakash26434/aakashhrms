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

interface AttendanceReportClientProps {
  lookupData: ReportFilterLookupData;
}

export function AttendanceReportClient({ lookupData }: AttendanceReportClientProps) {
  const [filterState, setFilterState] = useState<ReportFilterState>({
    fiscalYearId: lookupData.fiscalYears[0]?.id || "",
    bsMonth: 8, // Mangsir
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

      if (!res.success || !res.data) {
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
      let csv =
        "SN,Code,EmployeeName,Department,WorkingDays,Present,PayLeave,NonPayLeave,AbsentDays,OfficeOT,OffDayOT,OTEarned,LeaveDeduction\n";
      exportRows.forEach((r, idx) => {
        csv += `${idx + 1},"${r.employeeCode}","${r.employeeName}","${r.departmentName}",${
          r.totalWorkingDays
        },${r.presentDays},${r.payLeaveDays},${r.nonPayLeaveDays},${r.absentDays},${
          r.totalOtHoursOffice
        },${r.totalOtHoursOff},${r.otEarnedAmount},${r.leaveDeductionAmount}\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        exportRows.length === 1
          ? `attendance-${exportRows[0].employeeCode}.csv`
          : `attendance-report-${reportData.monthLabel.replace(/[^a-zA-Z0-9]/g, "-")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    <PageFrame size="wide" spacing="default">
      {/* Canonical Standard Page Header */}
      <PageHeader
        title="Attendance & OT Report"
        description="Device punch details, manual status matrix (P/A/L/HD), and statutory monthly working days, absent deductions, and OT earned summary."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-3 py-1 text-xs font-bold text-payroll-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Nepal Labour Act Standards</span>
          </span>
        </div>
      </PageHeader>

      {/* Filter Bar */}
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

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
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
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  Period: {reportData?.monthLabel || ""} ({fyLabel})
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                    reportData?.isLocked
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {reportData?.isLocked ? "Locked Payroll Data" : "Draft Pre-Payroll Data"}
                </span>
              </div>
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-payroll-primary/10 text-payroll-primary">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
              Attendance Matrix
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
