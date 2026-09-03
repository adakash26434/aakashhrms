import React from "react";
import { getMyLoans } from "@/lib/services/self-service.service";
import { Banknote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoansClientList } from "@/components/self-service/loans-client-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Loans | Self-Service Portal",
  description: "View active loans, advance disbursements, and repayment schedules",
};

export default async function MyLoansPage() {
  let loans;
  try {
    loans = await getMyLoans();
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<Banknote className="h-10 w-10 text-payroll-primary" />}
            title="Loan Data Unavailable"
            description={error?.message || "Failed to load loan details. Please contact HR."}
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
            Loans & Advances Portfolio
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Active organizational loans, salary advances, monthly EMI deductions, and historical payment records.
          </p>
        </div>

        <span className="text-xs font-bold text-gray-500 bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light">
          {loans.length} loan record(s)
        </span>
      </div>

      {loans.length === 0 ? (
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="py-16">
            <EmptyState
              icon={<Banknote className="h-10 w-10 text-payroll-primary" />}
              title="No active loans or salary advances"
              description="When emergency funds or company advances are disbursed to your account, installment progress will automatically display here."
            />
          </CardContent>
        </Card>
      ) : (
        <LoansClientList loans={loans} />
      )}
    </div>
  );
}
