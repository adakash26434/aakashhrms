"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton } from "@/components/kit/window";
import { myLoanDetailAction, requestMyLoanAction, withdrawMyLoanRequestAction } from "@/app/actions/ess-extras.actions";
import { loanTerms, npr } from "@/lib/engines/loan.engine";
import { t, type EssKey, type EssLang } from "@/lib/i18n/ess";
import type { LoanDetail, LoanRequestRow, LoanRow, MyLoansData, MyLoanType } from "@/lib/types/loan";
import { adToBSString } from "@/lib/utils/bs-calendar";

// My loans (4.10): the employee's own loans and advances with what is left, their requests, and a
// form to ask for the types employees request themselves. The server takes the employee from the
// session, checks the type's limit and eligibility, and someone else approves.

const bs = (iso: string) => {
  try {
    return adToBSString(new Date(`${iso.slice(0, 10)}T00:00:00`));
  } catch {
    return iso.slice(0, 10);
  }
};
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text);

function loanStatus(l: LoanRow, L: (k: EssKey) => string) {
  if (l.status === "ACTIVE") return <StatusChip status="active" label={L("loans.status.running")} />;
  if (l.closedHow === "written_off") return <StatusChip status="cancelled" label={L("loans.status.written_off")} />;
  return <StatusChip status="paid" label={L(l.closedHow === "settlement" ? "loans.status.settlement" : "loans.status.repaid")} />;
}

const REQUEST_TONE: Record<LoanRequestRow["status"], string> = { pending: "pending", approved: "approved", disbursed: "paid", rejected: "rejected", withdrawn: "cancelled" };

