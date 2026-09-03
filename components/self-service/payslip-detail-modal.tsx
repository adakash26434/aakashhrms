"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  X,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyPayslipDetailAction } from "@/app/actions/self-service.actions";

interface PayslipDetailModalProps {
  payslipId: string | null;
  onClose: () => void;
}

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashar", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export function PayslipDetailModal({
  payslipId,
  onClose,
}: PayslipDetailModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payslipId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getMyPayslipDetailAction(payslipId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || "Failed to load payslip breakdown.");
        }
      })
      .catch((err) => {
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
    (h: any) => h.headType === "EARNING" || h.headType === "Earning",
  );
  const deductionHeads = heads.filter(
    (h: any) => h.headType === "DEDUCTION" || h.headType === "Deduction",
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
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!slip}
            className="text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-payroll-primary" />
            <span>Print Payslip</span>
          </Button>

          <Button
            size="sm"
            onClick={onClose}
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-xs"
          >
            Close Statement
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-payroll-primary mx-auto mb-2" />
          <span>Generating salary breakdown...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : slip ? (
        <div className="space-y-4 py-1 text-xs print:p-0">
          {/* Employee & Pay Period Details Card */}
          <div className="p-4 rounded-xl bg-payroll-cream border border-payroll-light grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Employee
              </span>
              <strong className="text-payroll-navy font-bold block mt-0.5">
                {slip.employeeName}
              </strong>
              <span className="text-[11px] font-mono text-payroll-primary">
                {slip.employeeCode}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Designation / Dept
              </span>
              <strong className="text-payroll-navy block mt-0.5">
                {slip.designationName || "Staff"}
              </strong>
              <span className="text-[11px] text-gray-500">
                {slip.departmentName}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Bank Disbursement
              </span>
              <strong className="text-payroll-navy block mt-0.5">
                {slip.bankName || "Direct Bank Transfer"}
              </strong>
              <span className="text-[11px] font-mono text-gray-600">
                {slip.bankAccountNumber || "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Pay Period
              </span>
              <strong className="text-payroll-navy block mt-0.5">
                {BS_MONTHS[(slip.payslipMonth || 1) - 1]}
              </strong>
              <Badge variant="success" size="sm" className="mt-0.5 text-[10px]">
                {slip.status || "CONFIRMED"}
              </Badge>
            </div>
          </div>

          {/* Earnings vs Deductions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings Column */}
            <div className="border border-payroll-light rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="p-3 bg-payroll-cream/80 border-b border-payroll-light font-bold text-payroll-navy flex items-center justify-between">
                <span>Gross Earnings</span>
                <span className="text-payroll-primary font-mono">
                  NPR {Number(slip.grossEarnings).toLocaleString("en-NP")}
                </span>
              </div>
              <div className="p-3.5 space-y-2 divide-y divide-gray-100">
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Basic Salary</span>
                  <strong className="text-payroll-navy font-mono">
                    NPR {Number(slip.basicSalary).toLocaleString("en-NP")}
                  </strong>
                </div>

                {Number(slip.gradeAmount) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Salary Grade Amount</span>
                    <strong className="text-payroll-navy font-mono">
                      NPR {Number(slip.gradeAmount).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {Number(slip.otAmount) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Overtime Earnings</span>
                    <strong className="text-payroll-navy font-mono">
                      NPR {Number(slip.otAmount).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {earningsHeads.map((head: any) => (
                  <div key={head.id} className="flex justify-between py-1">
                    <span className="text-gray-600">{head.headName}</span>
                    <strong className="text-payroll-navy font-mono">
                      NPR {Number(head.calculatedAmount).toLocaleString("en-NP")}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions Column */}
            <div className="border border-payroll-light rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="p-3 bg-payroll-cream/80 border-b border-payroll-light font-bold text-payroll-navy flex items-center justify-between">
                <span>Statutory Deductions</span>
                <span className="text-rose-600 font-mono">
                  - NPR {Number(slip.totalDeductions).toLocaleString("en-NP")}
                </span>
              </div>
              <div className="p-3.5 space-y-2 divide-y divide-gray-100">
                {Number(slip.ssfEmployee) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Social Security Fund (SSF 11%)</span>
                    <strong className="text-rose-600 font-mono">
                      NPR {Number(slip.ssfEmployee).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {Number(slip.pfEmployee) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Provident Fund (EPF 10%)</span>
                    <strong className="text-rose-600 font-mono">
                      NPR {Number(slip.pfEmployee).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {Number(slip.citDeduction) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Citizen Investment Trust (CIT)</span>
                    <strong className="text-rose-600 font-mono">
                      NPR {Number(slip.citDeduction).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {Number(slip.tdsThisMonth) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Income Tax TDS (IRD)</span>
                    <strong className="text-rose-600 font-mono">
                      NPR {Number(slip.tdsThisMonth).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {Number(slip.loanDeduction) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Loan Repayment EMI</span>
                    <strong className="text-rose-600 font-mono">
                      NPR {Number(slip.loanDeduction).toLocaleString("en-NP")}
                    </strong>
                  </div>
                )}

                {deductionHeads.map((head: any) => (
                  <div key={head.id} className="flex justify-between py-1">
                    <span className="text-gray-600">{head.headName}</span>
                    <strong className="text-rose-600 font-mono">
                      NPR {Number(head.calculatedAmount).toLocaleString("en-NP")}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Net Payable Strip */}
          <div className="p-4 rounded-xl bg-payroll-navy text-white flex items-center justify-between shadow-payroll-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-payroll-light/80 block">
                Total Net Payable Disbursement
              </span>
              <p className="text-[11px] text-emerald-300">
                Credited to account #{slip.bankAccountNumber || "Primary Account"}
              </p>
            </div>
            <span className="text-xl sm:text-2xl font-extrabold text-white font-mono">
              NPR {Number(slip.netPayable).toLocaleString("en-NP")}
            </span>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
