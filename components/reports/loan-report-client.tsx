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
          let csv =
            "SN,Code,EmployeeName,Department,LoanType,LoanAmount,Installment,TotalReturned,Remaining,Status\n";
          csv += `1,"${row.employeeCode}","${row.employeeName}","${row.departmentName}","${row.loanTypeName}",${row.loanAmount},${row.installmentAmount},${row.totalReturned},${row.remainingAmount},"${row.status}"\n`;

          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `loan-statement-${row.employeeCode}.csv`);
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
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
    <PageFrame size="wide" spacing="default">
      {/* Canonical Standard Page Header */}
      <PageHeader
        title="Loan & Repayment Statements"
        description="Employee loan disbursement summaries, outstanding principal balances, and transaction recovery ledgers."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-3 py-1 text-xs font-bold text-payroll-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Staff Credit Recovery</span>
          </span>
        </div>
      </PageHeader>

      {/* Filter Bar with Loan Type and Designation Enabled */}
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
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Total Loans Count</p>
                <p className="text-lg font-bold text-payroll-navy">
                  {activeReportData.totalLoansCount}{" "}
                  <span className="text-xs font-medium text-gray-400">
                    ({activeReportData.activeLoansCount} active)
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-2.5 text-green-700">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Total Disbursed Principal</p>
                <p className="text-lg font-bold font-mono text-green-700">
                  NPR{" "}
                  {Number(activeReportData.totalDisbursedAmount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Total Recovered</p>
                <p className="text-lg font-bold font-mono text-emerald-800">
                  NPR{" "}
                  {Number(activeReportData.totalReturnedAmount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-payroll-light/80 bg-white p-4 shadow-payroll-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500">Outstanding Principal</p>
                <p className="text-lg font-bold font-mono text-rose-800">
                  NPR{" "}
                  {Number(activeReportData.totalRemainingBalance).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
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
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  Total Loans: {activeReportData.totalLoansCount}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Active: {activeReportData.activeLoansCount}
                </span>
              </div>
            }
          >
            {/* Sub-Tab Selector */}
            <div className="inline-flex rounded-xl border border-payroll-light bg-payroll-cream p-1 shadow-payroll-xs">
              <button
                type="button"
                onClick={() => setLoanTab("DISBURSEMENTS")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  loanTab === "DISBURSEMENTS"
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Disbursements ({activeReportData.summaryRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLoanTab("REPAYMENTS")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  loanTab === "REPAYMENTS"
                    ? "bg-emerald-600 text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Repayments ({activeReportData.repaymentRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLoanTab("SUMMARY")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  loanTab === "SUMMARY"
                    ? "bg-payroll-navy text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy"
                )}
              >
                Summary Ledger ({activeReportData.summaryRows.length})
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
