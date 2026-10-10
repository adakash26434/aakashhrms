"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Repeat, Save } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm } from "@/components/kit/property-form";
import { SectionIndex } from "@/components/kit/section-index";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { applyGradePolicyAction, previewRulesAction, rulesPageAction, saveRulesAction } from "@/app/actions/system-control.actions";
import { GRADE_METHODS, SSF_BASE_LABEL, gradePolicyChanged, gradePolicyOf, rulesAreValid, rulesChanges, validateRulesForm } from "@/lib/engines/rules.engine";
import { gradeBreakdown } from "@/lib/engines/grade-policy.engine";
import type { GradePolicyImpact, RulesChange, RulesErrors, RulesForm, RulesPage, RulesSaveResult } from "@/lib/types/system-control";

// Rules & controls (4.12b, template E): the company rules payroll reads, in sections with an
// index beside them; Save lists every change in words first, and a grade-policy change shows
// what it does to salaries (it goes through salary approval). The server checks everything again.

const SECTIONS: { id: string; label: string; fields: (keyof RulesForm)[] }[] = [
  { id: "rules-retirement", label: "Retirement contributions", fields: ["pfMaxPercent", "citLimit", "retirementLimit"] },
  { id: "rules-insurance", label: "Insurance premiums", fields: ["lifeInsuranceLimit", "healthInsuranceLimit", "houseInsuranceLimit"] },
  { id: "rules-relief", label: "Other tax relief", fields: ["remoteAreaLimit", "womenRebatePercent"] },
  { id: "rules-ssf", label: "Social security fund", fields: ["companyHasSsf", "ssfBase"] },
  { id: "rules-overtime", label: "Overtime", fields: ["otWorkDay", "otOffDay"] },
  { id: "rules-grades", label: "Grade policy", fields: ["gradeMethod", "gradeDaysInMonth", "gradePercent", "gradeAmount", "gradeMax"] },
];

const APPROVAL_WORDS: Record<RulesPage["salaryApproval"], string> = {
  none: "salary approval is off, so it counts at once (unless it includes your own salary)",
  simple: "it waits for an approver",
  multi_level: "it waits for the approvers in order",
};

const SAMPLE = { basic: 30_000, grades: 3 };

type NumberKey = { [K in keyof RulesForm]: RulesForm[K] extends number ? K : never }[keyof RulesForm];

/** What a grade-policy change did to salaries, in one sentence. */
function gradesText(g: GradePolicyImpact): string {
  const left = g.pending.length ? ` Left out while a change of theirs waits: ${g.pending.join(", ")} — apply the grade policy again once it is decided.` : "";
  if (!g.employees) return `No worked-out grade changed.${left}`;
  const who = `${g.employees} employee${g.employees === 1 ? "'s" : "s'"} grade changed`;
  const where = g.approvedAtOnce ? "and counts from today" : `and waits for ${g.waitingFor ?? "an approver"} under Salary structure → Approvals`;
  return `${who} ${where}.${left}`;
}

/** The notice after a save: what changed and what happened to salaries. */
function savedText(result: RulesSaveResult): string {
  const head = `${result.changed.length} rule${result.changed.length === 1 ? "" : "s"} saved.`;
  return result.grades ? `${head} ${gradesText(result.grades)}` : head;
}

