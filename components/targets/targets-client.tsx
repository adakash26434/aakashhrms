"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, X } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Notice } from "@/components/kit/notice";
import { Confirm } from "@/components/kit/confirm";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { FISCAL_MONTHS, TARGET_STATUSES } from "@/lib/engines/target.engine";
import { createTargetsAction, decideTargetAction, deleteTargetAction, updateTargetAction } from "@/app/actions/target.actions";
import { EvidenceList, STATUS_LABEL, fmt, pctText, targetStatusChip } from "@/components/targets/target-bits";
import type { PeriodScore, TargetRow, TargetsPageData } from "@/lib/types/target";

// Targets (G15), office side: HR sets monthly / yearly targets (one or many
// people at once), watches reports come in, and closes what supervisors have
// forwarded. Nobody sets or closes their own targets (the server refuses).

const MAX_PEOPLE = 200;

export function TargetsClient({ data, initialStatus }: { data: TargetsPageData; initialStatus?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  // A status from the link (the bell) looks across every year; otherwise this year.
  const [filters, setFilters] = useState<FilterValues>((): FilterValues => (initialStatus ? { status: initialStatus } : { fy: data.currentFy }));
  const [setting, setSetting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (filters.fy && r.fy !== filters.fy) return false;
      if (filters.kind && r.periodKind !== filters.kind) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (q && ![r.employeeName, r.employeeCode, r.title].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.rows, filters, search]);

  const open = openId ? data.rows.find((r) => r.id === openId) ?? null : null;
  const scoreOf = (r: TargetRow): PeriodScore | undefined =>
    data.scores.find((s) => s.employeeId === r.employeeId && s.periodKind === r.periodKind && s.fy === r.fy && s.monthNo === r.monthNo);

  const columns: GridColumn<TargetRow>[] = [
    { id: "employee", header: "Employee", value: (r) => r.employeeName, sticky: true, width: 230, cell: (r) => <>{r.employeeName} <span className="text-ink-faint">{r.employeeCode}</span></> },
    { id: "period", header: "Period", value: (r) => `${r.fy}-${String(r.monthNo ?? 0).padStart(2, "0")}`, width: 140, cell: (r) => r.periodLabel },
    { id: "title", header: "Target", value: (r) => r.title },
    { id: "target", header: "Goal", value: (r) => r.targetValue, type: "number", width: 120, cell: (r) => fmt(r.targetValue, r.unit) },
    { id: "weight", header: "Weight", value: (r) => r.weight, type: "number", width: 90, cell: (r) => `${r.weight}%` },
    { id: "reported", header: "Reported", value: (r) => r.achievedValue ?? -1, type: "number", width: 100, cell: (r) => fmt(r.achievedValue, r.unit) },
    { id: "verified", header: "Verified", value: (r) => r.verifiedValue ?? -1, type: "number", width: 100, cell: (r) => fmt(r.verifiedValue, r.unit) },
    { id: "pct", header: "Achieved", value: (r) => r.pct ?? -1, type: "number", width: 90, cell: (r) => pctText(r.pct) },
    { id: "score", header: "Period score", value: (r) => scoreOf(r)?.score ?? -1, type: "number", width: 110, cell: (r) => pctText(scoreOf(r)?.score ?? null), defaultHidden: true },
    { id: "status", header: "Status", value: (r) => r.status, width: 170, cell: (r) => targetStatusChip(r.status) },
  ];

  return (
    <div>
      <PageBar
        title="Targets"
        description="Monthly and yearly targets, the achievements staff report, and what supervisors forward"
        actions={[
          { id: "new", label: "Set targets", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.add, onClick: () => setSetting(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <FilterStrip
        id="targets"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Employee, code or target" }}
        filters={[
          { id: "fy", label: "Fiscal year", options: data.fiscalYears.map((y) => ({ value: y, label: y })), allLabel: "All years" },
          { id: "kind", label: "Period", options: [{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }], allLabel: "Monthly and yearly" },
          { id: "status", label: "Status", options: TARGET_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })), allLabel: "All statuses" },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="targets"
        label="Employee targets"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        onOpen={(r) => setOpenId(r.id)}
        exportModule="TARGETS"
        exportName="employee-targets"
        defaultSort={{ columnId: "employee", direction: "asc" }}
        empty={{ title: "No targets", description: data.permissions.add ? "Set a monthly or yearly target for one or more employees." : "Targets appear here." }}
      />

      {setting && (
        <SetTargetsWindow
          data={data}
          onClose={() => setSetting(false)}
          onSaved={(created, skipped) => {
            setSetting(false);
            setNotice(`${created} target${created === 1 ? "" : "s"} set${skipped ? `; ${skipped} already existed and were skipped` : ""}.`);
            refresh();
          }}
        />
      )}
      {open && <TargetWindow key={open.id} row={open} score={scoreOf(open)} permissions={data.permissions} onClose={() => setOpenId(null)} onChanged={(msg) => { setOpenId(null); setNotice(msg); refresh(); }} />}
    </div>
  );
}

function SetTargetsWindow({ data, onClose, onSaved }: { data: TargetsPageData; onClose: () => void; onSaved: (created: number, skipped: number) => void }) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [periodKind, setPeriodKind] = useState("month");
  const [fy, setFy] = useState(data.currentFy);
  const [monthNo, setMonthNo] = useState("");
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [weight, setWeight] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await createTargetsAction({ employeeIds: people.map((p) => p.id), periodKind, fy, monthNo, title, unit, targetValue, weight });
      if (result.success) onSaved(result.data.created, result.data.skipped);
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title="Set targets"
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : `Set for ${people.length || "…"} ${people.length === 1 ? "person" : "people"}`}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Who">
            <FieldRow label="Employees" required error={errors.employeeIds} help={`Up to ${MAX_PEOPLE}. The same target is set for each person.`}>
              <div className="space-y-2">
                <Combobox
                  options={data.employees.filter((e) => !people.some((p) => p.id === e.id)).map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))}
                  value=""
                  onChange={(id) => {
                    const e = data.employees.find((x) => x.id === id);
                    if (e && people.length < MAX_PEOPLE) setPeople((l) => [...l, { id: e.id, name: e.fullName }]);
                  }}
                  placeholder="Type a name or code to add"
                  aria-label="Add an employee"
                />
                {people.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Chosen employees">
                    {people.map((p) => (
                      <li key={p.id} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-sunken px-2 py-0.5 text-xs text-ink">
                        {p.name}
                        <button type="button" data-enter-skip aria-label={`Remove ${p.name}`} className="cursor-pointer text-ink-muted hover:text-danger" onClick={() => setPeople((l) => l.filter((x) => x.id !== p.id))}>
                          <X aria-hidden className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FieldRow>
          </FieldGroup>
          <FieldGroup title="Period">
            <FieldRow label="Period" required>
              <SelectField options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} value={periodKind} onChange={setPeriodKind} />
            </FieldRow>
            <FieldRow label="Fiscal year" required error={errors.fy}>
              <SelectField options={data.fiscalYears.map((y) => ({ value: y, label: y }))} value={fy} onChange={setFy} />
            </FieldRow>
            {periodKind === "month" && (
              <FieldRow label="Month" required error={errors.monthNo}>
                <SelectField options={FISCAL_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} value={monthNo} onChange={setMonthNo} placeholder="Choose the month" />
              </FieldRow>
            )}
          </FieldGroup>
          <FieldGroup title="Target">
            <FieldRow label="What" required error={errors.title}>
              <input className={inputClass} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New savings accounts opened" />
            </FieldRow>
            <FieldRow label="Goal" required error={errors.targetValue}>
              <input className={inputClass} inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </FieldRow>
            <FieldRow label="Unit" error={errors.unit} help="Accounts, NPR, files, % …">
              <input className={inputClass} value={unit} maxLength={30} onChange={(e) => setUnit(e.target.value)} />
            </FieldRow>
            <FieldRow label="Weight (%)" error={errors.weight} help="How much this target counts. A person's targets in one period should add up to 100.">
              <input className={inputClass} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function TargetWindow({ row, score, permissions, onClose, onChanged }: { row: TargetRow; score: PeriodScore | undefined; permissions: TargetsPageData["permissions"]; onClose: () => void; onChanged: (message: string) => void }) {
  const editable = permissions.manage && row.status === "set" && row.achievedValue === null;
  const [title, setTitle] = useState(row.title);
  const [unit, setUnit] = useState(row.unit);
  const [targetValue, setTargetValue] = useState(String(row.targetValue));
  const [weight, setWeight] = useState(String(row.weight));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (job: () => Promise<{ success: boolean; error?: string; validationErrors?: Record<string, string> }>, message: string) =>
    startTransition(async () => {
      setError(null);
      const result = await job();
      if (result.success) onChanged(message);
      else {
        setErrors(result.validationErrors ?? {});
        setError(result.error ?? "Could not save.");
      }
    });

  const decide = permissions.decide && row.status === "forwarded";

  return (
    <Window
      open
      onClose={onClose}
      title={`${row.employeeName} · ${row.periodLabel}`}
      size="md"
      footer={
        <>
          {editable && (
            <WindowButton onClick={() => setRemoving(true)} disabled={pending}>
              Remove
            </WindowButton>
          )}
          <WindowButton onClick={onClose}>Close</WindowButton>
          {editable && (
            <WindowButton variant="primary" onClick={() => run(() => updateTargetAction(row.id, { title, unit, targetValue, weight }), "Target saved.")} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </WindowButton>
          )}
          {decide && (
            <>
              <WindowButton onClick={() => run(() => decideTargetAction(row.id, "return", reason), "Returned to the employee.")} disabled={pending}>
                Return
              </WindowButton>
              <WindowButton variant="primary" onClick={() => run(() => decideTargetAction(row.id, "close"), "Closed.")} disabled={pending}>
                Close target
              </WindowButton>
            </>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {targetStatusChip(row.status)}
          <span className="text-ink-muted">{row.employeeCode} · {row.branch}</span>
          {score && <span className="text-ink-muted">Period score {pctText(score.score)} (weights add to {score.weightTotal}%)</span>}
        </div>
        <PropertyForm enterNavigation>
          <FieldGroup title="Target">
            <FieldRow label="What" error={errors.title}>
              {editable ? <input className={inputClass} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} /> : <span className="text-sm text-ink">{row.title}</span>}
            </FieldRow>
            <FieldRow label="Goal" error={errors.targetValue}>
              {editable ? <input className={inputClass} inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} /> : <span className="text-sm text-ink">{fmt(row.targetValue, row.unit)}</span>}
            </FieldRow>
            {editable && (
              <FieldRow label="Unit" error={errors.unit}>
                <input className={inputClass} value={unit} maxLength={30} onChange={(e) => setUnit(e.target.value)} />
              </FieldRow>
            )}
            <FieldRow label="Weight" error={errors.weight}>
              {editable ? <input className={inputClass} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /> : <span className="text-sm text-ink">{row.weight}%</span>}
            </FieldRow>
          </FieldGroup>
          {row.achievedValue !== null && (
            <FieldGroup title="Achievement">
              <FieldRow label="Reported by employee"><span className="text-sm text-ink">{fmt(row.achievedValue, row.unit)}</span></FieldRow>
              {row.achievedNote && <FieldRow label="Employee's note"><span className="whitespace-pre-wrap text-sm text-ink">{row.achievedNote}</span></FieldRow>}
              <FieldRow label="Files"><EvidenceList files={row.attachments} /></FieldRow>
              {row.verifiedValue !== null && <FieldRow label="Verified by supervisor"><span className="text-sm text-ink">{fmt(row.verifiedValue, row.unit)}</span></FieldRow>}
              {row.reviewerNote && <FieldRow label="Supervisor's note"><span className="whitespace-pre-wrap text-sm text-ink">{row.reviewerNote}</span></FieldRow>}
              <FieldRow label="Achieved"><span className="text-sm font-medium text-ink">{pctText(row.pct)}</span></FieldRow>
            </FieldGroup>
          )}
          {row.status === "returned" && row.returnReason && (
            <FieldGroup title="Returned">
              <FieldRow label="Reason"><span className="whitespace-pre-wrap text-sm text-ink">{row.returnReason}</span></FieldRow>
            </FieldGroup>
          )}
          {decide && (
            <FieldGroup title="Decision">
              <FieldRow label="Reason if returning" error={errors.reason} help="Needed only to send it back.">
                <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
              </FieldRow>
            </FieldGroup>
          )}
        </PropertyForm>
      </div>
      <Confirm
        open={removing}
        title="Remove this target?"
        message="Nobody has reported on it yet. This cannot be undone."
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          const result = await deleteTargetAction(row.id);
          setRemoving(false);
          if (result.success) onChanged("Target removed.");
          else setError(result.error);
        }}
      />
    </Window>
  );
}
