"use client";

import type { PayslipPrintData, CompanyReportInfo } from "@/lib/types/report";
import { maskAccountNumber } from "@/lib/engines/report.engine";
import { useWorkspaceContext } from "@/lib/contexts/workspace-context";
import { describeDetail } from "@/lib/engines/overtime.engine";

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
    <div className="space-y-8 print:space-y-0">
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
            className="relative w-full max-w-3xl mx-auto bg-white p-8 border border-zinc-200 shadow-none print:shadow-none print:border-none print:p-0 print:max-w-none print:page-break-after-always"
            style={{ pageBreakAfter: "always" }}
          >
            {/* Payslip Header Letterhead */}
            <div className="flex items-start justify-between border-b border-zinc-300 pb-5 mb-6">
              <div>
                {companyLegalName && (
                  <h1 className="text-lg font-bold text-zinc-950 tracking-tight mb-0.5">
                    {companyLegalName}
                  </h1>
                )}
                <p className="text-xs text-zinc-500 mt-0.5">
                  Payroll salary slip &mdash; Pay Period:{" "}
                  <span className="font-semibold text-zinc-900">{run.label}</span>
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-xs font-medium text-zinc-500">
                  Confidential
                </p>
                <p className="text-xs font-mono text-zinc-400">
                  #{slip.id ? slip.id.slice(0, 8) : "N/A"}
                </p>
                {activeCompany?.panVatNumber && (
                  <p className="text-2xs text-zinc-400 font-mono">
                    PAN: {activeCompany.panVatNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Employee Information Metadata: Clean 4-Column Flat Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-4 border-t border-b border-zinc-100 text-xs mb-6">
              <div>
                <span className="text-xs text-zinc-500 block">
                  Employee Name
                </span>
                <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                  {slip.employeeName}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Employee Code
                </span>
                <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">
                  {slip.employeeCode}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Department
                </span>
                <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                  {slip.departmentName}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Designation
                </span>
                <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                  {slip.designationName}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Bank Name
                </span>
                <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                  {slip.bankName || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Account Number
                </span>
                <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">
                  {maskAccountNumber(slip.bankAccountNumber)}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Pay Cycle
                </span>
                <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                  {run.label}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">
                  Status
                </span>
                <span className="text-sm font-medium text-emerald-800 block mt-0.5">
                  Verified / Locked
                </span>
              </div>
            </div>

            {/* Earnings vs Deductions Split Grid */}
            <div className="grid grid-cols-2 gap-12 text-xs mb-6 items-start">
              {/* Earnings Column */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                  Earnings & allowances
                </h3>
                <div className="space-y-0.5">
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">
                      Basic Salary
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(slip.basicSalary || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {Number(slip.gradeAmount || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">
                        Grade Amount
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.gradeAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.otAmount || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">
                        Overtime (OT)
                        {slip.otDetail && Math.abs(slip.otDetail.amount - Number(slip.otAmount)) < 0.005 && (
                          <span className="block text-2xs font-normal text-zinc-500">{describeDetail(slip.otDetail)}</span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.otAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}

                  {allowances.map((head) => (
                    <div
                      key={head.id}
                      className="flex justify-between py-2.5 border-b border-zinc-100"
                    >
                      <span className="text-zinc-600 font-medium">
                        {head.payHeadName}
                        {head.isManualOverride && (
                          <span className="text-2xs text-zinc-500 font-normal ml-1">
                            (Adjusted)
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(head.calculatedAmount || head.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-zinc-200 flex justify-between font-semibold text-zinc-900 text-xs">
                  <span>Gross earnings</span>
                  <span className="font-mono">
                    NPR{" "}
                    {Number(slip.grossEarnings || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Deductions Column */}
              <div className="border-l border-zinc-200/80 pl-12">
                <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                  Deductions
                </h3>
                <div className="space-y-0.5">
                  {Number(slip.pfEmployee || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">
                        Provident Fund (PF)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.pfEmployee).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.ssfEmployee || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <div>
                        <span className="text-zinc-600 font-medium">
                          Social Security Fund (SSF 31%)
                        </span>
                        <span className="block text-2xs text-zinc-400 font-normal">
                          EE 11% + ER 20%
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(Number(slip.ssfEmployee) + Number(slip.ssfEmployer || 0)).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.citDeduction || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">CIT</span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.citDeduction).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.tdsThisMonth || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">
                        TDS (Tax)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.tdsThisMonth).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.loanDeduction || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">
                        Loan Installment
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.loanDeduction).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {Number(slip.absentDeduction || 0) > 0 && (
                    <div className="flex justify-between py-2.5 border-b border-zinc-100">
                      <span className="text-zinc-600 font-medium">
                        Absent Deduction
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(slip.absentDeduction).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}

                  {otherDeductions.map((head) => (
                    <div
                      key={head.id}
                      className="flex justify-between py-2.5 border-b border-zinc-100"
                    >
                      <span className="text-zinc-600 font-medium">
                        {head.payHeadName}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        NPR {Number(head.calculatedAmount || head.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-zinc-200 flex justify-between font-semibold text-zinc-900 text-xs">
                  <span>Total deductions</span>
                  <span className="font-mono">
                    NPR{" "}
                    {Number(slip.totalDeductions || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Payable Minimal Summary Callout */}
            <div className="py-6 my-6 border-t border-b border-zinc-300 text-center space-y-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium block">
                Net Payable Amount
              </span>
              <span className="text-3xl font-bold tracking-tight text-emerald-950 font-mono block">
                NPR{" "}
                {Number(slip.netPayable || 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-2xs text-zinc-400 font-normal block">
                Disbursement to {slip.bankName || "Bank Account"} ({maskAccountNumber(slip.bankAccountNumber)})
              </span>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-dashed border-zinc-300">
              <div className="text-center">
                <div className="border-b border-zinc-300 w-3/4 mx-auto mb-1 h-6"></div>
                <span className="text-2xs font-medium text-zinc-600">
                  Prepared By (Payroll Controller)
                </span>
              </div>
              <div className="text-center">
                <div className="border-b border-zinc-300 w-3/4 mx-auto mb-1 h-6"></div>
                <span className="text-2xs font-medium text-zinc-600">
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
