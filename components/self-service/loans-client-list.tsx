"use client";

import React, { useState } from "react";
import { Banknote, Calendar, Clock, CheckCircle2, ListFilter, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoanRepaymentsModal } from "@/components/self-service/loan-repayments-modal";

interface Loan {
  id: string;
  loanTypeName: string;
  givenDate: string | null;
  loanAmount: string | number;
  installmentAmount: string | number;
  noOfInstallments: number | null;
  totalReturned: string | number;
  remainingAmount: string | number;
  status: string | null;
}

interface LoansClientListProps {
  loans: Loan[];
}

export function LoansClientList({ loans }: LoansClientListProps) {
  const [selectedLoan, setSelectedLoan] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <div className="space-y-4">
        {loans.map((loan) => {
          const loanAmount = Number(loan.loanAmount) || 0;
          const totalReturned = Number(loan.totalReturned) || 0;
          const remainingAmount = Number(loan.remainingAmount) || 0;
          const installmentAmount = Number(loan.installmentAmount) || 0;
          const returnedPercent =
            loanAmount > 0
              ? Math.min(100, Math.round((totalReturned / loanAmount) * 100))
              : 0;
          const isActive = loan.status === "ACTIVE" || loan.status === "Active";

          return (
            <Card
              key={loan.id}
              className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow"
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-payroll-cream text-payroll-primary border border-payroll-light shadow-2xs">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-payroll-navy">
                        {loan.loanTypeName}
                      </h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3 w-3 text-payroll-primary" />
                        Disbursed: {loan.givenDate || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Badge
                      variant={isActive ? "warning" : "success"}
                      size="sm"
                      className="font-bold text-[10px]"
                    >
                      {isActive ? (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          <span>ACTIVE EMI</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          <span>REPAID</span>
                        </>
                      )}
                    </Badge>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelectedLoan({ id: loan.id, name: loan.loanTypeName })
                      }
                      className="text-xs font-semibold h-8"
                    >
                      <ListFilter className="w-3.5 h-3.5 mr-1 text-payroll-primary" />
                      <span>Repayment History</span>
                    </Button>
                  </div>
                </div>

                {/* Progress Meter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Repayment Progress</span>
                    <span className="font-extrabold text-payroll-navy font-mono">
                      {returnedPercent}% Repaid
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-payroll-cream overflow-hidden border border-payroll-light/60">
                    <div
                      className="h-full rounded-full bg-payroll-primary transition-all"
                      style={{ width: `${returnedPercent}%` }}
                    />
                  </div>
                </div>

                {/* Financial Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-payroll-light/60 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">
                      Principal Loan
                    </span>
                    <strong className="font-mono font-bold text-payroll-navy mt-0.5 block">
                      NPR {loanAmount.toLocaleString("en-NP")}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">
                      Total Returned
                    </span>
                    <strong className="font-mono font-bold text-payroll-primary mt-0.5 block">
                      NPR {totalReturned.toLocaleString("en-NP")}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">
                      Remaining Balance
                    </span>
                    <strong className="font-mono font-bold text-rose-600 mt-0.5 block">
                      NPR {remainingAmount.toLocaleString("en-NP")}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">
                      Monthly EMI
                    </span>
                    <strong className="font-mono font-bold text-payroll-navy mt-0.5 block">
                      NPR {installmentAmount.toLocaleString("en-NP")}
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <LoanRepaymentsModal
        loanId={selectedLoan?.id || null}
        loanTypeName={selectedLoan?.name || "Loan"}
        onClose={() => setSelectedLoan(null)}
      />
    </>
  );
}
