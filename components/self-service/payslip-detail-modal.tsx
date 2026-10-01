"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyPayslipDetailAction } from "@/app/actions/self-service.actions";

interface PayslipDetailModalProps {
  payslipId: string | null;
  onClose: () => void;
}

interface PayslipHeadItem {
  id: string;
  headName?: string;
  payHeadName?: string;
  headType?: string;
  amount: string | number;
  calculatedAmount?: string | number;
}

interface PayslipDetailData {
  slip: {
    id: string;
    employeeName: string;
    employeeCode: string;
    departmentName?: string;
    designationName?: string;
    bankName?: string;
    bankAccountNumber?: string;
    payslipMonth?: number;
    payPeriodYear?: number;
    status?: string;
    basicSalary: string | number;
    gradeAmount?: string | number;
    otAmount?: string | number;
    grossEarnings: string | number;
    totalDeductions: string | number;
    ssfEmployee?: string | number;
    ssfEmployer?: string | number;
    pfEmployee?: string | number;
    citDeduction?: string | number;
    tdsThisMonth?: string | number;
    loanDeduction?: string | number;
    netPayable: string | number;
  };
  heads: PayslipHeadItem[];
}

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashar", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export function PayslipDetailModal({
  payslipId,
  onClose,
}: PayslipDetailModalProps) {
  const [data, setData] = useState<PayslipDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payslipId) return;

    let isMounted = true;
    getMyPayslipDetailAction(payslipId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setData(res.data as unknown as PayslipDetailData);
        } else {
          setError(res.error || "Failed to load payslip breakdown.");
        }
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err.message || "Network error loading payslip.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [payslipId]);

  const handlePrint = () => {
    window.print();
  };

  const slip = data?.slip;
  const heads = data?.heads || [];

  const earningsHeads = heads.filter(
    (h: PayslipHeadItem) =>
      h.headType === "EARNING" ||
      h.headType === "Earning" ||
      h.headType === "allowance" ||
      h.headType?.toLowerCase() === "allowance",
  );
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
  const deductionHeads = heads.filter(
    (h: PayslipHeadItem) =>
      (h.headType === "DEDUCTION" ||
        h.headType === "Deduction" ||
        h.headType?.toLowerCase() === "deduction") &&
      !isStatutoryDed(h.payHeadName || h.headName || ""),
  );

  return (
    <Dialog
      open={Boolean(payslipId)}
      onClose={onClose}
      title="Salary Payslip Statement"
      description={
        slip
          ? `${BS_MONTHS[(slip.payslipMonth || 1) - 1]} ${slip.payPeriodYear || ""} BS (${slip.employeeCode})`
          : "Itemized payroll calculation statement"
      }
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!slip}
            className="text-xs font-medium rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
            <span>Print Payslip</span>
          </Button>

          <Button
            size="sm"
            onClick={onClose}
            className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-xs shadow-none cursor-pointer"
          >
            Close Statement
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 text-center text-xs text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin text-payroll-primary mx-auto mb-2" />
          <span>Generating salary breakdown...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : slip ? (
        <div className="space-y-4 py-1 text-xs print:p-0">
          {/* Employee & Pay Period Details Card */}
          <div className="p-4 rounded-md bg-zinc-50 border border-zinc-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase block">
                Employee
              </span>
              <strong className="text-zinc-900 font-semibold block mt-0.5">
                {slip.employeeName}
              </strong>
              <span className="text-[11px] font-mono text-emerald-800 font-medium">
                {slip.employeeCode}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase block">
                Designation / Dept
              </span>
              <strong className="text-zinc-900 font-semibold block mt-0.5">
                {slip.designationName || "Staff"}
              </strong>
              <span className="text-[11px] text-zinc-500">
                {slip.departmentName}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase block">
                Bank Disbursement
              </span>
              <strong className="text-zinc-900 font-semibold block mt-0.5">
                {slip.bankName || "Direct Bank Transfer"}
              </strong>
              <span className="text-[11px] font-mono text-zinc-600">
                {slip.bankAccountNumber || "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase block">
                Pay Period
              </span>
              <strong className="text-zinc-900 font-semibold block mt-0.5">
                {BS_MONTHS[(slip.payslipMonth || 1) - 1]}
              </strong>
              <Badge variant="success" size="sm" className="mt-0.5 text-[10px]">
                {slip.status || "CONFIRMED"}
              </Badge>
            </div>
          </div>

          {/* Earnings vs Deductions Split Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start py-2">
            {/* Earnings Column */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                Gross earnings
              </h3>
              <div className="space-y-0.5">
                <div className="flex justify-between py-2.5 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Basic Salary</span>
                  <span className="text-zinc-900 font-mono font-semibold">
                    NPR {Number(slip.basicSalary).toLocaleString("en-NP")}
                  </span>
                </div>

                {Number(slip.gradeAmount) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Salary Grade Amount</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(slip.gradeAmount).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {Number(slip.otAmount) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Overtime Earnings</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(slip.otAmount).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {earningsHeads.map((head: PayslipHeadItem) => (
                  <div key={head.id} className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">{head.headName || head.payHeadName}</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(head.calculatedAmount || head.amount).toLocaleString("en-NP")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-zinc-200 flex justify-between font-semibold text-zinc-900 text-xs">
                <span>Total gross earnings</span>
                <span className="font-mono">
                  NPR {Number(slip.grossEarnings).toLocaleString("en-NP")}
                </span>
              </div>
            </div>

            {/* Deductions Column */}
            <div className="md:border-l md:border-zinc-200/80 md:pl-8">
              <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                Statutory deductions
              </h3>
              <div className="space-y-0.5">
                {Number(slip.ssfEmployee) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <div>
                      <span className="text-zinc-600 font-medium">Social Security Fund (SSF 31%)</span>
                      <span className="block text-[10px] text-zinc-400 font-normal">
                        EE 11% + ER 20%
                      </span>
                    </div>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(Number(slip.ssfEmployee) + Number(slip.ssfEmployer || 0)).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {Number(slip.pfEmployee) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Provident Fund (EPF 10%)</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(slip.pfEmployee).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {Number(slip.citDeduction) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Citizen Investment Trust (CIT)</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(slip.citDeduction).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {Number(slip.tdsThisMonth) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Income Tax TDS (IRD)</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(slip.tdsThisMonth).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {Number(slip.loanDeduction) > 0 && (
                  <div className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Loan Repayment EMI</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(slip.loanDeduction).toLocaleString("en-NP")}
                    </span>
                  </div>
                )}

                {deductionHeads.map((head: PayslipHeadItem) => (
                  <div key={head.id} className="flex justify-between py-2.5 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">{head.headName || head.payHeadName}</span>
                    <span className="text-zinc-900 font-mono font-semibold">
                      NPR {Number(head.calculatedAmount || head.amount).toLocaleString("en-NP")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-zinc-200 flex justify-between font-semibold text-zinc-900 text-xs">
                <span>Total deductions</span>
                <span className="font-mono">
                  - NPR {Number(slip.totalDeductions).toLocaleString("en-NP")}
                </span>
              </div>
            </div>
          </div>

          {/* Net Payable Strip */}
          <div className="p-4 rounded-md bg-emerald-950 text-white flex items-center justify-between shadow-none">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/80 block">
                Total Net Payable Disbursement
              </span>
              <p className="text-[11px] text-emerald-300">
                Credited to account #{slip.bankAccountNumber || "Primary Account"}
              </p>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-white font-mono">
              NPR {Number(slip.netPayable).toLocaleString("en-NP")}
            </span>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
