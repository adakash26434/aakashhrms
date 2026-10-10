"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { CalendarRange, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, Undo2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Amount } from "@/components/kit/amount";
import { EmptyState } from "@/components/kit/empty-state";
import { Guide } from "@/components/kit/guide";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { Panel } from "@/components/kit/panel";
import { PropertyForm } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { saveTaxLadderAction, taxSlabsPageAction } from "@/app/actions/tax-rate.actions";
import { MAX_LADDER_ROWS, bandRange, ladderBands, ladderChanges, ladderIsValid, ladderTax, validateLadder, type LadderErrors, type LadderRow } from "@/lib/engines/tax-rate.engine";
import { TAX_CATEGORIES, TAX_CATEGORY_LABEL, type TaxCategory, type TaxSlabsPage } from "@/lib/types/tax-rate";
import { cn } from "@/lib/utils";

// Tax slabs (4.12, template E): the three ladders of a fiscal year side by side, a calculator
// that works the tax out the way payroll does, and one window per ladder that edits it whole —
// bands as boundaries, each starting where the one before ends — with the changes listed in
// words before Save. The server checks the ladder again and refuses a closed year.

const INDIVIDUAL: TaxCategory = "Normal Single";
const SAMPLE_INCOME = 10_00_000;

const headerButton = "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-2xs font-medium text-brand-strong hover:bg-brand-subtle";
const th = "py-1.5 text-3xs font-medium uppercase tracking-wide text-ink-muted";

export function TaxSlabsClient({ initial }: { initial: TaxSlabsPage }) {
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<TaxCategory | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [pending, start] = useTransition();
  const year = data.years.find((y) => y.value === data.fiscalYearId);

  const load = (id: string, message?: string) =>
    start(async () => {
      const result = await taxSlabsPageAction(id);
      if (!result.success) {
        setNotice({ tone: "danger", text: result.error });
        return;
      }
      setData(result.data);
      setNotice(message ? { tone: "success", text: message } : null);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("year", result.data.fiscalYearId);
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        // The address bar keeps the old year; the page itself is right.
      }
    });

  return (
    <div>
      <PageBar
        title="Tax slabs"
        description="Income tax bands for each fiscal year (Income Tax Act, Schedule 1). Payroll taxes each employee under their category's ladder"
        actions={[
          { id: "years", label: "Fiscal years", icon: CalendarRange, group: "output", href: "/setup/fiscal-year" },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending || !data.fiscalYearId, onClick: () => load(data.fiscalYearId) },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {!data.fiscalYearId ? (
        <EmptyState
          title="No fiscal years yet"
          description="Tax slabs belong to a fiscal year. Add the year first."
          action={
            <Link href="/setup/fiscal-year" className={headerButton}>
              Open Fiscal years
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-medium text-ink-muted">Fiscal year</span>
            <div className="w-44">
              <SelectField
                aria-label="Fiscal year"
                options={data.years.map((y) => ({ value: y.value, label: y.label, hint: y.current ? "Current" : y.closed ? "Closed" : undefined }))}
                value={data.fiscalYearId}
                onChange={(id) => id !== data.fiscalYearId && load(id)}
                disabled={pending}
              />
            </div>
            {year?.current && <StatusChip status="active" label="Current year" />}
            {year?.closed && <StatusChip status="locked" label="Closed" />}
            {pending && <Loader2 aria-label="Loading" className="h-3.5 w-3.5 animate-spin text-ink-faint" />}
          </div>
          {data.closed ? (
            <Notice
              tone="warning"
              className="mb-3"
              action={
                <Link href="/setup/fiscal-year" className="text-2xs font-medium text-brand-strong underline underline-offset-2">
                  Fiscal years
                </Link>
              }
            >
              {data.fiscalYearLabel} is closed: its slabs stay as they were. To change them, reopen the year under Fiscal years.
            </Notice>
          ) : (
            data.hasRuns && (
              <Notice tone="info" className="mb-3">
                {data.fiscalYearLabel} has pay runs. Saved slabs are used from the next calculation: the tax still due for the year is spread over the months left, and payslips already
                worked out keep their tax until they are recalculated.
              </Notice>
            )
          )}
          <Guide
            id="tax-slabs"
            title="How tax slabs work"
            className="mb-3"
            steps={[
              { title: "Bands", text: "Each band taxes the part of the yearly taxable income between where it starts and where it ends, at its rate. The first starts at 0; the last has no top." },
              { title: "Categories", text: "Individual is for everyone without a category of their own. Couple is for married employees assessed as a couple; Person with disability has its own ladder. A category with no ladder uses Individual." },
              { title: "What payroll adds", text: `SSF contributors are not charged the 1% on the first band, and women get the ${data.womenRebatePercent}% rebate set under Rules & controls.` },
              { title: "When the budget changes", text: "Change the year's ladders here, or add the new year under Fiscal years and copy last year's slabs to start from." },
            ]}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TAX_CATEGORIES.map((c) => (
              <LadderPanel key={c} category={c} rows={data.ladders[c]} canEdit={data.canEdit} onEdit={() => setEditing(c)} />
            ))}
          </div>
          {!data.canEdit && !data.closed && <p className="mt-3 text-xs text-ink-muted">Changing tax slabs needs Tax rates → Edit with a company-wide role.</p>}
          <TaxCalculator page={data} />
        </>
      )}
      {editing && (
        <LadderWindow
          key={`${data.fiscalYearId}-${editing}`}
          page={data}
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(data.fiscalYearId, `${TAX_CATEGORY_LABEL[editing].en} slabs for ${data.fiscalYearLabel} saved.`);
          }}
        />
      )}
    </div>
  );
}

