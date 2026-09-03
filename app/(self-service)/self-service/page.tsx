import React from "react";
import Link from "next/link";
import { getSelfServiceDashboard } from "@/lib/services/self-service.service";
import {
  Wallet,
  CalendarDays,
  Clock,
  Banknote,
  UserCircle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Building2,
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
    <div className="space-y-6">
      {/* ── Welcome Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Welcome back, {emp?.firstName || "Employee"} 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 font-medium">
            {emp?.employeeCode} · {emp?.designationName || "Staff"} · {emp?.departmentName || "Department"} · {emp?.branchName || "Main Branch"}
          </p>
        </div>
        {dashboard.activeFiscalYear && (
          <Badge variant="success" size="sm" className="font-bold gap-1.5 shadow-2xs">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Fiscal Year {dashboard.activeFiscalYear.label}</span>
          </Badge>
        )}
      </div>

      {/* ── KPI Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Net Pay */}
        <DashboardCard
          icon={Wallet}
          iconBg="bg-payroll-cream text-payroll-primary border-payroll-light"
          label="Latest Net Pay"
          value={payslip ? `NPR ${Number(payslip.netPayable).toLocaleString("en-NP")}` : "—"}
          subtext={payslip ? `Month ${payslip.payPeriodMonth}, ${payslip.payPeriodYear} BS` : "No payslip processed yet"}
          href="/self-service/my-payslips"
        />

        {/* Leave Balance */}
        <DashboardCard
          icon={CalendarDays}
          iconBg="bg-blue-50 text-blue-700 border-blue-200"
          label="Leave Balance"
          value={`${leave.totalBalance} days`}
          subtext={`${leave.totalTaken} taken of ${leave.totalAllotted} allotted`}
          href="/self-service/my-leave"
        />

        {/* Pending Requests */}
        <DashboardCard
          icon={Clock}
          iconBg="bg-amber-50 text-amber-700 border-amber-200"
          label="Pending Requests"
          value={String(dashboard.pendingLeaveCount)}
          subtext="Applications awaiting approval"
          href="/self-service/my-leave"
        />

        {/* Active Loans */}
        <DashboardCard
          icon={Banknote}
          iconBg="bg-purple-50 text-purple-700 border-purple-200"
          label="Active Loans"
          value={dashboard.activeLoans.count > 0 ? `NPR ${dashboard.activeLoans.totalRemaining.toLocaleString("en-NP")}` : "None"}
          subtext={dashboard.activeLoans.count > 0 ? `${dashboard.activeLoans.count} active EMI loan(s)` : "No outstanding loans"}
          href="/self-service/my-loans"
        />
      </div>

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink
          href="/self-service/my-profile"
          title="Personnel Profile"
          description="Personal details, official documents, family lineage & bank accounts"
          icon={UserCircle}
        />
        <QuickLink
          href="/self-service/my-payslips"
          title="Salary Payslips"
          description="Itemized monthly salary slips with gross, tax & deductions"
          icon={TrendingUp}
        />
        <QuickLink
          href="/self-service/my-attendance"
          title="Attendance & Overtime"
          description="Monthly attendance telemetry, OT hours & penalty days"
          icon={Clock}
        />
      </div>
    </div>
  );
}

function DashboardCard({
  icon: Icon,
  iconBg,
  label,
  value,
  subtext,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  label: string;
  value: string;
  subtext: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="border-payroll-light/80 bg-white shadow-payroll-xs group-hover:shadow-payroll-sm group-hover:border-payroll-primary/40 transition-all h-full">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {label}
            </span>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${iconBg}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
          </div>

          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-payroll-navy tracking-tight">
              {value}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">{subtext}</p>
          </div>

          <div className="pt-2 border-t border-payroll-light/50 flex items-center text-xs font-bold text-payroll-primary group-hover:translate-x-1 transition-transform">
            <span>View details</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="border-payroll-light/80 bg-white shadow-payroll-xs group-hover:shadow-payroll-sm group-hover:border-payroll-primary/40 transition-all h-full">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-payroll-cream text-payroll-primary border border-payroll-light shadow-2xs group-hover:scale-105 transition-transform">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-payroll-navy group-hover:text-payroll-primary transition-colors">
              {title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-payroll-primary group-hover:translate-x-1 transition-all mt-0.5 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
