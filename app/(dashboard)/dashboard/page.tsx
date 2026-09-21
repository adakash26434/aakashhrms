export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { PageFrame } from "@/components/layout/page-frame";
import { ComplianceCenter } from "@/components/dashboard/compliance-center";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardHeroSection } from "@/components/dashboard/dashboard-hero";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PayrollOperationsCenter } from "@/components/dashboard/payroll-operations-center";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { getDashboardSnapshot } from "@/lib/services/dashboard.service";
import { ensureTenantContext } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dashboard | AakashHRMS",
  description: "Payroll dashboard overview for AakashHRMS",
};

export default async function DashboardPage() {
  await ensureTenantContext();

  const data = await getDashboardSnapshot();
  const headcountTotal = data.headcount.reduce((sum, d) => sum + d.count, 0);

  return (
    <PageFrame size="wide" spacing="default">
      <DashboardHeroSection data={data.hero} />
      <KpiGrid
        metrics={data.metrics}
        pendingApprovals={data.pendingApprovals}
      />
      <PayrollOperationsCenter
        run={data.currentRun}
        exceptions={data.validationExceptions}
      />
      <DashboardCharts
        trend={data.trend}
        headcount={data.headcount}
        headcountTotal={headcountTotal}
        attendance={data.attendance}
      />
      <ComplianceCenter score={data.complianceScore} items={data.compliance} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity items={data.activity} />
        <UpcomingEvents items={data.upcoming} />
      </div>
    </PageFrame>
  );
}
