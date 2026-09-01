import { getSelfServiceDashboard } from "@/lib/services/self-service.service";
import {
  Wallet,
  CalendarDays,
  Clock,
  Banknote,
  UserCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Self-Service Dashboard | PaySystem",
  description: "Your personal payroll and HR self-service portal",
};

export default async function SelfServiceDashboardPage() {
  let dashboard;
  try {
    dashboard = await getSelfServiceDashboard();
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCircle className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Self-Service Unavailable</h2>
        <p className="text-sm text-gray-500 max-w-md">
          {error?.message || "Your account is not linked to an employee record. Please contact your HR administrator."}
        </p>
      </div>
    );
  }

  const emp = dashboard.employee;
  const payslip = dashboard.latestPayslip;
  const leave = dashboard.leaveBalance;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1b3a1f]">
            Welcome back, {emp?.firstName || "Employee"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {emp?.employeeCode} · {emp?.designationName} · {emp?.departmentName} · {emp?.branchName}
          </p>
        </div>
        {dashboard.activeFiscalYear && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CalendarDays className="h-3.5 w-3.5" />
            {dashboard.activeFiscalYear.label}
          </span>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Net Pay */}
        <DashboardCard
          icon={Wallet}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          label="Latest Net Pay"
          value={payslip ? `NPR ${Number(payslip.netPayable).toLocaleString('en-NP')}` : "—"}
          subtext={payslip ? `Month ${payslip.payPeriodMonth}, ${payslip.payPeriodYear} BS` : "No payslip yet"}
          href="/self-service/my-payslips"
        />

        {/* Leave Balance */}
        <DashboardCard
          icon={CalendarDays}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          label="Leave Balance"
          value={`${leave.totalBalance} days`}
          subtext={`${leave.totalTaken} taken of ${leave.totalAllotted} allotted`}
          href="/self-service/my-leave"
        />

        {/* Pending Leave Requests */}
        <DashboardCard
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          label="Pending Requests"
          value={String(dashboard.pendingLeaveCount)}
          subtext="Leave applications awaiting approval"
          href="/self-service/my-leave"
        />

        {/* Active Loans */}
        <DashboardCard
          icon={Banknote}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          label="Active Loans"
          value={dashboard.activeLoans.count > 0 ? `NPR ${dashboard.activeLoans.totalRemaining.toLocaleString('en-NP')}` : "None"}
          subtext={dashboard.activeLoans.count > 0 ? `${dashboard.activeLoans.count} active loan(s)` : "No outstanding loans"}
          href="/self-service/my-loans"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink
          href="/self-service/my-profile"
          title="View My Profile"
          description="Personal details, contact info, bank accounts"
          icon={UserCircle}
        />
        <QuickLink
          href="/self-service/my-payslips"
          title="View Payslips"
          description="Monthly salary slips with full breakdown"
          icon={TrendingUp}
        />
        <QuickLink
          href="/self-service/my-attendance"
          title="Attendance Summary"
          description="Monthly attendance, OT hours, and deductions"
          icon={Clock}
        />
      </div>
    </div>
  );
}

function DashboardCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  subtext,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtext: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <div>
        <p className="text-xl font-bold text-[#1b3a1f]">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>
      </div>
      <div className="mt-3 flex items-center text-xs font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
        View details <ArrowRight className="h-3 w-3 ml-1" />
      </div>
    </a>
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
    <a
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-sm hover:border-emerald-200"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1b3a1f]">{title}</p>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition-colors ml-auto shrink-0" />
    </a>
  );
}
