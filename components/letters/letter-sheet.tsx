"use client";

import { Fragment } from "react";
import { Printer } from "lucide-react";
import { WindowButton } from "@/components/kit/window";
import { bothCalendars } from "@/components/kit/date-cell";
import { FONT_CLASS, LOGO_CLASS, MARGIN_CLASS, SPACING_CLASS, blockLabel, kindLayout, type SignatureBlock } from "@/lib/engines/letter-design.engine";
import type { LetterDetail, LetterheadData } from "@/lib/types/letter";
import { cn } from "@/lib/utils";

// HR letters (G2): the printed letter, A4, matching the salary revision
// letter's conventions (Ctrl+P; the app frame is hidden in print). The body
// is the frozen text rendered at issue time — plain text only, shown as
// paragraphs; no HTML ever reaches the page from user input. How it is drawn
// (letterhead, text size, margins, signature boxes) is the company's letter
// design; the words are frozen at issue.

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

function SignatureBox({ block, letter, letterhead, np }: { block: SignatureBlock; letter: LetterDetail; letterhead: LetterheadData; np: boolean }) {
  const label = blockLabel(block, np);
  let name = "";
  let title = "";
  if (block === "signatory") {
    name = letterhead.signatoryName;
    title = letterhead.signatoryTitle;
  } else if (block === "signatory2") {
    name = letterhead.signatory2Name;
    title = letterhead.signatory2Title;
  } else if (block === "received" || block === "employee") {
    name = np ? `श्री ${letter.employeeName}` : letter.employeeName;
  } else if (block === "guarantor") {
    name = letter.mergeData.guarantor_name ?? "";
  }
  const strong = block === "signatory" || block === "signatory2";
  return (
    <div className="w-48">
      <div className="h-10" aria-hidden />
      <p className={cn("border-t border-line-input pt-1", strong && "font-semibold")}>{strong && name ? name : label}</p>
      {strong && title && <p className="text-ink-muted">{title}</p>}
      {!strong && name && <p className="text-ink-muted">{name}</p>}
      {strong && <p className="text-ink-muted">{letterhead.name}</p>}
    </div>
  );
}

export function LetterSheet({ letter, letterhead, actions, preview }: { letter: LetterDetail; letterhead: LetterheadData; actions?: React.ReactNode; preview?: boolean }) {
  const np = letter.language === "np";
  const design = letterhead.design;
  const layout = kindLayout(design, letter.kind);
  const voided = letter.status === "voided";
  const centered = design.headerAlign === "center";
  const contact = [letterhead.phone, letterhead.email].filter(Boolean).join(" · ");
  const rule = design.ruleStyle === "brand" ? "border-b-2 border-brand" : design.ruleStyle === "line" ? "border-b border-line-input" : "";
  return (
    <div className={cn("mx-auto max-w-3xl", FONT_CLASS[design.fontSize])}>
      {!preview && (
        <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
          {actions}
          <WindowButton variant="primary" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </WindowButton>
        </div>
      )}
      <article className={cn("relative flex min-h-[26rem] flex-col overflow-hidden rounded-md border border-line bg-white text-ink shadow-sm print:border-0 print:shadow-none", np ? SPACING_CLASS[design.lineSpacing].np : SPACING_CLASS[design.lineSpacing].en)}>
        {design.ruleStyle === "brand" && <div aria-hidden className="h-1 bg-[linear-gradient(90deg,var(--brand)_0_68%,var(--brand-red)_68%_100%)] print:h-1" />}
        <div className={cn("flex flex-1 flex-col print:pt-6", MARGIN_CLASS[design.margin])}>
          <div className={cn("mb-6 flex items-center gap-4 pb-3", rule, centered ? "flex-col text-center" : "text-left")}>
            {design.logoDataUrl && (
              // A data: image chosen in the design; the page's image rule allows it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={design.logoDataUrl} alt="" className={cn("w-auto object-contain", LOGO_CLASS[design.logoSize])} />
            )}
            <div>
              <p className="text-2xl font-semibold tracking-tight text-brand-strong">{letterhead.name}</p>
              {letterhead.address && <p className="mt-0.5 text-xs text-ink-muted">{letterhead.address}</p>}
              {(letterhead.pan || (design.showRegNo && letterhead.regNo)) && (
                <p className="text-xs text-ink-muted">
                  {letterhead.pan && <>PAN / VAT: {letterhead.pan}</>}
                  {letterhead.pan && design.showRegNo && letterhead.regNo && " · "}
                  {design.showRegNo && letterhead.regNo && <>{np ? "दर्ता नं." : "Reg. no."}: {letterhead.regNo}</>}
                </p>
              )}
              {design.showContact && contact && <p className="text-xs text-ink-muted">{contact}</p>}
              {design.headerNote && <p className="text-xs text-ink-muted">{design.headerNote}</p>}
            </div>
          </div>

          <div className="mb-6 flex items-start justify-between text-xs">
            <div>
              <p>
                {np ? "च.नं." : "Ref. no."}: <span className="font-semibold">{letter.letterNumber}</span>
              </p>
              {layout.showRecipient && (
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

          <h1 className={cn("mb-5 text-center text-base", design.subjectStyle === "underline" && "font-semibold underline underline-offset-4", design.subjectStyle === "bold" && "font-bold", design.subjectStyle === "plain" && "font-medium")}>
            {np ? `विषय: ${letter.subject}` : letter.subject}
          </h1>

          <Paragraphs text={letter.body} />

          {layout.blocks.length > 0 && (
            <div className={cn("mt-auto flex flex-wrap gap-x-6 gap-y-8 pt-12 text-xs", layout.blocks.length === 1 ? "justify-end text-right" : "justify-between")}>
              {layout.blocks.map((block, i) => (
                <SignatureBox key={`${block}-${i}`} block={block} letter={letter} letterhead={letterhead} np={np} />
              ))}
            </div>
          )}

          {design.footerText && <p className="mt-8 border-t border-line pt-2 text-center text-2xs text-ink-muted">{design.footerText}</p>}

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
