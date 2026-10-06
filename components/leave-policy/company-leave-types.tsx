"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Power, Save, Trash2 } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { deleteLeaveTypeAction, previewLeaveTypeThisYearAction, saveLeaveTypeAction, toggleLeaveTypeStatusAction } from "@/app/actions/leave-type.actions";
import { fmt } from "@/lib/engines/leave.engine";
import { describeLeaveType, formOfRecord, normalizeLeaveTypeForm, validateLeaveTypeForm } from "@/lib/engines/leave-type.engine";
import type { CompanyTypeChange, LeaveTypeFormData, LeaveTypeRecord, ThisYearPreview } from "@/lib/types/leave-type";

const PAY_LABEL: Record<string, string> = {
  Pay: "Paid",
  "Non-Pay": "Unpaid",
  "Partial-Pay": "Half paid",
};
const WHO_LABEL: Record<string, string> = {
  All: "Everyone",
  Female: "Women",
  Male: "Men",
};
const days = (n: number) => `${fmt(n)} day${n === 1 ? "" : "s"}`;

/** How the days are given, in a few words. */
function givenText(t: Pick<LeaveTypeRecord, "kind" | "noOfDays" | "creditMode">): string {
  if (t.kind === "none") return "No balance";
  if (t.kind === "event") return `${days(t.noOfDays)} each time`;
  return `${days(t.noOfDays)} a year${t.creditMode === "monthly" ? ", monthly" : ""}`;
}

/** What happens at the year end, in words. */
function yearEnd(t: Pick<LeaveTypeRecord, "kind" | "carryForward" | "accumulationCap" | "isEncashable">): string {
  if (t.kind !== "balance") return "—";
  if (t.carryForward) return `Carried over${t.accumulationCap ? ` up to ${days(t.accumulationCap)}${t.isEncashable ? ", the rest paid out" : ", the rest lapses"}` : ""}`;
  return t.isEncashable ? "Paid out" : "Lapses";
}

/** Notice, service and limits, in words. */
function rulesText(t: Pick<LeaveTypeRecord, "noticeDays" | "eligibleAfterDays" | "maxDaysPerYear" | "maxDaysInService" | "requiresDocument" | "documentThresholdDays">): string {
  const out: string[] = [];
  if (t.noticeDays) out.push(`${days(t.noticeDays)}' notice`);
  if (t.eligibleAfterDays) out.push(`after ${days(t.eligibleAfterDays)}' service`);
  if (t.maxDaysPerYear) out.push(`≤ ${fmt(t.maxDaysPerYear)} a year`);
  if (t.maxDaysInService) out.push(`≤ ${fmt(t.maxDaysInService)} in all`);
  if (t.requiresDocument && t.documentThresholdDays) out.push(`certificate after ${fmt(t.documentThresholdDays)}`);
  return out.join(" · ") || "—";
}

const blank: LeaveTypeFormData = normalizeLeaveTypeForm({
  kind: "balance",
  leaveType: "Pay",
  noOfDays: 0,
  proRataForNewJoinees: true,
});

export interface CompanyTypePermissions {
  add: boolean;
  edit: boolean;
  delete: boolean;
}

type Named = { id: string; name: string }[];

/**
 * The company's own leave types (Unpaid, study, special…): the law sets no
 * minimum, so changes apply on save; every save is in the type's history and
 * the audit log. A type that has been used is switched off, never deleted.
 */
