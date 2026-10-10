"use client";

import { Printer } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { WindowButton } from "@/components/kit/window";
import type { ExitDetail } from "@/lib/types/exit";
import type { SettlementView } from "@/lib/types/settlement";
import type { LetterheadBase } from "@/lib/types/letter";

// Printable full & final settlement statement (F8), A4, bilingual headings. The
// lines are the frozen ones from when it was prepared; the app frame is hidden in print.

export function SettlementPrint({ exit, settlement, letterhead }: { exit: ExitDetail; settlement: SettlementView; letterhead: LetterheadBase }) {
  const earnings = settlement.lines.filter((l) => l.side === "earning");
  const deductions = settlement.lines.filter((l) => l.side === "deduction");
  const draft = settlement.status === "draft";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <WindowButton variant="primary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </WindowButton>
      </div>
      <article className="rounded-md border border-line bg-white p-10 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 text-center">
          <p className="text-base font-semibold">{letterhead.name}</p>
          <p className="text-xs text-ink-muted">
            {letterhead.address}
            {letterhead.pan && <> · PAN {letterhead.pan}</>}
          </p>
          <h1 className="mt-3 text-lg font-semibold">अन्तिम भुक्तानी विवरण · Full &amp; Final Settlement</h1>
          {draft && <p className="text-xs font-semibold uppercase tracking-wide text-danger">Draft — not yet approved</p>}
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Employee · कर्मचारी</dt>
            <dd>
              {exit.employeeName} ({exit.employeeCode})
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Separation · बिदाइको प्रकार</dt>
            <dd>
              {exit.kindName} · {exit.kindNameNp}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Last working day · अन्तिम कार्य दिन</dt>
            <dd>
              {exit.lastWorkingDayBs} ({exit.lastWorkingDayAd})
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Status</dt>
            <dd className="capitalize">{settlement.status}</dd>
          </div>
        </dl>

        <Section title="Payable to employee · पाउनुपर्ने" lines={earnings} total={settlement.earnings} />
        <Section title="Recoverable · कटौती" lines={deductions} total={settlement.deductions} />

        <div className="mt-3 flex items-center justify-between border-y border-line py-2 text-base font-semibold">
          <span>{settlement.recovery ? "Recoverable from employee · असुल गर्नुपर्ने" : "Net payable · खुद भुक्तानी"}</span>
          <Amount value={Number(settlement.net)} emphasis />
        </div>

        {settlement.taxSheet && (
          <p className="mt-3 text-xs text-ink-muted">
            Tax: taxable income earlier in the year {Number(settlement.taxSheet.ytdTaxable).toLocaleString("en-IN")}, TDS already deducted {Number(settlement.taxSheet.ytdTds).toLocaleString("en-IN")}.
          </p>
        )}
        {settlement.paymentRef && <p className="mt-2 text-xs">Payment reference: {settlement.paymentRef}</p>}

        <div className="mt-12 grid grid-cols-3 gap-6 text-center text-xs">
          <div className="border-t border-ink pt-1">
            Prepared by · तयार गर्ने
            <br />
            {settlement.preparedByName}
          </div>
          <div className="border-t border-ink pt-1">
            Approved by · स्वीकृत गर्ने
            <br />
            {settlement.approvedByName ?? " "}
          </div>
          <div className="border-t border-ink pt-1">
            Received by · बुझिलिने
            <br />
            {exit.employeeName}
          </div>
        </div>
      </article>
    </div>
  );
}

function Section({ title, lines, total }: { title: string; lines: SettlementView["lines"]; total: string }) {
  return (
    <section className="mb-3">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <table className="w-full text-sm">
        <tbody>
          {lines.map((l) => (
            <tr key={`${l.code}-${l.label}`} className="border-b border-line align-top">
              <td className="py-1 pr-2">
                {l.label} · {l.labelNp}
                <div className="text-xs text-ink-faint">{l.basis}</div>
              </td>
              <td className="py-1 text-right">
                <Amount value={Number(l.amount)} />
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td className="py-1 text-xs text-ink-faint">None</td>
              <td />
            </tr>
          )}
          <tr>
            <td className="py-1 text-right text-xs font-semibold">Total</td>
            <td className="py-1 text-right">
              <Amount value={Number(total)} emphasis />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
