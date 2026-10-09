"use client";

import { useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Clock3, Eye, PieChart, Play, RefreshCw, TriangleAlert, UserPlus } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { PageFrame } from "@/components/layout/page-frame";
import { Panel } from "@/components/kit/panel";
import { Skeleton } from "@/components/kit/skeleton";
import { EmptyState, ErrorState } from "@/components/kit/empty-state";
import { formatAmount } from "@/lib/kit/amount";
import { formatBSDateWithDay } from "@/lib/utils/bs-calendar";
import { toLocalDate } from "@/lib/utils/nepal-time";
import type { DashboardData } from "@/lib/types/dashboard";
import { ATTENDANCE_SERIES, BREAKDOWN_COLORS, COST_TREND_SERIES, NOT_LOCKED_LEGEND } from "./dashboard-chart-series";
import { DashboardFilters } from "./dashboard-filters";
import { DashboardKpiCards } from "./dashboard-kpi-cards";
import { DashboardPayRunBanner } from "./dashboard-pay-run-banner";
import { DashboardStatutoryCard } from "./dashboard-statutory-card";
import { DashboardUpcomingCard } from "./dashboard-upcoming-card";
import { DashboardDeadlinesCard } from "./dashboard-deadlines-card";
import { DashboardApprovalsCard } from "./dashboard-approvals-card";
import { DashboardReadinessCard } from "./dashboard-readiness-card";
import { DashboardDepartmentCostCard } from "./dashboard-department-cost-card";
import { DashboardLeaveOverview } from "./dashboard-leave-overview";
import { DashboardHeadcountCard } from "./dashboard-headcount-card";
import { DashboardActivityCard } from "./dashboard-activity-card";

// Recharts loads after the first paint; the cards around the charts render on the server.
const chartLoading = (height: string) =>
  function ChartLoading() {
    return <Skeleton className={`${height} w-full`} />;
  };
const DashboardCostTrendChart = dynamic(() => import("./dashboard-cost-trend-chart").then((m) => m.DashboardCostTrendChart), {
  ssr: false,
  loading: chartLoading("h-72"),
});
const DashboardCostBreakdownChart = dynamic(() => import("./dashboard-cost-breakdown-chart").then((m) => m.DashboardCostBreakdownChart), {
  ssr: false,
  loading: chartLoading("h-44"),
});
const DashboardAttendanceChart = dynamic(() => import("./dashboard-attendance-chart").then((m) => m.DashboardAttendanceChart), {
  ssr: false,
  loading: chartLoading("h-56"),
});

function greeting(iso: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function Legend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function FailedPanel({ id, title, onRetry }: { id: string; title: string; onRetry: () => void }) {
  return (
    <Panel level={3} id={id} title={title} icon={<TriangleAlert />}>
      <ErrorState message="This section could not be loaded. Nothing has changed in your data." onRetry={onRetry} />
    </Panel>
  );
}

/** A labelled group of cards: gives the page a clear rhythm instead of one long grid. */
function DashboardSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</h2>
        {description && <p className="hidden text-2xs text-ink-faint sm:block">{description}</p>}
        <span aria-hidden className="h-px flex-1 bg-line-strong" />
      </div>
      {children}
    </section>
  );
}

