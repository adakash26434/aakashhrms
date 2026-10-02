import React from "react";
import Link from "next/link";
import { getSelfServiceDashboard } from "@/lib/services/self-service.service";
import {
  ArrowUpRight,
  ArrowRight,
  Wallet,
  CalendarDays,
  Clock,
  Clock3,
  Banknote,
  UserCircle,
  FileText,
  Plus,
  LogIn,
  LogOut,
  MapPin,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Self-Service Dashboard | AakashHRMS",
  description: "Personal payroll and HR self-service dashboard",
};

export default async function SelfServiceDashboardPage() {
  let dashboard;
  try {
    dashboard = await getSelfServiceDashboard();
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<UserCircle className="h-10 w-10 text-payroll-primary" />}
            title="Self-Service Portal Unavailable"
            description={
              error?.message ||
              "Your user account is not linked to an active employee personnel record. Please contact your HR administrator."
            }
          />
        </CardContent>
      </Card>
    );
  }

  const emp = dashboard.employee;
  const payslip = dashboard.latestPayslip;
  const leave = dashboard.leaveBalance;

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="border-b border-zinc-200/70 pb-6 sm:pb-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
              <CalendarDays className="h-3.5 w-3.5 text-payroll-primary" />
              <span>{dashboard.activeFiscalYear?.label || "Current fiscal year"}</span>
              <span className="text-zinc-300">·</span>
              <span>Personal workspace</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-payroll-navy sm:text-4xl">
              Hello, {emp?.fullName || "Employee"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {emp?.designationName || "Staff"} · {emp?.departmentName || "Department"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span className="font-mono">{emp?.employeeCode || "Employee record"}</span>
              <span className="text-zinc-300">·</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-payroll-primary" />{emp?.branchName || "Main branch"}</span>
            </div>
          </div>

          <AttendanceStatus />
        </div>
      </section>

      <section aria-labelledby="quick-actions-title" className="overflow-hidden bg-transparent sm:rounded-xl sm:border sm:border-payroll-light/80 sm:bg-white sm:shadow-payroll-xs">
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200/70 py-3 sm:grid-cols-4 sm:divide-y-0 sm:py-4">
          <QuickAction href="/self-service/my-leave" title="Apply leave" description="Request time off" icon={Plus} />
          <QuickAction href="/self-service/my-payslips" title="View payslip" description="Open salary statement" icon={FileText} />
          <QuickAction href="/self-service/my-attendance" title="Attendance" description="Review your records" icon={Clock} />
          <QuickAction href="/self-service/my-loans" title="Request loan" description="Apply or view loans" icon={Banknote} />
        </div>
      </section>

      <section aria-labelledby="personal-summary-title" className="grid grid-cols-2 divide-x divide-payroll-light/70 border-y border-payroll-light/70 bg-white sm:grid-cols-4">
        <DashboardMetric icon={Clock} label="Attendance" value="—" subtext="Current month" href="/self-service/my-attendance" />
        <DashboardMetric icon={CalendarDays} label="Leave left" value={`${leave.totalBalance} days`} subtext={`${leave.totalTaken} taken of ${leave.totalAllotted} allotted`} href="/self-service/my-leave" />
        <DashboardMetric icon={Wallet} label="Last net pay" value={payslip ? `NPR ${Number(payslip.netPayable).toLocaleString("en-NP")}` : "—"} subtext={payslip ? `${payslip.payPeriodMonth}/${payslip.payPeriodYear} BS` : "No payslip yet"} href="/self-service/my-payslips" />
        <DashboardMetric icon={Clock3} label="Open requests" value={String(dashboard.pendingLeaveCount)} subtext="Awaiting review" href="/self-service/my-leave" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <LatestPayslip payslip={payslip} />
        <LeaveBalanceSummary leave={leave} />
      </div>
    </div>
  );
}

function AttendanceStatus() {
  return (
    <div className="min-w-0 border-y border-payroll-light/70 bg-transparent py-5 sm:rounded-xl sm:border sm:border-payroll-light/80 sm:bg-white sm:p-5 sm:shadow-payroll-xs lg:w-md">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
        <span className="h-2 w-2 rounded-full bg-zinc-300" />
        <span>Attendance actions ready for setup</span>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-zinc-200/70 border-y border-zinc-200/70 py-3">
        <StatusValue label="Punch in" value="—" />
        <StatusValue label="Punch out" value="—" />
        <StatusValue label="Worked" value="—" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled className="inline-flex min-h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white opacity-60 cursor-not-allowed" title="Clock in will be connected to attendance services later">
          <LogIn className="h-3.5 w-3.5" />
          Clock in
        </button>
        <button type="button" disabled className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 px-4 text-xs font-semibold text-zinc-500 opacity-60 cursor-not-allowed" title="Clock out will be connected to attendance services later">
          <LogOut className="h-3.5 w-3.5" />
          Clock out
        </button>
      </div>
    </div>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <span className="block text-2xs font-medium text-zinc-500">{label}</span>
      <span className="mt-1 block text-lg font-semibold tabular-nums text-payroll-navy">{value}</span>
    </div>
  );
}

