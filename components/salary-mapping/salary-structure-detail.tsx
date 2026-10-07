"use client";

import Link from "next/link";
import { Pencil, Plus, Printer } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell, useDateText } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { PaneActions, PaneFigures, PaneSection, useShowAll } from "@/components/kit/pane";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import type { RevisionSummary, SalaryStructureData, StructureRow } from "@/lib/types/salary-structure";
import { SalaryBreakdown } from "./salary-breakdown";
import { cn } from "@/lib/utils";
import { APPROVAL_ROUTE_LABEL } from "./salary-structure-approval";

const SCHEME: Record<string, string> = { ssf: "SSF", pf: "Provident fund", none: "None" };

const pct = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : 0);

/** Detail pane: Add salary structure / Revise salary on top, the current breakdown, and every revision (history) with letters. */
export function SalaryStructureDetail({ row, data, onRevise }: { row: StructureRow; data: SalaryStructureData; onRevise?: (row: StructureRow) => void }) {
  const history = data.history[row.employeeId] ?? [];
  const current = row.current;
  const dateText = useDateText();
  const setup = row.status === "setup";

  return (
    <div className="text-xs">
      {onRevise && (
        <PaneActions hint={row.status === "pending" ? "A salary change for this person is waiting for approval; revise again once it is decided." : undefined}>
          {row.status !== "pending" && (
            <WindowButton variant="primary" onClick={() => onRevise(row)}>
              {setup || !current ? <Plus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {setup || !current ? "Add salary structure" : "Revise salary"}
            </WindowButton>
          )}
        </PaneActions>
      )}

      {!row.levelKnown && (
        <PaneSection>
          <Notice tone="warning" title="Level not in the level list">
            The level saved for this person ({row.levelCode ? `"${row.levelCode}"` : "none"}) is not in Setup → Levels, so templates by level and the
            level&apos;s starting salary do not apply.{" "}
            <Link href={`/workforce/employees/${row.employeeId}/edit#section-job`} className="font-medium text-brand-strong underline-offset-2 hover:underline">
              Correct the level
            </Link>
          </Notice>
        </PaneSection>
      )}
      {current ? (
        <>
          {setup && (
            <PaneSection>
              <Notice tone="warning" title="Only basic + grade so far">
                Saved from the employee form. Add the retirement scheme{row.ssfExpected ? " (SSF)" : ""}, allowances and deductions, or confirm that none apply.
              </Notice>
            </PaneSection>
          )}
          <PaneSection title="Current" aside={`from ${dateText(current.effectiveFrom)}`}>
            <PaneFigures
              items={[
                { label: "Total salary", value: <Amount value={current.totals.totalSalary} />, strong: true },
                { label: current.totals.incomeTax === null ? "Net payable (before tax)" : "Net payable (est.)", value: <Amount value={current.totals.netPayable} /> },
                { label: "Cost to company", value: <Amount value={current.totals.costToCompany} /> },
              ]}
            />
            <p className="mt-1.5 text-2xs text-ink-muted">Retirement scheme: {SCHEME[current.lines.scheme]}</p>
          </PaneSection>
          <PaneSection title="Breakdown">
            <SalaryBreakdown totals={current.totals} lines={current.lines} heads={data.heads} compact />
          </PaneSection>
        </>
      ) : (
        <PaneSection>
          <Notice tone="warning">No salary structure yet, so this person cannot be paid.</Notice>
        </PaneSection>
      )}

      <PaneSection title="History" count={history.length || undefined}>
        {history.length === 0 ? <p className="text-ink-faint">No revisions yet.</p> : <SalaryHistory history={history} data={data} />}
      </PaneSection>
    </div>
  );
}

function SalaryHistory({ history, data }: { history: RevisionSummary[]; data: SalaryStructureData }) {
  const approved = history.filter((h) => h.status === "approved");
  const { shown, toggle } = useShowAll(history, 5);
  return (
    <>
      <ol className="space-y-2.5">
        {shown.map((h) => {
          const prev = approved.find((a) => a.id !== h.id && (a.effectiveFrom < h.effectiveFrom || (a.effectiveFrom === h.effectiveFrom && a.createdAt < h.createdAt)));
          const change = prev ? pct(prev.totals.totalSalary, h.totals.totalSalary) : 0;
          // Rows saved before revisions existed carry no reason or preparer.
          const legacy = !h.reason && !h.preparedBy;
          const route = data.batches.find((b) => b.id === h.batchId)?.approvalRoute;
          return (
            <li key={h.id} className="border-t border-line pt-2.5 first:border-0 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">
                  <DateCell value={h.effectiveFrom} />
                </span>
                <StatusChip status={h.status === "withdrawn" ? "cancelled" : h.status} />
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2 text-ink-muted">
                <span className="min-w-0">{h.reason || (legacy ? "Salary recorded before the revision history" : "—")}</span>
                <span className="shrink-0 tabular-nums">
                  <Amount value={h.totals.totalSalary} />
                  {prev && Math.abs(change) >= 0.05 && (
                    <span className={cn("ml-1.5 text-3xs font-semibold", change > 0 ? "text-success" : "text-danger")}>
                      {change > 0 ? "+" : ""}
                      {change.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-3xs text-ink-faint">
                <span className="min-w-0">
                  {h.preparedBy ? `By ${h.preparedBy}` : legacy ? "Existing record" : "By the system"}
                  {h.approvedBy && h.approvedBy !== h.preparedBy ? ` · approved by ${h.approvedBy}` : ""}
                  {route === "final_approve" ? ` · ${APPROVAL_ROUTE_LABEL[route].toLowerCase()}` : ""}
                </span>
                {h.status === "approved" && (
                  <a href={`/workforce/salary-mapping/letter/${h.id}`} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 font-medium text-brand-strong hover:underline">
                    <Printer aria-hidden className="h-3 w-3" /> Letter
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {toggle}
    </>
  );
}
