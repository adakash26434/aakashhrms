export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, CalendarCheck, CalendarDays, ChevronRight, FileCheck2, HandCoins, Receipt, Table, type LucideIcon } from "lucide-react";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission, requireAuthenticatedUser } from "@/lib/auth/check-permission";
import { PageBar } from "@/components/frame/page-bar";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";

export const metadata: Metadata = {
  title: "Reports | AakashHRMS",
  description: "Salary sheet, payslips, statutory returns, attendance, leave, loans and HR analytics.",
};

type ReportModule = Parameters<typeof hasPermission>[1];

interface Entry {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  module: ReportModule;
}

// The reports this person can open (View on each report's own module); the screens check again.
const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: "Payroll",
    entries: [
      { title: "Salary sheet", description: "Approved and locked pay runs for signature: every pay line, a summary, pay-line totals and the bank transfer list.", href: "/reports/salary-sheet", icon: Table, module: "REPORTS_SALARY_SHEET" },
      { title: "Payslips", description: "Payslips of a locked pay run, one per page, in English, Nepali or both.", href: "/reports/payslip", icon: Receipt, module: "REPORTS_PAYSLIP" },
      { title: "Statutory returns", description: "eTDS, SSF, Provident Fund and CIT schedules with their upload files, and annual tax certificates.", href: "/payroll/statutory", icon: FileCheck2, module: "REPORTS_TAX_IRD" },
    ],
  },
  {
    title: "Time and leave",
    entries: [
      { title: "Attendance report", description: "A month from the attendance rules: the summary, the day register or attendance cards.", href: "/reports/attendance", icon: CalendarDays, module: "REPORTS_ATTENDANCE" },
      { title: "Leave report", description: "A leave year from the leave ledger: balances, movement by type, leave taken and requests.", href: "/reports/leave", icon: CalendarCheck, module: "REPORTS_LEAVE" },
    ],
  },
  {
    title: "Loans and people",
    entries: [
      { title: "Loan report", description: "The loan register, repayments in a period and loans given in a period.", href: "/reports/loan", icon: HandCoins, module: "REPORTS_LOAN" },
      { title: "HR analytics", description: "Headcount, movement, tenure, training and the DoC / COPOMIS staff return.", href: "/reports/hr-analytics", icon: BarChart3, module: "EMPLOYEES" },
    ],
  },
];

export default async function ReportsPage() {
  await ensureTenantContext();
  await requireAuthenticatedUser();
  const allowed = await Promise.all(GROUPS.flatMap((g) => g.entries).map((e) => hasPermission("VIEW", e.module)));
  let i = 0;
  const groups = GROUPS.map((g) => ({ ...g, entries: g.entries.filter(() => allowed[i++]) })).filter((g) => g.entries.length > 0);

  return (
    <div>
      <PageBar title="Reports" description="Every report prints on A4 under the company letterhead and covers only the employees your role covers" />
      {groups.length === 0 ? (
        <EmptyState title="No reports for your role" description="Ask an administrator for the report permissions you need." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel key={g.title} title={g.title} count={g.entries.length}>
              <ul className="divide-y divide-line">
                {g.entries.map((e) => (
                  <li key={e.href}>
                    <Link href={e.href} className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-strong">
                        <e.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink group-hover:underline">{e.title}</span>
                        <span className="block text-xs text-ink-muted">{e.description}</span>
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
