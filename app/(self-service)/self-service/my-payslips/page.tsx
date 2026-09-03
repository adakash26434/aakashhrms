import React from "react";
import { getMyPayslips } from "@/lib/services/self-service.service";
import { FileText, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PayslipsClientList } from "@/components/self-service/payslips-client-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Payslips | Self-Service Portal",
  description: "View itemized monthly salary payslips and deductions",
};

export default async function MyPayslipsPage() {
  let payslips;
  try {
    payslips = await getMyPayslips();
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<Wallet className="h-10 w-10 text-payroll-primary" />}
            title="Payslips Unavailable"
            description={error?.message || "Failed to load salary payslips. Please contact HR."}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Salary Payslips Statement
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Click on any monthly payslip to inspect full itemized allowances, tax TDS, and statutory deductions.
          </p>
        </div>

        <span className="text-xs font-bold text-gray-500 bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light">
          {payslips.length} payslip(s) recorded
        </span>
      </div>

      {payslips.length === 0 ? (
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="py-16">
            <EmptyState
              icon={<FileText className="h-10 w-10 text-payroll-primary" />}
              title="No payslips generated yet"
              description="Your salary slips will be automatically generated and made available here once monthly payroll is approved and disbursed."
            />
          </CardContent>
        </Card>
      ) : (
        <PayslipsClientList payslips={payslips} />
      )}
    </div>
  );
}
