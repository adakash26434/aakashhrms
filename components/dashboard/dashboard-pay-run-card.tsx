import Link from "next/link";
import { ArrowRight, Check, Landmark, Play } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { Amount } from "@/components/kit/amount";
import { StatusChip } from "@/components/kit/status-chip";
import { RUN_STEPS } from "@/lib/engines/dashboard.engine";
import type { DashboardAccess, DashboardPayRun } from "@/lib/types/dashboard";
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
  if (status === "DRAFT" && access.payrollGenerate) return { label: "Continue the run", href: "/payroll/generate" };
  if (status === "UNDER_REVIEW" && access.payrollReview) return { label: "Review and approve", href: "/payroll/review" };
  if (status === "APPROVED" && access.payrollReview) return { label: "Lock the month", href: "/payroll/review" };
  return null;
}

function StepRail({ status }: { status: PayrollRunStatus }) {
  const current = RUN_STEPS.indexOf(status);
  const allDone = status === "LOCKED";
  return (
    <ol className="flex items-center" aria-label="Payroll progress">
      {RUN_STEPS.map((step, i) => {
        const done = i < current || allDone;
        const here = i === current && !allDone;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none" aria-current={here ? "step" : undefined}>
            <span className="flex flex-col items-center gap-1" title={STEP_LABEL[step]}>
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
              <span className={cn("whitespace-nowrap text-3xs", done || here ? "font-medium text-ink" : "text-ink-faint")}>{STEP_LABEL[step]}</span>
            </span>
            {i < RUN_STEPS.length - 1 && <span aria-hidden className={cn("mx-1 mb-4 h-px flex-1", i < current || allDone ? "bg-brand" : "bg-line-strong")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Pay run status for the latest month across all branch runs (4.1). */
export function DashboardPayRunCard({ payRun, access }: { payRun: DashboardPayRun; access: DashboardAccess }) {
  const { latest, next } = payRun;
  const action = latest ? nextAction(latest.status, access) : null;
  const canStart = !!next && access.payrollGenerate && !access.supportView;
  const button = "inline-flex h-8 items-center gap-1.5 rounded-md px-4 text-xs font-medium";

  return (
    <Panel level={3} id="dashboard-pay-run" title="Pay run" icon={<Landmark />} meta={latest?.label} href="/payroll" hrefLabel="Payroll">
      {!latest ? (
        <div className="space-y-3 p-4">
          <p className="text-xs text-ink-muted">No payroll has been run yet.</p>
          {canStart && (
            <Link href="/payroll/generate" className={cn(button, "bg-brand text-white hover:bg-brand-hover")}>
              <Play className="h-3.5 w-3.5" /> Start {next!.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
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
          <StepRail status={latest.status} />
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-2xs text-ink-muted">Net payable</dt>
              <dd className="font-semibold">
                <Amount value={latest.net} />
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-ink-muted">Employees</dt>
              <dd className="font-semibold tabular-nums">{latest.employees.toLocaleString("en-IN")}</dd>
            </div>
          </dl>
          {(action || canStart) && (
            <div className="flex flex-wrap gap-2">
              {action && (
                <Link href={action.href} className={cn(button, "bg-brand text-white hover:bg-brand-hover")}>
                  {action.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {canStart && (
                <Link href="/payroll/generate" className={cn(button, action ? "border border-line text-ink hover:bg-surface-sunken" : "bg-brand text-white hover:bg-brand-hover")}>
                  <Play className="h-3.5 w-3.5" /> Start {next!.label}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
