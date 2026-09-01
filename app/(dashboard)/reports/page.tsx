import Link from "next/link";
import {
  FileSpreadsheet,
  Printer,
  CalendarCheck,
  Receipt,
  CreditCard,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  PieChart,
} from "lucide-react";

export const metadata = {
  title: "Reports & Analytics | AakashHRMS",
  description:
    "Enterprise Payroll Reports, Payslips, Attendance, IRD Tax, Leave, and Loan Statements.",
};

const reportCards = [
  {
    title: "Salary Sheet Report",
    href: "/reports/salary-sheet",
    description:
      "Comprehensive monthly salary sheet showing employee basic salary, post/designation, dynamic allowances, tax, PF, SSF, CIT, loan deductions, and net payable.",
    icon: FileSpreadsheet,
    badge: "Monthly Master",
    group: "Payroll Outputs",
  },
  {
    title: "Payslips & Head Summary",
    href: "/reports/payslip",
    description:
      "Generate A4-optimized confidential payslips for individual or bulk printing. Includes Pay Head Summary breakdown tab with allowance/deduction filtering.",
    icon: Printer,
    badge: "Print & PDF",
    group: "Payroll Outputs",
  },
  {
    title: "Attendance & OT Report",
    href: "/reports/attendance",
    description:
      "Device punch details, manual status matrix (P/A/L/HD), and statutory monthly working days, absent deductions, and OT earned summary.",
    icon: CalendarCheck,
    badge: "Nepal Labour Act",
    group: "Time & Leave",
  },
  {
    title: "Leave Ledger & Balances",
    href: "/reports/leave",
    description:
      "Annual leave balances ledger, taken days, carried forward, encashable counts, and 5-mode application views (Taken, Approved, Rejected).",
    icon: CalendarDays,
    badge: "Leave Ledger",
    group: "Time & Leave",
  },
  {
    title: "Loan & Repayment Statements",
    href: "/reports/loan",
    description:
      "Disbursement payment statements, active/closed loan statuses, monthly installment schedules, and salary recovery ledgers.",
    icon: CreditCard,
    badge: "Loan Ledger",
    group: "Compliance & Loans",
  },
  {
    title: "TDS / IRD Tax Report",
    href: "/reports/tax-ird",
    description:
      "Nepal Inland Revenue Department (IRD) tax deduction statement (ETDS format) with official document headers and PAN verification.",
    icon: Receipt,
    badge: "IRD Compliance",
    group: "Compliance & Loans",
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d7e8d0] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#1b3a1f]">
            Reports & Statements Module
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Select a report category to view detailed statements, filter by
            organizational criteria, and export official CSV files.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#2e7d32]/10 px-3 py-1 text-xs font-bold text-[#2e7d32] border border-[#2e7d32]/20">
          <ShieldCheck className="h-4 w-4" /> Locked Run Data Enforced
        </div>
      </div>

      {/* Grid of Canonical Brand Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group relative flex flex-col justify-between rounded-xl border border-[#d7e8d0] bg-white p-6 shadow-payroll-sm transition-all hover:-translate-y-0.5 hover:shadow-payroll-md hover:border-[#2e7d32]"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center justify-center rounded-xl bg-[#2e7d32] p-3 text-white shadow-payroll-sm transition-all group-hover:bg-[#1b3a1f]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-[#f6faf6] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#1b3a1f] border border-[#d7e8d0]">
                    {card.badge}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#1b3a1f] group-hover:text-[#2e7d32] transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-1 text-xs font-bold text-[#2e7d32] group-hover:text-[#1b3a1f] transition-colors">
                <span>Open Report</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
