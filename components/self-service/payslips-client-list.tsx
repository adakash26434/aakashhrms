"use client";

import React, { useState } from "react";
import { FileText, ArrowRight, Eye, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PayslipDetailModal } from "@/components/self-service/payslip-detail-modal";

interface Payslip {
  id: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationName: string | null;
  grossEarnings: string | number;
  totalDeductions: string | number;
  netPayable: string | number;
  payslipMonth: number | null;
  payslipDate: string | null;
  status: string | null;
  payPeriodMonth: number | null;
  payPeriodYear: number | null;
}

interface PayslipsClientListProps {
  payslips: Payslip[];
}

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashar", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export function PayslipsClientList({ payslips }: PayslipsClientListProps) {
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-3">
        {payslips.map((slip) => {
          const monthIndex = (slip.payPeriodMonth || slip.payslipMonth || 1) - 1;
          const monthName = BS_MONTHS[monthIndex] || `Month ${monthIndex + 1}`;
          const isLocked = slip.status === "LOCKED" || slip.status === "CONFIRMED";

          return (
            <Card
              key={slip.id}
              onClick={() => setSelectedPayslipId(slip.id)}
              className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm hover:border-payroll-primary/40 transition-all cursor-pointer group"
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-payroll-cream text-payroll-primary border border-payroll-light shadow-2xs group-hover:scale-105 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-payroll-navy group-hover:text-payroll-primary transition-colors">
                      {monthName} {slip.payPeriodYear || ""} BS
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {slip.departmentName || "General"} · {slip.designationName || "Staff"}
                    </p>
                    {slip.payslipDate && (
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                        Disbursed: {slip.payslipDate}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-payroll-light/50">
                  {/* Gross vs Deductions */}
                  <div className="hidden md:flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">
                        Gross
                      </span>
                      <span className="font-semibold text-gray-700">
                        NPR {Number(slip.grossEarnings).toLocaleString("en-NP")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">
                        Deductions
                      </span>
                      <span className="font-semibold text-rose-600">
                        - NPR {Number(slip.totalDeductions).toLocaleString("en-NP")}
                      </span>
                    </div>
                  </div>

                  {/* Net Payable */}
                  <div className="text-right min-w-[120px]">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                      Net Payable
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-payroll-navy font-mono">
                      NPR {Number(slip.netPayable).toLocaleString("en-NP")}
                    </span>
                  </div>

                  {/* Status Badge & Action */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isLocked ? "success" : "warning"}
                      size="sm"
                      className="font-bold text-[10px]"
                    >
                      {slip.status || "CONFIRMED"}
                    </Badge>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs font-semibold text-payroll-primary group-hover:bg-payroll-cream hidden sm:inline-flex"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>View</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PayslipDetailModal
        payslipId={selectedPayslipId}
        onClose={() => setSelectedPayslipId(null)}
      />
    </>
  );
}