export function MyLoansClient({ lang, data }: { lang: EssLang; data: MyLoansData }) {
  const router = useRouter();
  const L = (k: EssKey) => t(lang, k);
  const [asking, setAsking] = useState(false);
  const [viewing, setViewing] = useState<LoanRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const typeName = (x: { typeName: string; typeId: string }) => {
    const type = data.types.find((ty) => ty.id === x.typeId);
    return lang === "np" && type?.nameNp ? type.nameNp : x.typeName;
  };

  const withdraw = async (id: string) => {
    setWithdrawing(id);
    setError(null);
    const r = await withdrawMyLoanRequestAction(id);
    setWithdrawing(null);
    if (!r.success) return setError(r.error);
    setNotice(L("loans.withdrawn"));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{L("loans.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{L("loans.description")}</p>
        </div>
        {data.types.length > 0 && (
          <WindowButton variant="primary" onClick={() => setAsking(true)}>
            <Plus className="h-4 w-4" /> {L("loans.request")}
          </WindowButton>
        )}
      </header>
      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {data.types.length === 0 && <Notice tone="info">{L("loans.noTypes")}</Notice>}

      <section aria-label={L("loans.myLoans")} className="space-y-3">
        {data.loans.length === 0 ? (
          <p className="text-sm text-ink-muted">{L("loans.none")}</p>
        ) : (
          data.loans.map((l) => (
            <article key={l.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{typeName(l)}</h2>
                  <p className="text-2xs text-ink-muted">
                    {L("loans.given")}: {bs(l.givenDate)} · <Amount value={l.amount} />
                  </p>
                </div>
                {loanStatus(l, L)}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={l.repaidPct} aria-valuemin={0} aria-valuemax={100} aria-label={L("loans.paidBack")}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${l.repaidPct}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-ink-muted">{L("loans.balance")}</dt>
                  <dd className="font-medium text-ink">
                    <Amount value={l.remaining} />
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{L("loans.paidBack")}</dt>
                  <dd className="font-medium text-ink">
                    <Amount value={l.returned} /> ({l.repaidPct}%)
                  </dd>
                </div>
                {l.status === "ACTIVE" && (
                  <>
                    <div>
                      <dt className="text-ink-muted">{L("loans.eachMonth")}</dt>
                      <dd className="font-medium text-ink">
                        <Amount value={l.installment} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">{L("loans.installmentsLeft")}</dt>
                      <dd className="font-medium text-ink">{l.installmentsLeft}</dd>
                    </div>
                  </>
                )}
              </dl>
              <WindowButton className="mt-3" onClick={() => setViewing(l)}>
                {L("loans.view")}
              </WindowButton>
            </article>
          ))
        )}
      </section>

      {data.requests.length > 0 && (
        <section aria-label={L("loans.requests")}>
          <h2 className="mb-2 text-sm font-semibold text-ink">{L("loans.requests")}</h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-4 py-2">{L("loans.type")}</th>
                  <th className="px-4 py-2 text-right">{L("loans.amount")}</th>
                  <th className="px-4 py-2">{L("loans.asked")}</th>
                  <th className="px-4 py-2">{L("loans.status")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 align-top">
                    <td className="px-4 py-2 font-medium text-ink">
                      {typeName(r)}
                      <span className="block text-2xs font-normal text-ink-muted">
                        {r.installments} × <Amount value={Number(r.terms.installment)} />
                      </span>
                      {r.decisionNote && (
                        <span className="block text-2xs font-normal text-ink-muted">
                          {L("loans.decision")}: {r.decisionNote}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Amount value={r.amount} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{bs(r.requestedAt)}</td>
                    <td className="px-4 py-2">
                      <StatusChip status={REQUEST_TONE[r.status]} label={L(`loans.req.${r.status}` as EssKey)} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.status === "pending" && r.can.withdraw && (
                        <WindowButton onClick={() => withdraw(r.id)} disabled={withdrawing === r.id}>
                          {withdrawing === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {L("loans.withdraw")}
                        </WindowButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {asking && (
        <AskWindow
          lang={lang}
          types={data.types}
          onClose={() => setAsking(false)}
          onSaved={() => {
            setAsking(false);
            setNotice(L("loans.submitted"));
            router.refresh();
          }}
        />
      )}
      {viewing && <RepaymentsWindow lang={lang} loan={viewing} title={typeName(viewing)} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AskWindow({ lang, types, onClose, onSaved }: { lang: EssLang; types: MyLoanType[]; onClose: () => void; onSaved: () => void }) {
  const L = (k: EssKey) => t(lang, k);
  const open = types.filter((x) => !x.blocked);
  const [form, setForm] = useState({ loanTypeId: open.length === 1 ? open[0].id : "", amount: 0, installments: open.length === 1 ? open[0].maxInstallments : 0, reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const type = open.find((x) => x.id === form.loanTypeId);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const name = (x: MyLoanType) => (lang === "np" && x.nameNp ? x.nameNp : x.name);
  const blockedText = (x: MyLoanType) => fill(L(`loans.blocked.${x.blocked}` as EssKey), { n: x.eligibleAfterMonths });
  // What it would cost a month (the server works it out again when saving).
  const terms = type && form.amount > 0 && form.installments > 0 ? loanTerms(form.amount, type.interestRate, form.installments) : null;

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await requestMyLoanAction(form);
      if (r.success) onSaved();
      else {
        setErrors(("validationErrors" in r && r.validationErrors) || {});
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={L("loans.request")}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            {L("loans.cancel")}
          </WindowButton>
          <WindowButton variant="primary" onClick={submit} disabled={pending || !open.length}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {L("loans.submit")}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title={L("loans.request")}>
            <FieldRow
              label={L("loans.type")}
              required
              error={errors.loanTypeId}
              help={type ? `${fill(L("loans.maxMonths"), { n: type.maxInstallments })} · ${type.interestRate ? `${L("loans.interest")} ${type.interestRate}%` : L("loans.noInterest")}` : undefined}
            >
              <SelectField
                options={open.map((x) => ({ value: x.id, label: name(x) }))}
                value={form.loanTypeId}
                onChange={(v) => {
                  set("loanTypeId", v);
                  const x = open.find((o) => o.id === v);
                  if (x && (!form.installments || form.installments > x.maxInstallments)) set("installments", x.maxInstallments);
                }}
                placeholder="—"
              />
            </FieldRow>
            <FieldRow label={L("loans.amount")} required error={errors.amount} help={type ? (type.limit !== null ? fill(L("loans.limit"), { amount: `NPR ${npr(type.limit)}` }) : L("loans.noLimit")) : undefined}>
              <NumberField value={form.amount} onChange={(v) => set("amount", v)} prefix="NPR" />
            </FieldRow>
            <FieldRow label={L("loans.months")} required error={errors.installments}>
              <NumberField value={form.installments} onChange={(v) => set("installments", v)} decimals={0} />
            </FieldRow>
            <FieldRow label={L("loans.reason")} required error={errors.reason} wide>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={form.reason} maxLength={500} onChange={(e) => set("reason", e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
        {terms && (
          <p className="text-xs text-ink-muted">
            {L("loans.eachMonth")}: <Amount value={Number(terms.installment)} /> · {L("loans.total")}: <Amount value={Number(terms.totalPayable)} />
          </p>
        )}
        {types.some((x) => x.blocked) && (
          <ul className="space-y-0.5 text-2xs text-ink-muted">
            {types
              .filter((x) => x.blocked)
              .map((x) => (
                <li key={x.id}>
                  {name(x)} — {L("loans.notNow")}: {blockedText(x)}
                </li>
              ))}
          </ul>
        )}
      </div>
    </Window>
  );
}

function RepaymentsWindow({ lang, loan, title, onClose }: { lang: EssLang; loan: LoanRow; title: string; onClose: () => void }) {
  const L = (k: EssKey) => t(lang, k);
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    myLoanDetailAction(loan.id).then((r) => {
      if (!live) return;
      if (r.success) setDetail(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [loan.id]);
  const how = (m: string) => L(m === "SALARY_DEDUCTION" ? "loans.how.payroll" : m === "SETTLEMENT" ? "loans.how.settlement" : "loans.how.cash");
  return (
    <Window open onClose={onClose} title={title} description={`${L("loans.balance")}: NPR ${npr(loan.remaining)}`} size="md" footer={<WindowButton onClick={onClose}>{L("loans.close")}</WindowButton>}>
      {error && <Notice tone="danger">{error}</Notice>}
      {!detail && !error && <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />}
      {detail &&
        (detail.repayments.length === 0 ? (
          <p className="text-sm text-ink-muted">{L("loans.nothingRepaid")}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {detail.repayments.map((r) => (
                <tr key={r.id} className="border-b border-line/60">
                  <td className="py-1.5 tabular-nums">{bs(r.date)}</td>
                  <td className="py-1.5 text-ink-muted">
                    {how(r.method)}
                    {r.payMonth ? ` · ${r.payMonth}` : ""}
                  </td>
                  <td className="py-1.5 text-right">
                    <Amount value={r.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </Window>
  );
}
