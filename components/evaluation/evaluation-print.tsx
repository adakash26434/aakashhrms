"use client";

import { Printer } from "lucide-react";
import { WindowButton } from "@/components/kit/window";
import { bothCalendars } from "@/components/kit/date-cell";
import { activeStages, stageDef } from "@/lib/engines/evaluation.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { EvaluationDetail } from "@/lib/types/evaluation";
import type { LetterheadBase } from "@/lib/types/letter";

// Printable का.स.मू. form (G1), A4, bilingual headings: criteria × stages
// marks, weighted totals, grade and signature blocks. Print with Ctrl+P;
// the app frame is hidden in print.

export function EvaluationPrint({ evaluation, letterhead }: { evaluation: EvaluationDetail; letterhead: LetterheadBase }) {
  const stages = activeStages(evaluation.form);
  const marks = (stage: string, criterionId: string) => evaluation.scores[stage]?.find((s) => s.criterionId === criterionId)?.marks ?? null;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <WindowButton variant="primary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </WindowButton>
      </div>
      <article className="rounded-md border border-line bg-white p-10 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div aria-hidden className="-mx-10 -mt-10 mb-6 h-1 bg-[linear-gradient(90deg,var(--brand)_0_68%,var(--brand-red)_68%_100%)] print:mx-0 print:mt-0" />
        <div className="mb-5 border-b-2 border-brand pb-3 text-center">
          <p className="text-xl font-semibold tracking-tight text-brand-strong">{letterhead.name}</p>
          {letterhead.address && <p className="text-xs text-ink-muted">{letterhead.address}</p>}
          <p className="mt-2 text-base font-semibold underline underline-offset-4">कार्य सम्पादन मूल्याङ्कन फाराम · Performance evaluation</p>
          <p className="text-xs text-ink-muted">{evaluation.cycleLabel}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <p><span className="text-ink-muted">कर्मचारीको नाम / Name:</span> <strong>{evaluation.employeeName}</strong></p>
          <p><span className="text-ink-muted">संकेत नं. / Code:</span> {evaluation.employeeCode}</p>
          <p><span className="text-ink-muted">पद / Designation:</span> {evaluation.designation}</p>
          <p><span className="text-ink-muted">कार्यालय / Branch:</span> {evaluation.branch}</p>
        </div>

        <table className="mb-5 w-full tabular-nums text-xs">
          <thead>
            <tr className="border-b-2 border-line-input text-left uppercase tracking-wide">
              <th className="py-1.5 pr-2">मापदण्ड / Criterion</th>
              <th className="w-14 py-1.5 pr-2 text-right">पूर्णाङ्क</th>
              {stages.map((stage) => (
                <th key={stage} className="w-24 py-1.5 pr-2 text-right">
                  {stageDef(stage)?.nameNp} ({evaluation.form.weights[stage]}%)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evaluation.form.sections.map((section) => (
              <SectionPrintRows key={section.id} section={section} stages={stages} marks={marks} />
            ))}
            <tr className="border-t-2 border-ink font-semibold">
              <td className="py-1.5 pr-2">जम्मा (प्रतिशत) / Stage %</td>
              <td className="py-1.5 pr-2 text-right">100</td>
              {stages.map((stage) => (
                <td key={stage} className="py-1.5 pr-2 text-right">
                  {evaluation.stagePercents[stage] !== undefined ? `${evaluation.stagePercents[stage]}%` : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div className="mb-8 rounded-md border border-line-strong p-3 text-sm">
          <p>
            <span className="text-ink-muted">भारित कुल / Weighted total:</span> <strong>{evaluation.total !== null ? `${evaluation.total}%` : "मूल्याङ्कन जारी छ (in progress)"}</strong>
            {evaluation.band && (
              <>
                {" "}· <span className="text-ink-muted">स्तर / Grade:</span> <strong>{evaluation.bandNp || evaluation.band}{evaluation.bandNp && evaluation.band ? ` (${evaluation.band})` : ""}</strong>
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8 text-xs">
          {stages.map((stage) => (
            <div key={stage}>
              <p className="w-full border-t border-line-input pt-1 font-semibold">{stageDef(stage)?.nameNp} / {stageDef(stage)?.name}</p>
              <p className="text-ink-muted">{evaluation.raterNames[stage] ?? "—"}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-right text-xs text-ink-muted">मिति / Date: {bothCalendars(nepalDateIso())}</p>
      </article>
    </div>
  );
}

function SectionPrintRows({
  section,
  stages,
  marks,
}: {
  section: EvaluationDetail["form"]["sections"][number];
  stages: string[];
  marks: (stage: string, criterionId: string) => number | null;
}) {
  return (
    <>
      <tr>
        <td colSpan={2 + stages.length} className="pb-1 pt-2 font-semibold uppercase tracking-wide text-ink-muted">
          {section.nameNp || section.name}
        </td>
      </tr>
      {section.criteria.map((c) => (
        <tr key={c.id} className="border-b border-line">
          <td className="py-1 pr-2">
            {c.nameNp || c.name}
            {c.nameNp && c.name && <span className="text-ink-faint"> · {c.name}</span>}
          </td>
          <td className="py-1 pr-2 text-right">{c.max}</td>
          {stages.map((stage) => {
            const m = marks(stage, c.id);
            return (
              <td key={stage} className="py-1 pr-2 text-right">
                {m !== null ? m : "—"}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
