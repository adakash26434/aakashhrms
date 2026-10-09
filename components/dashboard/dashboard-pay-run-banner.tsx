import Link from "next/link";
import { ArrowRight, Check, Landmark, Play } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { StatusChip } from "@/components/kit/status-chip";
import { RUN_STEPS } from "@/lib/engines/dashboard.engine";
import type { DashboardAccess, DashboardPayRun, FiscalProgress } from "@/lib/types/dashboard";
import type { PayrollRunStatus } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<PayrollRunStatus, string> = {
  DRAFT: "Calculated",
  UNDER_REVIEW: "In review",
  APPROVED: "Approved",
  LOCKED: "Locked",
};

/** The one next action for the month, if the user may take it. */
function nextAction(status: PayrollRunStatus, access: DashboardAccess): { label: string; href: string } | null {
  if (access.supportView) return null;
  if (status === "DRAFT" && access.payrollGenerate) return { label: "Continue the run", href: "/payroll" };
  if (status === "UNDER_REVIEW" && access.payrollReview) return { label: "Review and approve", href: "/payroll" };
  if (status === "APPROVED" && access.payrollReview) return { label: "Lock the month", href: "/payroll" };
  return null;
}

function StepRail({ status }: { status: PayrollRunStatus }) {
  const current = RUN_STEPS.indexOf(status);
  const allDone = status === "LOCKED";
  return (
    <ol className="flex w-full items-center" aria-label="Payroll progress">
      {RUN_STEPS.map((step, i) => {
        const done = i < current || allDone;
        const here = i === current && !allDone;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none" aria-current={here ? "step" : undefined}>
            <span className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-2xs font-semibold",
                  done && "border-brand bg-brand text-white",
                  here && "border-brand bg-brand-subtle text-brand-strong ring-4 ring-brand/15",
                  !done && !here && "border-line-strong bg-surface text-ink-faint"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-2xs", done || here ? "font-medium text-ink" : "text-ink-faint")}>{STEP_LABEL[step]}</span>
            </span>
            {i < RUN_STEPS.length - 1 && <span aria-hidden className={cn("mx-2 mb-5 h-0.5 flex-1 rounded-full", i < current || allDone ? "bg-brand" : "bg-line-strong")} />}
          </li>
        );
      })}
    </ol>
  );
}

const button = "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-xs font-semibold";

/**
 * Current pay run (4.1): the first thing on the dashboard, as in most payroll
 * software. Month, progress across branch runs, the net to pay and the one
 * action that moves it forward.
 */
export function DashboardPayRunBanner({ payRun, access, fiscal }: { payRun: DashboardPayRun; access: DashboardAccess; fiscal: FiscalProgress }) {
  const { latest, next } = payRun;
  const action = latest ? nextAction(latest.status, access) : null;
  const canStart = !!next && access.payrollGenerate && !access.supportView;

  return (
    <section
      aria-label="Current pay run"
      className="relative overflow-hidden rounded-lg border border-line-card bg-surface shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-brand"
    >
      <div className="flex flex-col gap-4 py-4 pl-5 pr-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 items-start gap-3 lg:w-80 lg:shrink-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Landmark className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-wider text-ink-faint">Current pay run</p>
            {latest ? (
              <>
                <p className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-ink">{latest.label}</span>
                  <StatusChip status={latest.status} />
                </p>
                <p className="mt-0.5 text-2xs leading-snug text-ink-muted">
                  {fiscal.label} · month {fiscal.month} of 12
                  {latest.runCount > 1 &&
                    ` · ${latest.runCount} branch runs: ${RUN_STEPS.filter((s) => latest.statusCounts[s] > 0)
                      .map((s) => `${latest.statusCounts[s]} ${STEP_LABEL[s].toLowerCase()}`)
                      .join(", ")}`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-base font-semibold text-ink">No payroll has been run yet</p>
                <p className="mt-0.5 text-2xs text-ink-muted">
                  {fiscal.label} · month {fiscal.month} of 12
                </p>
              </>
            )}
          </div>
        </div>

        {latest && (
          <div className="min-w-0 flex-1 lg:px-2">
            <StepRail status={latest.status} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:shrink-0">
          {latest && (
            <dl className="flex gap-6">
              <div>
                <dt className="text-2xs text-ink-muted">Net payable</dt>
                <dd className="text-base font-semibold">
                  <Amount value={latest.net} />
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-ink-muted">Employees</dt>
                <dd className="text-base font-semibold tabular-nums">{latest.employees.toLocaleString("en-IN")}</dd>
              </div>
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            {action && (
              <Link href={action.href} className={cn(button, "bg-brand text-white shadow-sm hover:bg-brand-hover")}>
                {action.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {canStart && (
              <Link
                href="/payroll"
                className={cn(button, action ? "border border-line-strong bg-surface text-ink hover:bg-surface-sunken" : "bg-brand text-white shadow-sm hover:bg-brand-hover")}
              >
                <Play className="h-3.5 w-3.5" /> Start {next!.label}
              </Link>
            )}
            {!action && !canStart && (
              <Link href="/payroll" className={cn(button, "border border-line-strong bg-surface text-ink hover:bg-surface-sunken")}>
                Open payroll <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
