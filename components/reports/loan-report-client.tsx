"use client";

import { useState, useTransition, useMemo } from "react";
import type {
  LoanReportFilter,
  LoanReportData,
  LoanSummaryRow,
  ReportFilterLookupData,
} from "@/lib/types/report";
import { LoanSummaryTable } from "./loan-summary-table";
import { LoanRepaymentTable } from "./loan-repayment-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportDataTableShell } from "./report-data-table-shell";
import { ReportPreviewModal } from "./report-preview-modal";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import {
  getLoanReportAction,
  exportLoanSummaryCsvAction,
  exportLoanRepaymentsCsvAction,
} from "@/app/actions/report.actions";
import { useToast } from "@/components/ui/toast";
import {
  CreditCard,
  Banknote,
  DollarSign,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoanIndividualSlips } from "./individual-report-slips";
import { authorizeExportAction } from "@/app/actions/export.actions";
import { rowsToCsv } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";

interface LoanReportClientProps {
  initialLookups: ReportFilterLookupData;
  initialReportData: LoanReportData | null;
  initialError?: string | null;
}

export function LoanReportClient({
  initialLookups,
  initialReportData,
  initialError,
}: LoanReportClientProps) {
  const [reportData, setReportData] = useState<LoanReportData | null>(initialReportData);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [loanTab, setLoanTab] = useState<"DISBURSEMENTS" | "REPAYMENTS" | "SUMMARY">(
    "DISBURSEMENTS"
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [singleEmployeeRow, setSingleEmployeeRow] = useState<LoanSummaryRow | null>(null);
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

  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [filter, setFilter] = useState<LoanReportFilter>({
    status: "ALL",
    branchId: "",
    departmentId: "",
    loanTypeId: "",
    employeeSearch: "",
  });

  const handleApplyFilter = (currentFilter: LoanReportFilter = filter) => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await getLoanReportAction(currentFilter);
      if (res.success && res.data) {
        setReportData(res.data);
        toast.success("Loan report refreshed.");
      } else {
        const msg = res.error || "Failed to load loan report.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    });
  };

  const handleExportCsv = async (rowsToExport?: LoanSummaryRow[]) => {
    startTransition(async () => {
      if (loanTab === "REPAYMENTS") {
        const res = await exportLoanRepaymentsCsvAction(filter);
        if (res.success && res.data) {
          const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", res.filename || "loan-repayments.csv");
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Loan repayments exported successfully.");
        } else {
          toast.error(res.error || "Failed to export CSV.");
        }
      } else {
        if (rowsToExport && rowsToExport.length === 1) {
          const row = rowsToExport[0];
          const gate = await authorizeExportAction({ module: "REPORTS_LOAN", label: `Loan statement ${row.employeeCode} (CSV)`, rowCount: 1 });
          if (!gate.allowed) {
            toast.error(gate.error ?? "Export not allowed");
            return;
          }
          downloadTextFile(
            `loan-statement-${row.employeeCode}.csv`,
            rowsToCsv(
              ["SN", "Code", "EmployeeName", "Department", "LoanType", "LoanAmount", "Installment", "TotalReturned", "Remaining", "Status"],
              [[1, row.employeeCode, row.employeeName, row.departmentName, row.loanTypeName, row.loanAmount, row.installmentAmount, row.totalReturned, row.remainingAmount, row.status]]
            )
          );
          toast.success("Single employee loan CSV exported.");
          return;
        }

        const res = await exportLoanSummaryCsvAction(filter);
        if (res.success && res.data) {
          const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", res.filename || "loan-summary-report.csv");
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Loan summary exported successfully.");
        } else {
          toast.error(res.error || "Failed to export CSV.");
        }
      }
    });
  };

  const handleSingleEmployeeAction = (
    row: LoanSummaryRow,
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
  const activeReportData: LoanReportData | null = useMemo(() => {
    if (!reportData) return null;
    let sRows = reportData.summaryRows;
    let rRows = reportData.repaymentRows;

    if (selectedEmployeeId) {
      const selectedEmp = initialLookups.employees?.find((e) => e.id === selectedEmployeeId);
      if (selectedEmp) {
        sRows = sRows.filter(
          (r) =>
            r.employeeCode.toLowerCase() === selectedEmp.employeeCode.toLowerCase() ||
            r.employeeName.toLowerCase() === selectedEmp.name.toLowerCase()
        );
        rRows = rRows.filter(
          (r) =>
            r.employeeCode.toLowerCase() === selectedEmp.employeeCode.toLowerCase() ||
            r.employeeName.toLowerCase() === selectedEmp.name.toLowerCase()
        );
      }
    }

    const totalDisbursed = sRows.reduce((acc, r) => acc + Number(r.loanAmount), 0);
    const totalReturned = sRows.reduce((acc, r) => acc + Number(r.totalReturned), 0);
    const totalRemaining = sRows.reduce((acc, r) => acc + Number(r.remainingAmount), 0);

    return {
      ...reportData,
      summaryRows: sRows,
      repaymentRows: rRows,
      totalLoansCount: sRows.length,
      activeLoansCount: sRows.filter((r) => r.status === "ACTIVE").length,
      totalDisbursedAmount: totalDisbursed.toString(),
      totalReturnedAmount: totalReturned.toString(),
      totalRemainingBalance: totalRemaining.toString(),
    };
  }, [reportData, selectedEmployeeId, initialLookups.employees]);

  const previewDisplayData: LoanReportData | null = useMemo(() => {
    if (singleEmployeeRow && reportData) {
      return {
        ...reportData,
        summaryRows: [singleEmployeeRow],
        repaymentRows: reportData.repaymentRows.filter(
          (r) => r.employeeCode === singleEmployeeRow.employeeCode
        ),
        totalLoansCount: 1,
        activeLoansCount: singleEmployeeRow.status === "ACTIVE" ? 1 : 0,
        totalDisbursedAmount: singleEmployeeRow.loanAmount,
        totalReturnedAmount: singleEmployeeRow.totalReturned,
        totalRemainingBalance: singleEmployeeRow.remainingAmount,
      };
    }
    return activeReportData;
  }, [singleEmployeeRow, reportData, activeReportData]);

  return (
    <PageFrame size="wide" spacing="default" className="print:space-y-0">
      {/* Canonical Standard Page Header — screen only */}
      <div className="print:hidden">
        <PageHeader
          title="Loan & Repayment Statements"
          description="Employee loan disbursement summaries, outstanding principal balances, and transaction recovery ledgers."
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Staff credit recovery</span>
            </span>
          </div>
        </PageHeader>
      </div>

      {/* Filter Bar — screen only */}
      <div className="print:hidden">
        <ReportFilterBar
          lookupData={initialLookups}
          showBranchFilter={true}
          showDepartmentFilter={true}
          showDesignationFilter={true}
          showLoanTypeFilter={true}
          showEmployeeFilter={true}
          showSearchFilter={true}
          onFilterChange={(newFilters: ReportFilterState) => {
            const nextFilter: LoanReportFilter = {
              status: "ALL",
              branchId: newFilters.branchId || "",
              departmentId: newFilters.departmentId || "",
              loanTypeId: newFilters.loanTypeId || "",
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
          {/* Total Loans Count */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Total loans count</p>
                <CreditCard className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {activeReportData.totalLoansCount}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              {activeReportData.activeLoansCount} active facilities
            </div>
          </div>

          {/* Total Disbursed Principal */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Total disbursed principal</p>
                <Banknote className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  NPR {Number(activeReportData.totalDisbursedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Cumulative disbursed across scope
            </div>
          </div>

          {/* Total Recovered */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Total recovered</p>
                <DollarSign className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  NPR {Number(activeReportData.totalReturnedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Reimbursed to date
            </div>
          </div>

          {/* Outstanding Balance */}
          <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">Outstanding balance</p>
                <TrendingDown className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  NPR {Number(activeReportData.totalRemainingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              Principal recovery pending
            </div>
          </div>
        </div>
      )}

      {/* Report Data Body */}
      {activeReportData && (
        <div className={isPreviewOpen ? "print:hidden space-y-4" : "space-y-4"}>
          {/* Top Action Toolbar with Sub-Tabs */}
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
                  Total loans: {activeReportData.totalLoansCount}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Active: {activeReportData.activeLoansCount}
                </span>
              </div>
            }
          >
            {/* Sub-Tab Selector */}
            <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-100/70 p-0.5">
              <button
                type="button"
                onClick={() => setLoanTab("DISBURSEMENTS")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  loanTab === "DISBURSEMENTS"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Disbursements ({activeReportData.summaryRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLoanTab("REPAYMENTS")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  loanTab === "REPAYMENTS"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Repayments ({activeReportData.repaymentRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLoanTab("SUMMARY")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-all",
                  loanTab === "SUMMARY"
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Summary ledger ({activeReportData.summaryRows.length})
              </button>
            </div>
          </ReportActionToolbar>

          {/* Tables inside Report Shell */}
          <ReportDataTableShell>
            {loanTab === "REPAYMENTS" ? (
              <LoanRepaymentTable rows={activeReportData.repaymentRows} />
            ) : (
              <LoanSummaryTable
                rows={activeReportData.summaryRows}
                onSingleEmployeeAction={handleSingleEmployeeAction}
              />
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
            ? `Single Employee Loan Statement — ${
                singleEmployeeRow?.employeeName ||
                activeReportData?.summaryRows[0]?.employeeName ||
                "Employee"
              }`
            : isIndividualSlipsView
            ? "Staff Loan Statements (Individual A4 Pages)"
            : "Staff Loan & Repayment Statement"
        }
        subtitle={`Scope: ${
          singleEmployeeRow ? singleEmployeeRow.employeeCode : filter.status || "ALL"
        }`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isPending}
        isSingleEmployee={
          singleEmployeeRow !== null ||
          Boolean(selectedEmployeeId) ||
          previewDisplayData?.summaryRows.length === 1
        }
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={loanTab === "SUMMARY" ? handlePrintIndividualSlips : undefined}
        company={initialLookups.company}
        metaDetails={[
          {
            label: "Scope",
            value:
              singleEmployeeRow || selectedEmployeeId
                ? "Single Employee"
                : isIndividualSlipsView
                ? "Individual Slips (Page-by-Page)"
                : filter.status || "ALL",
          },
          {
            label: "Total Disbursed",
            value: previewDisplayData
              ? `NPR ${Number(previewDisplayData.totalDisbursedAmount).toLocaleString()}`
              : "0",
          },
          {
            label: "Outstanding Balance",
            value: previewDisplayData
              ? `NPR ${Number(previewDisplayData.totalRemainingBalance).toLocaleString()}`
              : "0",
          },
        ]}
      >
        {previewDisplayData &&
          (isIndividualSlipsView ? (
            <LoanIndividualSlips
              rows={previewDisplayData.summaryRows}
              periodLabel={filter.status || "ALL"}
            />
          ) : (
            <div className="space-y-6">
              {loanTab === "REPAYMENTS" ? (
                <LoanRepaymentTable rows={previewDisplayData.repaymentRows} />
              ) : (
                <LoanSummaryTable rows={previewDisplayData.summaryRows} />
              )}
            </div>
          ))}
      </ReportPreviewModal>
    </PageFrame>
  );
}
