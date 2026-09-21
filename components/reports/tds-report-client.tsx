"use client";

import { useState, useMemo } from "react";
import { ReportFilterBar, type ReportFilterState } from "./report-filter-bar";
import { TDSReportTable } from "./tds-report-table";
import { ReportActionToolbar } from "./report-action-toolbar";
import { ReportDataTableShell } from "./report-data-table-shell";
import { ReportPreviewModal } from "./report-preview-modal";
import { TDSIndividualSlips } from "./individual-report-slips";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import type { ReportFilterLookupData, TDSReportData, TDSReportRow } from "@/lib/types/report";
import { getTDSReportAction } from "@/app/actions/report.actions";
import { AlertCircle, Receipt, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface TDSReportClientProps {
  lookupData: ReportFilterLookupData;
}

export function TDSReportClient({ lookupData }: TDSReportClientProps) {
  const [filterState, setFilterState] = useState<ReportFilterState>({
    fiscalYearId: lookupData.fiscalYears[0]?.id || "",
    reportType: "MONTHLY",
    bsMonth: 8, // Mangsir
  });
  const [reportData, setReportData] = useState<TDSReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [singleEmployeeRow, setSingleEmployeeRow] = useState<TDSReportRow | null>(null);
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

  const fetchReport = async (filters: ReportFilterState) => {
    if (!filters.fiscalYearId) {
      setError("Please select a Fiscal Year.");
      toast.error("Please select a Fiscal Year.");
      return;
    }
    if (filters.reportType === "MONTHLY" && !filters.bsMonth) {
      setError("Please select a BS Month for monthly TDS report.");
      toast.error("Please select a BS Month for monthly TDS report.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await getTDSReportAction({
        fiscalYearId: filters.fiscalYearId,
        reportType: filters.reportType || "MONTHLY",
        bsMonth: filters.reportType === "MONTHLY" ? filters.bsMonth : undefined,
      });

      if (!res.success || !res.data) {
        const msg = res.error || "Failed to load TDS report.";
        setError(msg);
        toast.error(msg);
        setReportData(null);
      } else {
        setReportData(res.data);
        toast.success("TDS IRD report loaded successfully.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading TDS report.";
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
  const activeReportData: TDSReportData | null = useMemo(() => {
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

    const totalGross = filteredRows.reduce((acc, r) => acc + Number(r.grossIncome), 0);
    const totalTds = filteredRows.reduce((acc, r) => acc + Number(r.tdsDeducted), 0);

    return {
      ...reportData,
      rows: filteredRows,
      totalGrossIncome: totalGross.toFixed(2),
      totalTds: totalTds.toFixed(2),
      employeesWithoutPAN: filteredRows.filter((r) => !r.panNumber).length,
    };
  }, [reportData, filterState.employeeId, lookupData.employees]);

  const handleExportCsv = async (rowsToExport?: TDSReportRow[]) => {
    if (!filterState.fiscalYearId || !reportData) return;
    setIsExporting(true);
    try {
      const exportRows = rowsToExport || activeReportData?.rows || reportData.rows;
      let csv =
        "SN,Code,EmployeeName,PANNumber,TaxStatus,Period,GrossIncome,PFDeducted,CITDeducted,TaxableIncome,TDSDeducted\n";
      exportRows.forEach((r, idx) => {
        csv += `${idx + 1},"${r.employeeCode}","${r.employeeName}","${
          r.panNumber || "N/A"
        }","${r.taxStatus}","${r.period}",${r.grossIncome},${r.pfDeducted},${
          r.citDeducted
        },${r.taxableIncome},${r.tdsDeducted}\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        exportRows.length === 1
          ? `tds-ird-${exportRows[0].employeeCode}.csv`
          : `tds-ird-report-${reportData.period.replace(/[^a-zA-Z0-9]/g, "-")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("TDS IRD CSV exported successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export CSV";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSingleEmployeeAction = (
    row: TDSReportRow,
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

  const previewDisplayData: TDSReportData | null = useMemo(() => {
    if (singleEmployeeRow && reportData) {
      return {
        ...reportData,
        rows: [singleEmployeeRow],
        totalGrossIncome: singleEmployeeRow.grossIncome,
        totalTds: singleEmployeeRow.tdsDeducted,
        employeesWithoutPAN: singleEmployeeRow.panNumber ? 0 : 1,
      };
    }
    return activeReportData;
  }, [singleEmployeeRow, reportData, activeReportData]);

  return (
    <PageFrame size="wide" spacing="default">
      {/* Canonical Standard Page Header */}
      <PageHeader
        title="TDS / IRD Tax Report"
        description="Inspect statutory tax deductions, PAN validations, and generate Inland Revenue Department (IRD) ETDS filing statements."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-3 py-1 text-xs font-bold text-payroll-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>IRD Compliance Slabs</span>
          </span>
        </div>
      </PageHeader>

      {/* Filter Bar */}
      <ReportFilterBar
        lookupData={lookupData}
        showFYSelector={true}
        showMonthSelector={true}
        showReportTypeToggle={true}
        showBranchFilter={false}
        showDepartmentFilter={false}
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
                  FY: {fyLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-payroll-light bg-payroll-cream px-2.5 py-0.5 text-xs font-semibold text-payroll-navy">
                  Period: {reportData?.period || "N/A"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Total Tax: NPR {Number(activeReportData.totalTds).toLocaleString()}
                </span>
              </div>
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-payroll-primary/10 text-payroll-primary">
              <Receipt className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
              ETDS Statements
            </span>
          </div>
        </ReportActionToolbar>

        {/* Report Table inside Shell */}
        <div className={isPreviewOpen ? "print:hidden" : ""}>
          {activeReportData ? (
            <TDSReportTable
              data={activeReportData}
              onExportCsv={() => handleExportCsv()}
              isExporting={isExporting}
              onSingleEmployeeAction={handleSingleEmployeeAction}
            />
          ) : (
            <ReportDataTableShell
              isEmpty={true}
              emptyTitle="No TDS Records Loaded"
              emptyDescription="Select Fiscal Year and view parameters from the filter bar above and click &quot;Generate Report&quot;."
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
            ? `Single Employee TDS Tax Statement — ${
                singleEmployeeRow?.employeeName ||
                activeReportData?.rows[0]?.employeeName ||
                "Employee"
              }`
            : isIndividualSlipsView
            ? "e-TDS Tax Certificates (Individual A4 Pages)"
            : "TDS / IRD Tax Statement (ETDS)"
        }
        subtitle={`Period: ${reportData?.period || ""} (${fyLabel})`}
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
          { label: "Type", value: filterState.reportType || "MONTHLY" },
          {
            label: "Scope",
            value:
              singleEmployeeRow || filterState.employeeId
                ? "Single Employee"
                : isIndividualSlipsView
                ? "Individual Slips (Page-by-Page)"
                : "All Selected Employees",
          },
          {
            label: "Total Tax Deducted",
            value: previewDisplayData
              ? `NPR ${Number(previewDisplayData.totalTds).toLocaleString()}`
              : "0",
          },
        ]}
      >
        {previewDisplayData &&
          (isIndividualSlipsView ? (
            <TDSIndividualSlips
              rows={previewDisplayData.rows}
              periodLabel={`${reportData?.period || ""} (${fyLabel})`}
            />
          ) : (
            <TDSReportTable data={previewDisplayData} />
          ))}
      </ReportPreviewModal>
    </PageFrame>
  );
}
