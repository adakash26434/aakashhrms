export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComplianceCenter } from "@/components/dashboard/compliance-center";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardHeroSection } from "@/components/dashboard/dashboard-hero";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PayrollOperationsCenter } from "@/components/dashboard/payroll-operations-center";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { getDashboardSnapshot } from "@/lib/services/dashboard.service";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { getDb, ensureTenantContext } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Dashboard | AakashHRMS",
  description: "Payroll dashboard overview for AakashHRMS",
};

export default async function DashboardPage() {
  await ensureTenantContext();

  const data = await getDashboardSnapshot();
  const headcountTotal = data.headcount.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
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
    </div>
  );
}