export function CompanyLeaveTypes({
  types,
  history,
  departments,
  designations,
  permissions,
  creating,
  onCloseCreate,
  onDone,
}: {
  types: LeaveTypeRecord[];
  history: Record<string, CompanyTypeChange[]>;
  departments: Named;
  designations: Named;
  permissions: CompanyTypePermissions;
  creating: boolean;
  onCloseCreate: () => void;
  onDone: (text: string) => void;
}) {
  const rows = useMemo(() => types.filter((t) => !t.isStatutory), [types]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = rows.find((t) => t.id === activeId) ?? null;
  const [editing, setEditing] = useState<LeaveTypeRecord | null>(null);
  const [confirm, setConfirm] = useState<null | "delete" | "toggle">(null);
  const [message, setMessage] = useState<string | null>(null);

  const columns = useMemo<GridColumn<LeaveTypeRecord>[]>(
    () => [
      {
        id: "name",
        header: "Leave type",
        width: 190,
        sticky: true,
        value: (t) => t.name,
        cell: (t) => (
          <span className="font-medium text-ink">
            {t.name} <span className="font-code text-3xs font-normal text-ink-faint">{t.code}</span>
          </span>
        ),
      },
      {
        id: "pay",
        header: "Pay",
        width: 90,
        value: (t) => PAY_LABEL[t.leaveType] ?? t.leaveType,
      },
      { id: "given", header: "Days", width: 150, value: (t) => givenText(t) },
      { id: "end", header: "Year end", width: 210, value: (t) => yearEnd(t) },
      { id: "rules", header: "Rules", width: 230, value: (t) => rulesText(t) },
      {
        id: "who",
        header: "Who",
        width: 90,
        value: (t) => (t.applicableDepartments.length || t.applicableDesignations.length ? "Some" : (WHO_LABEL[t.genderApplicable] ?? t.genderApplicable)),
      },
      {
        id: "status",
        header: "Status",
        width: 80,
        value: (t) => (t.isActive ? "Active" : "Off"),
        cell: (t) => <StatusChip status={t.isActive ? "active" : "inactive"} label={t.isActive ? "Active" : "Off"} />,
      },
    ],
    [],
  );

  const run = async (kind: "delete" | "toggle") => {
    if (!active) return;
    const r = kind === "delete" ? await deleteLeaveTypeAction(active.id) : await toggleLeaveTypeStatusAction(active.id, !active.isActive);
    setConfirm(null);
    if (!r.success) {
      setMessage(r.error);
      return;
    }
    if (kind === "delete") setActiveId(null);
    onDone(kind === "delete" ? `${active.name} was deleted.` : `${active.name} is ${active.isActive ? "switched off: it can't be chosen for new requests" : "switched on again"}.`);
  };

  return (
    <section aria-label="Company leave types" className="border-t border-line p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-80">
          <h2 className="text-sm font-semibold text-ink">Company leave types</h2>
          <p className="text-2xs text-ink-muted">Your own leave, e.g. Unpaid leave. The law sets no minimum for these; changes apply when saved and are kept in each type&apos;s history.</p>
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          {permissions.edit && (
            <WindowButton onClick={() => active && setEditing(active)} disabled={!active}>
              <Pencil className="h-3.5 w-3.5" /> Edit…
            </WindowButton>
          )}
          {permissions.edit && (
            <WindowButton onClick={() => setConfirm("toggle")} disabled={!active}>
              <Power className="h-3.5 w-3.5" /> {active && !active.isActive ? "Switch on" : "Switch off"}
            </WindowButton>
          )}
          {permissions.delete && (
            <WindowButton variant="danger" onClick={() => setConfirm("delete")} disabled={!active}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </WindowButton>
          )}
        </div>
      </div>
      {message && (
        <Notice tone="danger" className="mb-2" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      )}
      <SplitView
        id="company-leave-types"
        detailTitle={active ? active.name : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={active ? <TypePane type={active} history={history[active.id] ?? []} departments={departments} designations={designations} canEdit={permissions.edit} onEdit={() => setEditing(active)} /> : null}
        master={
          <DataGrid
            id="company-leave-types"
            label="Company leave types"
            columns={columns}
            rows={rows}
            getRowId={(t) => t.id}
            activeRowId={activeId}
            onActiveRowChange={(t) => setActiveId(t.id)}
            onOpen={(t) => (permissions.edit ? setEditing(t) : setActiveId(t.id))}
            defaultSort={{ columnId: "name", direction: "asc" }}
            pageSize={25}
            empty={{
              title: "No company leave types",
              description: "Add your own leave, such as study or special leave, with New leave type.",
            }}
          />
        }
      />

      {(creating || editing) && (
        <LeaveTypeWindow
          record={creating ? null : editing}
          departments={departments}
          designations={designations}
          onClose={() => {
            setEditing(null);
            onCloseCreate();
          }}
          onSaved={(text) => {
            setEditing(null);
            onCloseCreate();
            onDone(text);
          }}
        />
      )}
      <Confirm
        open={confirm === "toggle"}
        title={active?.isActive ? `Switch off ${active?.name}?` : `Switch on ${active?.name}?`}
        message={active?.isActive ? "It can't be chosen for new requests and gets no new credits. Balances, requests and history stay." : "It can be chosen for new requests again."}
        confirmLabel={active?.isActive ? "Switch off" : "Switch on"}
        onConfirm={() => run("toggle")}
        onCancel={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === "delete"}
        title={`Delete ${active?.name}?`}
        message="Only a leave type that was never used can be deleted. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => run("delete")}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}

/** The selected type: what it is in words, its settings, and its history. */
function TypePane({ type, history, departments, designations, canEdit, onEdit }: { type: LeaveTypeRecord; history: CompanyTypeChange[]; departments: Named; designations: Named; canEdit: boolean; onEdit: () => void }) {
  const dateText = useDateText();
  const f = formOfRecord(type);
  const names = (ids: string[], list: Named) =>
    ids
      .map((id) => list.find((x) => x.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  const settings: [string, string][] = [
    ["Pay", PAY_LABEL[type.leaveType] ?? type.leaveType],
    ["Days", givenText(type)],
    ...(type.kind === "balance" ? ([["Year end", yearEnd(type)]] as [string, string][]) : []),
    ...(type.kind === "balance" && type.isEncashable
      ? ([["Payout rate", type.encashmentBasis === "Fixed" && type.payoutFixedAmount ? `Rs ${type.payoutFixedAmount.toLocaleString("en-IN")} a day, never less than basic` : "Basic salary per day"]] as [string, string][])
      : []),
    ["Days counted", `${type.dayBasis === "calendar" ? "Calendar days" : "Working days"}${type.allowHalfDay ? ", half days allowed" : ", no half days"}`],
    ["Rules", rulesText(type)],
    ["Departments", names(type.applicableDepartments, departments) || "All"],
    ["Designations", names(type.applicableDesignations, designations) || "All"],
    ["Who", WHO_LABEL[type.genderApplicable] ?? type.genderApplicable],
  ];
  return (
    <div className="space-y-3 text-xs">
      <section aria-label="What it is" className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <p className="text-ink">{describeLeaveType(f)}</p>
        <dl className="mt-2 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-2xs">
          {settings.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {canEdit && (
          <WindowButton className="mt-2" variant="primary" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit…
          </WindowButton>
        )}
      </section>
      <section aria-label="History" className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">History</h3>
        {history.length === 0 ? (
          <p className="text-2xs text-ink-muted">No changes recorded yet.</p>
        ) : (
          <ol className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <ul className="space-y-0.5 text-ink">
                  {h.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                <p className="text-2xs text-ink-muted">
                  {h.note !== "Added" && h.note !== "Changed" ? `“${h.note}” · ` : ""}
                  {h.by} · {dateText(h.at.slice(0, 10))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Departments or designations to choose from; none chosen = everyone. */
function ChooseList({ label, options, value, onChange }: { label: string; options: Named; value: string[]; onChange: (v: string[]) => void }) {
  if (!options.length) return <p className="pt-1.5 text-2xs text-ink-faint">None set up</p>;
  return (
    <div role="group" aria-label={label} className="max-h-28 overflow-auto rounded-md border border-line-input bg-surface px-2 py-1">
      {options.map((o) => (
        <label key={o.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-ink">
          <input type="checkbox" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
          {o.name}
        </label>
      ))}
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return <h3 className="border-t border-line px-4 pt-3 text-2xs font-semibold uppercase tracking-wide text-ink-muted first:border-0">{children}</h3>;
}

/** New / Edit a company leave type: every rule the leave engine uses, with what it means in one sentence. */
function LeaveTypeWindow({ record, departments, designations, onClose, onSaved }: { record: LeaveTypeRecord | null; departments: Named; designations: Named; onClose: () => void; onSaved: (text: string) => void }) {
  const [start] = useState<LeaveTypeFormData>(() => (record ? formOfRecord(record) : blank));
  const [form, setForm] = useState(start);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thisYear, setThisYear] = useState(false);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ThisYearPreview | null | "loading">(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof LeaveTypeFormData>(k: K, v: LeaveTypeFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((e) => (k in e ? Object.fromEntries(Object.entries(e).filter(([key]) => key !== k)) : e));
  };
  const clean = useMemo(() => normalizeLeaveTypeForm(form), [form]);
  const live = useMemo(() => validateLeaveTypeForm(clean), [clean]);
  // Errors show once Save was pressed, and go as each field is put right.
  const shown = (tried ? { ...serverErrors, ...live } : {}) as Record<string, string>;
  // "Also this year": balance types given at the year start whose days are new or changed.
  const canThisYear = clean.kind === "balance" && clean.creditMode === "yearly" && clean.isActive && clean.noOfDays > 0 && (!record || start.kind !== "balance" || start.creditMode !== "yearly" || start.noOfDays !== clean.noOfDays);
  const previewKey = thisYear && canThisYear ? JSON.stringify([clean.noOfDays, clean.proRataForNewJoinees, clean.genderApplicable, clean.applicableDepartments, clean.applicableDesignations]) : "";

  useEffect(() => {
    if (!previewKey) return;
    let gone = false;
    const timer = setTimeout(async () => {
      setPreview("loading");
      const r = await previewLeaveTypeThisYearAction(record?.id ?? null, clean);
      if (!gone) setPreview(r.success ? r.data : null);
    }, 300);
    return () => {
      gone = true;
      clearTimeout(timer);
    };
    // The preview follows the fields that change it (previewKey), not every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const save = async () => {
    setTried(true);
    if (Object.keys(live).length) {
      setFailure("Check the highlighted fields.");
      return;
    }
    setSaving(true);
    setFailure(null);
    const r = await saveLeaveTypeAction(record?.id ?? null, clean, {
      thisYear: thisYear && canThisYear,
      note,
      version: record ? new Date(record.updatedAt).toISOString() : undefined,
    });
    setSaving(false);
    if (!r.success) {
      setServerErrors(("validationErrors" in r && r.validationErrors) || {});
      setFailure(r.error);
      return;
    }
    const credited = thisYear && canThisYear && preview && preview !== "loading" && preview.people ? ` This year's balances of ${preview.people} ${preview.people === 1 ? "person were" : "people were"} updated.` : "";
    onSaved((record ? `${clean.name} is saved.` : `${clean.name} is added. It can be chosen for leave requests now.`) + credited);
  };

  const kind = form.kind;
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start) || thisYear || note !== ""}
      size="lg"
      title={record ? `Edit leave type: ${record.name}` : "New leave type"}
      description="A leave type of your own. The law sets no minimum for it; changes apply when saved and are kept in its history."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <Heading>The leave</Heading>
        <FormGrid columns={2}>
          <GridField label="Name" required error={shown.name} size="lg">
            <input name="name" value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Study leave" className={inputClass} />
          </GridField>
          <GridField label="Code" required error={shown.code} size="md" help="Capital letters and _ only" suffix="A–Z and _">
            <input name="code" value={form.code} maxLength={40} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z_]/g, ""))} placeholder="STUDY" className={`${inputClass} font-code`} />
          </GridField>
          <GridField label="Pay" required error={shown.leaveType} size="md">
            <SelectField
              name="leaveType"
              options={[
                { value: "Pay", label: "Paid" },
                { value: "Partial-Pay", label: "Half paid" },
                { value: "Non-Pay", label: "Unpaid" },
              ]}
              value={form.leaveType}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  leaveType: v as LeaveTypeFormData["leaveType"],
                  kind: v === "Non-Pay" && f.kind === "balance" ? "none" : f.kind,
                }))
              }
            />
          </GridField>
          <GridField label="Days are" required error={shown.kind} size="lg" help="A balance: days a year to take from. Each time: a set number of days per occasion (e.g. a wedding). No balance: taken as needed, within any limits.">
            <SelectField
              name="kind"
              options={[
                { value: "balance", label: "A balance (days a year)" },
                {
                  value: "event",
                  label: "Given each time (days per occasion)",
                },
                { value: "none", label: "No balance (taken as needed)" },
              ]}
              value={form.kind}
              onChange={(v) => set("kind", v as LeaveTypeFormData["kind"])}
            />
          </GridField>
          {kind !== "none" && (
            <GridField label={kind === "event" ? "Days each time" : "Days a year"} required error={shown.noOfDays} size="code" suffix="days">
              <NumberField name="noOfDays" value={form.noOfDays} onChange={(v) => set("noOfDays", v)} decimals={1} max={365} selectOnFocus showZero aria-label={kind === "event" ? "Days each time" : "Days a year"} />
            </GridField>
          )}
          {kind === "event" && (
            <GridField label="Paid days each time" error={shown.paidDaysPerEvent} size="code" help="The first N days are paid, the rest unpaid. 0: all days as the pay says." suffix="0 = all">
              <NumberField name="paidDaysPerEvent" value={form.paidDaysPerEvent ?? 0} onChange={(v) => set("paidDaysPerEvent", v || null)} decimals={1} max={365} selectOnFocus aria-label="Paid days each time" />
            </GridField>
          )}
          {kind === "balance" && (
            <>
              <GridField label="Given" error={shown.creditMode} size="lg" help="Month by month: days a year ÷ 12, added as each attendance month is closed (like home leave).">
                <SelectField
                  name="creditMode"
                  options={[
                    {
                      value: "yearly",
                      label: "At the start of the leave year",
                    },
                    {
                      value: "monthly",
                      label: "Month by month (at each month close)",
                    },
                  ]}
                  value={form.creditMode}
                  onChange={(v) => set("creditMode", v as LeaveTypeFormData["creditMode"])}
                />
              </GridField>
              {form.creditMode === "yearly" && (
                <GridField label="Joiners get" size="lg">
                  <SelectField
                    name="proRata"
                    options={[
                      {
                        value: "share",
                        label: "A share, from the joining date",
                      },
                      { value: "whole", label: "The whole year's days" },
                    ]}
                    value={form.proRataForNewJoinees ? "share" : "whole"}
                    onChange={(v) => set("proRataForNewJoinees", v === "share")}
                  />
                </GridField>
              )}
            </>
          )}
          <GridField label="In use" size="md" help="Off: can't be chosen for new requests and gets no new credits" suffix="Off: not for new requests">
            <YesNoField name="isActive" value={form.isActive} onChange={(v) => set("isActive", v)} yesLabel="On" noLabel="Off" aria-label="In use" />
          </GridField>
        </FormGrid>
        {record && start.creditMode !== form.creditMode && <p className="px-4 pb-2 text-2xs text-ink-muted">People already given this year&apos;s days keep them; the new way applies to them from the next leave year.</p>}

        <Heading>Counting and limits</Heading>
        <FormGrid columns={2}>
          <GridField label="Days counted" size="md" help="Working days skip weekly offs and holidays inside the leave.">
            <SelectField
              name="dayBasis"
              options={[
                { value: "working", label: "Working days" },
                { value: "calendar", label: "Calendar days" },
              ]}
              value={form.dayBasis}
              onChange={(v) => set("dayBasis", v as LeaveTypeFormData["dayBasis"])}
            />
          </GridField>
          <GridField label="Half days allowed" size="md">
            <YesNoField name="allowHalfDay" value={form.allowHalfDay} onChange={(v) => set("allowHalfDay", v)} aria-label="Half days allowed" />
          </GridField>
          {kind !== "event" && (
            <GridField label="Most days a request" error={shown.maxDaysPerRequest} size="code" suffix="0 = no limit">
              <NumberField name="maxDaysPerRequest" value={form.maxDaysPerRequest ?? 0} onChange={(v) => set("maxDaysPerRequest", v || null)} decimals={1} max={365} selectOnFocus aria-label="Most days a request" />
            </GridField>
          )}
          {kind !== "balance" && (
            <>
              <GridField label="Most days a year" error={shown.maxDaysPerYear} size="code" help="Taken and waiting days in one leave year" suffix="0 = no limit">
                <NumberField name="maxDaysPerYear" value={form.maxDaysPerYear ?? 0} onChange={(v) => set("maxDaysPerYear", v || null)} decimals={1} max={365} selectOnFocus aria-label="Most days a year" />
              </GridField>
              <GridField label="Most days in all" error={shown.maxDaysInService} size="code" help="Over the person's whole service" suffix="0 = no limit">
                <NumberField name="maxDaysInService" value={form.maxDaysInService ?? 0} onChange={(v) => set("maxDaysInService", v || null)} decimals={1} max={3650} selectOnFocus aria-label="Most days over the whole service" />
              </GridField>
            </>
          )}
        </FormGrid>

        {kind === "balance" && (
          <>
            <Heading>Year end</Heading>
            <FormGrid columns={2}>
              <GridField label="Carried over" size="md">
                <YesNoField name="carryForward" value={form.carryForward} onChange={(v) => set("carryForward", v)} aria-label="Carried over to the next leave year" />
              </GridField>
              {form.carryForward && (
                <GridField label="Can be saved up to" error={shown.accumulationCap} size="code" suffix="0 = no limit">
                  <NumberField name="accumulationCap" value={form.accumulationCap ?? 0} onChange={(v) => set("accumulationCap", v || null)} decimals={1} max={999} selectOnFocus aria-label="Can be saved up to" />
                </GridField>
              )}
              {(!form.carryForward || form.accumulationCap) && (
                <GridField label={form.carryForward ? "Days over the limit" : "Days left"} size="md">
                  <SelectField
                    name="isEncashable"
                    options={[
                      { value: "lapse", label: "Lapse" },
                      { value: "pay", label: "Are paid out" },
                    ]}
                    value={form.isEncashable ? "pay" : "lapse"}
                    onChange={(v) => set("isEncashable", v === "pay")}
                  />
                </GridField>
              )}
              {form.isEncashable && (!form.carryForward || form.accumulationCap) && (
                <>
                  <GridField label="Payout rate" error={shown.encashmentBasis} size="md">
                    <SelectField
                      name="encashmentBasis"
                      options={[
                        {
                          value: "BasicSalary",
                          label: "Basic salary per day",
                        },
                        { value: "Fixed", label: "A fixed amount per day" },
                      ]}
                      value={form.encashmentBasis}
                      onChange={(v) => set("encashmentBasis", v as LeaveTypeFormData["encashmentBasis"])}
                    />
                  </GridField>
                  {form.encashmentBasis === "Fixed" && (
                    <GridField label="Amount per day" required error={shown.payoutFixedAmount} size="amount" help="Never paid below the person's basic salary per day" suffix="never below basic">
                      <NumberField name="payoutFixedAmount" value={form.payoutFixedAmount ?? 0} onChange={(v) => set("payoutFixedAmount", v || null)} decimals={2} max={10_000_000} selectOnFocus prefix="Rs" aria-label="Amount per day" />
                    </GridField>
                  )}
                </>
              )}
            </FormGrid>
          </>
        )}

        <Heading>Rules</Heading>
        <FormGrid columns={2}>
          <GridField label="Notice" error={shown.noticeDays} size="code" help="Employees ask at least this many days before the first day; HR can still enter it, with a note." suffix="days before · 0 = none">
            <NumberField name="noticeDays" value={form.noticeDays ?? 0} onChange={(v) => set("noticeDays", v || null)} decimals={0} max={365} selectOnFocus aria-label="Notice in days" />
          </GridField>
          <GridField label="After service of" error={shown.eligibleAfterDays} size="code" help="Can be taken only after this many days from joining, e.g. 180 for a six-month probation." suffix="days · 0 = from joining">
            <NumberField name="eligibleAfterDays" value={form.eligibleAfterDays ?? 0} onChange={(v) => set("eligibleAfterDays", v || null)} decimals={0} max={3650} selectOnFocus aria-label="After days of service" />
          </GridField>
          <GridField label="Ask for a certificate" size="md">
            <YesNoField
              name="requiresDocument"
              value={form.requiresDocument}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  requiresDocument: v,
                  documentThresholdDays: v ? (f.documentThresholdDays ?? 3) : null,
                }))
              }
              aria-label="Ask for a certificate"
            />
          </GridField>
          {form.requiresDocument && (
            <GridField label="After … days in a row" error={shown.documentThresholdDays} size="code">
              <NumberField name="documentThresholdDays" value={form.documentThresholdDays ?? 0} onChange={(v) => set("documentThresholdDays", v)} decimals={0} max={365} selectOnFocus aria-label="Certificate after days in a row" />
            </GridField>
          )}
        </FormGrid>

        <Heading>Who can take it</Heading>
        <FormGrid columns={2}>
          <GridField label="Gender" size="md">
            <SelectField
              name="genderApplicable"
              options={[
                { value: "All", label: "Everyone" },
                { value: "Female", label: "Women only" },
                { value: "Male", label: "Men only" },
              ]}
              value={form.genderApplicable}
              onChange={(v) => set("genderApplicable", v as LeaveTypeFormData["genderApplicable"])}
            />
          </GridField>
          <div className="hidden @min-[50rem]:block" />
          <GridField label="Departments" error={shown.applicableDepartments} size="lg" suffix={form.applicableDepartments.length ? undefined : "none ticked = all"}>
            <ChooseList label="Departments" options={departments} value={form.applicableDepartments} onChange={(v) => set("applicableDepartments", v)} />
          </GridField>
          <GridField label="Designations" error={shown.applicableDesignations} size="lg" suffix={form.applicableDesignations.length ? undefined : "none ticked = all"}>
            <ChooseList label="Designations" options={designations} value={form.applicableDesignations} onChange={(v) => set("applicableDesignations", v)} />
          </GridField>
        </FormGrid>

        <div className="space-y-2 border-t border-line px-4 py-3">
          <p className="text-xs text-ink">
            {describeLeaveType(clean, {
              departments: clean.applicableDepartments.length,
              designations: clean.applicableDesignations.length,
            })}
          </p>
          {canThisYear && (
            <div className="rounded-md border border-line bg-surface px-3 py-2">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-ink">
                <input type="checkbox" className="mt-0.5" checked={thisYear} onChange={(e) => setThisYear(e.target.checked)} />
                <span>
                  <span className="font-medium">{record ? "Also change this year's balances" : "Give this year's days now"}</span>
                  <span className="block text-2xs text-ink-muted">
                    {record ? `Otherwise the new days a year apply from the next leave year (and to people who join from now).` : "Otherwise everyone gets them when the next leave year is opened (people who join from now get them at once)."}
                  </span>
                </span>
              </label>
              {thisYear && (
                <p className="mt-1.5 text-2xs text-ink-muted" aria-live="polite">
                  {preview === "loading"
                    ? "Working out who is affected…"
                    : !preview
                      ? "There is no open leave year to change."
                      : preview.people === 0
                        ? `Nobody's ${preview.yearLabel} balance changes.`
                        : `${preview.yearLabel}: ${preview.people} ${preview.people === 1 ? "person" : "people"}${preview.added ? `, ${fmt(preview.added)} days added` : ""}${preview.taken ? `, ${fmt(preview.taken)} days taken back (never below what is left)` : ""}. For example ${preview.examples.map((e) => `${e.name} ${e.days > 0 ? "+" : ""}${fmt(e.days)}`).join(", ")}.`}
                </p>
              )}
            </div>
          )}
          <FormGrid columns={2} className="px-0 py-0">
            <GridField label="Why (optional)" size="full" span={3} help="Kept in this leave type's history">
              <input name="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Board decision 12/2083" className={inputClass} />
            </GridField>
          </FormGrid>
        </div>
      </PropertyForm>
    </Window>
  );
}
