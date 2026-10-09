"use client";

import { useMemo, useState, useTransition } from "react";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { Combobox } from "@/components/kit/combobox";
import { SelectField } from "@/components/kit/select-field";
import { Notice } from "@/components/kit/notice";
import { inputFieldsFor, templateText, type LetterLanguage } from "@/lib/engines/letter.engine";
import { previewLetterAction, issueLetterAction } from "@/app/actions/letter.actions";
import type { LetterEmployeeOption, LetterTemplateRow } from "@/lib/types/letter";
import type { LetterPreview } from "@/lib/services/letter.service";
import { cn } from "@/lib/utils";

// Issue window (G2): choose employee, template and language, fill only the
// fields that template actually uses, preview the rendered letter, issue.
// The server re-checks permission, scope and the own-record rule (S26).

interface IssueLetterWindowProps {
  open: boolean;
  onClose: () => void;
  employees: LetterEmployeeOption[];
  templates: LetterTemplateRow[];
  onIssued: (letterId: string, letterNumber: string) => void;
}

export function IssueLetterWindow({ open, onClose, employees, templates, onIssued }: IssueLetterWindowProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [language, setLanguage] = useState<LetterLanguage>("en");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<LetterPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const template = templates.find((t) => t.id === templateId) ?? null;
  const activeTemplates = templates.filter((t) => t.isActive);
  const hasNepali = !!template && !!template.bodyNp && !!template.subjectNp;

  // The engine is pure, so the window knows which fields this template asks for.
  const inputFields = useMemo(() => {
    if (!template) return [];
    const { subject, body } = templateText(template, language === "np" && hasNepali ? "np" : "en");
    return inputFieldsFor(body, subject);
  }, [template, language, hasNepali]);

  const dirty = !!employeeId || !!templateId || Object.keys(inputs).length > 0;
  const form = { employeeId, templateId, language, inputs };

  const reset = () => {
    setEmployeeId("");
    setTemplateId("");
    setLanguage("en");
    setInputs({});
    setErrors({});
    setPreview(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runPreview = () =>
    startTransition(async () => {
      setError(null);
      const result = await previewLetterAction(form);
      if (result.success) {
        setPreview(result.data);
        setErrors({});
      } else {
        setPreview(null);
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  const issue = () =>
    startTransition(async () => {
      setError(null);
      const result = await issueLetterAction(form);
      if (result.success) {
        const letter = result.data;
        reset();
        onIssued(letter.id, letter.letterNumber);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={close}
      title="Issue letter"
      description="The letter gets the fiscal year's next chalani number and its text is frozen as issued."
      size="lg"
      dirty={dirty}
      footer={
        <>
          <WindowButton onClick={close}>Cancel</WindowButton>
          <WindowButton onClick={runPreview} disabled={pending || !employeeId || !templateId}>
            {pending ? "Working…" : "Preview"}
          </WindowButton>
          <WindowButton variant="primary" onClick={issue} disabled={pending || !preview || preview.missing.length > 0}>
            Issue letter
          </WindowButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Letter">
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox
                options={employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))}
                value={employeeId}
                onChange={(v) => {
                  setEmployeeId(v);
                  setPreview(null);
                }}
                placeholder="Type a name or code"
              />
            </FieldRow>
            <FieldRow label="Template" required error={errors.templateId}>
              <SelectField
                options={activeTemplates.map((t) => ({ value: t.id, label: t.nameNp ? `${t.name} · ${t.nameNp}` : t.name }))}
                value={templateId}
                onChange={(v) => {
                  setTemplateId(v);
                  setInputs({});
                  setPreview(null);
                }}
                placeholder="Choose a template"
              />
            </FieldRow>
            <FieldRow label="Language" error={errors.language} help={template && !hasNepali ? "This template has no Nepali version yet." : undefined}>
              <SelectField
                options={[
                  { value: "en", label: "English" },
                  { value: "np", label: "नेपाली" },
                ]}
                value={language}
                onChange={(v) => {
                  setLanguage(v === "np" ? "np" : "en");
                  setPreview(null);
                }}
                disabled={!!template && !hasNepali}
              />
            </FieldRow>
          </FieldGroup>
          {inputFields.length > 0 && (
            <FieldGroup title="Details" description="Only the fields this template uses. A field inside an optional clause may stay empty — the clause is left out.">
              {inputFields.map((f) => (
                <FieldRow key={f.key} label={f.label} error={errors[`inputs.${f.key}`]}>
                  <input
                    type="text"
                    className={inputClass}
                    value={inputs[f.key] ?? ""}
                    onChange={(e) => {
                      setInputs((prev) => ({ ...prev, [f.key]: e.target.value }));
                      setPreview(null);
                    }}
                    maxLength={200}
                  />
                </FieldRow>
              ))}
            </FieldGroup>
          )}
        </PropertyForm>

        {preview && (
          <div className="rounded-md border border-line bg-surface-sunken p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Preview — {preview.employee?.fullName}</p>
              {preview.missing.length > 0 && (
                <p className="text-xs text-danger">
                  Fill: {preview.missing.join(", ")}
                </p>
              )}
            </div>
            <div className={cn("rounded-md border border-line bg-white p-5 text-sm text-ink", language === "np" && "leading-7")}>
              <p className="mb-3 text-center font-semibold underline underline-offset-4">{language === "np" ? `विषय: ${preview.subject}` : preview.subject}</p>
              <p className="whitespace-pre-line">{preview.body}</p>
            </div>
          </div>
        )}
      </div>
    </Window>
  );
}