export function RulesClient({ initial }: { initial: RulesPage }) {
  const [page, setPage] = useState(initial);
  const [form, setForm] = useState(initial.form);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<RulesErrors | null>(null);
  const [review, setReview] = useState<{ changes: RulesChange[]; grades: boolean; impact: GradePolicyImpact | null; error: string | null } | null>(null);
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [loading, start] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  const errors: RulesErrors = serverErrors ?? (tried ? validateRulesForm(form) : {});
  const changes = rulesChanges(page.form, form);
  const gradesChange = gradePolicyChanged(page.form, form);
  const edit = page.canEdit;
  const set = <K extends keyof RulesForm>(key: K, value: RulesForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
  };

  const reload = (message?: { tone: NoticeTone; text: string }) =>
    start(async () => {
      const result = await rulesPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setPage(result.data);
      setForm(result.data.form);
      setTried(false);
      setServerErrors(null);
      setNotice(message ?? null);
    });

  const openReview = () => {
    setTried(true);
    const problems = validateRulesForm(form);
    if (!rulesAreValid(problems)) {
      setNotice({ tone: "danger", text: "Check the highlighted rules." });
      const first = Object.keys(problems)[0];
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
      return;
    }
    if (!changes.length) return;
    setNotice(null);
    setReview({ changes, grades: gradesChange, impact: null, error: null });
    if (gradesChange) {
      start(async () => {
        const result = await previewRulesAction(form);
        if (result.success) setReview((r) => r && { ...r, impact: result.data });
        else {
          setReview((r) => r && { ...r, error: result.error });
          if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
        }
      });
    }
  };

  const save = async () => {
    const result = await saveRulesAction(form);
    if (!result.success) {
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
      throw new Error(result.error);
    }
    setReview(null);
    reload({ tone: "success", text: savedText(result.data) });
  };

  const applyAgain = async () => {
    const result = await applyGradePolicyAction();
    if (!result.success) throw new Error(result.error);
    setApplying(false);
    reload({ tone: "success", text: gradesText(result.data) });
  };

  const sectionItems = SECTIONS.map((s) => {
    const n = s.fields.filter((f) => errors[f]).length;
    return { id: s.id, label: s.label, state: n ? ("error" as const) : ("optional" as const), errors: n };
  });
  const policy = gradePolicyOf(form);
  const example = gradeBreakdown(SAMPLE.basic, SAMPLE.grades, policy);
  const row = (key: keyof RulesForm, label: string, control: ReactNode, help?: string) => (
    <FieldRow label={label} help={help} error={errors[key] ?? null}>
      {control}
    </FieldRow>
  );
  const rupees = (key: NumberKey) => <NumberField name={key} value={form[key]} onChange={(n) => set(key, n)} decimals={0} prefix="NPR" grouped showZero selectOnFocus readOnly={!edit} />;
  const percent = (key: NumberKey) => <NumberField name={key} value={form[key]} onChange={(n) => set(key, n)} decimals={2} max={100} showZero selectOnFocus readOnly={!edit} className="max-w-32" />;
  const times = (key: NumberKey) => <NumberField name={key} value={form[key]} onChange={(n) => set(key, n)} decimals={2} showZero selectOnFocus readOnly={!edit} className="max-w-32" />;

  return (
    <div>
      <PageBar
        title="Rules & controls"
        description="Tax deduction limits, SSF, overtime and the grade policy payroll works with"
        actions={[
          { id: "save", label: "Save", icon: Save, group: "create", primary: true, shortcut: "Ctrl+S", hidden: !edit, disabled: loading || !changes.length, disabledReason: changes.length ? undefined : "Nothing changed yet", onClick: openReview },
          { id: "grades", label: "Apply grade policy…", icon: Repeat, group: "output", hidden: !page.canChangeGrades, disabled: loading || gradesChange, disabledReason: gradesChange ? "Save the new grade policy first" : undefined, onClick: () => setApplying(true) },
          { id: "refresh", label: loading ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: loading, onClick: () => reload() },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {!edit && <Notice tone="info" className="mb-3">Changing these needs System control → Edit with a company-wide role.</Notice>}
      <div className="@container">
        <div className="grid gap-4 @min-[66rem]:grid-cols-[12rem_minmax(0,1fr)]">
          <SectionIndex className="sticky top-4 self-start" label="Rules" items={sectionItems} />
          <div ref={formRef} className="min-w-0">
            <PropertyForm enterNavigation={edit ? { end: () => saveRef.current } : undefined} onSubmit={edit ? openReview : undefined}>
              <section id="rules-retirement">
                <FieldGroup title="Retirement contributions" description="What payroll counts against income tax each year (Income Tax Act, s. 63).">
                  {row("pfMaxPercent", "PF, most of basic + grade (%)", percent("pfMaxPercent"), "PF is deducted at the pay head's rate, never more than this share of basic + grade.")}
                  {row("citLimit", "CIT counted a year", rupees("citLimit"), "The most of an employee's CIT counted against tax in a year.")}
                  {row("retirementLimit", "All retirement contributions a year", rupees("retirementLimit"), "PF, SSF and CIT together, never more than a third of the year's income.")}
                </FieldGroup>
              </section>
              <section id="rules-insurance">
                <FieldGroup title="Insurance premiums" description="Premiums deducted on payslips are counted against tax up to these amounts a year.">
                  {row("lifeInsuranceLimit", "Life insurance", rupees("lifeInsuranceLimit"))}
                  {row("healthInsuranceLimit", "Health insurance", rupees("healthInsuranceLimit"))}
                  {row("houseInsuranceLimit", "House insurance", rupees("houseInsuranceLimit"))}
                </FieldGroup>
              </section>
              <section id="rules-relief">
                <FieldGroup title="Other tax relief">
                  {row("remoteAreaLimit", "Remote area allowance, most a payment", rupees("remoteAreaLimit"), "A remote-area allowance payment is never more than this.")}
                  {row("womenRebatePercent", "Women's tax rebate (%)", percent("womenRebatePercent"), "Taken off the year's tax for women employees (Schedule 1).")}
                </FieldGroup>
              </section>
              <section id="rules-ssf">
                <FieldGroup title="Social security fund (SSF)">
                  {row(
                    "companyHasSsf",
                    "The company is in SSF",
                    <YesNoField name="companyHasSsf" value={form.companyHasSsf} onChange={(v) => set("companyHasSsf", v)} disabled={!edit} />,
                    "Employees whose employment type allows SSF contribute to SSF (11% + 20%) instead of PF."
                  )}
                  {row(
                    "ssfBase",
                    "SSF worked out on",
                    <SelectField name="ssfBase" options={Object.entries(SSF_BASE_LABEL).map(([value, label]) => ({ value, label }))} value={form.ssfBase} onChange={(v) => set("ssfBase", v === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade")} disabled={!edit} />
                  )}
                </FieldGroup>
              </section>
              <section id="rules-overtime">
                <FieldGroup title="Overtime" description="Overtime pay = hourly rate (basic ÷ 240) × hours × the multiplier; never below 1.5 (Labour Act 2074).">
                  {page.otRule && (
                    <div className="px-4 pt-3">
                      <Notice tone="info">
                        An hourly overtime rule is active (×{page.otRule.work} on a working day, ×{page.otRule.off} on an off day): payroll uses it. These apply when no rule is active.{" "}
                        <Link href="/timeAndLeave/policies?tab=ot-rules" className="font-medium underline underline-offset-2">
                          Overtime rules
                        </Link>
                      </Notice>
                    </div>
                  )}
                  {row("otWorkDay", "On a working day (×)", times("otWorkDay"))}
                  {row("otOffDay", "On an off day or holiday (×)", times("otOffDay"))}
                </FieldGroup>
              </section>
              <section id="rules-grades">
                <FieldGroup title="Grade policy" description="How a grade amount is worked out from basic salary and the number of grades.">
                  {row(
                    "gradeMethod",
                    "Grades are",
                    <SelectField name="gradeMethod" options={GRADE_METHODS.map((m) => ({ value: m.value, label: m.label, hint: m.hint }))} value={form.gradeMethod} onChange={(v) => set("gradeMethod", v as RulesForm["gradeMethod"])} disabled={!edit} />
                  )}
                  {form.gradeMethod === "STATUTORY_DAILY_RATE" &&
                    row("gradeDaysInMonth", "Days in a month", <NumberField name="gradeDaysInMonth" value={form.gradeDaysInMonth} onChange={(n) => set("gradeDaysInMonth", n)} decimals={0} max={32} selectOnFocus readOnly={!edit} className="max-w-32" />, "One grade = basic ÷ this.")}
                  {form.gradeMethod === "PERCENTAGE_OF_BASIC" && row("gradePercent", "Share of basic per grade (%)", percent("gradePercent"))}
                  {form.gradeMethod === "FIXED_AMOUNT_PER_GRADE" && row("gradeAmount", "Amount per grade", rupees("gradeAmount"))}
                  {(form.gradeMethod === "STATUTORY_DAILY_RATE" || form.gradeMethod === "PERCENTAGE_OF_BASIC" || form.gradeMethod === "FIXED_AMOUNT_PER_GRADE") && (
                    <>
                      {row("gradeMax", "Most grades counted", <NumberField name="gradeMax" value={form.gradeMax} onChange={(n) => set("gradeMax", n)} decimals={0} max={100} showZero selectOnFocus readOnly={!edit} className="max-w-32" />, "Grades above this are not paid. 0: no limit.")}
                      <div className="px-4 py-3 text-xs text-ink-muted">
                        Example: basic {SAMPLE.basic.toLocaleString("en-IN")} with {SAMPLE.grades} grades → <span className="tabular-nums text-ink">{example.formula}</span>
                      </div>
                    </>
                  )}
                  <div className="px-4 py-3 text-2xs text-ink-faint">
                    Saving a new grade policy works out every employee&apos;s grade again: those that change go to salary approval as one &quot;Grade policy&quot; change ({APPROVAL_WORDS[page.salaryApproval]}). Grades typed by hand stay as
                    they are.{!page.canChangeGrades && edit ? " Changing it also needs Salary structure → Edit." : ""}
                  </div>
                </FieldGroup>
              </section>
            </PropertyForm>
            {edit && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <span className="mr-auto text-2xs text-ink-muted">{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"} not saved` : "No changes"}</span>
                <WindowButton onClick={() => (setForm(page.form), setTried(false), setServerErrors(null))} disabled={!changes.length || loading}>
                  Undo changes
                </WindowButton>
                <WindowButton ref={saveRef} variant="primary" onClick={openReview} disabled={!changes.length || loading}>
                  <Save className="h-3.5 w-3.5" /> Save…
                </WindowButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {review && <ReviewWindow review={review} onClose={() => setReview(null)} onSave={save} />}
      <Confirm
        open={applying}
        title="Apply the grade policy again?"
        message="Every active employee's grade is worked out under the saved policy. Those that change go to salary approval as one Grade policy change; grades typed by hand stay. Use it after a waiting change of someone left out is decided."
        confirmLabel="Apply grade policy"
        onConfirm={applyAgain}
        onCancel={() => setApplying(false)}
      />
    </div>
  );
}

/** Save, after the changes in words and — for a grade policy — what happens to salaries. */
function ReviewWindow({
  review,
  onClose,
  onSave,
}: {
  review: { changes: RulesChange[]; grades: boolean; impact: GradePolicyImpact | null; error: string | null };
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const waitingImpact = review.grades && !review.impact && !review.error;
  const impact = review.impact;
  const run = async () => {
    setSaving(true);
    setFailure(null);
    try {
      await onSave();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      size="md"
      title="Save these rules?"
      description="Payroll uses them from the next calculation."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={run} disabled={saving || waitingImpact || !!review.error}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save rules
          </WindowButton>
        </>
      }
    >
      <ul className="divide-y divide-line rounded-lg border border-line text-xs">
        {review.changes.map((c) => (
          <li key={c.key} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
            <span className="text-ink">{c.label}</span>
            <span className="tabular-nums text-ink-muted">
              {c.from} → <span className="font-semibold text-ink">{c.to}</span>
            </span>
          </li>
        ))}
      </ul>
      {review.grades && (
        <section aria-label="Salaries" className="mt-3 rounded-lg border border-line px-3 py-2 text-xs">
          <h3 className="mb-1 font-semibold text-ink">Salaries</h3>
          {review.error ? (
            <p className="text-danger">{review.error}</p>
          ) : !impact ? (
            <p className="flex items-center gap-1.5 text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out every employee&apos;s grade…
            </p>
          ) : (
            <div className="space-y-1.5 text-ink">
              {impact.employees ? (
                <p>
                  {impact.employees} employee{impact.employees === 1 ? "'s" : "s'"} grade changes:{" "}
                  <Amount value={impact.monthlyChange} className="font-semibold" /> a month in all.{" "}
                  {impact.approvedAtOnce ? "It counts from today (salary approval is off)." : `It goes to salary approval as one Grade policy change and waits for ${impact.waitingFor ?? "an approver"}.`}
                </p>
              ) : (
                <p>No worked-out grade changes.</p>
              )}
              {impact.ownSalary && <p className="text-warning">Your own salary is in it, so someone else approves it.</p>}
              {impact.pending.length > 0 && (
                <p className="text-ink-muted">
                  Left out while a salary change of theirs waits: {impact.pending.join(", ")}. Apply the grade policy again once it is decided.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </Window>
  );
}
