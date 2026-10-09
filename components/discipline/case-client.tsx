"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { CASE_CATEGORIES, OUTCOMES, SEVERITIES } from "@/lib/engines/case.engine";
import { addCaseNoteAction, closeCaseAction, decideCaseAction, getCaseAction, investigateCaseAction, openCaseAction } from "@/app/actions/case.actions";
import type { CaseDetail, CaseListRow, CasePageData } from "@/lib/types/case";

// Disciplinary & grievance (G8): the confidential register, a new-case window
// and a case window with the timeline, investigate / decide / close. Termination
// is only recommended here — the exit itself is the Exit screen's.

const statusChip = (status: CaseListRow["status"]) =>
  status === "closed" ? (
    <StatusChip status="approved" label="Closed" />
  ) : status === "decided" ? (
    <StatusChip status="approved" label="Decided" />
  ) : status === "investigating" ? (
    <StatusChip status="onHold" label="Investigating" />
  ) : (
    <StatusChip status="pending" label="Open" />
  );

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function CaseClient({ data }: { data: CasePageData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.cases.filter((c) => {
      if (filters.category && c.category !== filters.category) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (q && ![c.employeeName, c.employeeCode, c.title].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.cases, filters, search]);

  const columns: GridColumn<CaseListRow>[] = [
    { id: "employee", header: "Employee", value: (c) => c.employeeName, sticky: true, cell: (c) => (
        <span>
          {c.employeeName} <span className="text-ink-faint">· {c.employeeCode}</span>
        </span>
      ) },
    { id: "category", header: "Type", value: (c) => c.categoryName, width: 120 },
    { id: "title", header: "Title", value: (c) => c.title },
    { id: "severity", header: "Severity", value: (c) => c.severity, width: 100, cell: (c) => <span className="capitalize">{c.severity}</span> },
    { id: "status", header: "Status", value: (c) => c.status, width: 140, cell: (c) => statusChip(c.status) },
    { id: "outcome", header: "Outcome", value: (c) => c.outcomeName ?? "", width: 170 },
    { id: "opened", header: "Opened", value: (c) => c.openedAt, width: 150, cell: (c) => when(c.openedAt) },
    { id: "by", header: "Opened by", value: (c) => c.openedByName, width: 140, defaultHidden: true },
  ];

  return (
    <div>
      <PageBar
        title="Discipline & grievance"
        description="Confidential cases: investigate, decide, close. Cases about you never appear here, and termination is only recommended — the exit runs under Exit."
        actions={[
          { id: "new", label: "New case", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.open, onClick: () => setCreating(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <FilterStrip
        id="hr-cases"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Employee, code or title" }}
        filters={[
          { id: "category", label: "Type", options: CASE_CATEGORIES.map((c) => ({ value: c.code, label: `${c.name} · ${c.nameNp}` })), allLabel: "All types" },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "open", label: "Open" },
              { value: "investigating", label: "Investigating" },
              { value: "decided", label: "Decided" },
              { value: "closed", label: "Closed" },
            ],
            allLabel: "All statuses",
          },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="hr-cases"
        label="Cases"
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        onOpen={(c) => setOpenId(c.id)}
        rowTone={(c) => (c.status === "open" && c.severity === "serious" ? "danger" : c.status === "investigating" ? "warning" : undefined)}
        exportModule="DISCIPLINE"
        exportName="hr-cases"
        defaultSort={{ columnId: "opened", direction: "desc" }}
        empty={{ title: "No cases", description: data.permissions.open ? "Open a case when a complaint or an incident comes in." : "Cases for employees in your scope appear here." }}
      />

      <NewCaseWindow
        open={creating}
        employees={data.employees}
        onClose={() => setCreating(false)}
        onSaved={(row) => {
          setCreating(false);
          setNotice({ tone: "success", text: `${row.categoryName} case opened for ${row.employeeName}.` });
          setOpenId(row.id);
          refresh();
        }}
      />
      {openId && <CaseWindow key={openId} caseId={openId} permissions={data.permissions} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  );
}

function NewCaseWindow({ open, employees, onClose, onSaved }: { open: boolean; employees: CasePageData["employees"]; onClose: () => void; onSaved: (row: CaseListRow) => void }) {
  const [category, setCategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [severity, setSeverity] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await openCaseAction({ category, employeeId, severity, title, description });
      if (result.success) {
        setCategory("");
        setEmployeeId("");
        setSeverity("");
        setTitle("");
        setDescription("");
        setErrors({});
        onSaved(result.data);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title="New case"
      description="Disciplinary: the employee concerned. Grievance: the employee who raised it."
      size="md"
      dirty={!!employeeId || !!title || !!description}
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !category || !employeeId}>
            {pending ? "Opening…" : "Open case"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Case">
            <FieldRow label="Type" required error={errors.category}>
              <SelectField options={CASE_CATEGORIES.map((c) => ({ value: c.code, label: `${c.name} · ${c.nameNp}` }))} value={category} onChange={setCategory} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox options={employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Type a name or code" />
            </FieldRow>
            <FieldRow label="Severity" required error={errors.severity}>
              <SelectField options={SEVERITIES.map((s) => ({ value: s.code, label: s.name }))} value={severity} onChange={setSeverity} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Title" required error={errors.title}>
              <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </FieldRow>
            <FieldRow label="What happened" required error={errors.description}>
              <textarea className={`${inputClass} h-auto min-h-24 max-w-none py-2`} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function CaseWindow({ caseId, permissions, onClose, onChanged }: { caseId: string; permissions: CasePageData["permissions"]; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [outcome, setOutcome] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getCaseAction(caseId);
      if (cancelled) return;
      if (result.success) setDetail(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const run = (call: () => Promise<{ success: true; data: CaseDetail } | { success: false; error: string; validationErrors?: Record<string, string> }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      setErrors({});
      const result = await call();
      if (result.success) {
        setDetail(result.data);
        after?.();
        onChanged();
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  const outcomes = detail ? OUTCOMES[detail.category] : [];

  return (
    <Window open onClose={onClose} title={detail ? detail.title : "Case"} description={detail ? `${detail.categoryName} · ${detail.employeeName} (${detail.employeeCode}) · ${detail.severity}` : undefined} size="lg" footer={<WindowButton onClick={onClose}>Close window</WindowButton>}>
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {!detail && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {detail && (
          <>
            <div className="flex items-center gap-2 text-xs">
              {statusChip(detail.status)}
              {detail.outcomeName && <span className="font-medium">Outcome: {detail.outcomeName}</span>}
            </div>
            <p className="whitespace-pre-wrap rounded-md border border-line bg-surface-sunken p-3 text-sm">{detail.description}</p>

            {permissions.manage && detail.status === "open" && (
              <WindowButton onClick={() => run(() => investigateCaseAction(caseId))} disabled={pending}>
                Start investigation
              </WindowButton>
            )}

            {permissions.decide && (detail.status === "open" || detail.status === "investigating") && (
              <PropertyForm>
                <FieldGroup title="Decision">
                  <FieldRow label="Outcome" required error={errors.outcome} help={detail.category === "disciplinary" ? "Termination can only be recommended; run the exit under Exit." : undefined}>
                    <SelectField options={outcomes.map((o) => ({ value: o.code, label: `${o.name} · ${o.nameNp}` }))} value={outcome} onChange={setOutcome} placeholder="Choose" />
                  </FieldRow>
                  <FieldRow label="Reason" required error={errors.note}>
                    <textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={decisionNote} maxLength={2000} onChange={(e) => setDecisionNote(e.target.value)} />
                  </FieldRow>
                </FieldGroup>
                <WindowButton variant="primary" disabled={pending || !outcome} onClick={() => run(() => decideCaseAction(caseId, { outcome, note: decisionNote }), () => setDecisionNote(""))}>
                  Record decision
                </WindowButton>
              </PropertyForm>
            )}

            {permissions.manage && detail.status === "decided" && (
              <WindowButton variant="primary" onClick={() => run(() => closeCaseAction(caseId))} disabled={pending}>
                Close case
              </WindowButton>
            )}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Timeline</p>
              <ul className="space-y-1.5 text-sm">
                {detail.events.map((e) => (
                  <li key={e.id} className="rounded-md border border-line px-3 py-1.5">
                    <span className="text-2xs text-ink-faint">
                      {when(e.at)} · {e.actorName} · {e.kind}
                    </span>
                    <p className="whitespace-pre-wrap">{e.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            {permissions.manage && detail.status !== "closed" && (
              <PropertyForm>
                <FieldGroup title="Add a note">
                  <FieldRow label="Note" error={errors.note}>
                    <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
                  </FieldRow>
                </FieldGroup>
                <WindowButton disabled={pending || note.trim().length < 3} onClick={() => run(() => addCaseNoteAction(caseId, note), () => setNote(""))}>
                  Add note
                </WindowButton>
              </PropertyForm>
            )}
          </>
        )}
      </div>
    </Window>
  );
}
