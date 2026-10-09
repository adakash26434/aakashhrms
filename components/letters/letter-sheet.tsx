"use client";

import { Fragment } from "react";
import { Printer } from "lucide-react";
import { WindowButton } from "@/components/kit/window";
import { bothCalendars } from "@/components/kit/date-cell";
import type { LetterDetail, LetterheadData } from "@/lib/types/letter";
import { cn } from "@/lib/utils";

// HR letters (G2): the printed letter, A4, matching the salary revision
// letter's conventions (Ctrl+P; the app frame is hidden in print). The body
// is the frozen text rendered at issue time — plain text only, shown as
// paragraphs; no HTML ever reaches the page from user input.

/** Letters addressed to the employee carry the recipient block and a received-by line. */
const CERTIFICATE_KINDS = new Set(["experience", "noc"]);

function Paragraphs({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 whitespace-pre-line">
          {p}
        </p>
      ))}
    </>
  );
}

export function LetterSheet({ letter, letterhead, actions }: { letter: LetterDetail; letterhead: LetterheadData; actions?: React.ReactNode }) {
  const np = letter.language === "np";
  const addressed = !CERTIFICATE_KINDS.has(letter.kind);
  const voided = letter.status === "voided";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
        {actions}
        <WindowButton variant="primary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </WindowButton>
      </div>
      <article className={cn("relative overflow-hidden rounded-md border border-line bg-white text-sm leading-relaxed text-ink shadow-sm print:border-0 print:shadow-none", np && "leading-7")}>
        {/* Letterhead: the company's green → red rule, name, address and PAN. */}
        <div aria-hidden className="h-1 bg-[linear-gradient(90deg,var(--brand)_0_68%,var(--brand-red)_68%_100%)] print:h-1" />
        <div className="p-10 print:p-0 print:pt-6">
          <div className="mb-6 border-b-2 border-brand pb-3 text-center">
            <p className="text-2xl font-semibold tracking-tight text-brand-strong">{letterhead.name}</p>
            {letterhead.address && <p className="mt-0.5 text-xs text-ink-muted">{letterhead.address}</p>}
            {letterhead.pan && <p className="text-xs text-ink-muted">PAN / VAT: {letterhead.pan}</p>}
          </div>

          <div className="mb-6 flex items-start justify-between text-xs">
            <div>
              <p>
                {np ? "च.नं." : "Ref. no."}: <span className="font-semibold">{letter.letterNumber}</span>
              </p>
              {addressed && (
                <div className="mt-4">
                  <p className="font-semibold">{np ? `श्री ${letter.employeeName}` : letter.employeeName}</p>
                  <p className="text-ink-muted">
                    {np ? "कर्मचारी संकेत नं." : "Employee code"}: {letter.employeeCode}
                  </p>
                </div>
              )}
            </div>
            <p>
              {np ? "मिति" : "Date"}: {np ? `${letter.issuedDateBs} (${letter.issuedDateAd})` : bothCalendars(letter.issuedDateAd)}
            </p>
          </div>

          <h1 className="mb-5 text-center text-base font-semibold underline underline-offset-4">
            {np ? `विषय: ${letter.subject}` : letter.subject}
          </h1>

          <Paragraphs text={letter.body} />

          <div className="flex items-end justify-between pt-12 text-xs">
            {addressed ? (
              <div>
                <p className="w-48 border-t border-line-input pt-1">{np ? "बुझिलिनेको सही" : `Received by ${letter.employeeName}`}</p>
                {np && <p className="text-ink-muted">श्री {letter.employeeName}</p>}
              </div>
            ) : (
              <div />
            )}
            <div className="text-right">
              <p className="ml-auto w-48 border-t border-line-input pt-1 font-semibold">{letterhead.signatoryName || (np ? "अधिकार प्राप्त अधिकारी" : "Authorised signatory")}</p>
              {letterhead.signatoryTitle && <p className="text-ink-muted">{letterhead.signatoryTitle}</p>}
              <p className="text-ink-muted">{letterhead.name}</p>
            </div>
          </div>

          {voided && (
            <Fragment>
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="-rotate-[24deg] select-none border-4 border-danger px-8 py-2 text-4xl font-bold uppercase tracking-widest text-danger opacity-30">
                  {np ? "रद्द गरिएको" : "Voided"}
                </p>
              </div>
              <p className="mt-8 border-t border-line pt-2 text-xs text-danger">
                {np ? "रद्द गरिएको" : "Voided"}: {letter.voidReason} — {letter.voidedByName ?? ""}
              </p>
            </Fragment>
          )}
        </div>
      </article>
    </div>
  );
}
