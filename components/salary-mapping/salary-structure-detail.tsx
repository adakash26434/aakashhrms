"use client";

import { Pencil, Printer } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell, useDateText } from "@/components/kit/date-cell";
import { FactBox, type Fact } from "@/components/kit/fact-box";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import type { RevisionSummary, SalaryStructureData, StructureRow } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

const SCHEME: Record<string, string> = { ssf: "SSF", pf: "Provident fund", none: "None" };

/** The pay heads of a revision as facts (only those that apply). */
export function breakdownFacts(rev: RevisionSummary, data: SalaryStructureData): { earnings: Fact[]; deductions: Fact[] } {
  const earnings: Fact[] = [
    { label: "Basic salary", value: <Amount value={rev.lines.basic} /> },
    { label: `Grade (${rev.lines.gradeCount})${rev.lines.gradeManual ? " · by hand" : ""}`, value: <Amount value={rev.lines.gradeAmount} /> },
  ];
  const deductions: Fact[] = [];
  for (const h of data.heads) {
    if (h.kind === "amount" && rev.lines.amounts[h.id]) {
      (h.type === "allowance" ? earnings : deductions).push({ label: h.name, value: <Amount value={rev.lines.amounts[h.id]} /> });
    } else if (h.kind === "computed" && rev.lines.computed.includes(h.id)) {
      (h.type === "allowance" ? earnings : deductions).push({ label: h.name, value: <span className="text-2xs font-normal text-ink-muted">{h.rule}</span> });
    }
  }
  if (rev.lines.scheme !== "none") {
    deductions.push({
      label: `${rev.lines.scheme === "ssf" ? "SSF 11%" : "PF"} (employee)`,
      value: <Amount value={rev.totals.retirementEmployee} />,
    });
  }
  return { earnings, deductions };
}

const pct = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : 0);

/** Detail pane: the current breakdown and every revision (history) with letters. */
export function SalaryStructureDetail({ row, data, onRevise }: { row: StructureRow; data: SalaryStructureData; onRevise?: (row: StructureRow) => void }) {
  const history = data.history[row.employeeId] ?? [];
  const current = row.current;
  const approved = history.filter((h) => h.status === "approved");
  const dateText = useDateText();

  return (
    <div className="space-y-3">
      {current ? (
        <FactBox
          title={`Current · effective ${dateText(current.effectiveFrom)}`}
          sections={[
            { title: "Earnings", facts: breakdownFacts(current, data).earnings },
            ...(breakdownFacts(current, data).deductions.length ? [{ title: "Deductions", facts: breakdownFacts(current, data).deductions }] : []),
            {
              title: "Monthly totals (before tax)",
              facts: [
                { label: "Gross", value: <Amount value={current.totals.gross} emphasis /> },
                { label: "Net before tax", value: <Amount value={current.totals.netBeforeTax} emphasis /> },
                { label: "Employer cost", value: <Amount value={current.totals.employerCost} /> },
                { label: "Retirement scheme", value: SCHEME[current.lines.scheme] },
              ],
            },
          ]}
          footer={
            onRevise && row.status !== "pending" ? (
              <WindowButton onClick={() => onRevise(row)}>
                <Pencil className="h-3.5 w-3.5" /> Revise salary
              </WindowButton>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-3 text-xs text-warning">
          No salary structure yet, so this person cannot be paid.
          {onRevise && (
            <WindowButton className="mt-2" onClick={() => onRevise(row)}>
              <Pencil className="h-3.5 w-3.5" /> Add the structure
            </WindowButton>
          )}
        </div>
      )}

      <section aria-label="Salary history" className="rounded-lg border border-line bg-surface">
        <h3 className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">History</h3>
        {history.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-faint">No revisions yet.</p>
        ) : (
          <ol className="divide-y divide-line">
            {history.map((h) => {
              const prev = approved.find((a) => a.id !== h.id && (a.effectiveFrom < h.effectiveFrom || (a.effectiveFrom === h.effectiveFrom && a.createdAt < h.createdAt)));
              const change = prev ? pct(prev.totals.gross, h.totals.gross) : 0;
              // Rows saved before revisions existed carry no reason or preparer.
              const legacy = !h.reason && !h.preparedBy;
              return (
                <li key={h.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">
                      <DateCell value={h.effectiveFrom} />
                    </span>
                    <StatusChip status={h.status === "withdrawn" ? "cancelled" : h.status} />
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2 text-ink-muted">
                    <span className="truncate">{h.reason || (legacy ? "Salary recorded before the revision history" : "—")}</span>
                    <span className="shrink-0 tabular-nums">
                      <Amount value={h.totals.gross} />
                      {prev && Math.abs(change) >= 0.05 && (
                        <span className={cn("ml-1.5 text-3xs font-semibold", change > 0 ? "text-success" : "text-danger")}>
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-3xs text-ink-faint">
                    <span className="truncate">
                      {h.preparedBy ? `By ${h.preparedBy}` : legacy ? "Existing record" : "By the system"}
                      {h.approvedBy && h.approvedBy !== h.preparedBy ? ` · approved by ${h.approvedBy}` : ""}
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
        )}
      </section>
    </div>
  );
}