/** One category's ladder, read-only, with the tax at the top of each band. */
function LadderPanel({ category, rows, canEdit, onEdit }: { category: TaxCategory; rows: LadderRow[]; canEdit: boolean; onEdit: () => void }) {
  const label = TAX_CATEGORY_LABEL[category];
  const bands = ladderBands(rows);
  const withFixed = bands.some((b) => b.fixedDeduction);
  return (
    <Panel
      title={label.en}
      count={bands.length || undefined}
      actions={
        canEdit ? (
          <button type="button" className={headerButton} onClick={onEdit} aria-label={`Edit the ${label.en} ladder`}>
            <Pencil className="h-3 w-3" /> {bands.length ? "Edit" : "Set slabs"}
          </button>
        ) : undefined
      }
    >
      <p className="border-b border-line px-4 py-2 text-2xs text-ink-faint">{label.hint}</p>
      {bands.length ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left">
              <th className={cn(th, "pl-4 pr-2")}>Yearly taxable income</th>
              <th className={cn(th, "px-2 text-right")}>Rate</th>
              {withFixed && <th className={cn(th, "px-2 text-right")}>Less</th>}
              <th className={cn(th, "pl-2 pr-4 text-right")} title="Tax on an income at the top of the band (before the SSF exemption and the women's rebate)">
                Tax at the top
              </th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pl-4 pr-2 tabular-nums text-ink">{bandRange(b)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{b.ratePercent}%</td>
                {withFixed && (
                  <td className="px-2 py-1.5 text-right">
                    <Amount value={b.fixedDeduction} decimals={0} />
                  </td>
                )}
                <td className="py-1.5 pl-2 pr-4 text-right">{b.upTo === null ? <span className="text-ink-faint">–</span> : <Amount value={ladderTax(rows, b.upTo).total} decimals={0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={cn("px-4 py-6 text-center text-xs", category === INDIVIDUAL ? "text-warning" : "text-ink-muted")}>
          {category === INDIVIDUAL ? "Not set: payroll can't work out income tax for this year until it is." : "Not set: payroll uses the Individual ladder."}
        </p>
      )}
    </Panel>
  );
}

function Param({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

/** Tax on a yearly income under the chosen ladder, worked out as payroll does. */
function TaxCalculator({ page }: { page: TaxSlabsPage }) {
  const [category, setCategory] = useState<TaxCategory>(INDIVIDUAL);
  const [income, setIncome] = useState(SAMPLE_INCOME);
  const [ssf, setSsf] = useState(false);
  const [woman, setWoman] = useState(false);
  const own = page.ladders[category];
  const rows = own.length ? own : page.ladders[INDIVIDUAL];
  const result = ladderTax(rows, income, { ssf, rebatePercent: woman ? page.womenRebatePercent : 0 });
  const used = result.bands.filter((b) => b.taxed > 0);

  return (
    <Panel title="Tax on a yearly income" meta="A check of the ladder, the way payroll applies it" padded className="mt-3 h-auto">
      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <Param label="Category">
            <SelectField options={TAX_CATEGORIES.map((c) => ({ value: c, label: TAX_CATEGORY_LABEL[c].en }))} value={category} onChange={(v) => setCategory(v as TaxCategory)} />
          </Param>
          <Param label="Yearly taxable income">
            <NumberField value={income} onChange={setIncome} decimals={0} prefix="NPR" grouped selectOnFocus />
          </Param>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
            <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={ssf} onChange={(e) => setSsf(e.target.checked)} />
            Contributes to SSF (no 1% on the first band)
          </label>
          {page.womenRebatePercent > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
              <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={woman} onChange={(e) => setWoman(e.target.checked)} />
              Woman ({page.womenRebatePercent}% rebate)
            </label>
          )}
          <p className="text-2xs text-ink-faint">Taxable income is after the allowed deductions (SSF, PF, CIT, insurance). Payroll spreads the year&apos;s tax over its months.</p>
        </div>
        <div className="min-w-0">
          {!own.length && category !== INDIVIDUAL && rows.length > 0 && <p className="mb-2 text-2xs text-ink-muted">No {TAX_CATEGORY_LABEL[category].en} ladder for {page.fiscalYearLabel}: the Individual ladder applies.</p>}
          {!rows.length ? (
            <p className="text-xs text-ink-muted">No slabs for {page.fiscalYearLabel} yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-96 text-xs">
                <thead>
                  <tr className="text-left">
                    <th className={cn(th, "pr-2")}>Band</th>
                    <th className={cn(th, "px-2 text-right")}>Income in the band</th>
                    <th className={cn(th, "px-2 text-right")}>Rate</th>
                    <th className={cn(th, "pl-2 text-right")}>Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {used.map((b, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-1.5 pr-2 tabular-nums text-ink">{bandRange(b)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Amount value={b.taxed} decimals={0} />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {b.rate}%{b.rate !== b.ratePercent && <span className="ml-1 text-ink-faint">(SSF)</span>}
                        {b.fixedDeduction > 0 && <span className="ml-1 text-ink-faint">less {b.fixedDeduction.toLocaleString("en-IN")}</span>}
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <Amount value={b.tax} />
                      </td>
                    </tr>
                  ))}
                  {result.rebate > 0 && (
                    <tr className="border-t border-line">
                      <td colSpan={3} className="py-1.5 pr-2 text-ink-muted">
                        Women&apos;s rebate ({page.womenRebatePercent}%)
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <Amount value={-result.rebate} />
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-line-strong font-semibold">
                    <td colSpan={3} className="py-1.5 pr-2 text-ink">
                      Tax for the year
                    </td>
                    <td className="py-1.5 pl-2 text-right">
                      <Amount value={result.total} emphasis />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 pr-2 text-ink-muted">
                      A month (÷ 12) · effective rate {income > 0 ? ((result.total / income) * 100).toFixed(2) : "0.00"}%
                    </td>
                    <td className="py-1 pl-2 text-right">
                      <Amount value={result.total / 12} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Edits one category's ladder as a whole: From is where the band before ends; the last band has no top. */
function LadderWindow({ page, category, onClose, onSaved }: { page: TaxSlabsPage; category: TaxCategory; onClose: () => void; onSaved: () => void }) {
  const label = TAX_CATEGORY_LABEL[category].en;
  const saved = page.ladders[category];
  const [rows, setRows] = useState<LadderRow[]>(() => (saved.length ? saved : [{ upTo: null, ratePercent: 1, fixedDeduction: 0 }]));
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<LadderErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState("");
  const [sample, setSample] = useState(SAMPLE_INCOME);
  const [saving, startSave] = useTransition();
  const [copying, startCopy] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  const removing = rows.length === 0;
  const bands = ladderBands(rows);
  const anyFixed = rows.some((r) => r.fixedDeduction);
  const errors = removing ? { rows: {} } : validateLadder(rows);
  const shown = serverErrors ?? (tried ? errors : null);
  const changes = ladderChanges(saved, rows);
  const others = page.years.filter((y) => y.value !== page.fiscalYearId);

  const edit = (next: LadderRow[]) => {
    setRows(next);
    setServerErrors(null);
    setFailure(null);
  };
  const setRow = (i: number, patch: Partial<LadderRow>) => edit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const focusField = (name: string) => requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus());

  const addBand = () => {
    const last = rows[rows.length - 1];
    // The band that was last now needs a top; the new one is open-ended at the same rate or higher.
    edit([...rows.slice(0, -1), { ...last, upTo: null }, { upTo: null, ratePercent: last?.ratePercent ?? 0, fixedDeduction: 0 }]);
    focusField(`band.${rows.length - 1}.upTo`);
  };
  const removeBand = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    if (next.length) next[next.length - 1] = { ...next[next.length - 1], upTo: null };
    edit(next);
  };

  const copy = (id: string) => {
    setCopyFrom(id);
    if (!id) return;
    startCopy(async () => {
      const result = await taxSlabsPageAction(id);
      const other = result.success ? result.data.ladders[category] : [];
      if (!result.success) setFailure(result.error);
      else if (!other.length) setFailure(`${result.data.fiscalYearLabel} has no ${label} ladder.`);
      else edit(other);
      setCopyFrom("");
    });
  };

  const save = () => {
    setTried(true);
    if (!removing && !ladderIsValid(errors)) {
      setFailure(errors.form ?? "Check the highlighted bands.");
      const first = Object.entries(errors.rows)[0];
      if (first) focusField(`band.${first[0]}.${first[1].upTo ? "upTo" : first[1].ratePercent ? "rate" : "less"}`);
      return;
    }
    startSave(async () => {
      const result = await saveTaxLadderAction(page.fiscalYearId, category, rows);
      if (result.success) return onSaved();
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
    });
  };

  // A category with no ladder is taxed under Individual's, before and after alike.
  const fallback = page.ladders[INDIVIDUAL];
  const before = ladderTax(saved.length ? saved : fallback, sample).total;
  const after = ladderTax(rows.length ? rows : fallback, sample).total;

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={changes.length > 0}
      size="lg"
      title={`${label} · ${page.fiscalYearLabel}`}
      description="Each band starts where the one before ends; the last has no top. Saved as a whole."
      footer={
        <>
          {failure ? (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          ) : (
            <span className="mr-auto text-2xs text-ink-muted">{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"}` : "No changes yet"}</span>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || changes.length === 0}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save slabs
          </WindowButton>
        </>
      }
    >
      {page.hasRuns && (
        <Notice tone="info" className="mb-3">
          {page.fiscalYearLabel} has pay runs: the new slabs are used from the next calculation, with the tax still due spread over the months left.
        </Notice>
      )}
      <div ref={formRef}>
        <PropertyForm enterNavigation={{ end: () => saveRef.current }} onSubmit={save}>
          {removing ? (
            <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-xs text-ink">
              The {label} ladder will be removed: payroll uses the Individual ladder for these employees.{" "}
              <button type="button" className="inline-flex cursor-pointer items-center gap-1 font-medium text-brand-strong underline underline-offset-2" onClick={() => edit(saved)}>
                <Undo2 className="h-3 w-3" /> Keep it
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* On a phone the derived From column folds away, and Less too unless a band uses it. */}
              <table className="w-full text-xs sm:min-w-[34rem]">
                <thead>
                  <tr className="text-left">
                    <th className={cn(th, "w-8 pr-2")}>#</th>
                    <th className={cn(th, "hidden px-2 text-right sm:table-cell")}>From</th>
                    <th className={cn(th, "px-2")}>Up to</th>
                    <th className={cn(th, "w-20 px-2 sm:w-28")}>Rate %</th>
                    <th className={cn(th, "w-32 px-2", !anyFixed && "hidden sm:table-cell")} title="A fixed amount taken off this band's tax. Nepal's slabs have none: leave it empty.">
                      Less (fixed)
                    </th>
                    <th className={cn(th, "w-8")}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b, i) => {
                    const last = i === bands.length - 1;
                    const e = shown?.rows[i];
                    return [
                      <tr key={`band-${i}`} className="border-t border-line align-middle">
                        <td className="py-1.5 pr-2 tabular-nums text-ink-muted">{i + 1}</td>
                        <td className="hidden px-2 py-1.5 text-right tabular-nums text-ink-muted sm:table-cell">{b.from.toLocaleString("en-IN")}</td>
                        <td className="px-2 py-1.5">
                          {last ? (
                            <span className="text-ink-muted">
                              <span className="sm:hidden">{b.from.toLocaleString("en-IN")} </span>and above
                            </span>
                          ) : (
                            <NumberField name={`band.${i}.upTo`} aria-label={`Band ${i + 1}: up to`} aria-invalid={e?.upTo ? true : undefined} value={b.upTo ?? 0} onChange={(n) => setRow(i, { upTo: n || null })} decimals={0} grouped selectOnFocus />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <NumberField name={`band.${i}.rate`} aria-label={`Band ${i + 1}: rate %`} aria-invalid={e?.ratePercent ? true : undefined} value={b.ratePercent} onChange={(n) => setRow(i, { ratePercent: n })} decimals={2} max={100} showZero selectOnFocus />
                        </td>
                        <td className={cn("px-2 py-1.5", !anyFixed && "hidden sm:table-cell")}>
                          <NumberField name={`band.${i}.less`} aria-label={`Band ${i + 1}: less (fixed)`} aria-invalid={e?.fixedDeduction ? true : undefined} value={b.fixedDeduction} onChange={(n) => setRow(i, { fixedDeduction: n })} decimals={0} grouped selectOnFocus />
                        </td>
                        <td className="py-1.5 text-right">
                          <WindowButton aria-label={`Remove band ${i + 1}`} title="Remove band" className="h-7 px-2" disabled={rows.length === 1} onClick={() => removeBand(i)} data-enter-skip>
                            <Trash2 className="h-3.5 w-3.5" />
                          </WindowButton>
                        </td>
                      </tr>,
                      e && (
                        <tr key={`error-${i}`}>
                          <td />
                          <td colSpan={5} className="pb-1.5 text-2xs font-medium text-danger" role="alert">
                            {[e.upTo, e.ratePercent, e.fixedDeduction].filter(Boolean).join(" ")}
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PropertyForm>
      </div>
      {!removing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <WindowButton onClick={addBand} disabled={rows.length >= MAX_LADDER_ROWS}>
            <Plus className="h-3.5 w-3.5" /> Add band
          </WindowButton>
          {others.length > 0 && (
            <div className="w-56">
              <SelectField aria-label="Start from another year" options={others.map((y) => ({ value: y.value, label: `Copy ${y.label}'s ladder` }))} value={copyFrom} onChange={copy} allowEmpty placeholder={copying ? "Loading…" : "Start from another year…"} disabled={copying} />
            </div>
          )}
          {category !== INDIVIDUAL && saved.length > 0 && (
            <WindowButton className="ml-auto" onClick={() => edit([])}>
              <Trash2 className="h-3.5 w-3.5" /> Remove ladder
            </WindowButton>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section aria-label="Changes" className="rounded-lg border border-line px-3 py-2">
          <h3 className="mb-1 text-xs font-semibold text-ink">Changes</h3>
          {changes.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-2xs text-ink">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-ink-muted">Nothing changed yet.</p>
          )}
        </section>
        <section aria-label="Effect" className="rounded-lg border border-line px-3 py-2">
          <h3 className="mb-1 text-xs font-semibold text-ink">Effect on a yearly income of</h3>
          <NumberField value={sample} onChange={setSample} decimals={0} prefix="NPR" grouped selectOnFocus aria-label="Yearly income to compare" className="mb-1.5" />
          <p className="text-2xs text-ink-muted">
            Tax now <Amount value={before} className="text-ink" /> · after saving <Amount value={after} className={cn("font-semibold", after === before ? "text-ink" : "text-brand-strong")} />
          </p>
          {(saved.length === 0 || removing) && category !== INDIVIDUAL && <p className="mt-0.5 text-2xs text-ink-faint">Without its own ladder, {label} is taxed under Individual&apos;s.</p>}
        </section>
      </div>
    </Window>
  );
}
