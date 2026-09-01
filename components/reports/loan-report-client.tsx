"use client";

import { useState, useTransition, useMemo } from "react";
import type { LoanReportFilter, LoanReportData, LoanSummaryRow, ReportFilterLookupData, LoanReportStatus } from "@/lib/types/report";
import { LoanSummaryTable } from "./loan-summary-table";
import { LoanRepaymentTable } from "./loan-repayment-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportPreviewModal } from "./report-preview-modal";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
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
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"SUMMARY" | "REPAYMENTS">("SUMMARY");
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

  const [filter, setFilter] = useState<LoanReportFilter & { employeeId?: string }>({
    status: "ALL",
    loanTypeId: "",
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
      const res = await getLoanReportAction(filter);
      if (res.success && res.data) {
        setReportData(res.data);
        toast.success("Loan report loaded successfully.");
      } else {
        const msg = res.error || "Failed to load loan report.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    });
  };

  // Filter loan report data for single employee selection
  const activeReportData: LoanReportData | null = useMemo(() => {
    if (!reportData) return null;
    let filteredSummary = reportData.summaryRows;
    let filteredRepayments = reportData.repaymentRows;

    if (filter.employeeId) {
      const selectedEmp = initialLookups.employees.find((e) => e.id === filter.employeeId);
      if (selectedEmp) {
        filteredSummary = filteredSummary.filter(
          (r) => r.employeeCode === selectedEmp.employeeCode || r.employeeName === selectedEmp.name
        );
        filteredRepayments = filteredRepayments.filter(
          (r) => r.employeeCode === selectedEmp.employeeCode || r.employeeName === selectedEmp.name
        );
      }
    }

    if (filteredSummary.length === reportData.summaryRows.length && filteredRepayments.length === reportData.repaymentRows.length) {
      return reportData;
    }

    const totalDisbursed = filteredSummary.reduce((acc, r) => acc + Number(r.loanAmount), 0);
    const totalReturned = filteredSummary.reduce((acc, r) => acc + Number(r.totalReturned), 0);
    const totalRemaining = filteredSummary.reduce((acc, r) => acc + Number(r.remainingAmount), 0);

    return {
      ...reportData,
      summaryRows: filteredSummary,
      repaymentRows: filteredRepayments,
      totalLoansCount: filteredSummary.length,
      activeLoansCount: filteredSummary.filter((r) => r.status === "ACTIVE").length,
      totalDisbursedAmount: totalDisbursed.toFixed(2),
      totalReturnedAmount: totalReturned.toFixed(2),
      totalRemainingBalance: totalRemaining.toFixed(2),
    };
  }, [reportData, filter.employeeId, initialLookups.employees]);

  const handleExportCsv = (customRows?: LoanSummaryRow[]) => {
    startTransition(async () => {
      if (customRows) {
        let csv = "SN,Code,EmployeeName,Department,LoanType,DisbursedDate,DisbursedAmount,MonthlyInstallment,Tenure,TotalReturned,RemainingBalance,Status\n";
        customRows.forEach((r, idx) => {
          csv += `${idx + 1},"${r.employeeCode}","${r.employeeName}","${r.departmentName}","${r.loanTypeName}","${r.givenDate}",${r.loanAmount},${r.installmentAmount},${r.noOfInstallments},${r.totalReturned},${r.remainingAmount},"${r.status}"\n`;
        });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `loan-summary-${customRows[0].employeeCode}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Loan summary CSV exported successfully.");
        return;
      }

      let res;
      if (activeTab === "SUMMARY") {
        res = await exportLoanSummaryCsvAction(filter);
      } else {
        res = await exportLoanRepaymentsCsvAction(filter);
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
        toast.success("Loan report CSV exported successfully.");
      } else {
        toast.error(res?.error || "Failed to export CSV");
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

  const previewDisplayData: LoanReportData | null = useMemo(() => {
    if (singleEmployeeRow && reportData) {
      return {
        ...reportData,
        summaryRows: [singleEmployeeRow],
        repaymentRows: reportData.repaymentRows.filter((r) => r.employeeCode === singleEmployeeRow.employeeCode),
        totalLoansCount: 1,
        activeLoansCount: singleEmployeeRow.status === "ACTIVE" ? 1 : 0,
        totalDisbursedAmount: singleEmployeeRow.loanAmount,
        totalReturnedAmount: singleEmployeeRow.totalReturned,
        totalRemainingBalance: singleEmployeeRow.remainingAmount,
      };
    }
    return activeReportData;
  }, [singleEmployeeRow, reportData, activeReportData]);

  const [loanTab, setLoanTab] = useState<"DISBURSEMENTS" | "REPAYMENTS" | "SUMMARY">("DISBURSEMENTS");

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <ReportActionToolbar
        title="Staff Loan & Repayment Ledger Report"
        subtitle="Employee loan disbursement summaries, outstanding principal balances, and transaction recovery ledgers."
        onPrint={handlePrint}
        onExport={() => handleExportCsv()}
        onPreview={() => {
          setSingleEmployeeRow(null);
          setIsPreviewOpen(true);
        }}
        isExporting={isPending}
        hasData={!!activeReportData}
        badge="Loan Ledger"
        meta={
          activeReportData ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-[#d7e8d0]/60 px-2.5 py-0.5 text-xs font-semibold text-[#1b3a1f]">
                Total Loans: {activeReportData.totalLoansCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Active: {activeReportData.activeLoansCount}
              </span>
            </>
          ) : undefined
        }
      />

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
          setFilter((prev) => ({
            ...prev,
            loanTypeId: newFilters.loanTypeId || "",
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
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Total Loans Count</p>
                  <p className="text-lg font-bold text-[#1b3a1f]">
                    {activeReportData.totalLoansCount} <span className="text-xs font-medium text-gray-400">({activeReportData.activeLoansCount} active)</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2 text-green-600">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Total Disbursed Principal</p>
                  <p className="text-lg font-bold font-mono text-green-700">
                    NPR {Number(activeReportData.totalDisbursedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Total Recovered</p>
                  <p className="text-lg font-bold font-mono text-emerald-800">
                    NPR {Number(activeReportData.totalReturnedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-payroll-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500">Outstanding Principal</p>
                  <p className="text-lg font-bold font-mono text-rose-800">
                    NPR {Number(activeReportData.totalRemainingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tab Selector using Excel terminology */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6faf6] p-2 rounded-xl border border-[#d7e8d0]">
              <div className="inline-flex rounded-lg border border-[#d7e8d0] bg-white p-1 shadow-payroll-sm">
                <button
                  type="button"
                  onClick={() => setLoanTab("DISBURSEMENTS")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    loanTab === "DISBURSEMENTS" ? "bg-[#2e7d32] text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Loan Payment (Disbursements) ({activeReportData.summaryRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoanTab("REPAYMENTS")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    loanTab === "REPAYMENTS" ? "bg-emerald-600 text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Repayments Recovery ({activeReportData.repaymentRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoanTab("SUMMARY")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    loanTab === "SUMMARY" ? "bg-[#1b3a1f] text-white shadow-payroll-sm" : "text-gray-600 hover:text-[#1b3a1f]"
                  }`}
                >
                  Loan Statement (Summary) ({activeReportData.summaryRows.length})
                </button>
              </div>
            </div>

            {loanTab === "REPAYMENTS" ? (
              <LoanRepaymentTable rows={activeReportData.repaymentRows} />
            ) : (
              <LoanSummaryTable
                rows={activeReportData.summaryRows}
                onSingleEmployeeAction={handleSingleEmployeeAction}
              />
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
        title={singleEmployeeRow || filter.employeeId ? `Single Employee Loan Statement — ${singleEmployeeRow?.employeeName || activeReportData?.summaryRows[0]?.employeeName || "Employee"}` : isIndividualSlipsView ? "Staff Loan Statements (Individual A4 Pages)" : "Staff Loan & Repayment Statement"}
        subtitle={`Scope: ${singleEmployeeRow ? singleEmployeeRow.employeeCode : filter.status || "ALL"}`}
        onPrint={handlePrintSummary}
        onExport={() => handleExportCsv(singleEmployeeRow ? [singleEmployeeRow] : undefined)}
        isExporting={isPending}
        isSingleEmployee={singleEmployeeRow !== null || !!filter.employeeId || previewDisplayData?.summaryRows.length === 1}
        onPrintSummary={handlePrintSummary}
        onPrintIndividualSlips={activeTab === "SUMMARY" ? handlePrintIndividualSlips : undefined}
        metaDetails={[
          { label: "Scope", value: (singleEmployeeRow || filter.employeeId) ? `Single Employee` : isIndividualSlipsView ? "Individual Slips (Page-by-Page)" : filter.status || "ALL" },
          { label: "Total Disbursed", value: previewDisplayData ? `NPR ${Number(previewDisplayData.totalDisbursedAmount).toLocaleString()}` : "0" },
          { label: "Outstanding Balance", value: previewDisplayData ? `NPR ${Number(previewDisplayData.totalRemainingBalance).toLocaleString()}` : "0" },
        ]}
      >
        {previewDisplayData && (
          isIndividualSlipsView ? (
            <LoanIndividualSlips rows={previewDisplayData.summaryRows} periodLabel={filter.status || "ALL"} />
          ) : (
            <div className="space-y-6">
              {activeTab === "SUMMARY" ? (
                <LoanSummaryTable rows={previewDisplayData.summaryRows} />
              ) : (
                <LoanRepaymentTable rows={previewDisplayData.repaymentRows} />
              )}
            </div>
          )
        )}
      </ReportPreviewModal>
    </div>
  );
}
