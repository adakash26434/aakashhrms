"use client";

import { useState, useMemo } from "react";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { PayslipPrintable } from "./payslip-printable";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportDataTableShell } from "./report-data-table-shell";
import { ReportPreviewModal } from "./report-preview-modal";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import type { ReportFilterLookupData, PayslipPrintData } from "@/lib/types/report";
import { getPayslipReportAction } from "@/app/actions/report.actions";
import { AlertCircle, Printer, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface PayslipClientProps {
  lookupData: ReportFilterLookupData;
}

export function PayslipClient({ lookupData }: PayslipClientProps) {
  const [filterState, setFilterState] = useState<ReportFilterState>({
    payrollRunId: lookupData.lockedPayrollRuns[0]?.id || "",
  });
  const [payslips, setPayslips] = useState<PayslipPrintData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const toast = useToast();

  const fetchPayslips = async (filters: ReportFilterState) => {
    if (!filters.payrollRunId) {
      setError("Please select a locked payroll run.");
      toast.error("Please select a locked payroll run.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await getPayslipReportAction({
        payrollRunId: filters.payrollRunId,
      });

      if (!res.success || !res.data) {
        const msg = res.error || "Failed to load payslips.";
        setError(msg);
        toast.error(msg);
        setPayslips([]);
      } else {
        setPayslips(res.data);
        toast.success(`Loaded ${res.data.length} payslips successfully.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading payslips.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters: ReportFilterState) => {
    setFilterState(newFilters);
    fetchPayslips(newFilters);
  };

  // Single employee filter applied to active payslips
  const activePayslips = useMemo(() => {
    if (!filterState.employeeId) return payslips;
    const selectedEmp = lookupData.employees.find((e) => e.id === filterState.employeeId);
    if (!selectedEmp) return payslips;

    return payslips.filter(
      (p) =>
        p.slip.employeeCode === selectedEmp.employeeCode ||
        p.slip.employeeName === selectedEmp.name
    );
  }, [payslips, filterState.employeeId, lookupData.employees]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (activePayslips.length === 0) return;
    let csv =
      "EmployeeCode,EmployeeName,Department,BasicSalary,GradeAmount,GrossEarnings,TotalDeductions,NetPayable,BankAccount\n";
    activePayslips.forEach(({ slip }) => {
      csv += `"${slip.employeeCode}","${slip.employeeName}","${slip.departmentName}",${slip.basicSalary},${slip.gradeAmount},${slip.grossEarnings},${slip.totalDeductions},${slip.netPayable},"${slip.bankAccountNumber}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      activePayslips.length === 1
        ? `payslip-${activePayslips[0].slip.employeeCode}.csv`
        : `payslips-export-${filterState.payrollRunId}.csv`
    );
    link.click();
  };

  const selectedRunLabel =
    lookupData.lockedPayrollRuns.find((r) => r.id === filterState.payrollRunId)?.label ||
    "Selected Run";

  return (
    <PageFrame size="wide" spacing="default" className="print:space-y-0">
      {/* Canonical Standard Page Header — hidden during print */}
      <div className="print:hidden">
        <PageHeader
          title="Employee Payslips & Confidential Print"
          description="Generate and print official confidential salary slips for employee distribution."
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>A4 confidential format</span>
            </span>
          </div>
        </PageHeader>
      </div>

      {/* Filter Bar */}
      <div className="print:hidden">
        <ReportFilterBar
          lookupData={lookupData}
          showRunSelector={true}
          showBranchFilter={true}
          showDepartmentFilter={true}
          showDesignationFilter={true}
          showEmployeeFilter={true}
          showSearchFilter={true}
          onFilterChange={handleFilterChange}
          isLoading={isLoading}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3.5 text-xs font-medium text-rose-700 border border-rose-200 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Result Section */}
      <div>
        {/* Standard Action Toolbar — hidden during print */}
        <ReportActionToolbar
          onPrint={handlePrint}
          onExport={handleExportCsv}
          onPreview={() => setIsPreviewOpen(true)}
          hasData={activePayslips.length > 0}
          meta={
            activePayslips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Period: {selectedRunLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Slips count: {activePayslips.length}
                </span>
              </div>
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-zinc-100 text-zinc-700">
              <Printer className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-zinc-900">
              Printable salary slips
            </span>
          </div>
        </ReportActionToolbar>

        {/* Printable Payslips — occupies full print viewport from top */}
        <div className={isPreviewOpen ? "print:hidden" : "mt-4 print:mt-0"}>
          {activePayslips.length > 0 ? (
            <PayslipPrintable data={activePayslips} company={lookupData.company} />
          ) : (
            <ReportDataTableShell
              isEmpty={true}
              emptyTitle="No Payslips Loaded"
              emptyDescription="Select a locked payroll run and click &quot;Generate Report&quot; to view payslips."
            >
              <div />
            </ReportDataTableShell>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={
          activePayslips.length === 1
            ? `Confidential Payslip Preview — ${activePayslips[0].slip.employeeName}`
            : "Confidential Payslips Batch Preview"
        }
        subtitle={`Period: ${selectedRunLabel}`}
        onPrint={handlePrint}
        onExport={handleExportCsv}
        isSingleEmployee={activePayslips.length === 1}
        onPrintSummary={handlePrint}
        onPrintIndividualSlips={handlePrint}
        company={lookupData.company}
        metaDetails={[
          { label: "Payroll Run", value: selectedRunLabel },
          { label: "Total Slips", value: `${activePayslips.length} Employee(s)` },
        ]}
      >
        <PayslipPrintable data={activePayslips} company={lookupData.company} />
      </ReportPreviewModal>
    </PageFrame>
  );
}
