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
import { authorizeExportAction } from "@/app/actions/export.actions";
import { rowsToCsv } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";

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

  /** Injects a temporary @page landscape override for wide tabular prints,
   *  then removes it after printing via the afterprint event.
   *  NOTE: @page must be at the stylesheet root — NOT inside @media print. */
  const printLandscape = (delayMs = 50) => {
    const styleEl = document.createElement("style");
    styleEl.id = "__salary-landscape-override";
    // Bare @page rule (root level) — this is the correct spec. @page inside @media print is invalid.
    styleEl.textContent = "@page { size: A4 landscape; margin: 8mm 6mm; }";
    document.head.appendChild(styleEl);
    document.body.classList.add("print-landscape");
    setTimeout(() => {
      window.print();
    }, delayMs);
    window.addEventListener(
      "afterprint",
      () => {
        document.getElementById("__salary-landscape-override")?.remove();
        document.body.classList.remove("print-landscape");
      },
      { once: true }
    );
  };

  const handlePrintSummary = () => {
    setIsIndividualSlipsView(false);
    printLandscape(50);
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
      const gate = await authorizeExportAction({ module: "REPORTS_SALARY_SHEET", label: `Salary sheet ${sheetData.run.label} (CSV)`, rowCount: exportRows.length });
      if (!gate.allowed) {
        toast.error(gate.error ?? "Export not allowed");
        return;
      }
      const csv = rowsToCsv(
        ["SN", "Code", "EmployeeName", "Department", "BasicSalary", "GradeAmount", "OTAmount", "GrossEarnings", "AbsentDeduction", "PF", "SSF", "CIT", "TDS", "LoanDeduction", "TotalDeductions", "NetPayable", "BankName", "BankAccount"],
        exportRows.map((r, idx) => [
          idx + 1, r.employeeCode, r.employeeName, r.departmentName, r.basicSalary, r.gradeAmount, r.otAmount, r.grossEarnings,
          r.absentDeduction, r.pfEmployee, r.ssfEmployee, r.citDeduction, r.tdsThisMonth, r.loanDeduction, r.totalDeductions,
          r.netPayable, r.bankName, r.bankAccountNumberFull,
        ])
      );
      downloadTextFile(
        exportRows.length === 1
          ? `salary-sheet-${exportRows[0].employeeCode}.csv`
          : `salary-sheet-${sheetData.run.label.replace(/[^a-zA-Z0-9]/g, "-")}.csv`,
        csv
      );
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
    if (activeTab === "SALARY_SHEET") {
      printLandscape(50);
    } else {
      window.print();
    }
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
    <PageFrame size="wide" spacing="default" className="print:space-y-0">
      {/* Canonical Standard Page Header — screen only */}
      <div className="print:hidden">
        <PageHeader
          title="Salary Sheet Report"
          description="View earnings, dynamic allowances, deductions, and net payable breakdown for locked monthly payroll runs."
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Locked run data enforced</span>
            </span>
          </div>
        </PageHeader>
      </div>

      {/* Filter Bar — screen only */}
      <div className="print:hidden">
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
          hasData={Boolean(activeSheetData || headSummaryRows.length > 0)}
          meta={
            activeSheetData ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Period: {selectedRunLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Staff: {activeSheetData.summary.totalEmployees}
                </span>
              </div>
            ) : undefined
          }
        >
          {/* Sub-tab Switcher: Salary Sheet vs Pay Head Summary */}
          <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-100/70 p-0.5">
            <button
              type="button"
              onClick={() => handleTabChange("SALARY_SHEET")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all",
                activeTab === "SALARY_SHEET"
                  ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-500" />
              <span>Salary sheet</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("HEAD_SUMMARY")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all",
                activeTab === "HEAD_SUMMARY"
                  ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              <span>Pay head summary</span>
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
                    className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline text-xs inline-flex items-center gap-1"
                  >
                    Lock a payroll run in Review section
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
