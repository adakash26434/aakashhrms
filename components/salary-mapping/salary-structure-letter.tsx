"use client";

import { Printer } from "lucide-react";
import { bothCalendars } from "@/components/kit/date-cell";
import { WindowButton } from "@/components/kit/window";
import { addressLine } from "@/lib/constants/nepal-locations";
import type { LetterData } from "@/lib/services/salary-structure.service";
import type { CompanyProfileSetupData } from "@/lib/types/company-setup";
import type { StructureLines } from "@/lib/types/salary-structure";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { cn } from "@/lib/utils";

/** One line of the old / new table. */
function LetterLine({ r, strong, showOld }: { r: { label: string; old: number | null; now: number }; strong?: boolean; showOld: boolean }) {
  const diff = r.old === null ? null : r.now - r.old;
  return (
    <tr className={cn("border-b border-line", strong && "font-semibold")}>
      <td className="py-1.5 pr-3">{r.label}</td>
      {showOld && <td className="py-1.5 pr-3 text-right">{r.old === null ? "—" : money(r.old)}</td>}
      <td className="py-1.5 pr-3 text-right">{money(r.now)}</td>
      {showOld && <td className="py-1.5 text-right">{diff ? `${diff > 0 ? "+" : ""}${money(diff)}` : "—"}</td>}
    </tr>
  );
}

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Salary revision letter (4.4), A4, in English: old and new pay per
 * component, totals, effective date and reason, with a signature line.
 * Print with Ctrl+P; the app frame is hidden in print.
 */
export function SalaryStructureLetter({ letter, company }: { letter: LetterData; company: CompanyProfileSetupData | null }) {
  const { employee, revision, previous, heads } = letter;
  const prev = previous?.lines ?? null;
  const rows: { label: string; old: number | null; now: number }[] = [
    { label: "Basic salary", old: prev?.basic ?? null, now: revision.lines.basic },
    { label: `Grade${revision.lines.gradeCount ? ` (${revision.lines.gradeCount})` : ""}`, old: prev?.gradeAmount ?? null, now: revision.lines.gradeAmount },
  ];
  const amountRow = (lines: StructureLines | null, id: string) => (lines ? lines.amounts[id] ?? 0 : null);
  for (const h of heads.filter((x) => x.kind === "amount" && x.type === "allowance")) {
    const now = revision.lines.amounts[h.id] ?? 0;
    const old = amountRow(prev, h.id);
    if (now || old) rows.push({ label: h.name, old, now });
  }
  const totals = [
    { label: "Monthly gross", old: previous?.totals.gross ?? null, now: revision.totals.gross },
    { label: "Net before tax", old: previous?.totals.netBeforeTax ?? null, now: revision.totals.netBeforeTax },
  ];
  const deductions: { label: string; old: number | null; now: number }[] = [];
  for (const h of heads.filter((x) => x.kind === "amount" && x.type === "deduction")) {
    const now = revision.lines.amounts[h.id] ?? 0;
    const old = amountRow(prev, h.id);
    if (now || old) deductions.push({ label: h.name, old, now });
  }
  if (revision.lines.scheme !== "none" || previous?.lines.scheme !== "none") {
    deductions.push({
      label: revision.lines.scheme === "ssf" ? "SSF 11% (employee)" : revision.lines.scheme === "pf" ? "Provident fund (employee)" : "Retirement contribution",
      old: previous ? previous.totals.retirementEmployee : null,
      now: revision.totals.retirementEmployee,
    });
  }
  const name = company?.displayName || company?.legalName || "";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <WindowButton variant="primary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print letter
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
        <h1 className="mb-4 text-base font-semibold underline underline-offset-4">Salary revision</h1>
        <p className="mb-4">
          Dear {employee.fullName.split(" ")[0]},
          <br />
          We are pleased to inform you that your salary has been revised with effect from <strong>{bothCalendars(revision.effectiveFrom)}</strong>
          {revision.reason ? <> ({revision.reason})</> : null}. Your monthly salary is set out below.
        </p>
        <table className="mb-4 w-full tabular-nums">
          <thead>
            <tr className="border-b-2 border-line-input text-left text-xs uppercase tracking-wide">
              <th className="py-1.5 pr-3">Component (monthly, NPR)</th>
              {previous && <th className="py-1.5 pr-3 text-right">Previous</th>}
              <th className="py-1.5 pr-3 text-right">Revised</th>
              {previous && <th className="py-1.5 text-right">Change</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <LetterLine key={r.label} r={r} showOld={!!previous} />
            ))}
            <LetterLine r={totals[0]} showOld={!!previous} strong />
            {deductions.map((r) => (
              <LetterLine key={r.label} r={r} showOld={!!previous} />
            ))}
            <LetterLine r={totals[1]} showOld={!!previous} strong />
          </tbody>
        </table>
        <p className="mb-10 text-xs text-ink-muted">
          Income tax (TDS) is deducted each month as required by law. All other terms of your employment remain unchanged.
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
