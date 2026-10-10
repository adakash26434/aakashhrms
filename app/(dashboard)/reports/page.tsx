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
  Coins,
  Clock,
  FileCheck,
} from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = {
  title: "Reports & Analytics | AakashHRMS",
  description:
    "Enterprise Payroll Reports, Payslips, Attendance, IRD Tax, Leave, and Loan Statements.",
};

interface ReportCardItem {
  title: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
}

interface ReportGroup {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  reports: ReportCardItem[];
}

const reportGroups: ReportGroup[] = [
  {
    name: "Payroll Outputs",
    description: "Monthly master register and confidential payslip outputs",
    icon: Coins,
    reports: [
      {
        title: "Salary Sheet Report",
        href: "/reports/salary-sheet",
        description:
          "Comprehensive monthly salary sheet showing employee basic salary, designation, dynamic allowances, tax, PF, SSF, CIT, loan deductions, and net payable.",
        icon: FileSpreadsheet,
        badge: "Monthly Master",
      },
      {
        title: "Payslips & Head Summary",
        href: "/reports/payslip",
        description:
          "Generate A4-optimized confidential payslips for individual or batch printing. Includes Pay Head Summary breakdown tab with allowance/deduction filtering.",
        icon: Printer,
        badge: "Print & PDF",
      },
    ],
  },
  {
    name: "Time & Workforce Ledgers",
    description: "Statutory attendance tracking and annual leave balance records",
    icon: Clock,
    reports: [
      {
        title: "Attendance & OT Report",
        href: "/reports/attendance",
        description:
          "Device punch details, manual status matrix (P/A/L/HD), statutory monthly working days, absent deductions, and overtime summary.",
        icon: CalendarCheck,
        badge: "Nepal Labour Act",
      },
      {
        title: "Leave Ledger & Balances",
        href: "/reports/leave",
        description:
          "Annual leave balances ledger, taken days, carried forward, encashable counts, and 5-mode application views (Taken, Approved, Rejected).",
        icon: CalendarDays,
        badge: "Leave Ledger",
      },
    ],
  },
  {
    name: "Statutory Compliance & Loans",
    description: "Inland Revenue Department tax filing and staff credit recovery",
    icon: FileCheck,
    reports: [
      {
        title: "Statutory returns",
        href: "/payroll/statutory",
        description:
          "eTDS by revenue code (11211 social security tax, 11112 remuneration tax), SSF, Provident Fund and CIT deposit files, and annual tax certificates.",
        icon: Receipt,
        badge: "IRD Compliance",
      },
      {
        title: "Loan & Repayment Statements",
        href: "/reports/loan",
        description:
          "Disbursement payment statements, active/closed loan statuses, monthly installment schedules, and salary recovery ledgers.",
        icon: CreditCard,
        badge: "Loan Ledger",
      },
    ],
  },
];

export default function ReportsHubPage() {
  return (
    <PageFrame size="wide" spacing="relaxed">
      {/* Unified Canonical Page Header */}
      <PageHeader
        title="Reports & Statements"
        description="Select an official report category to view detailed statements, filter by organizational parameters, and export official CSV files."
      >
        <div className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 border border-zinc-200">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          <span>Locked run data enforced</span>
        </div>
      </PageHeader>

      {/* Categorized Report Sections */}
      <div className="space-y-8">
        {reportGroups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.name} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2.5 border-b border-zinc-200/80 pb-2">
                <div className="p-1 rounded-md bg-zinc-100 text-zinc-700">
                  <GroupIcon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 tracking-tight">
                    {group.name}
                  </h3>
                  <p className="text-2xs text-zinc-500">
                    {group.description}
                  </p>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.reports.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group relative flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="inline-flex items-center justify-center rounded-md bg-zinc-100 p-2 text-zinc-700 transition-colors group-hover:bg-zinc-950 group-hover:text-white">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-2xs font-medium text-zinc-600 border border-zinc-200">
                            {card.badge}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-zinc-900 group-hover:text-emerald-950 transition-colors">
                            {card.title}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-emerald-800 group-hover:text-zinc-900 transition-colors pt-2.5 border-t border-zinc-100">
                        <span>Open statement</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </PageFrame>
  );
}
