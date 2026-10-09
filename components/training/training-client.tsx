"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { PROGRAM_KINDS } from "@/lib/engines/training.engine";
import { createProgramAction, getProgramAction, markParticipantAction, moveProgramAction, nominateAction, updateProgramAction } from "@/app/actions/training.actions";
import type { ParticipantRow, ProgramDetail, ProgramRow, TrainingPageData } from "@/lib/types/training";

// Training (G7): programme register, a programme window with nominations,
// attendance, scores and certificates, and the service bond end date per
// participant. Nobody marks their own training (the server refuses).

const statusChip = (status: ProgramRow["status"]) =>
  status === "completed" ? (
    <StatusChip status="approved" label="Completed" />
  ) : status === "cancelled" ? (
    <StatusChip status="cancelled" label="Cancelled" />
  ) : status === "running" ? (
    <StatusChip status="onHold" label="Running" />
  ) : (
    <StatusChip status="pending" label="Planned" />
  );

export function TrainingClient({ data }: { data: TrainingPageData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [editing, setEditing] = useState<ProgramRow | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.programs.filter((p) => {
      if (filters.kind && p.kind !== filters.kind) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (q && ![p.title, p.provider].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.programs, filters, search]);

  const columns: GridColumn<ProgramRow>[] = [
    { id: "title", header: "Programme", value: (p) => p.title, sticky: true },
    { id: "kind", header: "Kind", value: (p) => p.kindName, width: 160 },
    { id: "start", header: "Start", value: (p) => p.startAd, type: "date", width: 120, cell: (p) => <DateCell value={p.startAd} /> },
    { id: "end", header: "End", value: (p) => p.endAd, type: "date", width: 120, cell: (p) => <DateCell value={p.endAd} /> },
    { id: "hours", header: "Hours", value: (p) => p.hours, width: 80 },
    { id: "people", header: "Completed / nominated", value: (p) => p.nominated, width: 170, cell: (p) => `${p.completed} / ${p.nominated}` },
    { id: "bond", header: "Bond", value: (p) => p.bondMonths, width: 90, cell: (p) => (p.bondMonths ? `${p.bondMonths} mo` : "—") },
    { id: "cost", header: "Cost", value: (p) => p.cost, type: "number", width: 120, cell: (p) => <Amount value={p.cost} />, defaultHidden: true },
    { id: "status", header: "Status", value: (p) => p.status, width: 120, cell: (p) => statusChip(p.status) },
  ];

  return (
    <div>
      <PageBar
        title="Training"
        description="Programmes, nominations, attendance, scores and service bonds"
        actions={[
          { id: "new", label: "New programme", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.add, onClick: () => setEditing("new") },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <FilterStrip
        id="training"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Title or provider" }}
        filters={[
          { id: "kind", label: "Kind", options: PROGRAM_KINDS.map((k) => ({ value: k.code, label: k.name })), allLabel: "All kinds" },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "planned", label: "Planned" },
              { value: "running", label: "Running" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ],
            allLabel: "All statuses",
          },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="training"
        label="Training programmes"
        columns={columns}
        rows={rows}
        getRowId={(p) => p.id}
        onOpen={(p) => setOpenId(p.id)}
        exportModule="TRAINING"
        exportName="training-programmes"
        defaultSort={{ columnId: "start", direction: "desc" }}
        empty={{ title: "No programmes", description: data.permissions.add ? "Plan a programme and nominate staff." : "Training programmes appear here." }}
      />

      {editing && (
        <ProgramFormWindow
          key={editing === "new" ? "new" : editing.id}
          program={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setEditing(null);
            setNotice(`Programme saved: ${row.title}.`);
            refresh();
          }}
        />
      )}
      {openId && <ProgramWindow key={openId} programId={openId} data={data} onClose={() => setOpenId(null)} onChanged={refresh} onEdit={(p) => setEditing(p)} />}
    </div>
  );
}

function ProgramFormWindow({ program, onClose, onSaved }: { program: ProgramRow | null; onClose: () => void; onSaved: (row: ProgramRow) => void }) {
  const [title, setTitle] = useState(program?.title ?? "");
  const [provider, setProvider] = useState(program?.provider ?? "");
  const [kind, setKind] = useState(program?.kind ?? "");
  const [startAd, setStartAd] = useState(program?.startAd ?? "");
  const [endAd, setEndAd] = useState(program?.endAd ?? "");
  const [hours, setHours] = useState(program ? String(program.hours) : "");
  const [cost, setCost] = useState(program ? String(program.cost) : "");
  const [bondMonths, setBondMonths] = useState(program ? String(program.bondMonths) : "");
  const [note, setNote] = useState(program?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const form = { title, provider, kind, startAd, endAd, hours, cost, bondMonths, note };
      const result = program ? await updateProgramAction(program.id, form) : await createProgramAction(form);
      if (result.success) onSaved(result.data);
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title={program ? "Edit programme" : "New programme"}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Programme">
            <FieldRow label="Title" required error={errors.title}>
              <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </FieldRow>
            <FieldRow label="Kind" required error={errors.kind}>
              <SelectField options={PROGRAM_KINDS.map((k) => ({ value: k.code, label: k.name }))} value={kind} onChange={setKind} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Provider" error={errors.provider}>
              <input className={inputClass} value={provider} maxLength={200} onChange={(e) => setProvider(e.target.value)} />
            </FieldRow>
            <FieldRow label="Start" required error={errors.startAd}>
              <DateField value={startAd} onChange={setStartAd} />
            </FieldRow>
            <FieldRow label="End" required error={errors.endAd}>
              <DateField value={endAd} onChange={setEndAd} />
            </FieldRow>
            <FieldRow label="Hours" required error={errors.hours}>
              <input className={inputClass} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
            </FieldRow>
            <FieldRow label="Cost" error={errors.cost}>
              <input className={inputClass} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </FieldRow>
            <FieldRow label="Service bond (months)" error={errors.bondMonths} help="Months the employee commits to stay after completing. 0 = none.">
              <input className={inputClass} inputMode="numeric" value={bondMonths} onChange={(e) => setBondMonths(e.target.value)} />
            </FieldRow>
            <FieldRow label="Note" error={errors.note}>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function ProgramWindow({ programId, data, onClose, onChanged, onEdit }: { programId: string; data: TrainingPageData; onClose: () => void; onChanged: () => void; onEdit: (p: ProgramRow) => void }) {
  const [detail, setDetail] = useState<ProgramDetail | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getProgramAction(programId);
      if (cancelled) return;
      if (result.success) setDetail(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const apply = (result: { success: true; data: ProgramDetail } | { success: false; error: string; validationErrors?: Record<string, string> }, after?: () => void) => {
    if (result.success) {
      setDetail(result.data);
      after?.();
      onChanged();
    } else {
      const fieldError = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
      setError(fieldError ?? result.error);
    }
  };

  const move = (to: string) =>
    startTransition(async () => {
      setError(null);
      apply(await moveProgramAction(programId, to));
    });

  const nominate = () =>
    startTransition(async () => {
      setError(null);
      const result = await nominateAction(programId, [employeeId]);
      if (result.success) apply({ success: true, data: result.data.detail }, () => setEmployeeId(""));
      else apply(result);
    });

  const [drafts, setDrafts] = useState<Record<string, { score: string; certificateNo: string }>>({});
  const draft = (p: ParticipantRow) => drafts[p.id] ?? { score: p.score === null ? "" : String(p.score), certificateNo: p.certificateNo ?? "" };
  const setDraft = (id: string, patch: Partial<{ score: string; certificateNo: string }>, base: ParticipantRow) =>
    setDrafts((d) => ({ ...d, [id]: { ...draft(base), ...patch } }));

  const mark = (p: ParticipantRow, status: string) =>
    startTransition(async () => {
      setError(null);
      const d = draft(p);
      apply(await markParticipantAction(p.id, { status, score: status === "absent" ? "" : d.score, certificateNo: status === "completed" ? d.certificateNo : "" }));
    });

  const open = detail && (detail.status === "planned" || detail.status === "running");
  const people = new Set(detail?.participants.map((p) => p.employeeId));

  return (
    <Window open onClose={onClose} title={detail?.title ?? "Programme"} description={detail ? `${detail.kindName} · ${detail.startAd} → ${detail.endAd} · ${detail.hours} h${detail.bondMonths ? ` · bond ${detail.bondMonths} months` : ""}` : undefined} size="lg" footer={<WindowButton onClick={onClose}>Close window</WindowButton>}>
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {!detail && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {detail && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {statusChip(detail.status)}
              {data.permissions.manage && open && <WindowButton onClick={() => onEdit(detail)}>Edit</WindowButton>}
              {data.permissions.manage && detail.next.includes("running") && <WindowButton onClick={() => move("running")} disabled={pending}>Start</WindowButton>}
              {data.permissions.manage && detail.next.includes("completed") && <WindowButton variant="primary" onClick={() => move("completed")} disabled={pending}>Mark completed</WindowButton>}
              {data.permissions.manage && detail.next.includes("cancelled") && <WindowButton onClick={() => move("cancelled")} disabled={pending}>Cancel</WindowButton>}
            </div>

            {data.permissions.add && open && (
              <div className="flex items-end gap-2">
                <div className="min-w-64 flex-1">
                  <Combobox options={data.employees.filter((e) => !people.has(e.id)).map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Nominate an employee" />
                </div>
                <WindowButton onClick={nominate} disabled={pending || !employeeId}>
                  Nominate
                </WindowButton>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="py-1 pr-2">Employee</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Score</th>
                  <th className="py-1 pr-2">Certificate</th>
                  <th className="py-1 pr-2">Bond until</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {detail.participants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-ink-muted">
                      No one nominated yet.
                    </td>
                  </tr>
                )}
                {detail.participants.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-1 pr-2">
                      {p.employeeName} <span className="text-ink-faint">· {p.employeeCode}</span>
                    </td>
                    <td className="py-1 pr-2 capitalize">{p.status}</td>
                    <td className="py-1 pr-2">
                      {data.permissions.manage && detail.status !== "planned" && p.status !== "absent" ? (
                        <input className={`${inputClass} w-16`} inputMode="decimal" value={draft(p).score} onChange={(e) => setDraft(p.id, { score: e.target.value }, p)} aria-label="Score" />
                      ) : (
                        p.score ?? "—"
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {data.permissions.manage && detail.status === "completed" && p.status !== "absent" ? (
                        <input className={`${inputClass} w-28`} value={draft(p).certificateNo} maxLength={60} onChange={(e) => setDraft(p.id, { certificateNo: e.target.value }, p)} aria-label="Certificate number" />
                      ) : (
                        p.certificateNo ?? "—"
                      )}
                    </td>
                    <td className="py-1 pr-2">{p.bondEndsAd ? <DateCell value={p.bondEndsAd} /> : "—"}</td>
                    <td className="py-1 text-right">
                      {data.permissions.manage && (detail.status === "running" || detail.status === "completed") && (
                        <span className="inline-flex gap-1">
                          {detail.status === "running" && (
                            <>
                              <WindowButton onClick={() => mark(p, "attended")} disabled={pending}>Attended</WindowButton>
                              <WindowButton onClick={() => mark(p, "absent")} disabled={pending}>Absent</WindowButton>
                            </>
                          )}
                          {detail.status === "completed" && p.status !== "absent" && (
                            <WindowButton onClick={() => mark(p, "completed")} disabled={pending}>Completed</WindowButton>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Window>
  );
}
