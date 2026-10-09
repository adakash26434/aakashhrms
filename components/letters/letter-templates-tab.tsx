"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { Confirm } from "@/components/kit/confirm";
import { Notice } from "@/components/kit/notice";
import { LETTER_MERGE_FIELDS } from "@/lib/engines/letter.engine";
import { saveLetterTemplateAction, deleteLetterTemplateAction } from "@/app/actions/letter.actions";
import type { LetterTemplateRow } from "@/lib/types/letter";

// Letter templates (G2): the six system templates (editable, never deletable)
// plus the company's own. Bodies are plain text with {{merge_field}}
// placeholders and optional {{#if field}}…{{/if}} clauses.

const textareaClass = `${inputClass} h-auto min-h-48 max-w-none whitespace-pre-wrap py-2 leading-6`;

interface TemplateForm {
  code: string;
  name: string;
  nameNp: string;
  subjectEn: string;
  subjectNp: string;
  bodyEn: string;
  bodyNp: string;
  isActive: boolean;
}

const emptyForm: TemplateForm = { code: "", name: "", nameNp: "", subjectEn: "", subjectNp: "", bodyEn: "", bodyNp: "", isActive: true };

export function LetterTemplatesTab({ templates, canEdit, onDone }: { templates: LetterTemplateRow[]; canEdit: boolean; onDone: (text: string) => void }) {
  const [editing, setEditing] = useState<LetterTemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LetterTemplateRow | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = creating || !!editing;
  const set = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const startCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setError(null);
    setCreating(true);
  };
  const startEdit = (t: LetterTemplateRow) => {
    setForm({ code: t.code, name: t.name, nameNp: t.nameNp, subjectEn: t.subjectEn, subjectNp: t.subjectNp, bodyEn: t.bodyEn, bodyNp: t.bodyNp, isActive: t.isActive });
    setErrors({});
    setError(null);
    setEditing(t);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveLetterTemplateAction(editing?.id ?? null, form);
      if (result.success) {
        close();
        onDone(`Template "${result.data.name}" saved.`);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  const remove = async () => {
    if (!deleting) return;
    const result = await deleteLetterTemplateAction(deleting.id);
    setDeleting(null);
    if (result.success) onDone("Template deleted.");
    else setError(result.error);
  };

  const columns: GridColumn<LetterTemplateRow>[] = [
    { id: "name", header: "Template", value: (t) => t.name, sticky: true },
    { id: "nameNp", header: "नाम", value: (t) => t.nameNp },
    { id: "code", header: "Code", value: (t) => t.code, width: 120 },
    { id: "languages", header: "Languages", value: (t) => (t.bodyNp ? "English · नेपाली" : "English"), width: 130 },
    { id: "kind", header: "Kind", value: (t) => (t.isSystem ? "System" : "Custom"), width: 90 },
    {
      id: "status",
      header: "Status",
      value: (t) => (t.isActive ? "Active" : "Inactive"),
      cell: (t) => <StatusChip status={t.isActive ? "active" : "inactive"} />,
      width: 100,
    },
  ];

  return (
    <div className="p-3">
      {error && (
        <Notice tone="danger" className="mb-3" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      <DataGrid
        id="letter-templates"
        label="Letter templates"
        columns={columns}
        rows={templates}
        getRowId={(t) => t.id}
        onOpen={canEdit ? startEdit : undefined}
        toolbar={
          canEdit ? (
            <WindowButton onClick={startCreate}>
              <Plus className="h-3.5 w-3.5" /> New template
            </WindowButton>
          ) : undefined
        }
        empty={{ title: "No templates", description: "The system templates appear on first use." }}
      />

      <Window
        open={open}
        onClose={close}
        title={editing ? `Edit template — ${editing.name}` : "New template"}
        description="Plain text with {{merge_field}} placeholders; wrap an optional clause in {{#if field}}…{{/if}} so it appears only when that field is filled."
        size="xl"
        dirty
        footer={
          <>
            <WindowButton onClick={close}>Cancel</WindowButton>
            {editing && canEdit && !editing.isSystem && (
              <WindowButton
                variant="danger"
                onClick={() => {
                  setDeleting(editing);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </WindowButton>
            )}
            <WindowButton variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save template"}
            </WindowButton>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_230px]">
          <PropertyForm enterNavigation>
            <FieldGroup title="Template">
              <FieldRow label="Name" required error={errors.name}>
                <input className={inputClass} value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Appointment letter" />
              </FieldRow>
              <FieldRow label="Name (नेपाली)" error={errors.nameNp}>
                <input className={inputClass} value={form.nameNp} maxLength={100} onChange={(e) => set("nameNp", e.target.value)} placeholder="जस्तै: नियुक्ति पत्र" />
              </FieldRow>
              <FieldRow label="Code" required error={errors.code} help={editing?.isSystem ? "A system template's code never changes." : "Short id, e.g. warning_letter."}>
                <input className={`${inputClass} font-code`} value={form.code} maxLength={30} readOnly={!!editing?.isSystem} onChange={(e) => set("code", e.target.value.toLowerCase())} />
              </FieldRow>
              <FieldRow label="Active" error={errors.isActive}>
                <label className="flex h-8 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                  Offered in the Issue window
                </label>
              </FieldRow>
            </FieldGroup>
            <FieldGroup title="English">
              <FieldRow label="Subject" required error={errors.subjectEn}>
                <input className={inputClass} value={form.subjectEn} maxLength={200} onChange={(e) => set("subjectEn", e.target.value)} />
              </FieldRow>
              <FieldRow label="Body" required error={errors.bodyEn} wide>
                <textarea className={textareaClass} value={form.bodyEn} onChange={(e) => set("bodyEn", e.target.value)} />
              </FieldRow>
            </FieldGroup>
            <FieldGroup title="नेपाली" description="Leave both empty for an English-only template.">
              <FieldRow label="विषय" error={errors.subjectNp}>
                <input className={inputClass} value={form.subjectNp} maxLength={200} onChange={(e) => set("subjectNp", e.target.value)} />
              </FieldRow>
              <FieldRow label="पत्रको व्यहोरा" error={errors.bodyNp} wide>
                <textarea className={`${textareaClass} leading-7`} value={form.bodyNp} onChange={(e) => set("bodyNp", e.target.value)} />
              </FieldRow>
            </FieldGroup>
          </PropertyForm>
          <aside className="rounded-md border border-line bg-surface-sunken p-3 text-xs">
            <p className="mb-2 font-semibold uppercase tracking-wide text-ink-muted">Merge fields</p>
            <ul className="space-y-1">
              {LETTER_MERGE_FIELDS.map((f) => (
                <li key={f.key} className="flex items-baseline justify-between gap-2">
                  <code className="font-code text-2xs text-ink">{`{{${f.key}}}`}</code>
                  <span className="text-right text-ink-faint">{f.source === "input" ? "asked at issue" : f.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-2 text-ink-muted">
              Optional clause: <code className="font-code text-2xs">{"{{#if remarks}}…{{/if}}"}</code>
            </p>
          </aside>
        </div>
      </Window>

      <Confirm
        open={!!deleting}
        title="Delete template"
        message={`Delete the custom template "${deleting?.name}"? Issued letters are not affected.`}
        tone="danger"
        confirmLabel="Delete"
        requireText="DELETE"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
