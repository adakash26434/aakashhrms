"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DateCell } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { fieldLabel } from "@/lib/constants/employee-form";
import { validateDossier } from "@/lib/engines/employee-dossier.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { ATTACHMENT_KINDS, DOSSIER_LIMITS, QUALIFICATION_LEVELS, type AttachmentInput, type EmployeeDossierInput, type QualificationInput, type WorkHistoryInput } from "@/lib/types/employee-dossier";
import { cn } from "@/lib/utils";
import { FormSection, type EmployeeFormApi } from "./employee-form-fields";
import { DocumentViewer } from "./employee-document-viewer";
import { ScanField } from "./scan-field";

// Qualifications & history (4.2c): three lists saved with the employee —
// education, past employment and other attachments (certificates, training,
// undertakings, Dhanjamani). Rows are edited in a window; a scan per row.

const iconButton = "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
const addButton = "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-brand px-2.5 text-2xs font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";

type ListKey = keyof EmployeeDossierInput;
type Row = QualificationInput | WorkHistoryInput | AttachmentInput;

const EMPTY: { [K in ListKey]: EmployeeDossierInput[K][number] } = {
  qualifications: { level: "", degree: "", institution: "", board: "", passedYear: "", division: "", major: "", file: null },
  workHistory: { organisation: "", designation: "", fromAd: "", toAd: "", duties: "", reference: "", file: null },
  attachments: { kind: "", title: "", note: "", file: null },
};

const levelLabel = (code: string) => QUALIFICATION_LEVELS.find((l) => l.code === code)?.label ?? code;
const kindLabel = (code: string) => ATTACHMENT_KINDS.find((k) => k.code === code)?.label ?? code;

