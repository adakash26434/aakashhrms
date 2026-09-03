"use client";

import React, { useState, useEffect } from "react";
import { Banknote, CheckCircle2, Calendar, AlertCircle, Loader2, DollarSign } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyLoanRepaymentsAction } from "@/app/actions/self-service.actions";

interface LoanRepaymentsModalProps {
  loanId: string | null;
  loanTypeName: string;
  onClose: () => void;
}

export function LoanRepaymentsModal({
  loanId,
  loanTypeName,
  onClose,
}: LoanRepaymentsModalProps) {
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId) {
      setRepayments([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getMyLoanRepaymentsAction(loanId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setRepayments(res.data);
        } else {
          setError(res.error || "Failed to load loan repayments.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Network error loading repayments.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loanId]);

  return (
    <Dialog
      open={Boolean(loanId)}
      onClose={onClose}
      title="Loan Repayment Schedule & History"
      description={`Monthly installment deduction records for ${loanTypeName}.`}
      size="lg"
      footer={
        <div className="flex items-center justify-end w-full">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-xs"
          >
            Close Schedule
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-payroll-primary mx-auto mb-2" />
          <span>Retrieving repayment installment records...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : repayments.length === 0 ? (
        <div className="py-12 text-center text-xs text-gray-500 space-y-1">
          <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="font-bold text-payroll-navy">No installments recorded yet</p>
          <p className="text-[11px] text-gray-400">
            Deductions will be automatically registered during monthly payroll processing.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto py-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-payroll-cream/70 text-payroll-navy font-bold uppercase tracking-wider border-b border-payroll-light text-[11px]">
              <tr>
                <th className="px-4 py-3">Repayment Date</th>
                <th className="px-4 py-3 text-right">Amount Deducted</th>
                <th className="px-4 py-3 text-right">Remaining Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-payroll-light/50 bg-white font-mono">
              {repayments.map((rep) => (
                <tr key={rep.id} className="hover:bg-payroll-cream/40 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-sans">
                    {rep.repaymentDate}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-payroll-navy">
                    NPR {Number(rep.amount).toLocaleString("en-NP")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-600">
                    NPR {Number(rep.remainingAmount || 0).toLocaleString("en-NP")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="success" size="sm" className="text-[10px]">
                      DEDUCTED
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
