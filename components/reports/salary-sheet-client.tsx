"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { SalarySheetTable } from "./salary-sheet-table";
import { PayslipHeadTable } from "./payslip-head-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportDataTableShell } from "./report-data-table-shell";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import type {
  ReportFilterLookupData,
  SalarySheetReportData,
  SalarySheetRow,
  PayslipHeadSummaryRow,
} from "@/lib/types/report";
import {
  getSalarySheetReportAction,
  getPayslipHeadSummaryAction,
} from "@/app/actions/report.actions";
import { AlertCircle, FileSpreadsheet, Layers, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ReportPreviewModal = dynamic(
  () => import("./report-preview-modal").then((m) => m.ReportPreviewModal),
  { ssr: false }
);

const SalarySheetIndividualSlips = dynamic(
  () => import("./individual-report-slips").then((m) => m.SalarySheetIndividualSlips),
  { ssr: false }
);

interface SalarySheetClientProps {
  lookupData: ReportFilterLookupData;
}

export function SalarySheetClient({ lookupData }: SalarySheetClientProps) {
  const [filterState, setFilterState] = useState<ReportFilterState>({
    payrollRunId: lookupData.lockedPayrollRuns[0]?.id || "",
  });
  const [sheetData, setSheetData] = useState<SalarySheetReportData | null>(null);
  const [headSummaryRows, setHeadSummaryRows] = useState<PayslipHeadSummaryRow[]>([]);
  const [activeTab, setActiveTab] = useState<"SALARY_SHEET" | "HEAD_SUMMARY">("SALARY_SHEET");
  const [headRunLabel, setHeadRunLabel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [singleEmployeeRow, setSingleEmployeeRow] = useState<SalarySheetRow | null>(null);
  const [isIndividualSlipsView, setIsIndividualSlipsView] = useState(false);

  const toast = useToast();

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

  const fetchReport = async (filters: ReportFilterState, tabToFetch: "SALARY_SHEET" | "HEAD_SUMMARY" = activeTab) => {
    if (!filters.payrollRunId) {
      setError("Please select a locked payroll run.");
      toast.error("Please select a locked payroll run.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      if (tabToFetch === "SALARY_SHEET") {
        const res = await getSalarySheetReportAction({
          payrollRunId: filters.payrollRunId,
          branchId: filters.branchId,
          departmentId: filters.departmentId,
          employeeSearch: filters.search,
        });

        if (!res.success || !res.data) {
          const msg = res.error || "Failed to fetch salary sheet.";
          setError(msg);
          toast.error(msg);
          setSheetData(null);
        } else {
          setSheetData(res.data);
          toast.success("Salary sheet loaded successfully.");
        }
      } else {
        const res = await getPayslipHeadSummaryAction({
          payrollRunId: filters.payrollRunId,
          branchId: filters.branchId,
          departmentId: filters.departmentId,
        });

        if (!res.success || !res.data) {
          const msg = res.error || "Failed to fetch pay head summary.";
          setError(msg);
          toast.error(msg);
          setHeadSummaryRows([]);
        } else {
          setHeadSummaryRows(res.data.rows);
          setHeadRunLabel(res.data.runLabel);
          toast.success("Pay head summary loaded successfully.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading report.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters: ReportFilterState) => {
    setFilterState(newFilters);
    setSingleEmployeeRow(null);
    fetchReport(newFilters, activeTab);
  };

  const handleTabChange = (tab: "SALARY_SHEET" | "HEAD_SUMMARY") => {
    setActiveTab(tab);
    setSingleEmployeeRow(null);
    if (filterState.payrollRunId) {
      fetchReport(filterState, tab);
    }
  };

  // Derive filtered sheet data based on single employee filter
  const activeSheetData: SalarySheetReportData | null = useMemo(() => {
    if (!sheetData) return null;
    let filteredRows = sheetData.rows;

    if (filterState.employeeId) {
      const selectedEmp = lookupData.employees.find((e) => e.id === filterState.employeeId);
      if (selectedEmp) {
        filteredRows = filteredRows.filter(
          (r) => r.employeeCode === selectedEmp.employeeCode || r.employeeName === selectedEmp.name
        );
      }
    }

    if (filteredRows.length === sheetData.rows.length) {
      return sheetData;
    }

    const totalGross = filteredRows.reduce((acc, r) => acc + Number(r.grossEarnings), 0);
    const totalDed = filteredRows.reduce((acc, r) => acc + Number(r.totalDeductions), 0);
    const totalNet = filteredRows.reduce((acc, r) => acc + Number(r.netPayable), 0);

    return {
      ...sheetData,
      rows: filteredRows,
      summary: {
        ...sheetData.summary,
        totalEmployees: filteredRows.length,
        totalGrossEarnings: totalGross.toFixed(2),
        totalDeductions: totalDed.toFixed(2),
        totalNetPayable: totalNet.toFixed(2),
      },
    };
  }, [sheetData, filterState.employeeId, lookupData.employees]);

  const handleExportCsv = async (rowsToExport?: SalarySheetRow[]) => {
    if (!filterState.payrollRunId || !sheetData) return;
    setIsExporting(true);
    try {
      const exportRows = rowsToExport || activeSheetData?.rows || sheetData.rows;
      let csv =
        "SN,Code,EmployeeName,Department,BasicSalary,GradeAmount,OTAmount,GrossEarnings,AbsentDeduction,PF,SSF,CIT,TDS,LoanDeduction,TotalDeductions,NetPayable,BankName,BankAccount\n";
      exportRows.forEach((r, idx) => {
        csv += `${idx + 1},"${r.employeeCode}","${r.employeeName}","${r.departmentName}",${r.basicSalary},${r.gradeAmount},${r.otAmount},${r.grossEarnings},${r.absentDeduction},${r.pfEmployee},${r.ssfEmployee},${r.citDeduction},${r.tdsThisMonth},${r.loanDeduction},${r.totalDeductions},${r.netPayable},"${r.bankName}","${r.bankAccountNumberFull}"\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        exportRows.length === 1
          ? `salary-sheet-${exportRows[0].employeeCode}.csv`
          : `salary-sheet-${sheetData.run.label.replace(/[^a-zA-Z0-9]/g, "-")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Salary sheet CSV exported successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export CSV";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSingleEmployeeAction = (
    row: SalarySheetRow,
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

  const selectedRunLabel =
    lookupData.lockedPayrollRuns.find((r) => r.id === filterState.payrollRunId)?.label ||
    "Selected Run";

  const previewDisplayData: SalarySheetReportData | null = useMemo(() => {
    if (singleEmployeeRow && sheetData) {
      return {
        ...sheetData,
        rows: [singleEmployeeRow],
        summary: {
          ...sheetData.summary,
          totalEmployees: 1,
          totalGrossEarnings: singleEmployeeRow.grossEarnings,
          totalDeductions: singleEmployeeRow.totalDeductions,
          totalNetPayable: singleEmployeeRow.netPayable,
        },
      };
    }
    return activeSheetData;
  }, [singleEmployeeRow, sheetData, activeSheetData]);

  return (
    <PageFrame size="wide" spacing="default">
      {/* Canonical Standard Page Header */}
      <PageHeader
        title="Salary Sheet Report"
        description="View earnings, dynamic allowances, deductions, and net payable breakdown for locked monthly payroll runs."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-3 py-1 text-xs font-bold text-payroll-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Locked Run Data Enforced</span>
          </span>
        </div>
      </PageHeader>

      {/* Filter Bar */}
      <ReportFilterBar
        lookupData={lookupData}
        showRunSelector={true}
        showBranchFilter={true}
        showDepartmentFilter={true}
        showDesignationFilter={true}
        showEmployeeFilter={true}
        showSearchFilter={activeTab === "SALARY_SHEET"}
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
          hasData={Boolean(activeSheetData || headSummaryRows.length > 0)}
          meta={
            activeSheetData ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  Period: {selectedRunLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  Staff: {activeSheetData.summary.totalEmployees}
                </span>
              </div>
            ) : undefined
          }
        >
          {/* Sub-tab Switcher: Salary Sheet vs Pay Head Summary */}
          <div className="inline-flex rounded-lg border border-payroll-light bg-payroll-cream p-1 shadow-payroll-xs">
            <button
              type="button"
              onClick={() => handleTabChange("SALARY_SHEET")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                activeTab === "SALARY_SHEET"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:text-payroll-navy"
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Salary Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("HEAD_SUMMARY")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                activeTab === "HEAD_SUMMARY"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:text-payroll-navy"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Pay Head Summary</span>
            </button>
          </div>
        </ReportActionToolbar>

        {/* Tab Content inside Report Shell */}
        <div className={isPreviewOpen ? "print:hidden" : ""}>
          {activeTab === "SALARY_SHEET" ? (
            activeSheetData ? (
              <SalarySheetTable
                data={activeSheetData}
                onExportCsv={() => handleExportCsv()}
                isExporting={isExporting}
                onSingleEmployeeAction={handleSingleEmployeeAction}
              />
            ) : (
              <ReportDataTableShell
                isEmpty={true}
                emptyTitle="No Salary Sheet Loaded"
                emptyDescription="Select a locked payroll run from the filter options above and click &quot;Generate Report&quot;."
                emptyAction={
                  <a
                    href="/payroll/review"
                    className="font-semibold text-payroll-primary hover:underline text-xs inline-flex items-center gap-1"
                  >
                    Lock a payroll run in Review section →
                  </a>
                }
              >
                <div />
              </ReportDataTableShell>
            )
          ) : (
            <PayslipHeadTable rows={headSummaryRows} runLabel={headRunLabel} />
          )}
        </div>
      </div>

      {/* Full Document Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSingleEmployeeRow(null);
          setIsIndividualSlipsView(false);
        }}
        title={
          singleEmployeeRow || filterState.employeeId
            ? `Single Employee Report — ${
                singleEmployeeRow?.employeeName ||
                activeSheetData?.rows[0]?.employeeName ||
                "Employee"
              }`
            : isIndividualSlipsView
            ? "Employee Salary Slips (Individual A4 Pages)"
            : "Monthly Salary Sheet Statement"
        }
        subtitle={`Period: ${selectedRunLabel}`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isExporting}
        isSingleEmployee={
          singleEmployeeRow !== null ||
          Boolean(filterState.employeeId) ||
          previewDisplayData?.rows.length === 1
        }
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={
          activeTab === "SALARY_SHEET" ? handlePrintIndividualSlips : undefined
        }
        company={lookupData.company}
        metaDetails={[
          { label: "Payroll Run", value: selectedRunLabel },
          {
            label: "Report View",
            value:
              singleEmployeeRow || filterState.employeeId
                ? "Single Employee"
                : isIndividualSlipsView
                ? "Individual Slips (Page-by-Page)"
                : activeTab === "SALARY_SHEET"
                ? "Full Salary Sheet"
                : "Pay Head Summary",
          },
          {
            label: "Employees Count",
            value: previewDisplayData ? String(previewDisplayData.rows.length) : "N/A",
          },
        ]}
      >
        {isIndividualSlipsView && previewDisplayData ? (
          <SalarySheetIndividualSlips
            rows={previewDisplayData.rows}
            periodLabel={selectedRunLabel}
            company={lookupData.company}
          />
        ) : activeTab === "SALARY_SHEET" && previewDisplayData ? (
          <SalarySheetTable data={previewDisplayData} />
        ) : (
          <PayslipHeadTable rows={headSummaryRows} runLabel={headRunLabel} />
        )}
      </ReportPreviewModal>
    </PageFrame>
  );
}
