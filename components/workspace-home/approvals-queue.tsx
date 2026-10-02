"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2, TriangleAlert, Users, Wallet } from "lucide-react";
import { updateLeaveStatusAction } from "@/app/actions/leave.actions";
import { Worklist } from "@/components/kit/worklist";
import { Panel } from "@/components/kit/panel";
import { DateCell } from "@/components/kit/date-cell";
import { StatusChip, TONE_CLASSES } from "@/components/kit/status-chip";
import type { QueueLeave } from "@/lib/home/leave-queue";
import { cn } from "@/lib/utils";

const APPROVALS_HREF = "/timeAndLeave/leaves?tab=approvals";

function days(n: number) {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function DateRange({ from, to }: { from: string; to: string }) {
  return from === to ? (
    <DateCell value={from} />
  ) : (
    <>
      <DateCell value={from} /> – <DateCell value={to} />
    </>
  );
}

function Fact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "warning" | "danger" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-xs">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("text-right font-medium tabular-nums", tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-ink")}>{children}</dd>
    </div>
  );
}

function LeaveDetail({ item }: { item: QueueLeave }) {
  const after = item.balance === null ? null : item.balance - item.days;
  const unpaid = item.payType === "Non-Pay" || item.payType === "Partial-Pay";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{item.employeeName}</p>
          <p className="text-2xs text-ink-faint">
            <span className="font-code">{item.employeeCode}</span> · {item.department}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {item.waitingDays !== null && item.waitingDays > 0 && (
            <StatusChip status="pending" label={`Waiting ${days(item.waitingDays)}`} />
          )}
          {unpaid && (
            <span className={cn("inline-flex h-5 items-center gap-1 rounded-full border px-2 text-2xs font-medium", TONE_CLASSES.warning)}>
              <Wallet aria-hidden className="h-3 w-3" />
              {item.payType === "Non-Pay" ? "Unpaid: reduces salary" : "Part-paid"}
            </span>
          )}
        </div>
      </div>

      <dl className="divide-y divide-line rounded-md border border-line px-3">
        <Fact label="Leave type">{item.leaveType}</Fact>
        <Fact label="Dates">
          <DateRange from={item.from} to={item.to} />
        </Fact>
        <Fact label="Days">{days(item.days)}</Fact>
        <Fact label="Applied on">
          <DateCell value={item.appliedOn} />
        </Fact>
        {item.balance !== null && (
          <Fact label="Balance after approval" tone={after !== null && after < 0 ? "danger" : after !== null && after < 1 ? "warning" : undefined}>
            {item.balance} → {after}
            {after !== null && after < 0 && " (over balance)"}
          </Fact>
        )}
      </dl>

      {item.reason && (
        <blockquote className="border-l-2 border-line-strong pl-3 text-xs italic text-ink-muted">“{item.reason}”</blockquote>
      )}

      {item.overlaps.length > 0 && (
        <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
          <Users aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <span className="font-semibold">Also off in {item.department}:</span>{" "}
            {item.overlaps.map((o, i) => (
              <span key={`${o.name}-${i}`}>
                {i > 0 && ", "}
                {o.name}
                {o.status === "Pending" && " (pending)"}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Home approvals queue (E3 worklist). Decisions go through the hardened
 * updateLeaveStatusAction (S17): scope, self-approval and race checks, audit.
 */
export function ApprovalsQueue({
  items,
  canDecide,
  scopeLabel,
  onDecided,
  decideOverride,
}: {
  items: QueueLeave[];
  canDecide: boolean;
  scopeLabel: string | null;
  onDecided: (message: string) => void;
  /** Dev preview only (/dev/home): decide locally instead of calling the server. */
  decideOverride?: (item: QueueLeave, status: "Approved" | "Rejected", reason?: string) => Promise<void>;
}) {
  const router = useRouter();
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const open = items.filter((i) => !decided.has(i.id));

  const decide = async (item: QueueLeave, status: "Approved" | "Rejected", reason?: string) => {
    if (decideOverride) {
      await decideOverride(item, status, reason);
    } else {
      const res = await updateLeaveStatusAction(item.id, status, undefined, reason);
      if (!res.success) throw new Error(res.error);
    }
    setDecided((prev) => new Set(prev).add(item.id));
    onDecided(`${status === "Approved" ? "Approved" : "Rejected"} ${item.employeeName}'s ${item.leaveType.toLowerCase()} (${days(item.days)}).`);
    if (!decideOverride) router.refresh();
  };

  const panelProps = {
    id: "home-approvals",
    title: "Leave approvals",
    icon: <CalendarCheck2 />,
    count: open.length,
    countTone: "attention" as const,
    meta: scopeLabel ?? undefined,
    href: APPROVALS_HREF,
    hrefLabel: "All requests",
  };

  if (!canDecide) {
    return (
      <Panel {...panelProps}>
        {open.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-muted">No leave requests are waiting for a decision.</p>
        ) : (
          <>
            <p className="flex items-center gap-1.5 border-b border-line bg-surface-sunken px-3 py-1.5 text-2xs text-ink-muted">
              <TriangleAlert className="h-3 w-3" /> View only: you can see these requests but not decide them.
            </p>
            <ul className="divide-y divide-line">
              {open.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{item.employeeName}</span>
                    <span className="block truncate text-2xs text-ink-muted">
                      {item.leaveType} · {days(item.days)}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs text-ink-muted">
                    <DateRange from={item.from} to={item.to} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    );
  }

  if (open.length === 0) {
    return (
      <Panel {...panelProps}>
        <p role="status" className="flex items-center gap-2 px-3 py-3 text-xs text-ink-muted">
          <CheckCircle2 className="h-4 w-4 text-success" />
          All caught up. No leave requests are waiting for you.
        </p>
      </Panel>
    );
  }

  return (
    <Panel {...panelProps} bodyClassName="[&>div]:rounded-none [&>div]:border-0">
      <Worklist
        title="Waiting for you"
        items={open}
        getId={(i) => i.id}
        renderSummary={(i) => (
          <span className="block min-w-0">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-ink">{i.employeeName}</span>
              {i.overlaps.length > 0 && <Users aria-label="Overlaps with colleagues" className="h-3 w-3 shrink-0 text-warning" />}
            </span>
            <span className="block truncate text-2xs text-ink-muted">
              {i.leaveType} · {days(i.days)}
            </span>
            <span className="block truncate text-2xs text-ink-faint">
              <DateRange from={i.from} to={i.to} />
            </span>
          </span>
        )}
        renderDetail={(i) => <LeaveDetail item={i} />}
        onApprove={(i) => decide(i, "Approved")}
        onReject={(i, reason) => decide(i, "Rejected", reason)}
      />
      {items.length >= 50 && (
        <p className="border-t border-line px-3 py-1.5 text-2xs text-ink-muted">
          Showing the 50 oldest. <Link href={APPROVALS_HREF} className="text-brand-strong hover:underline">See every request</Link>
        </p>
      )}
    </Panel>
  );
}
