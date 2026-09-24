export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import { PageFrame } from "@/components/layout/page-frame";
import { DashboardHeroSection } from "@/components/dashboard/dashboard-hero";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { DashboardActionLinks } from "@/components/dashboard/dashboard-action-links";
import { PayrollOperationsCenter } from "@/components/dashboard/payroll-operations-center";
import { PendingApprovalsPanel } from "@/components/dashboard/pending-approvals-panel";
import { AttendanceToday } from "@/components/dashboard/attendance-today";
import { ComplianceCenter } from "@/components/dashboard/compliance-center";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { getDashboardSnapshot } from "@/lib/services/dashboard.service";
import { ensureTenantContext } from "@/lib/db";

// Dynamic chart imports to ensure smooth hydration with Recharts
const MonthlyPayrollTrend = dynamicImport(
  () =>
    import("@/components/dashboard/monthly-payroll-trend").then(
      (m) => m.MonthlyPayrollTrend,
    ),
  {
    loading: () => (
      <div className="h-72 animate-pulse rounded-xl border border-payroll-border bg-white" />
    ),
  },
);

const HeadcountByDepartment = dynamicImport(
  () =>
    import("@/components/dashboard/headcount-by-department").then(
      (m) => m.HeadcountByDepartment,
    ),
  {
    loading: () => (
      <div className="h-44 animate-pulse rounded-xl border border-payroll-border bg-white" />
    ),
  },
);

export const metadata: Metadata = {
  title: "Dashboard | AakashHRMS",
  description: "Payroll operations and workforce overview for AakashHRMS",
};

export default async function DashboardPage() {
  await ensureTenantContext();

  const data = await getDashboardSnapshot();
  const headcountTotal = data.headcount.reduce((sum, d) => sum + d.count, 0);
  const employeeCount =
    Number(data.metrics.find((m) => m.id === "employees")?.value) || 0;

  return (
    <PageFrame size="wide" spacing="none" className="space-y-4 sm:space-y-5">
      {/* 1. Header Row (Title, Subtitle, Month Selector, Primary Action) */}
      <DashboardHeroSection
        data={data.hero}
        periodLabel={data.currentRun?.period}
        payPeriodMonth={data.currentRun?.payPeriodMonth}
        payPeriodYear={data.currentRun?.payPeriodYear}
        payPeriodStartDate={data.currentRun?.payPeriodStartDate}
      />

      {/* 2. Top KPI Strip (4-Card Row Max) */}
      <KpiGrid
        metrics={data.metrics}
        pendingApprovals={data.pendingApprovals}
        attendance={data.attendance}
        grossPayroll={data.currentRun?.grossPayroll}
      />

      {/* 3. Quick Actions Horizontal Link Row */}
      <DashboardActionLinks />

      {/* 4. Operational Command Center — Structured Aligned Rows */}
      <div className="space-y-5 pt-1">
        {/* Row 1: Payroll Overview + Pending Approvals (Matched Height & Alignment) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col min-w-0">
            <PayrollOperationsCenter
              run={data.currentRun}
              exceptions={data.validationExceptions}
            />
          </div>
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col min-w-0">
            <PendingApprovalsPanel
              pendingCount={data.pendingApprovals.value}
              items={data.pendingApprovals.items}
            />
          </div>
        </div>

        {/* Row 2: Payroll Trend + Attendance & Leave Today (Exact Reference Image 1 Layout) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col min-w-0">
            <MonthlyPayrollTrend
              data={data.trend}
              latestNet={data.currentRun?.netPayable}
              periodLabel={data.currentRun?.period}
            />
          </div>
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col min-w-0">
            <AttendanceToday
              attendance={data.attendance}
              totalEmployees={employeeCount}
              todayWorkforce={data.todayWorkforce}
            />
          </div>
        </div>

        {/* Row 3: Forensic Audit Trail + Workforce Distribution */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col min-w-0">
            <RecentActivity items={data.activity} />
          </div>
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col min-w-0">
            <HeadcountByDepartment
              data={data.headcount}
              total={headcountTotal}
            />
          </div>
        </div>

        {/* Row 4: Statutory Compliance Health + Statutory Deadlines */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col min-w-0">
            <ComplianceCenter
              score={data.complianceScore}
              items={data.compliance}
            />
          </div>
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col min-w-0">
            <UpcomingEvents items={data.upcoming} />
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
