"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, Paperclip, Plus, Save, X } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { findProvinceByDistrict, getAllDistricts } from "@/lib/constants/nepal-locations";
import { DOCUMENT_FIELD_LABELS } from "@/lib/constants/employee-form";
import { availableDocumentTypes, fileProblem, fileSizeText, isPrimaryDocument, suggestedIssuingOffice, validateDocuments } from "@/lib/engines/employee-document.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { DOCUMENT_TYPE_LABEL, type DocumentFileRef, type EmployeeDocumentInput } from "@/lib/types/employee-document";
import { cn } from "@/lib/utils";
import { DocumentViewer, scanUrl } from "./employee-document-viewer";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/**
 * Add or edit one identity document (4.2b) in a window: type, number, issuing district and
 * office (pre-filled from the type and district until typed over), issued date, and one scan
 * with the front and back in it. The change goes into the employee form; it is saved with
 * the employee.
 */
export function EmployeeDocumentWindow({
  rows,
  index,
  employeeId,
  dateOfBirth,
  staged,
  onCancel,
  onDone,
}: {
  /** Every document in the form. */
  rows: EmployeeDocumentInput[];
  /** The row being edited; rows.length for a new one. */
  index: number;
  employeeId: string | null;
  dateOfBirth: string;
  /** Uploads made on this page and not saved yet (removing one deletes it on the server). */
  staged: Set<string>;
  onCancel: () => void;
  onDone: (row: EmployeeDocumentInput) => void;
}) {
  const isNew = index >= rows.length;
  const initial = useMemo<EmployeeDocumentInput>(() => {
    // A document saved before issuing offices existed gets the usual office to start from.
    if (!isNew) return rows[index].office ? rows[index] : { ...rows[index], office: suggestedIssuingOffice(rows[index].type, rows[index].district) };
    const free = availableDocumentTypes(rows, -1);
    // The first document of a new employee is the citizenship certificate (or the NID).
    const type = free.find((t) => isPrimaryDocument(t) && !rows.some((r) => isPrimaryDocument(r.type))) ?? (free.length === 1 ? free[0] : "");
    return { type, number: "", district: "", office: suggestedIssuingOffice(type, ""), issuedDate: "", file: null };
  }, [isNew, rows, index]);
  const [draft, setDraft] = useState<EmployeeDocumentInput>(initial);
  // The office follows the type and district until someone types in it.
  const [officeTyped, setOfficeTyped] = useState(() => !isNew && !!initial.office && initial.office !== suggestedIssuingOffice(initial.type, initial.district));
  const [tried, setTried] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  // No type chosen yet (a second document): start on Document, not on Number.
  useEffect(() => {
    if (initial.type) return;
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [name="type"]')?.focus());
    return () => cancelAnimationFrame(id);
  }, [initial.type]);

  const districts = useMemo(() => getAllDistricts().map((d) => ({ value: d.name, label: d.name, hint: findProvinceByDistrict(d.name)?.name.replace(/ Province$/, "") })), []);
  const typeOptions = availableDocumentTypes(rows, isNew ? -1 : index).map((t) => ({ value: t, label: DOCUMENT_TYPE_LABEL[t] }));

  // This row's errors, checked in the list (so a duplicate type is caught here); the list-level rule waits for the form.
  const all = validateDocuments(isNew ? [...rows, draft] : rows.map((r, i) => (i === index ? draft : r)), { dateOfBirth, today: nepalDateIso() });
  const errorOf = (field: keyof typeof DOCUMENT_FIELD_LABELS) => (tried ? all[`documents.${index}.${field}`] : undefined);
  const hasErrors = Object.keys(all).some((k) => k.startsWith(`documents.${index}.`));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const change = (next: Partial<EmployeeDocumentInput>) =>
    setDraft((d) => {
      const merged = { ...d, ...next };
      if (!officeTyped && ("type" in next || "district" in next)) merged.office = suggestedIssuingOffice(merged.type, merged.district);
      return merged;
    });

  const discard = (fileId: string) => {
    if (!staged.has(fileId)) return;
    staged.delete(fileId);
    void fetch(scanUrl(fileId), { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
  };

  const upload = async (file: File) => {
    const problem = fileProblem(file.size);
    if (problem) return setUploadError(problem);
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const query = employeeId ? `?employee=${encodeURIComponent(employeeId)}` : "";
      const res = await fetch(`/api/employees/documents/files${query}`, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { success: boolean; data?: DocumentFileRef; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) {
        setUploadError(json?.error ?? "The scan could not be uploaded. Try again.");
        return;
      }
      const ref = json.data;
      staged.add(ref.id);
      // A scan replaced before it was ever saved is deleted at once.
      if (draft.file && draft.file.id !== initial.file?.id) discard(draft.file.id);
      setDraft((d) => ({ ...d, file: ref }));
    } catch {
      setUploadError("The scan could not be uploaded. Check the connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    if (draft.file && draft.file.id !== initial.file?.id) discard(draft.file.id);
    setDraft((d) => ({ ...d, file: null }));
  };

  const cancel = () => {
    // Uploads made in this window that are not kept: delete them now.
    if (draft.file && draft.file.id !== initial.file?.id) discard(draft.file.id);
    onCancel();
  };

  const done = () => {
    setTried(true);
    if (hasErrors || uploading) return;
    onDone({ ...draft, number: draft.number.trim(), office: draft.office.trim() });
  };

  const title = isNew ? "Add document" : `Edit ${draft.type ? DOCUMENT_TYPE_LABEL[draft.type] : "document"}`;

  return (
    <Window
      open
      onClose={uploading ? () => {} : cancel}
      dirty={dirty}
      title={title}
      description="Saved with the employee when you save the form. Enter moves to the next field."
      size="lg"
      footer={
        <>
          <WindowCancel disabled={uploading} onClick={cancel} />
          <WindowButton ref={saveRef} variant="primary" onClick={done} disabled={uploading}>
            {isNew ? <Plus aria-hidden className="h-3.5 w-3.5" /> : <Save aria-hidden className="h-3.5 w-3.5" />}
            {isNew ? "Add document" : "Save changes"}
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={done} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0">
        <div className="bg-surface-panel">
          <FormGrid columns={2}>
            <GridField label={DOCUMENT_FIELD_LABELS.type} required error={errorOf("type")} size="md">
              <SelectField name="type" options={typeOptions} value={draft.type} onChange={(v) => change({ type: v as EmployeeDocumentInput["type"] })} placeholder="Choose the document" />
            </GridField>
            <GridField label={DOCUMENT_FIELD_LABELS.number} required error={errorOf("number")} size="md">
              <input
                name="number"
                autoComplete="off"
                spellCheck={false}
                maxLength={50}
                data-autofocus={!isNew || undefined}
                value={draft.number}
                onChange={(e) => change({ number: e.target.value })}
                className={cn(inputClass, "font-code")}
              />
            </GridField>
            <GridField label={DOCUMENT_FIELD_LABELS.district} required error={errorOf("district")} size="md">
              <Combobox name="district" options={districts} value={draft.district} onChange={(v) => change({ district: v })} placeholder="District" />
            </GridField>
            <GridField label={DOCUMENT_FIELD_LABELS.issuedDate} required={!draft.id} error={errorOf("issuedDate")} size="date">
              <DateField name="issuedDate" value={draft.issuedDate} onChange={(v) => change({ issuedDate: v })} />
            </GridField>
            <GridField label={DOCUMENT_FIELD_LABELS.office} required={!draft.id} error={errorOf("office")} size="lg" span={2} help="Filled from the document and district; change it if it was issued elsewhere.">
              <input
                name="office"
                autoComplete="off"
                maxLength={150}
                value={draft.office}
                onChange={(e) => {
                  setOfficeTyped(true);
                  change({ office: e.target.value });
                }}
                className={inputClass}
              />
            </GridField>
            <GridField label={DOCUMENT_FIELD_LABELS.file} required={!draft.id && isPrimaryDocument(draft.type)} error={uploadError || errorOf("file")} size="full" span={2}>
              <div className="space-y-1.5">
                {draft.file ? (
                  <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border border-line bg-surface pl-2.5 text-xs">
                    <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span className="min-w-0 max-w-64 truncate font-medium text-ink" title={draft.file.name}>
                      {draft.file.name}
                    </span>
                    <span className="shrink-0 text-2xs text-ink-faint">{fileSizeText(draft.file.size)}</span>
                    <button type="button" data-enter-skip onClick={() => setViewing(true)} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded px-1.5 text-2xs font-medium text-brand hover:bg-brand-subtle">
                      <Eye aria-hidden className="h-3.5 w-3.5" /> View
                    </button>
                    <button type="button" data-enter-skip onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex h-7 cursor-pointer items-center rounded px-1.5 text-2xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
                      Replace
                    </button>
                    <button type="button" data-enter-skip onClick={removeFile} aria-label="Remove the scan" title="Remove the scan" className="mr-0.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-ink-muted hover:bg-danger-subtle hover:text-danger">
                      <X aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    data-enter-skip
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:border-brand hover:text-brand disabled:cursor-wait disabled:opacity-60"
                  >
                    {uploading ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Paperclip aria-hidden className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading…" : "Choose file"}
                  </button>
                )}
                <p className="text-2xs text-ink-muted">Scan the front and back into one file: a PDF with both pages, or one image with both sides. PDF, JPG or PNG, up to 3 MB.</p>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  tabIndex={-1}
                  aria-hidden
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void upload(file);
                  }}
                />
              </div>
            </GridField>
          </FormGrid>
        </div>
      </PropertyForm>
      {viewing && <DocumentViewer open title={draft.type ? DOCUMENT_TYPE_LABEL[draft.type] : "Scan"} file={draft.file} onClose={() => setViewing(false)} />}
    </Window>
  );
}
