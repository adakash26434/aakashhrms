"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { RECORD_GAP_LABEL } from "@/lib/engines/employee.engine";
import type { EmployeeFacts, EmployeeProfile, EmployeeRecordTab } from "@/lib/types/employee";
import { cn } from "@/lib/utils";

function Part({ title, action, tone, children }: { title: string; action?: ReactNode; tone?: "warning"; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn("rounded-lg border bg-surface shadow-sm", tone === "warning" ? "border-warning/40" : "border-line-card")}>
      <header className={cn("flex items-center justify-between gap-2 rounded-t-lg border-b px-3 py-1.5", tone === "warning" ? "border-warning/30 bg-warning-subtle" : "border-line-strong bg-canvas/70")}>
        <h3 className={cn("text-3xs font-semibold uppercase tracking-wide", tone === "warning" ? "text-warning" : "text-ink-muted")}>{title}</h3>
        {action}
      </header>
      <div className="px-3 py-2 text-xs">{children}</div>
    </section>
  );
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("text-right tabular-nums", strong ? "font-semibold text-ink" : "text-ink")}>{children}</span>
    </div>
  );
}

function OpenTab({ tab, onOpen, label = "Open" }: { tab: EmployeeRecordTab; onOpen: (tab: EmployeeRecordTab) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onOpen(tab)} className="inline-flex cursor-pointer items-center text-3xs font-medium text-brand-strong hover:underline">
      {label} <ChevronRight aria-hidden className="h-3 w-3" />
    </button>
  );
}

const none = <span className="text-ink-faint">None yet</span>;

/**
 * FactBox pane (as on Business Central card pages): this employee at a glance
 * across modules, beside every tab. Parts the user may not see are left out.
 */
export function EmployeeRecordFactBox({
  profile,
  facts,
  canEdit,
  onOpenTab,
}: {
  profile: EmployeeProfile;
  facts: EmployeeFacts;
  canEdit: boolean;
  onOpenTab: (tab: EmployeeRecordTab) => void;
}) {
  const { attendance, leave, lastPayslip, loans } = facts;
  return (
    <aside aria-label="At a glance" className="space-y-3">
      {profile.gaps.length > 0 && (
        <Part
          title="Records to fix"
          tone="warning"
          action={
            canEdit && (
              <Link href={`/workforce/employees/${profile.id}/edit`} className="text-3xs font-medium text-warning underline underline-offset-2">
                Fix now
              </Link>
            )
          }
        >
          <ul className="space-y-1">
            {profile.gaps.map((g) => (
              <li key={g} className="flex items-center gap-1.5 text-warning">
                <TriangleAlert aria-hidden className="h-3 w-3 shrink-0" />
                {RECORD_GAP_LABEL[g]}
              </li>
            ))}
          </ul>
        </Part>
      )}

      {lastPayslip !== undefined && (
        <Part title="Last payslip" action={<OpenTab tab="payslips" onOpen={onOpenTab} />}>
          {lastPayslip ? (
            <>
              <p className="text-2xs text-ink-muted">{lastPayslip.periodLabel}</p>
              <p className="text-lg font-semibold leading-tight text-ink">
                <Amount value={lastPayslip.net} prefix="NPR" />
              </p>
              <Row label="Gross">
                <Amount value={lastPayslip.gross} />
              </Row>
            </>
          ) : (
            none
          )}
        </Part>
      )}

      {attendance !== undefined && (
        <Part title={attendance ? `Attendance · ${attendance.monthLabel}` : "Attendance"} action={<OpenTab tab="attendance" onOpen={onOpenTab} />}>
          {attendance ? (
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { label: "Present", value: attendance.present, tone: "text-success" },
                { label: "Leave", value: attendance.leave, tone: "text-info" },
                { label: "Absent", value: attendance.absent, tone: attendance.absent ? "text-danger" : "text-ink" },
                { label: "No entry", value: attendance.notRecorded, tone: "text-ink-faint" },
              ].map((c) => (
                <div key={c.label} className="rounded-md bg-surface-sunken/70 px-1 py-1.5">
                  <p className={cn("text-sm font-semibold tabular-nums", c.tone)}>{c.value}</p>
                  <p className="text-3xs text-ink-muted">{c.label}</p>
                </div>
              ))}
            </div>
          ) : (
            none
          )}
        </Part>
      )}

      {leave !== undefined && (
        <Part title={leave?.fiscalYearLabel ? `Leave left · ${leave.fiscalYearLabel}` : "Leave left"} action={<OpenTab tab="leave" onOpen={onOpenTab} />}>
          {leave ? (
            <>
              <Row label="All types" strong>
                {leave.balance} days
              </Row>
              {leave.types.map((t) => (
                <Row key={t.name} label={t.name.replace(/\s*\(.*\)$/, "")}>
                  {t.balance}
                </Row>
              ))}
            </>
          ) : (
            none
          )}
        </Part>
      )}

      {loans !== undefined && (
        <Part title="Loans" action={<OpenTab tab="loans" onOpen={onOpenTab} />}>
          {loans && loans.active > 0 ? (
            <>
              <Row label="Outstanding" strong>
                <Amount value={loans.outstanding} />
              </Row>
              <Row label="Open loans">{loans.active}</Row>
            </>
          ) : (
            <span className="text-ink-faint">No open loans</span>
          )}
        </Part>
      )}

      <Part title="Self-service login">
        {profile.access ? (
          <>
            <Row label="Status">
              <span className={profile.access.state === "active" ? "text-success" : "text-warning"}>
                {{ active: "Active", pending: "Not signed in yet", disabled: "Switched off" }[profile.access.state]}
              </span>
            </Row>
            <Row label="Last sign-in">{profile.access.lastLoginAt ? <DateCell value={profile.access.lastLoginAt} /> : "Never"}</Row>
          </>
        ) : (
          <span className="text-ink-faint">No login</span>
        )}
      </Part>
    </aside>
  );
}
