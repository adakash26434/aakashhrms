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
        title: "TDS / IRD Tax Report",
        href: "/reports/tax-ird",
        description:
          "Nepal Inland Revenue Department (IRD) tax deduction statement (ETDS format) with official document headers and PAN verification.",
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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-payroll-primary/10 px-3 py-1 text-xs font-bold text-payroll-primary border border-payroll-primary/20 shadow-payroll-xs">
          <ShieldCheck className="h-4 w-4" />
          <span>Locked Run Data Enforced</span>
        </div>
      </PageHeader>

      {/* Categorized Report Sections */}
      <div className="space-y-8">
        {reportGroups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.name} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2 border-b border-payroll-light/60 pb-2">
                <div className="p-1 rounded-md bg-payroll-primary/10 text-payroll-primary">
                  <GroupIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
                    {group.name}
                  </h3>
                  <p className="text-[11px] text-gray-400">
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
                      className="group relative flex flex-col justify-between rounded-2xl border border-payroll-light/80 bg-white p-5 shadow-payroll-xs transition-all hover:-translate-y-0.5 hover:shadow-payroll-sm hover:border-payroll-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-payroll-primary"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="inline-flex items-center justify-center rounded-xl bg-payroll-primary p-2.5 text-white shadow-payroll-xs transition-all group-hover:bg-payroll-navy">
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="rounded-full bg-payroll-cream px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-payroll-navy border border-payroll-light">
                            {card.badge}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-payroll-navy group-hover:text-payroll-primary transition-colors">
                            {card.title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-payroll-primary group-hover:text-payroll-navy transition-colors pt-2 border-t border-payroll-light/40">
                        <span>Open Statement</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
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
