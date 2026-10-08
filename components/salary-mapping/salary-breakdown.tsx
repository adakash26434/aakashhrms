"use client";

import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import type { StructureHead, StructureLines, StructureTotals } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

/**
 * The salary breakdown (4.4b): one wording on every screen, in the payslip's
 * terms (docs/redesign/02-design-system.md → Salary breakdown).
 */
export interface BreakdownRow {
  key: string;
  label: string;
  amount: number;
  section: "earnings" | "deductions" | "result";
  style?: "subtotal" | "total" | "net" | "muted";
  hint?: string;
}

export const BREAKDOWN_NOTE = "Overtime, absence, festival / remote allowances and loan installments are worked out in each month's payroll.";

/** Rows of a breakdown; lines that don't apply are left out. */
export function breakdownRows(t: StructureTotals, lines: StructureLines): BreakdownRow[] {
  const rows: BreakdownRow[] = [{ key: "basic", label: "Basic salary", amount: t.basic, section: "earnings" }];
  if (t.grade || lines.gradeCount) {
    const count = lines.gradeCount === 1 ? "1 grade" : `${lines.gradeCount} grades`;
    rows.push({ key: "grade", label: `Grade (${count}${lines.gradeManual ? ", by hand" : ""})`, amount: t.grade, section: "earnings" });
  }
  for (const i of t.items.filter((x) => x.type === "allowance")) rows.push({ key: `head:${i.id}`, label: i.name, amount: i.amount, section: "earnings" });
  rows.push({ key: "totalSalary", label: "Total salary", amount: t.totalSalary, section: "earnings", style: "subtotal", hint: "Basic + grade + allowances" });
  if (t.employerInEarnings) {
    rows.push({ key: "ssfEmployer", label: "SSF – employer contribution 20%", amount: t.employerInEarnings, section: "earnings", hint: "Paid by the company; deposited with SSF" });
    rows.push({ key: "grossEarnings", label: "Gross earnings", amount: t.grossEarnings, section: "earnings", style: "total", hint: "Total salary + SSF employer 20%" });
  }
  if (t.retirementDeduction) {
    const ssf = t.employerInEarnings > 0;
    rows.push({
      key: "retirement",
      label: ssf ? "SSF 31% (11% employee + 20% employer)" : "Provident fund – employee",
      amount: t.retirementDeduction,
      section: "deductions",
      hint: ssf ? "Deposited with SSF" : undefined,
    });
  }
  for (const i of t.items.filter((x) => x.type === "deduction")) rows.push({ key: `head:${i.id}`, label: i.name, amount: i.amount, section: "deductions" });
  if (t.incomeTax !== null) rows.push({ key: "incomeTax", label: "Income tax (estimate)", amount: t.incomeTax, section: "deductions", hint: "Same rules as payroll: tax slabs and SSF / PF / CIT / insurance relief" });
  rows.push({ key: "totalDeductions", label: "Total deductions", amount: t.totalDeductions, section: "deductions", style: "total" });
  rows.push({ key: "netPayable", label: t.incomeTax === null ? "Net payable (before income tax)" : "Net payable (estimate)", amount: t.netPayable, section: "result", style: "net", hint: "Gross earnings − total deductions" });
  rows.push({
    key: "costToCompany",
    label: "Cost to company",
    amount: t.costToCompany,
    section: "result",
    style: "muted",
    hint: t.retirementEmployer && !t.employerInEarnings ? "Gross earnings + provident fund (employer)" : "Gross earnings",
  });
  return rows;
}

const SECTION_TITLE = { earnings: "Earnings (monthly)", deductions: "Deductions (monthly)", result: null } as const;

/** A structure's monthly breakdown: earnings, deductions, net payable and cost to company. */
export function SalaryBreakdown({
  totals,
  lines,
  heads,
  compact,
  note = true,
  className,
}: {
  totals: StructureTotals;
  lines: StructureLines;
  heads: readonly StructureHead[];
  /** Tighter spacing, for side panes. */
  compact?: boolean;
  note?: boolean;
  className?: string;
}) {
  const rows = breakdownRows(totals, lines);
  // Assigned heads paid only in some months (festival, remote): named, not added.
  const occasional = heads.filter((h) => h.kind === "computed" && h.occasional && lines.computed.includes(h.id));
  return (
    <div className={cn("text-xs", className)}>
      {totals.problem && (
        <Notice tone="warning" className="mb-2">
          {totals.problem}
        </Notice>
      )}
      {(["earnings", "deductions", "result"] as const).map((section) => {
        const mine = rows.filter((r) => r.section === section);
        if (!mine.length) return null;
        const title = SECTION_TITLE[section];
        return (
          <section key={section} className={cn(section !== "earnings" && (compact ? "mt-2" : "mt-3"))}>
            {title && <h4 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>}
            <dl className={cn(compact ? "space-y-0.5" : "space-y-1")}>
              {mine.map((r) => (
                <div
                  key={r.key}
                  title={r.hint}
                  className={cn(
                    "flex items-baseline justify-between gap-3",
                    r.style === "subtotal" && "border-t border-line pt-1 font-medium text-ink",
                    r.style === "total" && "border-t border-line pt-1 font-semibold text-ink",
                    r.style === "net" && "rounded-md border border-brand/25 bg-brand-subtle px-2 py-1.5 text-sm font-semibold text-ink",
                    r.style === "muted" && "px-2 text-ink-muted"
                  )}
                >
                  <dt className={cn("min-w-0", !r.style && "text-ink-muted")}>{r.label}</dt>
                  <dd className="shrink-0 tabular-nums">
                    <Amount value={r.amount} emphasis={r.style === "net"} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      {occasional.length > 0 && (
        <p className="mt-2 text-2xs text-ink-muted">
          Also paid in some months: {occasional.map((h) => `${h.name} (${h.rule.toLowerCase()})`).join(", ")}.
        </p>
      )}
      {note && <p className={cn("text-3xs leading-relaxed text-ink-faint", compact ? "mt-2" : "mt-3")}>{BREAKDOWN_NOTE}</p>}
    </div>
  );
}
