"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DateCell } from "@/components/kit/date-cell";
import { fieldLabel } from "@/lib/constants/employee-form";
import { isPrimaryDocument } from "@/lib/engines/employee-document.engine";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, type EmployeeDocumentInput } from "@/lib/types/employee-document";
import { cn } from "@/lib/utils";
import { FormSection, TextField, type EmployeeFormApi } from "./employee-form-fields";
import { DocumentViewer, scanUrl } from "./employee-document-viewer";
import { EmployeeDocumentWindow } from "./employee-document-window";

const iconButton =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Identity documents (4.2b): one row per document (type, number, issuing district and office,
 * issued date, scan) with View / Edit / Delete on the row. Adding and editing happen in a
 * window; everything is saved with the employee. Citizenship or NID is required; each type
 * once. PAN stays a plain number below.
 */
export function EmployeeFormDocuments({ api }: { api: EmployeeFormApi }) {
  const { form, errors } = api;
  const rows = form.documents;
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  // Uploads made on this page and not saved yet: removing or replacing one deletes it on the server.
  const [staged] = useState(() => new Set<string>());

  const clearRowErrors = () => {
    // Row errors are keyed by position: clear them all rather than show them on the wrong row.
    for (const key of Object.keys(errors)) if (key.startsWith("documents.")) api.clear(key);
    api.clear("documents");
  };

  const saveRow = (index: number, row: EmployeeDocumentInput) => {
    api.update((f) => ({ ...f, documents: index >= f.documents.length ? [...f.documents, row] : f.documents.map((r, i) => (i === index ? row : r)) }));
    clearRowErrors();
    setEditing(null);
  };

  const removeRow = (index: number) => {
    const file = rows[index]?.file;
    if (file && staged.has(file.id)) {
      staged.delete(file.id);
      void fetch(scanUrl(file.id), { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    }
    api.update((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== index) }));
    clearRowErrors();
    setRemoving(null);
  };

  const primaryCount = rows.filter((r) => isPrimaryDocument(r.type)).length;
  const full = rows.length >= DOCUMENT_TYPES.length;
  const rowErrors = (i: number) => Object.entries(errors).filter(([k, m]) => m && k.startsWith(`documents.${i}.`));
  const typeName = (r: EmployeeDocumentInput | undefined) => (r?.type ? DOCUMENT_TYPE_LABEL[r.type] : "Document");

  return (
    <FormSection
      id="documents"
      title="Identity documents"
      description="A citizenship certificate or National ID is required, with a scan. Other documents are optional."
      aside={
        <button
          type="button"
          data-field-anchor="documents"
          onClick={() => setEditing(rows.length)}
          disabled={full}
          title={full ? "Every document type is listed" : undefined}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-brand px-2.5 text-2xs font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" /> Add document
        </button>
      }
    >
      <div className="col-span-full min-w-0">
        {errors.documents && (
          <p role="alert" className="mb-2 flex items-center gap-1.5 text-2xs font-medium text-danger">
            <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> {errors.documents}
          </p>
        )}
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-6 text-center text-xs text-ink-muted">
            No documents yet. Add the citizenship certificate or National ID.
            <div className="mt-3">
              <button type="button" onClick={() => setEditing(0)} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken">
                <Plus aria-hidden className="h-3.5 w-3.5" /> Add document
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-184 text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-sunken text-left text-3xs uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Document</th>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Issuing district</th>
                  <th className="px-3 py-2 font-medium">Issuing office</th>
                  <th className="px-3 py-2 font-medium">Issued</th>
                  <th className="px-3 py-2 font-medium">Scan</th>
                  <th className="w-px px-2 py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const problems = rowErrors(i);
                  const lastPrimary = isPrimaryDocument(r.type) && primaryCount === 1;
                  const incomplete = !!r.id && isPrimaryDocument(r.type) && (!r.issuedDate || !r.file);
                  return (
                    <tr key={r.id ?? `new-${i}`} className={cn("border-b border-line align-top last:border-0", problems.length > 0 && "bg-danger-subtle/40")}>
                      <td className="px-3 py-2 font-medium text-ink">
                        {typeName(r)}
                        {problems.length > 0 && (
                          <span role="alert" className="mt-0.5 block text-3xs font-medium text-danger">
                            {problems.map(([k, m]) => `${fieldLabel(k).replace(/ \(document \d+\)$/, "")}: ${m}`).join(" · ")}
                          </span>
                        )}
                        {!problems.length && incomplete && <span className="mt-0.5 block text-3xs font-normal text-warning">Add the issued date and a scan</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-code text-ink">{r.number || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink">{r.district || "—"}</td>
                      <td className="px-3 py-2 text-ink-muted">{r.office || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink">{r.issuedDate ? <DateCell value={r.issuedDate} /> : <span className="text-ink-faint">—</span>}</td>
                      <td className="px-3 py-2">{r.file ? <span className="text-ink-muted">Attached</span> : <span className="text-ink-faint">None</span>}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        <button type="button" data-enter-skip onClick={() => setViewing(i)} disabled={!r.file} aria-label={`View the ${typeName(r)} scan`} title={r.file ? "View the scan" : "No scan yet"} className={iconButton}>
                          <Eye aria-hidden className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" data-enter-skip name={`documents.${i}.edit`} onClick={() => setEditing(i)} aria-label={`Edit ${typeName(r)}`} title="Edit" className={cn(iconButton, problems.length > 0 && "text-danger")}>
                          <Pencil aria-hidden className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          data-enter-skip
                          onClick={() => setRemoving(i)}
                          disabled={lastPrimary}
                          aria-label={`Delete ${typeName(r)}`}
                          title={lastPrimary ? "A citizenship certificate or a National ID is required" : "Delete"}
                          className={cn(iconButton, "hover:bg-danger-subtle hover:text-danger")}
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TextField
        api={api}
        field="panNumber"
        code
        inputMode="numeric"
        maxLength={9}
        size="code"
        transform={(v) => v.replace(/\D/g, "").slice(0, 9)}
        help="9 digits, issued by the Inland Revenue Department. Needed for TDS reporting."
      />

      {editing !== null && (
        <EmployeeDocumentWindow
          rows={rows}
          index={editing}
          employeeId={api.ctx.employeeId}
          dateOfBirth={form.dateOfBirth}
          staged={staged}
          onCancel={() => setEditing(null)}
          onDone={(row) => saveRow(editing, row)}
        />
      )}
      <Confirm
        open={removing !== null}
        title={`Delete ${typeName(removing !== null ? rows[removing] : undefined)}?`}
        message="It is removed, with its scan, when you save the employee."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (removing !== null) removeRow(removing);
        }}
        onCancel={() => setRemoving(null)}
      />
      {viewing !== null && <DocumentViewer open title={typeName(rows[viewing])} file={rows[viewing]?.file ?? null} onClose={() => setViewing(null)} />}
    </FormSection>
  );
}
