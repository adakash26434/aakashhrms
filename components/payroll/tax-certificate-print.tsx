"use client";

import { Printer } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { WindowButton } from "@/components/kit/window";
import type { TaxCertificateData } from "@/lib/types/statutory";
import type { LetterheadBase } from "@/lib/types/letter";

// Annual tax certificate (4.8 / F9), A4, bilingual: the remuneration paid and the tax
// withheld month by month in a fiscal year, split by revenue code. Print with Ctrl+P;
// the app frame is hidden in print. Shared by the office screen and self-service.

const TAX_STATUS_NP: Record<string, string> = { Single: "एकल", "Normal Single": "एकल", Married: "दम्पती", Widow: "एकल (विधवा)" };

/** "FY 2083/84" → "2083/84" for prose and headings that already say fiscal year. */
const yearOnly = (label: string) => label.replace(/^FY\s*/i, "");

export function TaxCertificatePrint({ certificate, letterhead, printable = true }: { certificate: TaxCertificateData; letterhead: LetterheadBase; printable?: boolean }) {
  const c = certificate;
  const pan = c.employee.pan || "—";
  const year = yearOnly(c.fiscalYearLabel);
  return (
    <div className="mx-auto max-w-4xl">
      {printable && (
        <div className="mb-4 flex justify-end print:hidden">
          <WindowButton variant="primary" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </WindowButton>
        </div>
      )}
      <article className="rounded-md border border-line bg-white p-8 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="mb-4 text-center">
          <p className="text-base font-semibold">{letterhead.name}</p>
          <p className="text-xs text-ink-muted">
            {letterhead.address}
            {letterhead.pan && <> · PAN {letterhead.pan}</>}
          </p>
          <h1 className="mt-3 text-lg font-semibold">पारिश्रमिक कर कट्टी प्रमाणपत्र</h1>
          <p className="text-sm font-medium">Tax Deduction Certificate (Remuneration)</p>
          <p className="text-xs text-ink-muted">आर्थिक वर्ष · Fiscal year {year}</p>
        </header>

        <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Employee · कर्मचारी</dt>
            <dd className="text-right">
              {c.employee.name} ({c.employee.code})
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">PAN · स्थायी लेखा नम्बर</dt>
            <dd className="font-mono">{pan}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Assessed as · करनिर्धारण</dt>
            <dd className="text-right">
              {c.employee.taxStatus || "—"} {TAX_STATUS_NP[c.employee.taxStatus] && <>· {TAX_STATUS_NP[c.employee.taxStatus]}</>}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">SSF contributor · सामाजिक सुरक्षा कोष</dt>
            <dd>{c.employee.ssf ? "Yes · छ" : "No · छैन"}</dd>
          </div>
        </dl>

        <p className="mb-1">
          {c.employee.name} (स्थायी लेखा नम्बर {pan}) लाई आर्थिक वर्ष {year} मा भुक्तानी गरिएको पारिश्रमिकबाट तल उल्लेख भए बमोजिम स्रोतमा कर कट्टी गरिएको व्यहोरा प्रमाणित गरिन्छ।
        </p>
        <p className="mb-4 text-ink-muted">
          This is to certify that tax was deducted at source, as shown below, from the remuneration paid to {c.employee.name} (PAN {pan}) in fiscal year {year}.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-xs">
            <thead>
              <tr className="border-y border-line text-left text-ink-muted">
                <th className="py-1.5 pr-2">Month · महिना</th>
                <th className="py-1.5 pr-2">Paid on (BS)</th>
                <th className="py-1.5 pr-2 text-right">Gross · कुल</th>
                <th className="py-1.5 pr-2 text-right">Retirement · अवकाश कोष</th>
                <th className="py-1.5 pr-2 text-right">Taxable · करयोग्य</th>
                <th className="py-1.5 pr-2 text-right">SST 11211</th>
                <th className="py-1.5 pr-2 text-right">Remuneration tax 11112</th>
                <th className="py-1.5 text-right">Total tax · जम्मा कर</th>
              </tr>
            </thead>
            <tbody>
              {c.lines.map((l, i) => (
                <tr key={`${l.label}-${i}`} className="border-b border-line/60">
                  <td className="py-1 pr-2">
                    {l.label} <span className="text-ink-faint">· {l.labelNp}</span>
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 font-mono">{l.paymentDateBs}</td>
                  <td className="py-1 pr-2 text-right">
                    <Amount value={Number(l.gross)} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Amount value={Number(l.retirement)} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Amount value={Number(l.taxable)} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Amount value={Number(l.sst)} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Amount value={Number(l.remuneration)} />
                  </td>
                  <td className="py-1 text-right">
                    <Amount value={Number(l.tds)} />
                  </td>
                </tr>
              ))}
              <tr className="border-y border-line font-semibold">
                <td className="py-1.5 pr-2" colSpan={2}>
                  Total · जम्मा
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <Amount value={Number(c.totals.gross)} emphasis />
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <Amount value={Number(c.totals.retirement)} emphasis />
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <Amount value={Number(c.totals.taxable)} emphasis />
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <Amount value={Number(c.totals.sst)} emphasis />
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <Amount value={Number(c.totals.remuneration)} emphasis />
                </td>
                <td className="py-1.5 text-right">
                  <Amount value={Number(c.totals.tds)} emphasis />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section className="mt-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">By revenue code · राजस्व शीर्षक अनुसार</h2>
          <dl className="grid gap-1 text-xs sm:w-2/3">
            {c.revenue.map((r) => (
              <div key={r.code} className="flex justify-between gap-2">
                <dt>
                  {r.code} — {r.en} · {r.np}
                </dt>
                <dd>
                  <Amount value={Number(r.amount)} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-12 flex items-end justify-between gap-6 text-xs">
          <p className="text-ink-muted">
            Issued on · जारी मिति: {c.issuedOnBs} ({c.issuedOnAd})
          </p>
          <div className="min-w-52 border-t border-ink pt-1 text-center">
            {letterhead.signatoryName || "Authorised signatory"}
            {letterhead.signatoryTitle && (
              <>
                <br />
                {letterhead.signatoryTitle}
              </>
            )}
            <br />
            <span className="text-ink-muted">आधिकारिक हस्ताक्षर</span>
          </div>
        </div>
        <p className="mt-6 text-2xs text-ink-faint">Prepared from the approved and locked payroll of {letterhead.name}. Months still under review are not included.</p>
      </article>
    </div>
  );
}
