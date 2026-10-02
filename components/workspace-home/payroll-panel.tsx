import Link from "next/link";
import { ArrowRight, Check, Landmark, Play, TrendingUp, TriangleAlert } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { Amount } from "@/components/kit/amount";
import { StatusChip } from "@/components/kit/status-chip";
import { EmptyState } from "@/components/kit/empty-state";
import { RUN_STEPS, VARIANCE_FLAG_PCT, type TrendPoint } from "@/lib/home/payroll-period";
import type { HomeAccess, HomePayroll } from "@/lib/home/types";
import type { PayrollRunStatus } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<PayrollRunStatus, string> = {
  DRAFT: "Calculated",
  UNDER_REVIEW: "In review",
  APPROVED: "Approved",
  LOCKED: "Locked",
};

/** The one thing to do next for the period, if the user may do it. */
function nextAction(status: PayrollRunStatus, access: HomeAccess): { label: string; href: string } | null {
  if (status === "DRAFT" && access.payrollGenerate) return { label: "Continue the run", href: "/payroll/generate" };
  if (status === "UNDER_REVIEW" && access.payrollReview) return { label: "Review and approve", href: "/payroll/review" };
  if (status === "APPROVED" && access.payrollReview) return { label: "Lock the period", href: "/payroll/review" };
  return null;
}

function StepRail({ status }: { status: PayrollRunStatus }) {
  const current = RUN_STEPS.indexOf(status);
  return (
    <ol className="flex items-center" aria-label="Payroll progress">
      {RUN_STEPS.map((step, i) => {
        const done = i < current || status === "LOCKED";
        const here = i === current && status !== "LOCKED";
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none" aria-current={here ? "step" : undefined}>
            <span className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-3xs font-semibold",
                  done && "border-brand bg-brand text-white",
                  here && "border-brand bg-brand-subtle text-brand-strong ring-2 ring-brand/20",
                  !done && !here && "border-line-strong bg-surface text-ink-faint"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-3xs font-medium", done || here ? "text-ink" : "text-ink-faint")}>{STEP_LABEL[step]}</span>
            </span>
            {i < RUN_STEPS.length - 1 && <span aria-hidden className={cn("mx-1 mb-4 h-px flex-1", i < current || status === "LOCKED" ? "bg-brand" : "bg-line-strong")} />}
          </li>
        );
      })}
    </ol>
  );
}

function Figure({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="truncate text-2xs text-ink-muted">{label}</dt>
      <dd className={cn("truncate tabular-nums", strong ? "text-base font-semibold text-ink" : "text-sm font-medium text-ink")}>{children}</dd>
    </div>
  );
}

export function PayrollPanel({ payroll, access }: { payroll: HomePayroll; access: HomeAccess }) {
  const { latest, next } = payroll;
  const action = latest ? nextAction(latest.status, access) : null;
  const canStart = !!next && access.payrollGenerate;

  return (
    <Panel id="home-payroll" title="Payroll" icon={<Landmark />} meta={latest?.label} href="/payroll" hrefLabel="Payroll">
      {!latest ? (
        <EmptyState
          title="No payroll has been run yet"
          description="Calculate the first month to see totals, progress and deadlines here."
          action={
            canStart ? (
              <Link href="/payroll/generate" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover">
                <Play className="h-3.5 w-3.5" /> Start {next!.label}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-3">
            <p className="text-sm font-semibold text-ink">{latest.label}</p>
            <StatusChip status={latest.status} />
            {latest.runCount > 1 && (
              <span className="text-2xs text-ink-muted">
                {latest.runCount} branch runs ·{" "}
                {RUN_STEPS.filter((s) => latest.statusCounts[s] > 0)
                  .map((s) => `${latest.statusCounts[s]} ${STEP_LABEL[s].toLowerCase()}`)
                  .join(", ")}
              </span>
            )}
          </div>
          <div className="px-4 pb-1 pt-3">
            <StepRail status={latest.status} />
          </div>
          <dl className="grid grid-cols-2 divide-line border-y border-line sm:grid-cols-4 sm:divide-x">
            <Figure label="Gross pay">
              <Amount value={latest.gross} />
            </Figure>
            <Figure label="Deductions">
              <Amount value={latest.deductions} />
            </Figure>
            <Figure label="Net payable" strong>
              <Amount value={latest.net} emphasis />
            </Figure>
            <Figure label="Employees paid">{latest.employees.toLocaleString("en-IN")}</Figure>
          </dl>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
            <span className="text-2xs text-ink-muted">
              TDS <Amount value={latest.tds} className="font-medium text-ink" /> · SSF <Amount value={latest.ssf} className="font-medium text-ink" />
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {action && (
                <Link href={action.href} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover">
                  {action.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {canStart && (
                <Link
                  href="/payroll/generate"
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
                    action ? "border border-line text-ink hover:bg-surface-sunken" : "bg-brand text-white hover:bg-brand-hover"
                  )}
                >
                  <Play className="h-3.5 w-3.5" /> Start {next!.label}
                </Link>
              )}
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Net pay over the last periods as plain bars, with large swings flagged (F1 preview). */
export function TrendPanel({ trend }: { trend: TrendPoint[] }) {
  // One period is not a trend; the panel appears from the second period on.
  if (trend.length < 2) return null;
  const max = Math.max(...trend.map((t) => t.gross), 1);
  return (
    <Panel id="home-trend" title="Net pay by period" icon={<TrendingUp />} meta={`Last ${trend.length}`} href="/reports/salary-sheet" hrefLabel="Salary sheet">
      <div className="px-3 pb-2 pt-3">
        <div className="flex h-36 items-end gap-2" aria-hidden>
          {trend.map((t) => {
            const flagged = t.netChangePct !== null && Math.abs(t.netChangePct) >= VARIANCE_FLAG_PCT;
            return (
              <div key={t.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${t.label}: net ${t.net.toLocaleString("en-IN")}, gross ${t.gross.toLocaleString("en-IN")}`}>
                {t.netChangePct !== null && (
                  <span className={cn("text-3xs font-medium tabular-nums", flagged ? "text-warning" : "text-ink-faint")}>
                    {flagged && <TriangleAlert className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" />}
                    {t.netChangePct > 0 ? "+" : ""}
                    {t.netChangePct}%
                  </span>
                )}
                <div className="relative flex w-full max-w-12 flex-1 items-end">
                  <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-brand-100" style={{ height: `${(t.gross / max) * 100}%` }} />
                  <div
                    className={cn("relative w-full rounded-t-sm", t.locked ? "bg-brand" : "bg-brand/45 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(255_255_255/0.35)_3px,rgb(255_255_255/0.35)_6px)]")}
                    style={{ height: `${(t.net / max) * 100}%` }}
                  />
                </div>
                <span className="text-3xs text-ink-muted">{t.shortLabel}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand" /> Net, locked
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand/45" /> Net, not locked
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand-100" /> Gross
          </span>
          <span className="ml-auto">Change of {VARIANCE_FLAG_PCT}% or more is flagged</span>
        </div>
        <table className="sr-only">
          <caption>Net and gross pay by period</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Gross</th>
              <th scope="col">Net</th>
              <th scope="col">Change</th>
              <th scope="col">Locked</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((t) => (
              <tr key={t.key}>
                <th scope="row">{t.label}</th>
                <td>{t.gross.toLocaleString("en-IN")}</td>
                <td>{t.net.toLocaleString("en-IN")}</td>
                <td>{t.netChangePct === null ? "—" : `${t.netChangePct}%`}</td>
                <td>{t.locked ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
