"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CalendarClock, CheckCircle2, ClipboardCheck, Clock3, HandCoins, History, Landmark, Play, RefreshCw, TriangleAlert, UserPlus, Eye } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { PageFrame } from "@/components/layout/page-frame";
import { EmptyState, ErrorState } from "@/components/kit/empty-state";
import { Panel } from "@/components/kit/panel";
import { formatAmount } from "@/lib/kit/amount";
import { formatBSDateWithDay } from "@/lib/utils/bs-calendar";
import { toLocalDate } from "@/lib/home/nepal-time";
import { deadlineWhen } from "@/lib/home/deadlines";
import type { HomeData } from "@/lib/home/types";
import { CueStrip, type Cue } from "./cue-strip";
import { ApprovalsQueue } from "./approvals-queue";
import { PayrollPanel, TrendPanel } from "./payroll-panel";
import { ActivityPanel, DeadlinesPanel, HeadcountPanel, ReadinessPanel, TodayPanel } from "./side-panels";

const STATUS_SHORT: Record<string, string> = { DRAFT: "Calculated", UNDER_REVIEW: "In review", APPROVED: "Approved", LOCKED: "Locked" };

function greeting(iso: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function buildCues(data: HomeData): Cue[] {
  const cues: Cue[] = [];
  const { access } = data;

  if (data.approvals) {
    const n = data.approvals.length;
    const oldest = data.approvals.reduce((m, a) => Math.max(m, a.waitingDays ?? 0), 0);
    cues.push({
      id: "approvals",
      label: "Approvals",
      value: String(n),
      hint: n === 0 ? "Nothing waiting" : oldest > 0 ? `Oldest waiting ${oldest} ${oldest === 1 ? "day" : "days"}` : "Leave requests waiting",
      href: "#home-approvals",
      icon: CalendarCheck2,
      tone: n === 0 ? "good" : oldest > 3 ? "danger" : "attention",
    });
  }

  if (data.payroll) {
    const { latest, next } = data.payroll;
    if (next && access.payrollGenerate) {
      cues.push({ id: "payroll", label: "Payroll", value: "Start", hint: `${next.label} not started`, href: "/payroll/generate", icon: Landmark, tone: "attention" });
    } else if (latest) {
      cues.push({
        id: "payroll",
        label: "Payroll",
        value: STATUS_SHORT[latest.status] ?? latest.status,
        hint: latest.label,
        href: "#home-payroll",
        icon: Landmark,
        tone: latest.status === "LOCKED" ? "good" : "attention",
      });
    } else {
      cues.push({ id: "payroll", label: "Payroll", value: "—", hint: "No payroll run yet", href: "#home-payroll", icon: Landmark });
    }
  }

  const nextDeadline = data.deadlines?.[0];
  if (nextDeadline) {
    cues.push({
      id: "deadline",
      label: nextDeadline.daysLeft < 0 ? "Deposit due" : "Next deposit",
      value: nextDeadline.daysLeft < 0 ? "Passed" : nextDeadline.daysLeft === 0 ? "Today" : `${nextDeadline.daysLeft}d`,
      hint: `${nextDeadline.code} for ${nextDeadline.forPeriod}${nextDeadline.daysLeft < 0 ? ` · ${deadlineWhen(nextDeadline.daysLeft).toLowerCase()}` : ""}`,
      href: "#home-deadlines",
      icon: CalendarClock,
      tone: nextDeadline.daysLeft <= 3 ? "danger" : nextDeadline.daysLeft <= 7 ? "attention" : "neutral",
    });
  }

  if (data.readiness) {
    const affected = data.readiness.issues.reduce((n, i) => n + i.count, 0);
    cues.push({
      id: "readiness",
      label: "Records to fix",
      value: String(affected),
      hint: affected === 0 ? "All records ready" : "Before the next run",
      href: "#home-readiness",
      icon: ClipboardCheck,
      tone: affected === 0 ? "good" : "attention",
    });
  }

  if (data.workforce && access.attendance) {
    const { recorded, total } = data.workforce;
    cues.push({
      id: "attendance",
      label: "Attendance",
      value: `${recorded}/${total}`,
      hint: recorded === 0 ? "Not recorded yet" : "Recorded today",
      href: "/timeAndLeave/attendance",
      icon: Clock3,
    });
  }

  if (data.loans) {
    cues.push({
      id: "loans",
      label: "Loans",
      value: formatAmount(data.loans.outstanding, { compact: true }),
      hint: `${data.loans.active} active ${data.loans.active === 1 ? "loan" : "loans"} outstanding`,
      href: "/loans",
      icon: HandCoins,
    });
  }

  return cues;
}

/** Home (Phase 4.1, template F): work queues first, figures second, no hero. */
export function HomeView({
  data,
  decideOverride,
}: {
  data: HomeData;
  /** Dev preview only: see ApprovalsQueue. */
  decideOverride?: React.ComponentProps<typeof ApprovalsQueue>["decideOverride"];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const { access } = data;

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const refresh = () => startRefresh(() => router.refresh());
  const today = toLocalDate(data.todayIso);
  const cues = buildCues(data);

  const failedPayroll = !data.payroll && access.payroll && data.failed.includes("payroll");
  const failedActivity = !data.activity && access.audit && data.failed.includes("activity");
  const hasMain = !!(data.approvals || data.payroll || data.activity || failedPayroll || failedActivity);
  const hasSide = !!(data.workforce || data.deadlines || data.readiness || data.headcount);

  return (
    <PageFrame size="wide" spacing="none">
      <PageBar
        title="Home"
        description={`${greeting(data.generatedAt)}, ${data.displayName} · ${today ? formatBSDateWithDay(today) : ""} · Updated ${clock(data.generatedAt)}`}
        status={
          access.scopeLabel ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-line bg-surface-sunken px-2 text-2xs font-medium text-ink-muted">
              <Eye className="h-3 w-3" /> {access.scopeLabel}
            </span>
          ) : undefined
        }
        actions={[
          { id: "employee", label: "Add employee", icon: UserPlus, group: "create", href: "/workforce/employees/new", hidden: !access.employeesAdd },
          { id: "run", label: "Run payroll", icon: Play, group: "create", href: "/payroll/generate", hidden: !access.payrollGenerate || access.supportView },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", onClick: refresh, disabled: refreshing },
        ]}
      />

      {access.supportView && (
        <p className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
          <Eye className="h-3.5 w-3.5" /> Support view: you can see this company&apos;s Home but cannot approve or change anything from here.
        </p>
      )}

      {data.failed.length > 0 && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          <TriangleAlert className="h-3.5 w-3.5" />
          <span className="flex-1">Some sections could not load ({data.failed.join(", ")}). Figures shown are complete for the sections that did.</span>
          <button type="button" onClick={refresh} className="h-7 rounded-md border border-danger/30 bg-surface px-2.5 font-medium hover:bg-danger-subtle cursor-pointer">
            Try again
          </button>
        </div>
      )}

      <CueStrip cues={cues} />

      {!hasMain && !hasSide ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            title="Nothing to work on here"
            description="Your role has no work queues. Your payslips, leave and profile are in self-service."
            action={
              <Link href="/self-service" className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover">
                Open self-service
              </Link>
            }
          />
        </div>
      ) : (
        <div className={hasMain && hasSide ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]" : "grid gap-4"}>
          {hasMain && (
            <div className="min-w-0 space-y-4">
              {data.approvals && <ApprovalsQueue items={data.approvals} canDecide={access.leaveDecide} scopeLabel={access.scopeLabel} onDecided={setNotice} decideOverride={decideOverride} />}
              {data.payroll && <PayrollPanel payroll={data.payroll} access={access} />}
              {failedPayroll && (
                <Panel id="home-payroll" title="Payroll" icon={<Landmark />}>
                  <ErrorState message="Payroll figures could not be loaded. Nothing has changed in your payroll." onRetry={refresh} />
                </Panel>
              )}
              {failedActivity && (
                <Panel id="home-activity" title="Recent activity" icon={<History />}>
                  <ErrorState message="The audit log could not be loaded." onRetry={refresh} />
                </Panel>
              )}
              {((data.payroll?.trend.length ?? 0) >= 2 || data.activity) && (
                <div className={(data.payroll?.trend.length ?? 0) >= 2 && data.activity ? "grid items-start gap-4 2xl:grid-cols-2" : "grid gap-4"}>
                  {data.payroll && <TrendPanel trend={data.payroll.trend} />}
                  {data.activity && <ActivityPanel activity={data.activity} todayIso={data.todayIso} />}
                </div>
              )}
            </div>
          )}
          {hasSide && (
            <div className="min-w-0 space-y-4">
              {data.workforce && <TodayPanel today={data.workforce} showAttendance={access.attendance} />}
              {data.deadlines && <DeadlinesPanel deadlines={data.deadlines} />}
              {data.readiness && <ReadinessPanel checked={data.readiness.checked} issues={data.readiness.issues} />}
              {data.headcount && <HeadcountPanel headcount={data.headcount} />}
            </div>
          )}
        </div>
      )}

      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2">
        {notice && (
          <p className="flex items-center gap-2 rounded-md border border-line bg-ink px-3 py-2 text-xs font-medium text-white shadow-lg animate-[dialogIn_140ms_var(--ease-out-quint)]">
            <CheckCircle2 className="h-4 w-4 text-brand-200" /> {notice}
          </p>
        )}
      </div>
    </PageFrame>
  );
}
