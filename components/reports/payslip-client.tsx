"use client";

import { useState, useMemo } from "react";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { PayslipPrintable } from "./payslip-printable";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportPreviewModal } from "./report-preview-modal";
import type { ReportFilterLookupData, PayslipPrintData } from "@/lib/types/report";
import { getPayslipReportAction } from "@/app/actions/report.actions";
import { AlertCircle } from "lucide-react";
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
      (p) => p.slip.employeeCode === selectedEmp.employeeCode || p.slip.employeeName === selectedEmp.name
    );
  }, [payslips, filterState.employeeId, lookupData.employees]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (activePayslips.length === 0) return;
    let csv = "EmployeeCode,EmployeeName,Department,BasicSalary,GradeAmount,GrossEarnings,TotalDeductions,NetPayable,BankAccount\n";
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

  const selectedRunLabel = lookupData.lockedPayrollRuns.find(r => r.id === filterState.payrollRunId)?.label || "Selected Run";

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <ReportActionToolbar
        title="Employee Payslips & Confidential Print"
        subtitle="Generate and print official confidential salary slips for employee distribution."
        onPrint={handlePrint}
        onExport={handleExportCsv}
        onPreview={() => setIsPreviewOpen(true)}
        hasData={activePayslips.length > 0}
        badge="A4 Confidential"
        meta={
          activePayslips.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-[#d7e8d0]/60 px-2.5 py-0.5 text-xs font-semibold text-[#1b3a1f]">
                Period: {selectedRunLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-[#d7e8d0]/60 px-2.5 py-0.5 text-xs font-semibold text-[#1b3a1f]">
                Slips Count: {activePayslips.length}
              </span>
            </>
          ) : undefined
        }
      />

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
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Printable Payslips Container */}
      <div className={isPreviewOpen ? "print:hidden" : ""}>
        {activePayslips.length > 0 ? (
          <PayslipPrintable data={activePayslips} />
        ) : (
          <div className="rounded-xl border border-dashed border-[#d7e8d0] bg-[#f6faf6] p-10 text-center text-xs text-gray-500 print:hidden">
            Select a locked payroll run and click "Generate Report" to view payslips.
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={activePayslips.length === 1 ? `Confidential Payslip Preview — ${activePayslips[0].slip.employeeName}` : "Confidential Payslips Batch Preview"}
        subtitle={`Period: ${selectedRunLabel}`}
        onPrint={handlePrint}
        onExport={handleExportCsv}
        isSingleEmployee={activePayslips.length === 1}
        onPrintSummary={handlePrint}
        onPrintIndividualSlips={handlePrint}
        metaDetails={[
          { label: "Payroll Run", value: selectedRunLabel },
          { label: "Total Slips", value: `${activePayslips.length} Employee(s)` },
        ]}
      >
        <PayslipPrintable data={activePayslips} />
      </ReportPreviewModal>
    </div>
  );
}
