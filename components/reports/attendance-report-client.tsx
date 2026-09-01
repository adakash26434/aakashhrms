"use client";

import { useState, useMemo, useEffect } from "react";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { AttendanceReportTable } from "./attendance-report-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportPreviewModal } from "./report-preview-modal";
import { AttendanceIndividualSlips } from "./individual-report-slips";
import type { ReportFilterLookupData, AttendanceReportData, AttendanceReportRow } from "@/lib/types/report";
import {
  getAttendanceReportAction,
  exportAttendanceCsvAction,
} from "@/app/actions/report.actions";
import { AlertCircle } from "lucide-react";
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

  useEffect(() => {
    if (filterState.fiscalYearId && filterState.bsMonth) {
      fetchReport(filterState);
    }
  }, []);

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
      let csv = "SN,Code,EmployeeName,Department,WorkingDays,Present,PayLeave,NonPayLeave,AbsentDays,OfficeOT,OffDayOT,OTEarned,LeaveDeduction\n";
      exportRows.forEach((r, idx) => {
        csv += `${idx + 1},"${r.employeeCode}","${r.employeeName}","${r.departmentName}",${r.totalWorkingDays},${r.presentDays},${r.payLeaveDays},${r.nonPayLeaveDays},${r.absentDays},${r.totalOtHoursOffice},${r.totalOtHoursOff},${r.otEarnedAmount},${r.leaveDeductionAmount}\n`;
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

  const fyLabel = lookupData.fiscalYears.find((f) => f.id === filterState.fiscalYearId)?.label || "Selected FY";

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
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <ReportActionToolbar
        title="Attendance & Overtime Ledger Report"
        subtitle="View monthly working days, present/absent counts, leave deductions, and calculated overtime hours."
        onPrint={handlePrint}
        onExport={() => handleExportCsv()}
        onPreview={() => {
          setSingleEmployeeRow(null);
          setIsPreviewOpen(true);
        }}
        isExporting={isExporting}
        hasData={!!activeReportData}
        badge="Nepal Labour Act"
        meta={
          activeReportData ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-[#d7e8d0]/60 px-2.5 py-0.5 text-xs font-semibold text-[#1b3a1f]">
                Period: {reportData?.monthLabel || ""} ({fyLabel})
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                reportData?.isLocked
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {reportData?.isLocked ? "Locked Payroll Data" : "Draft Pre-Payroll Data"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">
                Manual Attendance Ledger (Biometric Standby)
              </span>
            </>
          ) : undefined
        }
      />

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

      {/* Report Table */}
      <div className={isPreviewOpen ? "print:hidden" : ""}>
        {activeReportData ? (
          <AttendanceReportTable
            data={activeReportData}
            onExportCsv={() => handleExportCsv()}
            isExporting={isExporting}
            onSingleEmployeeAction={handleSingleEmployeeAction}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[#d7e8d0] bg-[#f6faf6] p-10 text-center text-xs text-gray-500">
            Select Fiscal Year and BS Month from the filter bar above and click "Generate Report".
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSingleEmployeeRow(null);
          setIsIndividualSlipsView(false);
        }}
        title={singleEmployeeRow || filterState.employeeId ? `Single Employee Attendance — ${singleEmployeeRow?.employeeName || activeReportData?.rows[0]?.employeeName || "Employee"}` : isIndividualSlipsView ? "Attendance & OT Statements (Individual A4 Pages)" : "Attendance & OT Statement"}
        subtitle={`Period: ${reportData?.monthLabel || ""} (${fyLabel})`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isExporting}
        isSingleEmployee={singleEmployeeRow !== null || !!filterState.employeeId || previewDisplayData?.rows.length === 1}
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={handlePrintIndividualSlips}
        metaDetails={[
          { label: "Fiscal Year", value: fyLabel },
          { label: "Period", value: reportData?.monthLabel || "N/A" },
          { label: "Scope", value: (singleEmployeeRow || filterState.employeeId) ? `Single Employee` : isIndividualSlipsView ? "Individual Slips (Page-by-Page)" : "All Selected Employees" },
          { label: "Lock Status", value: reportData?.isLocked ? "LOCKED" : "UNLOCKED" },
        ]}
      >
        {previewDisplayData && (
          isIndividualSlipsView ? (
            <AttendanceIndividualSlips rows={previewDisplayData.rows} periodLabel={`${reportData?.monthLabel || ""} (${fyLabel})`} />
          ) : (
            <AttendanceReportTable data={previewDisplayData} />
          )
        )}
      </ReportPreviewModal>
    </div>
  );
}
