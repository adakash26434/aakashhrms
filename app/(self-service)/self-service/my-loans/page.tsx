import { getMyLoans } from "@/lib/services/self-service.service";
import { Banknote, CheckCircle2, Clock, DollarSign, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Loans | Self-Service Portal",
  description: "View your active and completed loans and repayment history",
};

export default async function MyLoansPage() {
  let loans;
  try {
    loans = await getMyLoans();
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-gray-200 bg-white">
        <Banknote className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Loan Data Unavailable</h2>
        <p className="text-sm text-gray-500">{error?.message || "Failed to load loan information."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a1f]">My Loans & Advances</h1>
        <span className="text-xs text-gray-400">{loans.length} loan record(s)</span>
      </div>

      {loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-gray-200 bg-white text-center">
          <Banknote className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No loan or advance records found.</p>
          <p className="text-xs text-gray-400 mt-1">When loans are disbursed, your monthly installment progress will show here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const loanAmount = Number(loan.loanAmount) || 0;
            const totalReturned = Number(loan.totalReturned) || 0;
            const remainingAmount = Number(loan.remainingAmount) || 0;
            const installmentAmount = Number(loan.installmentAmount) || 0;
            const returnedPercent = loanAmount > 0 ? Math.round((totalReturned / loanAmount) * 100) : 0;

            return (
              <div
                key={loan.id}
                className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      loan.status === 'ACTIVE' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1b3a1f]">{loan.loanTypeName}</h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        Disbursed: {loan.givenDate}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 self-start sm:self-auto rounded-full px-3 py-1 text-xs font-bold border ${
                    loan.status === 'ACTIVE'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {loan.status === 'ACTIVE' ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {loan.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span>Repayment Progress</span>
                    <span className="font-semibold text-[#1b3a1f]">{returnedPercent}% Repaid</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(returnedPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 text-xs">
                  <div>
                    <p className="text-gray-400">Total Disbursed</p>
                    <p className="font-bold text-gray-800 mt-0.5">
                      NPR {loanAmount.toLocaleString('en-NP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total Repaid</p>
                    <p className="font-bold text-emerald-600 mt-0.5">
                      NPR {totalReturned.toLocaleString('en-NP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Remaining Balance</p>
                    <p className="font-bold text-red-500 mt-0.5">
                      NPR {remainingAmount.toLocaleString('en-NP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Monthly EMI</p>
                    <p className="font-bold text-gray-800 mt-0.5">
                      NPR {installmentAmount.toLocaleString('en-NP')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
