export const dynamic = "force-dynamic";
import { LoanClient } from "@/components/loans/loan-client";
import {
  getLoanTypesWithKPIs,
  getLoansWithKPIs,
} from "@/lib/services/loan.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Loan Management | AakashHRMS",
  description: "Manage staff loan types, disbursements, and repayments.",
};

export default async function LoansPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "LOANS");

  const [loanTypeData, loanData] = await Promise.all([
    getLoanTypesWithKPIs(),
    getLoansWithKPIs(),
  ]);

  return (
    <LoanClient
      initialLoanTypes={loanTypeData.loanTypes}
      initialLoanTypeKPIs={loanTypeData.kpis}
      initialLoans={loanData.loans}
      initialLoanKPIs={loanData.kpis}
    />
  );
}
