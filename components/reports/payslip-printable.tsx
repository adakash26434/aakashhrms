"use client";

import type { PayslipPrintData, CompanyReportInfo } from "@/lib/types/report";
import { maskAccountNumber } from "@/lib/engines/report.engine";
import { useWorkspaceContext } from "@/lib/contexts/workspace-context";

interface PayslipPrintableProps {
  data: PayslipPrintData[];
  company?: CompanyReportInfo;
}

export function PayslipPrintable({ data, company }: PayslipPrintableProps) {
  const workspaceCtx = useWorkspaceContext();
  const activeCompany = company || workspaceCtx?.company;
  const companyLegalName =
    activeCompany?.legalName ||
    activeCompany?.displayName ||
    activeCompany?.name;
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-gray-500">
        No payslip data to display.
      </div>
    );
  }

  return (
    <div className="print-portrait space-y-8 print:space-y-0">
      {data.map((item, index) => {
        const { slip, heads, run } = item;
        const allowances = heads.filter((h) => h.headType === "allowance");
        const isStatutoryDed = (name: string) => {
          const lower = (name || "").toLowerCase();
          return (
            lower.includes("provident fund") ||
            lower.includes("epf") ||
            lower.includes("ssf") ||
            lower.includes("social security") ||
            lower.includes("citizen investment") ||
            lower.includes("cit")
          );
        };
        const otherDeductions = heads.filter(
          (h) => h.headType === "deduction" && !isStatutoryDed(h.payHeadName)
        );

        return (
          <div
            key={slip.id || index}
            className="relative overflow-hidden w-full max-w-3xl mx-auto rounded-xl border border-payroll-light bg-white p-6 shadow-payroll-sm print:shadow-none print:border-black print:p-4 print:page-break-after-always"
            style={{ pageBreakAfter: "always" }}
          >
            {/* Light Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] select-none print:opacity-[0.04]">
              <span className="text-7xl font-black uppercase text-payroll-navy rotate-[-30deg]">
                CONFIDENTIAL
              </span>
            </div>
            {/* Payslip Header */}
            <div className="flex items-start justify-between border-b-2 border-payroll-navy pb-4 mb-4">
              <div>
                {companyLegalName && (
                  <h1 className="text-base font-black text-payroll-navy uppercase tracking-wider mb-0.5">
                    {companyLegalName}
                  </h1>
                )}
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  PAYROLL SALARY SLIP
                </h2>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">
                  Period:{" "}
                  <span className="text-payroll-navy font-bold">{run.label}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-payroll-navy uppercase">
                  CONFIDENTIAL
                </p>
                <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                  Slip ID: #{slip.id ? slip.id.slice(0, 8) : "N/A"}
                </p>
                {activeCompany?.panVatNumber && (
                  <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                    PAN: {activeCompany.panVatNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Employee Particulars Grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-payroll-cream border border-payroll-light p-3 text-xs mb-4 print:bg-white print:border-gray-300">
              <div>
                <span className="text-gray-400 font-medium uppercase text-[10px] block">
                  Employee Name
                </span>
                <span className="font-bold text-payroll-navy text-sm">
                  {slip.employeeName}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium uppercase text-[10px] block">
                  Employee Code
                </span>
                <span className="font-bold text-payroll-navy font-mono">
                  {slip.employeeCode}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium uppercase text-[10px] block">
                  Department
                </span>
                <span className="font-semibold text-payroll-navy">
                  {slip.departmentName}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium uppercase text-[10px] block">
                  Designation
                </span>
                <span className="font-semibold text-payroll-navy">
                  {slip.designationName}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium uppercase text-[10px] block">
                  Bank Name
                </span>
                <span className="font-semibold text-payroll-navy">
                  {slip.bankName || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium uppercase text-[10px] block">
                  Account Number
                </span>
                <span className="font-semibold text-payroll-navy font-mono">
                  {maskAccountNumber(slip.bankAccountNumber)}
                </span>
              </div>
            </div>

            {/* Earnings vs Deductions Table Grid */}
            <div className="grid grid-cols-2 gap-4 border border-payroll-light rounded-lg overflow-hidden text-xs mb-4">
              {/* Earnings Column */}
              <div className="border-r border-payroll-light">
                <div className="bg-emerald-50 px-3 py-1.5 border-b border-payroll-light font-bold text-emerald-800 uppercase tracking-wider text-[11px]">
                  Earnings & Allowances
                </div>
                <div className="p-3 space-y-1.5 min-h-35">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">
                      Basic Salary
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-payroll-navy">
                      {Number(slip.basicSalary || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {Number(slip.gradeAmount || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Grade Amount
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-payroll-navy">
                        {Number(slip.gradeAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.otAmount || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Overtime (OT)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-payroll-navy">
                        {Number(slip.otAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}

                  {allowances.map((head) => (
                    <div
                      key={head.id}
                      className="flex justify-between py-1 border-b border-gray-100"
                    >
                      <span className="text-gray-600 font-medium">
                        {head.payHeadName}
                        {head.isManualOverride && (
                          <span className="text-[9px] text-amber-600 font-bold ml-1">
                            (Adjusted)
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-payroll-navy">
                        {Number(head.calculatedAmount || head.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-payroll-cream px-3 py-2 border-t border-payroll-light flex justify-between font-bold text-emerald-800 text-xs">
                  <span>GROSS EARNINGS</span>
                  <span className="font-mono">
                    NPR{" "}
                    {Number(slip.grossEarnings || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Deductions Column */}
              <div>
                <div className="bg-red-50 px-3 py-1.5 border-b border-payroll-light font-bold text-red-800 uppercase tracking-wider text-[11px]">
                  Deductions
                </div>
                <div className="p-3 space-y-1.5 min-h-35">
                  {Number(slip.pfEmployee || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Provident Fund (PF)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(slip.pfEmployee).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.ssfEmployee || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <div>
                        <span className="text-gray-600 font-medium">
                          Social Security Fund (SSF 31%)
                        </span>
                        <span className="block text-[9px] text-gray-400">
                          EE 11% ({Number(slip.ssfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 })}) + ER 20% ({Number(slip.ssfEmployer || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(Number(slip.ssfEmployee) + Number(slip.ssfEmployer || 0)).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.citDeduction || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">CIT</span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(slip.citDeduction).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.tdsThisMonth || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        TDS (Tax)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(slip.tdsThisMonth).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.loanDeduction || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Loan Installment
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(slip.loanDeduction).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.absentDeduction || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Absent Deduction
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(slip.absentDeduction).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}

                  {otherDeductions.map((head) => (
                    <div
                      key={head.id}
                      className="flex justify-between py-1 border-b border-gray-100"
                    >
                      <span className="text-gray-600 font-medium">
                        {head.payHeadName}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {Number(head.calculatedAmount || head.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-payroll-cream px-3 py-2 border-t border-payroll-light flex justify-between font-bold text-red-800 text-xs">
                  <span>TOTAL DEDUCTIONS</span>
                  <span className="font-mono">
                    NPR{" "}
                    {Number(slip.totalDeductions || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Payable Banner */}
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-center mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                NET PAYABLE (IN WORDS / FIGURE)
              </span>
              <span className="text-xl font-black text-emerald-900 font-mono mt-0.5 block">
                NPR{" "}
                {Number(slip.netPayable || 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-dashed border-payroll-light">
              <div className="text-center">
                <div className="border-b border-gray-400 w-3/4 mx-auto mb-1 h-6"></div>
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Prepared By (Payroll Controller)
                </span>
              </div>
              <div className="text-center">
                <div className="border-b border-gray-400 w-3/4 mx-auto mb-1 h-6"></div>
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Authorized Signatory (HR / Management)
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