function QuickAction({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="group flex min-h-26 flex-col justify-center gap-2 px-3 py-3 transition-colors hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-payroll-primary sm:min-h-32 sm:px-6 sm:py-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-payroll-navy">{title}</span>
      </div>
      <span className="pl-11 text-xs leading-relaxed text-zinc-600">{description}</span>
    </Link>
  );
}

function LatestPayslip({
  payslip,
}: {
  payslip:
    | {
        netPayable: string | number;
        grossEarnings?: string | number;
        totalDeductions?: string | number;
        payPeriodMonth: number | null;
        payPeriodYear: number | null;
        status?: string | null;
      }
    | null
    | undefined;
}) {
  return (
    <section aria-labelledby="latest-payslip-title" className="min-w-0 border-b border-payroll-border pb-6 sm:rounded-xl sm:border sm:border-payroll-border sm:bg-white sm:p-6 sm:shadow-payroll-xs">
      <div className="flex items-center justify-between gap-3">
        <h2 id="latest-payslip-title" className="text-base font-semibold text-payroll-navy">Latest payslip</h2>
        <Link href="/self-service/my-payslips" className="inline-flex items-center gap-1 text-xs font-semibold text-payroll-primary hover:text-payroll-navy">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {payslip ? (
        <div className="mt-5 border-t border-payroll-border/70 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-payroll-text-muted">
            <span>{payslip.payPeriodMonth}/{payslip.payPeriodYear} BS · Net payable</span>
            <Badge variant="success" size="sm" className="font-semibold">{payslip.status || "Ready"}</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-payroll-navy tabular-nums">
            NPR {Number(payslip.netPayable).toLocaleString("en-NP")}
          </p>
          <div className="mt-5 border-t border-payroll-border/70 pt-3 text-xs">
            {payslip.grossEarnings !== undefined && payslip.totalDeductions !== undefined && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <AmountValue label="Gross" value={payslip.grossEarnings} />
                <AmountValue label="Deductions" value={payslip.totalDeductions} />
              </div>
            )}
            <Link href="/self-service/my-payslips" className="mt-3 inline-flex items-center gap-1 font-semibold text-payroll-primary hover:text-payroll-navy">
              Open statement <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-5 border-t border-payroll-border/70 pt-4 text-sm text-payroll-text-muted">Your latest approved payslip will appear here.</p>
      )}
    </section>
  );
}

function AmountValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="block text-2xs text-payroll-text-muted">{label}</span>
      <span className="mt-1 block font-mono font-semibold tabular-nums text-payroll-navy">NPR {Number(value).toLocaleString("en-NP")}</span>
    </div>
  );
}

function LeaveBalanceSummary({
  leave,
}: {
  leave: { totalBalance: number; totalTaken: number; totalAllotted: number };
}) {
  const total = Number(leave.totalAllotted) || 0;
  const taken = Number(leave.totalTaken) || 0;
  const usedPercent = total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;

  return (
    <section aria-labelledby="leave-balance-title" className="min-w-0 pt-6 sm:rounded-xl sm:border sm:border-payroll-border sm:bg-white sm:p-6 sm:shadow-payroll-xs sm:pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="leave-balance-title" className="text-base font-semibold text-payroll-navy">Leave balance</h2>
        <Link href="/self-service/my-leave" className="text-xs font-semibold text-payroll-primary hover:text-payroll-navy">Apply</Link>
      </div>
      <div className="mt-5 border-t border-payroll-border/70 pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-payroll-navy tabular-nums">{leave.totalBalance} days</p>
            <p className="mt-1 text-xs text-payroll-text-muted">remaining across your current entitlement</p>
          </div>
          <CalendarDays className="h-5 w-5 text-payroll-primary" />
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-payroll-cream">
          <div className="h-full rounded-full bg-payroll-primary" style={{ width: `${usedPercent}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-2xs text-payroll-text-muted">
          <span>{taken} used</span>
          <span>{total} allotted</span>
        </div>
        <Link href="/self-service/my-leave" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-payroll-primary hover:text-payroll-navy">
          View leave history <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value,
  subtext,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-payroll-text-muted">
          {label}
        </span>
        <Icon className="h-4 w-4 text-payroll-primary transition-colors group-hover:text-payroll-primary-hover" />
      </div>

      <div className="mt-2.5">
        <span className="text-xl font-semibold tracking-tight text-payroll-navy tabular-nums font-sans sm:text-2xl">
          {value}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-payroll-border/80 pt-2 text-xs font-medium text-payroll-text-muted transition-colors group-hover:text-payroll-primary">
        <span className="truncate">{subtext}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