export function EmployeeFormDossier({ api }: { api: EmployeeFormApi }) {
  const { form, errors } = api;
  const dossier = form.dossier;
  const [editing, setEditing] = useState<{ list: ListKey; index: number } | null>(null);
  const [removing, setRemoving] = useState<{ list: ListKey; index: number } | null>(null);
  const [viewing, setViewing] = useState<{ title: string; row: Row } | null>(null);
  const [staged] = useState(() => new Set<string>());

  const clearErrors = (list: ListKey) => {
    for (const key of Object.keys(errors)) if (key.startsWith(`${list}.`)) api.clear(key);
  };
  const rowErrors = (list: ListKey, i: number) => Object.entries(errors).filter(([k, m]) => m && k.startsWith(`${list}.${i}.`));

  const saveRow = (list: ListKey, index: number, row: Row) => {
    api.update((f) => {
      const rows = f.dossier[list] as Row[];
      const next = index >= rows.length ? [...rows, row] : rows.map((r, i) => (i === index ? row : r));
      return { ...f, dossier: { ...f.dossier, [list]: next } };
    });
    clearErrors(list);
    setEditing(null);
  };
  const removeRow = (list: ListKey, index: number) => {
    const row = (dossier[list] as Row[])[index];
    if (row?.file && staged.has(row.file.id)) {
      staged.delete(row.file.id);
      void fetch(`/api/employees/documents/files/${encodeURIComponent(row.file.id)}`, { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    }
    api.update((f) => ({ ...f, dossier: { ...f.dossier, [list]: (f.dossier[list] as Row[]).filter((_, i) => i !== index) } }));
    clearErrors(list);
    setRemoving(null);
  };

  const problems = (list: ListKey, i: number) => {
    const found = rowErrors(list, i);
    return found.length ? <span role="alert" className="mt-0.5 block text-3xs font-medium text-danger">{found.map(([k, m]) => `${fieldLabel(k).replace(/ \(.*\)$/, "")}: ${m}`).join(" · ")}</span> : null;
  };
  const actions = (list: ListKey, i: number, label: string, row: Row) => (
    <td key="actions" className="whitespace-nowrap px-2 py-1.5 text-right">
      <button type="button" data-enter-skip onClick={() => setViewing({ title: label, row })} disabled={!row.file} aria-label={`View the file for ${label}`} className={iconButton}><Eye aria-hidden className="h-3.5 w-3.5" /></button>
      <button type="button" data-enter-skip name={`${list}.${i}.edit`} onClick={() => setEditing({ list, index: i })} aria-label={`Edit ${label}`} className={cn(iconButton, rowErrors(list, i).length > 0 && "text-danger")}><Pencil aria-hidden className="h-3.5 w-3.5" /></button>
      <button type="button" data-enter-skip onClick={() => setRemoving({ list, index: i })} aria-label={`Delete ${label}`} className={cn(iconButton, "hover:bg-danger-subtle hover:text-danger")}><Trash2 aria-hidden className="h-3.5 w-3.5" /></button>
    </td>
  );
  const table = (list: ListKey, head: string[], children: React.ReactNode, empty: string) =>
    (dossier[list] as Row[]).length === 0 ? (
      <div className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-4 text-center text-xs text-ink-muted">{empty}</div>
    ) : (
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-160 text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-sunken text-left text-3xs uppercase tracking-wide text-ink-muted">
              {head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              <th className="w-px px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    );
  const block = (list: ListKey, title: string, description: string, head: string[], empty: string, children: React.ReactNode) => (
    <div className="col-span-full min-w-0">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-ink">{title}</h3>
          <p className="text-2xs text-ink-muted">{description}</p>
        </div>
        <button type="button" data-field-anchor={list} onClick={() => setEditing({ list, index: (dossier[list] as Row[]).length })} disabled={(dossier[list] as Row[]).length >= DOSSIER_LIMITS[list]} className={addButton}>
          <Plus aria-hidden className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {table(list, head, children, empty)}
    </div>
  );

  return (
    <FormSection id="dossier" title="Qualifications & history" description="Education, past employment and other papers on file. Each row may carry a scan; everything is saved with the employee." columns={2}>
      {block("qualifications", "Education", "Highest first is not required — list every certificate.", ["Level", "Degree", "Institution", "Board / university", "Year", "Division", "Scan"], "No qualifications yet.", [
        dossier.qualifications.map((q, i) => (
          <tr key={q.id ?? `q-${i}`} className={cn("border-b border-line align-top last:border-0", rowErrors("qualifications", i).length > 0 && "bg-danger-subtle/40")}>
            <td className="px-3 py-2 font-medium text-ink">{levelLabel(q.level)}{problems("qualifications", i)}</td>
            <td className="px-3 py-2">{q.degree}{q.major && <span className="block text-2xs text-ink-muted">{q.major}</span>}</td>
            <td className="px-3 py-2">{q.institution || "—"}</td>
            <td className="px-3 py-2">{q.board || "—"}</td>
            <td className="px-3 py-2 tabular-nums">{q.passedYear || "—"}</td>
            <td className="px-3 py-2">{q.division || "—"}</td>
            <td className="px-3 py-2">{q.file ? <span className="text-ink-muted">Attached</span> : <span className="text-ink-faint">None</span>}</td>
            {actions("qualifications", i, q.degree || "qualification", q)}
          </tr>
        )),
      ])}
      {block("workHistory", "Past employment", "Where the person worked before joining here.", ["Organisation", "Designation", "From", "To", "Reference", "Letter"], "No past employment recorded.", [
        dossier.workHistory.map((w, i) => (
          <tr key={w.id ?? `w-${i}`} className={cn("border-b border-line align-top last:border-0", rowErrors("workHistory", i).length > 0 && "bg-danger-subtle/40")}>
            <td className="px-3 py-2 font-medium text-ink">{w.organisation}{problems("workHistory", i)}</td>
            <td className="px-3 py-2">{w.designation}</td>
            <td className="whitespace-nowrap px-3 py-2">{w.fromAd ? <DateCell value={w.fromAd} /> : "—"}</td>
            <td className="whitespace-nowrap px-3 py-2">{w.toAd ? <DateCell value={w.toAd} /> : <span className="text-ink-faint">—</span>}</td>
            <td className="px-3 py-2 text-ink-muted">{w.reference || "—"}</td>
            <td className="px-3 py-2">{w.file ? <span className="text-ink-muted">Attached</span> : <span className="text-ink-faint">None</span>}</td>
            {actions("workHistory", i, w.organisation || "past job", w)}
          </tr>
        )),
      ])}
      {block("attachments", "Other attachments", "Certificates, training, agreements, undertakings (Dhanjamani), reports — one file each.", ["Kind", "Title", "Note", "File"], "No attachments yet.", [
        dossier.attachments.map((a, i) => (
          <tr key={a.id ?? `a-${i}`} className={cn("border-b border-line align-top last:border-0", rowErrors("attachments", i).length > 0 && "bg-danger-subtle/40")}>
            <td className="px-3 py-2 font-medium text-ink">{kindLabel(a.kind)}{problems("attachments", i)}</td>
            <td className="px-3 py-2">{a.title}</td>
            <td className="px-3 py-2 text-ink-muted">{a.note || "—"}</td>
            <td className="px-3 py-2">{a.file ? <span className="text-ink-muted">{a.file.name}</span> : <span className="text-danger">Missing</span>}</td>
            {actions("attachments", i, a.title || "attachment", a)}
          </tr>
        )),
      ])}

      {editing && (
        <DossierRowWindow
          key={`${editing.list}-${editing.index}`}
          list={editing.list}
          dossier={dossier}
          index={editing.index}
          employeeId={api.ctx.employeeId}
          joiningDate={form.joiningDate}
          staged={staged}
          onCancel={() => setEditing(null)}
          onDone={(row) => saveRow(editing.list, editing.index, row)}
        />
      )}
      <Confirm open={!!removing} title="Delete this row?" message="It is removed, with its file, when you save the employee." confirmLabel="Delete" tone="danger" onConfirm={() => { if (removing) removeRow(removing.list, removing.index); }} onCancel={() => setRemoving(null)} />
      {viewing && <DocumentViewer open title={viewing.title} file={viewing.row.file} onClose={() => setViewing(null)} />}
    </FormSection>
  );
}

function DossierRowWindow({ list, dossier, index, employeeId, joiningDate, staged, onCancel, onDone }: { list: ListKey; dossier: EmployeeDossierInput; index: number; employeeId: string | null; joiningDate: string; staged: Set<string>; onCancel: () => void; onDone: (row: Row) => void }) {
  const rows = dossier[list] as Row[];
  const isNew = index >= rows.length;
  const initial = isNew ? EMPTY[list] : rows[index];
  const [draft, setDraft] = useState<Row>(initial);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<Row>) => setDraft((d) => ({ ...d, ...patch }) as Row);
  const d = draft as QualificationInput & WorkHistoryInput & AttachmentInput;

  const all = validateDossier({ ...dossier, [list]: isNew ? [...rows, draft] : rows.map((r, i) => (i === index ? draft : r)) } as EmployeeDossierInput, { today: nepalDateIso(), joiningDate });
  const errorOf = (field: string) => (tried ? all[`${list}.${index}.${field}`] : undefined);
  const hasErrors = Object.keys(all).some((k) => k.startsWith(`${list}.${index}.`));
  const titles: Record<ListKey, string> = { qualifications: "Qualification", workHistory: "Past employment", attachments: "Attachment" };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const done = () => {
    setTried(true);
    if (hasErrors) return;
    onDone(draft);
  };
  const cancel = () => {
    if (draft.file && draft.file.id !== initial.file?.id && staged.has(draft.file.id)) {
      staged.delete(draft.file.id);
      void fetch(`/api/employees/documents/files/${encodeURIComponent(draft.file.id)}`, { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    }
    onCancel();
  };
  const text = (field: string, value: string, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <input className={inputClass} name={field} value={value} onChange={(e) => set({ [field]: e.target.value } as Partial<Row>)} {...extra} />
  );

  return (
    <Window open onClose={cancel} title={`${isNew ? "Add" : "Edit"} ${titles[list].toLowerCase()}`} size="md" dirty={dirty} footer={<><WindowCancel onClick={cancel} /><WindowButton variant="primary" onClick={done}>{isNew ? "Add" : "Done"}</WindowButton></>}>
      <PropertyForm onSubmit={done} enterNavigation>
        <div className="p-4">
          <FormGrid columns={2}>
            {list === "qualifications" && (
              <>
                <GridField label="Level" required error={errorOf("level")}><SelectField options={QUALIFICATION_LEVELS.map((l) => ({ value: l.code, label: l.label }))} value={d.level} onChange={(v) => set({ level: v } as Partial<Row>)} placeholder="Choose" /></GridField>
                <GridField label="Degree / certificate" required error={errorOf("degree")}>{text("degree", d.degree, { maxLength: 120, placeholder: "BBS, MBA, SEE…" })}</GridField>
                <GridField label="Institution" error={errorOf("institution")}>{text("institution", d.institution, { maxLength: 200 })}</GridField>
                <GridField label="Board / university" error={errorOf("board")}>{text("board", d.board, { maxLength: 200, placeholder: "Tribhuvan University, NEB…" })}</GridField>
                <GridField label="Year passed" error={errorOf("passedYear")}>{text("passedYear", d.passedYear, { maxLength: 4, inputMode: "numeric", placeholder: "2078" })}</GridField>
                <GridField label="Division / grade" error={errorOf("division")}>{text("division", d.division, { maxLength: 40, placeholder: "First, 3.6 GPA…" })}</GridField>
                <GridField label="Major / faculty" error={errorOf("major")} span={2}>{text("major", d.major, { maxLength: 120 })}</GridField>
                <GridField label="Certificate scan" span={2}><ScanField value={d.file} onChange={(file) => set({ file } as Partial<Row>)} employeeId={employeeId} staged={staged} title={d.degree || "Certificate"} hint="PDF, JPG or PNG, up to 3 MB." /></GridField>
              </>
            )}
            {list === "workHistory" && (
              <>
                <GridField label="Organisation" required error={errorOf("organisation")}>{text("organisation", d.organisation, { maxLength: 200 })}</GridField>
                <GridField label="Designation" required error={errorOf("designation")}>{text("designation", d.designation, { maxLength: 120 })}</GridField>
                <GridField label="From" required error={errorOf("fromAd")}><DateField value={d.fromAd} onChange={(v) => set({ fromAd: v } as Partial<Row>)} /></GridField>
                <GridField label="To" error={errorOf("toAd")} help="Leave empty if it was the last job before joining."><DateField value={d.toAd} onChange={(v) => set({ toAd: v } as Partial<Row>)} /></GridField>
                <GridField label="Reference" error={errorOf("reference")} span={2}>{text("reference", d.reference, { maxLength: 200, placeholder: "A contact there, with a phone number" })}</GridField>
                <GridField label="Duties" error={errorOf("duties")} span={2}><textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={d.duties} maxLength={1000} onChange={(e) => set({ duties: e.target.value } as Partial<Row>)} /></GridField>
                <GridField label="Experience letter" span={2}><ScanField value={d.file} onChange={(file) => set({ file } as Partial<Row>)} employeeId={employeeId} staged={staged} title={d.organisation || "Experience letter"} hint="PDF, JPG or PNG, up to 3 MB." /></GridField>
              </>
            )}
            {list === "attachments" && (
              <>
                <GridField label="Kind" required error={errorOf("kind")}><SelectField options={ATTACHMENT_KINDS.map((k) => ({ value: k.code, label: k.label }))} value={d.kind} onChange={(v) => set({ kind: v } as Partial<Row>)} placeholder="Choose" /></GridField>
                <GridField label="Title" required error={errorOf("title")}>{text("title", d.title, { maxLength: 150 })}</GridField>
                <GridField label="Note" error={errorOf("note")} span={2}>{text("note", d.note, { maxLength: 500 })}</GridField>
                <GridField label="File" required error={errorOf("file")} span={2}><ScanField value={d.file} onChange={(file) => set({ file } as Partial<Row>)} employeeId={employeeId} staged={staged} title={d.title || "Attachment"} hint="PDF, JPG or PNG, up to 3 MB." /></GridField>
              </>
            )}
          </FormGrid>
        </div>
      </PropertyForm>
    </Window>
  );
}