/** Dashboard (roadmap 4.1, template F): headline figures and charts first, then the work that needs attention. */
export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const { access, filters } = data;
  const failed = (name: string) => data.failed.includes(name);
  const today = toLocalDate(data.todayIso);

  const trendHasData = !!data.costTrend?.some((p) => p.hasData);
  const todayCounts = data.attendance?.days[data.attendance.days.length - 1];
  const showFilters = access.payroll || filters.branches.length > 1;

  const attentionCards = [
    data.deadlines && <DashboardDeadlinesCard key="deadlines" deadlines={data.deadlines} />,
    data.approvals && <DashboardApprovalsCard key="approvals" total={data.approvals.total} items={data.approvals.items} scopeLabel={access.scopeLabel} />,
    failed("approvals") && !data.approvals && <FailedPanel key="approvals-failed" id="dashboard-approvals" title="Pending approvals" onRetry={refresh} />,
    data.readiness && <DashboardReadinessCard key="readiness" checked={data.readiness.checked} issues={data.readiness.issues} />,
  ].filter(Boolean);

  const payrollFailed = access.payroll && !data.kpis && failed("payroll");
  const hasPayroll = !!(data.costTrend || data.departmentCost || data.statutory || payrollFailed);
  const hasLeave = !!(data.leaveByType || data.onLeaveToday);
  const attendanceFailed = failed("attendance") && !data.attendance;
  const activityFailed = failed("activity") && !data.activity;
  const hasPeople = !!(data.attendance || attendanceFailed || hasLeave || data.headcount || data.upcoming || data.activity || activityFailed);
  const nothing = !data.payRun && !data.kpis && !hasPayroll && attentionCards.length === 0 && !hasPeople;

  return (
    <PageFrame size="wide" spacing="none">
      <PageBar
        title="Dashboard"
        description={`${greeting(data.generatedAt)}, ${data.displayName} · ${today ? formatBSDateWithDay(today) : ""} · Updated ${clock(data.generatedAt)}`}
        status={
          access.scopeLabel ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-line bg-surface-sunken px-2 text-2xs font-medium text-ink-muted">
              <Eye className="h-3 w-3" /> {access.scopeLabel}
            </span>
          ) : undefined
        }
        actions={[
          { id: "run", label: "Run payroll", icon: Play, group: "create", href: "/payroll", hidden: !access.payrollGenerate || access.supportView },
          { id: "employee", label: "Add employee", icon: UserPlus, group: "create", href: "/workforce/employees/new", hidden: !access.employeesAdd },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", onClick: refresh, disabled: refreshing },
        ]}
      />

      {access.supportView && (
        <p className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-subtle px-4 py-2 text-xs text-warning">
          <Eye className="h-3.5 w-3.5" /> Support view: read-only.
        </p>
      )}

      {data.failed.length > 0 && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger/30 bg-danger-subtle px-4 py-2 text-xs text-danger">
          <TriangleAlert className="h-3.5 w-3.5" />
          <span className="flex-1">Some sections could not load ({data.failed.join(", ")}). Everything else on this page is complete.</span>
          <button type="button" onClick={refresh} className="h-7 rounded-md border border-danger/30 bg-surface px-2.5 font-medium hover:bg-danger-subtle cursor-pointer">
            Try again
          </button>
        </div>
      )}

      {showFilters && <DashboardFilters filters={filters} />}

      {nothing ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            title="Nothing to show here"
            description="Your role has no dashboard figures. Your payslips, leave and profile are in self-service."
            action={
              <Link href="/self-service" className="inline-flex h-8 items-center rounded-md bg-brand px-4 text-xs font-medium text-white hover:bg-brand-hover">
                Open self-service
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {(data.payRun || data.kpis) && (
            <div className="space-y-4">
              {data.payRun && <DashboardPayRunBanner payRun={data.payRun} access={access} fiscal={data.fiscalProgress} />}
              {data.kpis && <DashboardKpiCards kpis={data.kpis} compareLabel={filters.period.compareLabel} />}
            </div>
          )}

          {hasPayroll && (
            <DashboardSection title="Payroll" description={filters.period.label}>
              {payrollFailed && <FailedPanel id="dashboard-payroll" title="Payroll figures" onRetry={refresh} />}
              {data.costTrend && data.costBreakdown && (
                <div className="grid items-stretch gap-5 xl:grid-cols-3">
                  <Panel
                    level={3}
                    id="dashboard-cost-trend"
                    title="Payroll cost by month"
                    icon={<BarChart3 />}
                    meta="Last 12 months"
                    href="/reports/salary-sheet"
                    hrefLabel="Salary sheet"
                    className="xl:col-span-2"
                  >
                    {trendHasData ? (
                      <div className="space-y-3 px-4 pb-4 pt-3">
                        <Legend items={[...COST_TREND_SERIES, NOT_LOCKED_LEGEND]} />
                        <DashboardCostTrendChart points={data.costTrend} />
                      </div>
                    ) : (
                      <EmptyState title="No payroll yet" description="The monthly cost appears here after the first payroll run." />
                    )}
                  </Panel>
                  <Panel level={3} id="dashboard-cost-breakdown" title="Where the money went" icon={<PieChart />} meta={filters.period.label}>
                    {data.costBreakdown.total > 0 ? (
                      <div className="p-4">
                        <DashboardCostBreakdownChart total={data.costBreakdown.total} segments={data.costBreakdown.segments} />
                        <ul className="mt-4 space-y-1.5">
                          {data.costBreakdown.segments.map((s) => (
                            <li key={s.id} className="flex items-center gap-2 text-xs">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: BREAKDOWN_COLORS[s.id] }} />
                              <span className="flex-1 truncate text-ink-muted">{s.label}</span>
                              <span className="tabular-nums text-ink" title={formatAmount(s.amount, { prefix: "NPR" })}>
                                {formatAmount(s.amount, { compact: true })}
                              </span>
                              <span className="w-10 text-right text-2xs tabular-nums text-ink-faint">{Math.round((s.amount / data.costBreakdown!.total) * 1000) / 10}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <EmptyState title="No payroll in this period" description="Choose another period, or run payroll for this month." />
                    )}
                  </Panel>
                </div>
              )}
              {(data.departmentCost || data.statutory) && (
                <div className="grid items-stretch gap-5 xl:grid-cols-3">
                  {data.departmentCost && (
                    <div className={data.statutory ? "xl:col-span-2" : "xl:col-span-3"}>
                      <DashboardDepartmentCostCard departments={data.departmentCost} periodLabel={filters.period.label} />
                    </div>
                  )}
                  {data.statutory && <DashboardStatutoryCard statutory={data.statutory} periodLabel={filters.period.label} />}
                </div>
              )}
            </DashboardSection>
          )}

          {attentionCards.length > 0 && (
            <DashboardSection title="Needs attention" description="Deposits, approvals and records to fix">
              <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{attentionCards}</div>
            </DashboardSection>
          )}

          {hasPeople && (
            <DashboardSection title="People" description={data.attendance?.monthLabel}>
              {(data.attendance || attendanceFailed || hasLeave) && (
                <div className="grid items-stretch gap-5 xl:grid-cols-3">
                  {data.attendance && (
                    <Panel
                      level={3}
                      id="dashboard-attendance"
                      title="Attendance this month"
                      icon={<Clock3 />}
                      meta={data.attendance.ratePct === null ? data.attendance.monthLabel : `${data.attendance.monthLabel} · ${data.attendance.ratePct}% attendance`}
                      href="/timeAndLeave/attendance"
                      hrefLabel="Attendance"
                      className={hasLeave ? "xl:col-span-2" : "xl:col-span-3"}
                    >
                      <div className="space-y-3 px-4 pb-4 pt-3">
                        {todayCounts && (
                          <p className="text-xs text-ink-muted">
                            Today: <span className="font-medium text-ink">{todayCounts.present}</span> present · {todayCounts.leave} on leave · {todayCounts.absent} absent
                            {todayCounts.notRecorded > 0 && <span className="text-warning"> · {todayCounts.notRecorded} not recorded</span>}
                          </p>
                        )}
                        <Legend items={ATTENDANCE_SERIES} />
                        <DashboardAttendanceChart days={data.attendance.days} />
                      </div>
                    </Panel>
                  )}
                  {attendanceFailed && (
                    <div className={hasLeave ? "xl:col-span-2" : "xl:col-span-3"}>
                      <FailedPanel id="dashboard-attendance" title="Attendance this month" onRetry={refresh} />
                    </div>
                  )}
                  {hasLeave && <DashboardLeaveOverview leaveByType={data.leaveByType} onLeaveToday={data.onLeaveToday} />}
                </div>
              )}
              {(data.headcount || data.upcoming || data.activity || activityFailed) && (
                <div className="grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {data.headcount && <DashboardHeadcountCard headcount={data.headcount} />}
                  {data.upcoming && <DashboardUpcomingCard events={data.upcoming} />}
                  {data.activity && <DashboardActivityCard activity={data.activity} todayIso={data.todayIso} />}
                  {activityFailed && <FailedPanel id="dashboard-activity" title="Recent activity" onRetry={refresh} />}
                </div>
              )}
            </DashboardSection>
          )}
        </div>
      )}
    </PageFrame>
  );
}
