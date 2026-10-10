"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { Combobox } from "@/components/kit/combobox";
import { SelectField } from "@/components/kit/select-field";
import { Notice } from "@/components/kit/notice";
import { issueJoiningPackAction, planJoiningPackAction } from "@/app/actions/letter.actions";
import { JOINING_PACK, LONG_INPUT_FIELDS, type PackLanguage } from "@/lib/engines/letter.engine";
import type { PackPlan } from "@/lib/services/letter.service";
import type { LetterEmployeeOption } from "@/lib/types/letter";

// Joining pack (G2 follow-up): the papers a new employee is given together —
// appointment, job description, agreement, KYC and dhanjamani — in English,
// Nepali or both. Salary, probation, notice period and duties are filled from
// the employee's record; only what is genuinely unknown is typed. Nothing is
// issued until every chosen letter has all its details.

const DEFAULT_KINDS = ["appointment", "job_description", "agreement", "kyc"];

export function JoiningPackWindow({ open, onClose, employees, initialEmployeeId, onIssued }: { open: boolean; onClose: () => void; employees: LetterEmployeeOption[]; initialEmployeeId?: string; onIssued: (text: string) => void }) {
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? "");
  const [language, setLanguage] = useState<PackLanguage>("en");
  const [kinds, setKinds] = useState<string[]>(DEFAULT_KINDS);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<PackPlan | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [planning, setPlanning] = useState(false);
  const planned = useRef(0);
  const seeded = useRef<string>("");

  const form = { employeeId, language, kinds, inputs };

  // Re-plan (debounced) whenever the choice changes: which details are asked, which are still missing.
  useEffect(() => {
    if (!open || !employeeId || kinds.length === 0) return;
    const run = ++planned.current;
    const timer = setTimeout(async () => {
      setPlanning(true);
      const result = await planJoiningPackAction({ employeeId, language, kinds, inputs });
      if (run !== planned.current) return;
      setPlanning(false);
      if (result.success) {
        setPlan(result.data);
        setError(null);
        // Prefill from the record once per employee; typed values always win.
        if (seeded.current !== employeeId) {
          seeded.current = employeeId;
          setInputs((prev) => ({ ...result.data.defaults, ...prev }));
        }
      } else {
        setPlan(null);
        setError(result.error);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [open, employeeId, language, kinds, inputs]);

  const reset = () => {
    setEmployeeId(initialEmployeeId ?? "");
    setLanguage("en");
    setKinds(DEFAULT_KINDS);
    setInputs({});
    setPlan(null);
    setErrors({});
    setError(null);
    seeded.current = "";
  };
  const close = () => {
    reset();
    onClose();
  };

  const toggle = (code: string) => setKinds((k) => (k.includes(code) ? k.filter((x) => x !== code) : [...k, code]));
  const count = kinds.length * (language === "both" ? 2 : 1);
  const blocked = !plan || plan.missingInputs.length > 0 || plan.missingRecord.length > 0 || plan.unavailable.length > 0;

  const issue = () =>
    startTransition(async () => {
      setError(null);
      const result = await issueJoiningPackAction(form);
      if (!result.success) {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
        return;
      }
      const { issued, failed } = result.data;
      const base = `${issued.length} letter${issued.length === 1 ? "" : "s"} issued (${issued.map((l) => l.letterNumber).join(", ")}).`;
      if (failed.length) {
        setError(`${base} Not issued: ${failed.map((f) => `${f.kind} — ${f.error}`).join("; ")}`);
        return;
      }
      reset();
      onIssued(base);
    });

  return (
    <Window
      open={open}
      onClose={close}
      title="Joining pack"
      description="Issue the new employee's papers together. Each letter gets its own chalani number and its text is frozen as issued."
      size="lg"
      dirty={!!employeeId}
      footer={
        <>
          <WindowButton onClick={close}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={issue} disabled={pending || planning || blocked}>
            {pending ? "Issuing…" : `Issue ${count} letter${count === 1 ? "" : "s"}`}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Pack">
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox
                options={employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))}
                value={employeeId}
                onChange={(v) => {
                  setEmployeeId(v);
                  setInputs({});
                  seeded.current = "";
                  setPlan(null);
                }}
                placeholder="Type a name or code"
              />
            </FieldRow>
            <FieldRow label="Language">
              <SelectField
                options={[
                  { value: "en", label: "English" },
                  { value: "np", label: "नेपाली" },
                  { value: "both", label: "Both — English and नेपाली" },
                ]}
                value={language}
                onChange={(v) => setLanguage(v === "np" || v === "both" ? v : "en")}
              />
            </FieldRow>
            <FieldRow label="Letters" required error={errors.kinds} wide>
              <ul className="grid gap-1 sm:grid-cols-2">
                {JOINING_PACK.map((code) => {
                  const k = plan?.kinds.find((x) => x.code === code);
                  const available = k ? k.available : true;
                  return (
                    <li key={code}>
                      <label className="flex min-h-8 items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={kinds.includes(code)} disabled={!available} onChange={() => toggle(code)} />
                        <span>
                          {k?.name ?? code.replace(/_/g, " ")}
                          {k?.nameNp ? <span className="text-ink-faint"> · {k.nameNp}</span> : null}
                          {!available && <span className="text-danger"> (inactive)</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </FieldRow>
          </FieldGroup>

          {plan && plan.inputFields.length > 0 && (
            <FieldGroup title="Details" description="Filled from the employee's record where known. A field inside an optional clause may stay empty.">
              {plan.inputFields.map((f) => (
                <FieldRow key={f.key} label={f.label} error={errors[`inputs.${f.key}`]} wide={LONG_INPUT_FIELDS.has(f.key)}>
                  {LONG_INPUT_FIELDS.has(f.key) ? (
                    <textarea className={`${inputClass} h-auto min-h-24 max-w-none py-2`} value={inputs[f.key] ?? ""} maxLength={3000} onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value }))} />
                  ) : (
                    <input type="text" className={inputClass} value={inputs[f.key] ?? ""} maxLength={200} onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </FieldRow>
              ))}
            </FieldGroup>
          )}
        </PropertyForm>

        {plan && (plan.missingRecord.length > 0 || plan.unavailable.length > 0 || plan.missingInputs.length > 0) && (
          <Notice tone="warning">
            {plan.missingRecord.length > 0 && <p>The employee&apos;s record lacks: {plan.missingRecord.join(", ")}. Complete the record, then try again.</p>}
            {plan.unavailable.length > 0 && <p>No text yet for: {plan.unavailable.join(", ")}. Add it under Templates, or change the language.</p>}
            {plan.missingInputs.length > 0 && <p>Still to fill: {plan.missingInputs.join(", ")}.</p>}
          </Notice>
        )}
        {plan && !blocked && (
          <p className="text-xs text-ink-muted">
            Ready: {plan.employee.fullName} · {plan.employee.designation}, {plan.employee.branch} — {count} letter{count === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    </Window>
  );
}
