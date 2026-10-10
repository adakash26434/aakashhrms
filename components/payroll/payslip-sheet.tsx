import { Amount } from "@/components/kit/amount";
import { PAYSLIP_TEXT, type Bilingual, type PayslipLanguage } from "@/lib/constants/payslip-labels";
import type { PayslipLine } from "@/lib/engines/payslip-view.engine";
import type { PayslipSheetData } from "@/lib/types/payslip-sheet";
import { cn } from "@/lib/utils";

// Bilingual payslip (4.8 / F11): one A4-friendly sheet per payslip, in English, Nepali or both,
// BS dates first (no <header> element: the print stylesheet hides every header). The figures are the stored ones, arranged by payslip-view.engine so each
// column adds up to the stored total. Used by Reports → Payslips and self-service.

function Say({ text, lang, inline }: { text: Bilingual; lang: PayslipLanguage; inline?: boolean }) {
  if (lang === "en") return <>{text.en}</>;
  if (lang === "np") return <span lang="ne">{text.np}</span>;
  if (text.np === text.en) return <>{text.en}</>;
  return inline ? (
    <>
      {text.en} <span lang="ne" className="text-ink-faint">· {text.np}</span>
    </>
  ) : (
    <>
      {text.en}
      <span lang="ne" className="block text-2xs font-normal text-ink-faint">
        {text.np}
      </span>
    </>
  );
}

function Lines({ lines, lang }: { lines: PayslipLine[]; lang: PayslipLanguage }) {
  return (
    <ul className="divide-y divide-line/70">
      {lines.map((l) => (
        <li key={l.key} className="flex items-start justify-between gap-3 py-1.5">
          <span className="min-w-0 text-ink">
            <Say text={l.label} lang={lang} />
            {l.adjusted && (
              <span className="ml-1 text-2xs text-ink-faint">
                (<Say text={PAYSLIP_TEXT.adjusted} lang={lang === "both" ? "en" : lang} />)
              </span>
            )}
            {l.note && (
              <span className="block text-2xs text-ink-faint">
                <Say text={l.note} lang={lang} inline />
              </span>
            )}
          </span>
          <Amount value={Number(l.amount)} className="shrink-0" />
        </li>
      ))}
    </ul>
  );
}

export function PayslipSheet({ data, lang, bare = false }: { data: PayslipSheetData; lang: PayslipLanguage; /** Inside a report paper (4.11): no frame or page break of its own. */ bare?: boolean }) {
  // Inside a report paper (itself an <article>) the sheet is a plain block.
  const Sheet = bare ? "div" : "article";
  const { header: h, statement: s } = data;
  const facts: [Bilingual, string | null, boolean?][] = [
    [PAYSLIP_TEXT.employee, `${h.employee.name}`],
    [PAYSLIP_TEXT.code, h.employee.code, true],
    [PAYSLIP_TEXT.department, h.employee.department],
    [PAYSLIP_TEXT.designation, h.employee.designation],
    [PAYSLIP_TEXT.pan, h.employee.pan, true],
    [PAYSLIP_TEXT.bank, h.bank.name],
    [PAYSLIP_TEXT.account, h.bank.account, true],
    [PAYSLIP_TEXT.paidOn, h.paidOn ? `${h.paidOn.bs} BS (${h.paidOn.ad})` : null, true],
  ];
  return (
    <Sheet className={cn("text-xs leading-relaxed text-ink", bare ? "w-full" : "mx-auto w-full max-w-3xl break-after-page rounded-md border border-line bg-white p-6 print:max-w-none print:rounded-none print:border-0 print:p-0")}>
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">{h.company.name}</p>
          {h.company.address && <p className="text-ink-muted">{h.company.address}</p>}
          {h.company.pan && <p className="text-ink-muted">PAN {h.company.pan}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            <Say text={PAYSLIP_TEXT.title} lang={lang} inline />
          </p>
          <p className="font-medium">
            <Say text={h.period} lang={lang} inline />
          </p>
          {h.runType && (
            <p className="font-medium text-brand">
              <Say text={h.runType} lang={lang} inline />
            </p>
          )}
          <p className="text-2xs uppercase tracking-wide text-ink-faint">
            <Say text={PAYSLIP_TEXT.confidential} lang={lang} inline />
          </p>
        </div>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
        {facts.map(([label, value, mono]) => (
          <div key={label.en} className="min-w-0">
            <dt className="text-2xs text-ink-muted">
              <Say text={label} lang={lang} inline />
            </dt>
            <dd className={cn("break-words font-medium", mono && "font-mono")}>{value || "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <section aria-label="Earnings">
          <h3 className="border-b border-ink/40 pb-1 text-xs font-semibold">
            <Say text={PAYSLIP_TEXT.earnings} lang={lang} inline />
          </h3>
          <Lines lines={s.earnings} lang={lang} />
          <div className="flex items-start justify-between gap-3 border-t border-ink/40 pt-1.5 font-semibold">
            <span>
              <Say text={PAYSLIP_TEXT.gross} lang={lang} />
            </span>
            <Amount value={Number(s.gross)} emphasis />
          </div>
        </section>
        <section aria-label="Deductions">
          <h3 className="border-b border-ink/40 pb-1 text-xs font-semibold">
            <Say text={PAYSLIP_TEXT.deductions} lang={lang} inline />
          </h3>
          <Lines lines={s.deductions} lang={lang} />
          <div className="flex items-start justify-between gap-3 border-t border-ink/40 pt-1.5 font-semibold">
            <span>
              <Say text={PAYSLIP_TEXT.totalDeductions} lang={lang} />
            </span>
            <Amount value={Number(s.totalDeductions)} emphasis />
          </div>
        </section>
      </div>

      <div className="my-4 flex items-center justify-between gap-3 border-y border-ink/40 py-2.5 text-sm font-semibold">
        <span>
          <Say text={PAYSLIP_TEXT.net} lang={lang} />
        </span>
        <Amount value={Number(s.net)} emphasis className="text-base" />
      </div>

      {s.employerPf && (
        <p className="text-2xs text-ink-muted">
          <Say text={PAYSLIP_TEXT.employerPf} lang={lang} inline />: <Amount value={Number(s.employerPf)} />
        </p>
      )}
      {!s.balanced && (
        <p className="mt-1 text-2xs text-warning">
          <Say text={PAYSLIP_TEXT.figuresNote} lang={lang} inline />
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-2xs text-ink-muted">
        <div className="border-t border-ink/60 pt-1">
          <Say text={PAYSLIP_TEXT.preparedBy} lang={lang} />
        </div>
        <div className="border-t border-ink/60 pt-1">
          <Say text={PAYSLIP_TEXT.approvedBy} lang={lang} />
        </div>
      </div>
    </Sheet>
  );
}
