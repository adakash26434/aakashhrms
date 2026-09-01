import { getMyPayslips } from "@/lib/services/self-service.service";
import { FileText, Download, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Payslips | Self-Service Portal",
  description: "View your monthly salary payslips",
};

export default async function MyPayslipsPage() {
  let payslips;
  try {
    payslips = await getMyPayslips();
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-gray-200 bg-white">
        <Wallet className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Payslips Unavailable</h2>
        <p className="text-sm text-gray-500">{error?.message || "Failed to load your payslips."}</p>
      </div>
    );
  }

  const BS_MONTHS = [
    "Baisakh", "Jestha", "Ashar", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1b3a1f]">My Payslips</h1>
        <span className="text-xs text-gray-400">{payslips.length} payslip(s)</span>
      </div>

      {payslips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-gray-200 bg-white">
          <FileText className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No payslips generated yet.</p>
          <p className="text-xs text-gray-400 mt-1">Your payslips will appear here after monthly payroll runs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((slip) => (
            <div
              key={slip.id}
              className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-sm hover:border-emerald-200"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1b3a1f]">
                    {BS_MONTHS[(slip.payPeriodMonth || 1) - 1]} {slip.payPeriodYear} BS
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {slip.departmentName} · {slip.designationName}
                  </p>
                  {slip.payslipDate && (
                    <p className="text-[10px] text-gray-400 mt-0.5">Generated: {slip.payslipDate}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Salary Breakdown Summary */}
                <div className="hidden sm:flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <p className="text-gray-400">Gross</p>
                    <p className="font-semibold text-gray-600">NPR {Number(slip.grossEarnings).toLocaleString('en-NP')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400">Deductions</p>
                    <p className="font-semibold text-red-500">- {Number(slip.totalDeductions).toLocaleString('en-NP')}</p>
                  </div>
                </div>

                {/* Net Payable */}
                <div className="text-right min-w-[120px]">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Net Pay</p>
                  <p className="text-lg font-bold text-emerald-700">
                    NPR {Number(slip.netPayable).toLocaleString('en-NP')}
                  </p>
                </div>

                {/* Status Badge */}
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  slip.status === 'LOCKED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {slip.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
