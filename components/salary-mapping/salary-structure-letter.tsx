"use client";

import { Fragment } from "react";
import { Printer } from "lucide-react";
import { bothCalendars } from "@/components/kit/date-cell";
import { WindowButton } from "@/components/kit/window";
import { addressLine } from "@/lib/constants/nepal-locations";
import type { LetterData } from "@/lib/services/salary-structure.service";
import type { CompanyProfileSetupData } from "@/lib/types/company-setup";
import { breakdownRows, BREAKDOWN_NOTE, type BreakdownRow } from "./salary-breakdown";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { cn } from "@/lib/utils";

/** One line of the old / new table; the line closing a part (earnings, deductions, net payable) has a darker, thicker rule. */
function LetterLine({ r, showOld, closing }: { r: LetterRow; showOld: boolean; closing: boolean }) {
  const diff = r.old === null ? null : r.now - r.old;
  const strong = r.style === "total" || r.style === "subtotal" || r.style === "net";
  return (
    <tr className={cn(closing ? "border-b-2 border-ink" : "border-b border-line", strong && "font-semibold", r.style === "muted" && "text-ink-muted")}>
      <td className="py-1.5 pr-3">{r.label}</td>
      {showOld && <td className="py-1.5 pr-3 text-right">{r.old === null ? "—" : money(r.old)}</td>}
      <td className="py-1.5 pr-3 text-right">{money(r.now)}</td>
      {showOld && <td className="py-1.5 text-right">{diff ? `${diff > 0 ? "+" : ""}${money(diff)}` : "—"}</td>}
    </tr>
  );
}

interface LetterRow {
  key: string;
  label: string;
  section: BreakdownRow["section"];
  style?: BreakdownRow["style"];
  old: number | null;
  now: number;
}

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The revised breakdown, with the previous amount of each line (lines only in the previous one included). */
function letterRows(now: BreakdownRow[], before: BreakdownRow[] | null): LetterRow[] {
  const old = new Map((before ?? []).map((r) => [r.key, r]));
  const rows: LetterRow[] = now.map((r) => ({ key: r.key, label: r.label, section: r.section, style: r.style, now: r.amount, old: before ? old.get(r.key)?.amount ?? 0 : null }));
  for (const r of before ?? []) {
    if (rows.some((x) => x.key === r.key)) continue;
    // A line that went away (an allowance removed): shown before its section's subtotal.
    const at = rows.findIndex((x) => x.section === r.section && (x.style === "subtotal" || x.style === "total"));
    rows.splice(at < 0 ? rows.length : at, 0, { key: r.key, label: r.label, section: r.section, style: r.style, now: 0, old: r.amount });
  }
  return rows;
}

/**
 * Printable salary revision (4.4), A4, in English: the salary breakdown (4.4b),
 * previous and revised, effective date and reason, with a signature line.
 * Someone's first salary prints as "Salary structure" (nothing to compare).
 * Print with Ctrl+P; the app frame is hidden in print.
 */
export function SalaryStructureLetter({ letter, company }: { letter: LetterData; company: CompanyProfileSetupData | null }) {
  const { employee, revision, previous } = letter;
  const rows = letterRows(breakdownRows(revision.totals, revision.lines), previous ? breakdownRows(previous.totals, previous.lines) : null);
  const sections = (["earnings", "deductions", "result"] as const).map((section) => ({ section, rows: rows.filter((r) => r.section === section) }));
  // The last line of earnings and of deductions, and net payable, close their part.
  const closingKeys = new Set([
    ...(["earnings", "deductions"] as const).map((s) => sections.find((x) => x.section === s)!.rows.at(-1)?.key),
    "netPayable",
  ].filter((k): k is string => !!k));
  const name = company?.displayName || company?.legalName || "";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <WindowButton variant="primary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </WindowButton>
      </div>
      <article className="rounded-md border border-line bg-white p-10 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* A div, not a header element: print styles hide every header element as app chrome. */}
        <div className="mb-8 border-b border-line-strong pb-4">
          <p className="text-lg font-semibold">{name}</p>
          {company?.headOfficeAddress && <p className="text-xs text-ink-muted">{addressLine(company.headOfficeAddress)}</p>}
          {company?.panVatNumber && <p className="text-xs text-ink-muted">PAN / VAT: {company.panVatNumber}</p>}
        </div>
        <div className="mb-6 flex justify-between text-xs">
          <div>
            <p className="font-semibold">{employee.fullName}</p>
            <p>Employee code: {employee.employeeCode}</p>
            <p>
              {employee.designation}
              {employee.department ? `, ${employee.department}` : ""}
            </p>
            {employee.branch && <p>{employee.branch}</p>}
          </div>
          <p>Date: {bothCalendars(nepalDateIso())}</p>
        </div>
        <h1 className="mb-4 text-base font-semibold underline underline-offset-4">{previous ? "Salary revision" : "Salary structure"}</h1>
        <p className="mb-4">
          Dear {employee.fullName.split(" ")[0]},
          <br />
          {previous ? "We are pleased to inform you that your salary has been revised with effect from " : "Your salary is set with effect from "}
          <strong>{bothCalendars(revision.effectiveFrom)}</strong>
          {revision.reason ? <> ({revision.reason})</> : null}. Your monthly salary is set out below.
        </p>
        <table className="mb-4 w-full tabular-nums">
          <thead>
            <tr className="border-b-2 border-line-input text-left text-xs uppercase tracking-wide">
              <th className="py-1.5 pr-3">Component (monthly, NPR)</th>
              {previous && <th className="py-1.5 pr-3 text-right">Previous</th>}
              <th className="py-1.5 pr-3 text-right">{previous ? "Revised" : "Amount"}</th>
              {previous && <th className="py-1.5 text-right">Change</th>}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ section, rows: list }) => (
              <Fragment key={section}>
                {section !== "result" && (
                  <tr>
                    <td colSpan={previous ? 4 : 2} className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {section === "earnings" ? "Earnings" : "Deductions"}
                    </td>
                  </tr>
                )}
                {list.map((r) => (
                  <LetterLine key={r.key} r={r} showOld={!!previous} closing={closingKeys.has(r.key)} />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="mb-10 text-xs text-ink-muted">
          Income tax is an estimate on the current tax rules; the payslip each month is final. {BREAKDOWN_NOTE}
          {previous ? " All other terms of your employment remain unchanged." : null}
        </p>
        <div className="flex justify-between pt-10 text-xs">
          <div>
            <p className="w-48 border-t border-line-input pt-1">{company?.signatory1Name || "Authorised signatory"}</p>
            {company?.signatory1Title && <p className="text-ink-muted">{company.signatory1Title}</p>}
          </div>
          <div className="text-right">
            <p className="ml-auto w-48 border-t border-line-input pt-1">Received by {employee.fullName}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
