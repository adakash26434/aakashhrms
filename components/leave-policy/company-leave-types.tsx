"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Power, Save, Trash2 } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { deleteLeaveTypeAction, saveLeaveTypeAction, toggleLeaveTypeStatusAction } from "@/app/actions/leave-type.actions";
import { fmt } from "@/lib/engines/leave.engine";
import type { LeaveTypeFormData, LeaveTypeRecord } from "@/lib/types/leave-type";

const PAY_LABEL: Record<string, string> = { Pay: "Paid", "Non-Pay": "Unpaid", "Partial-Pay": "Half paid" };
const WHO_LABEL: Record<string, string> = { All: "Everyone", Female: "Women", Male: "Men" };

/** What happens at the year end, in words. */
function yearEnd(t: Pick<LeaveTypeRecord, "noOfDays" | "carryForward" | "accumulationCap" | "isEncashable">): string {
  if (!t.noOfDays) return "No balance";
  if (t.carryForward) return `Carried over up to ${t.accumulationCap ? fmt(t.accumulationCap) : "any number of"} days${t.isEncashable ? ", the rest paid out" : ", the rest lapses"}`;
  return t.isEncashable ? "Paid out at the year end" : "Lapses at the year end";
}

/** The whole type in one sentence ("Study leave: 10 paid days a year, carried over up to 20 days, the rest lapses"). */
function sentence(f: LeaveTypeFormData): string {
  const name = f.name.trim() || "This leave";
  const days = f.noOfDays ? `${fmt(f.noOfDays)} ${PAY_LABEL[f.leaveType].toLowerCase()} day${f.noOfDays === 1 ? "" : "s"} a year${f.proRataForNewJoinees ? " (a share for joiners)" : ""}` : `${PAY_LABEL[f.leaveType].toLowerCase()}, no balance`;
  const end = f.noOfDays ? `, ${yearEnd(f).charAt(0).toLowerCase()}${yearEnd(f).slice(1)}` : "";
  const cert = f.requiresDocument && f.documentThresholdDays ? `, a certificate after ${fmt(f.documentThresholdDays)} days in a row` : "";
  const who = f.genderApplicable !== "All" ? `, for ${WHO_LABEL[f.genderApplicable].toLowerCase()} only` : "";
  return `${name}: ${days}${end}${cert}${who}.`;
}

const blank: LeaveTypeFormData = {
  name: "",
  code: "",
  leaveType: "Pay",
  noOfDays: 0,
  carryForward: false,
  accumulationCap: null,
  maxPaidDays: null,
  isStatutory: false,
  statutoryCode: null,
  genderApplicable: "All",
  requiresDocument: false,
  documentThresholdDays: null,
  isEncashable: false,
  encashmentBasis: "BasicSalary",
  proRataForNewJoinees: true,
  applicableDepartments: [],
  applicableDesignations: [],
  isActive: true,
};

const formOf = (t: LeaveTypeRecord): LeaveTypeFormData => ({
  name: t.name,
  code: t.code,
  leaveType: t.leaveType,
  noOfDays: t.noOfDays,
  carryForward: t.carryForward,
  accumulationCap: t.accumulationCap,
  maxPaidDays: t.maxPaidDays,
  isStatutory: false,
  statutoryCode: null,
  genderApplicable: t.genderApplicable,
  requiresDocument: t.requiresDocument,
  documentThresholdDays: t.documentThresholdDays,
  isEncashable: t.isEncashable,
  encashmentBasis: t.encashmentBasis || "BasicSalary",
  proRataForNewJoinees: t.proRataForNewJoinees,
  applicableDepartments: t.applicableDepartments,
  applicableDesignations: t.applicableDesignations,
  isActive: t.isActive,
});

export interface CompanyTypePermissions {
  add: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * The company's own leave types (Unpaid, study, special…): the law sets no
 * minimum, so changes apply on save and are audited. A type that has been
 * used is switched off, never deleted.
 */
export function CompanyLeaveTypes({
  types,
  permissions,
  creating,
  onCloseCreate,
  onDone,
}: {
  types: LeaveTypeRecord[];
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
        width: 180,
        sticky: true,
        value: (t) => t.name,
        cell: (t) => (
          <span className="font-medium text-ink">
            {t.name} <span className="font-code text-3xs font-normal text-ink-faint">{t.code}</span>
          </span>
        ),
      },
      { id: "pay", header: "Pay", width: 100, value: (t) => PAY_LABEL[t.leaveType] ?? t.leaveType },
      { id: "days", header: "Days a year", type: "number", width: 120, value: (t) => t.noOfDays, cell: (t) => (t.noOfDays ? fmt(t.noOfDays) : <span className="text-ink-faint">—</span>) },
      { id: "end", header: "Year end", width: 250, value: (t) => yearEnd(t) },
      { id: "certificate", header: "Certificate", width: 120, value: (t) => (t.requiresDocument && t.documentThresholdDays ? `after ${fmt(t.documentThresholdDays)} days` : "—") },
      { id: "who", header: "Who", width: 90, value: (t) => WHO_LABEL[t.genderApplicable] ?? t.genderApplicable },
      { id: "status", header: "Status", width: 90, value: (t) => (t.isActive ? "Active" : "Off"), cell: (t) => <StatusChip status={t.isActive ? "active" : "inactive"} label={t.isActive ? "Active" : "Off"} /> },
    ],
    []
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
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-ink">Company leave types</h2>
          <p className="text-2xs text-ink-muted">Your own leave, e.g. Unpaid leave. The law sets no minimum for these; changes apply when saved.</p>
        </div>
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
      {message && (
        <Notice tone="danger" className="mb-2" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      )}
      <DataGrid
        id="company-leave-types"
        label="Company leave types"
        columns={columns}
        rows={rows}
        getRowId={(t) => t.id}
        activeRowId={activeId}
        onActiveRowChange={(t) => setActiveId(t.id)}
        onOpen={(t) => permissions.edit && setEditing(t)}
        defaultSort={{ columnId: "name", direction: "asc" }}
        pageSize={25}
        empty={{ title: "No company leave types", description: "Add your own leave, such as study or special leave, with New leave type." }}
      />

      {(creating || editing) && (
        <LeaveTypeWindow
          record={editing}
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
        message={active?.isActive ? "It can't be chosen for new requests. Balances, requests and history stay." : "It can be chosen for new requests again."}
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

/** New / Edit a company leave type: the fields the rules use today, with what it means in one sentence. */
function LeaveTypeWindow({ record, onClose, onSaved }: { record: LeaveTypeRecord | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [start] = useState<LeaveTypeFormData>(() => (record ? formOf(record) : blank));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof LeaveTypeFormData>(k: K, v: LeaveTypeFormData[K]) => setForm((f) => ({ ...f, [k]: v }));
  const hasBalance = form.noOfDays > 0;

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const payload: LeaveTypeFormData = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      carryForward: hasBalance && form.carryForward,
      accumulationCap: hasBalance && form.carryForward ? form.accumulationCap : null,
      isEncashable: hasBalance && form.isEncashable,
      documentThresholdDays: form.requiresDocument ? form.documentThresholdDays : null,
    };
    const r = await saveLeaveTypeAction(record?.id ?? null, payload);
    setSaving(false);
    if (!r.success) {
      setErrors(("validationErrors" in r && r.validationErrors) || {});
      setFailure(r.error);
      return;
    }
    onSaved(record ? `${payload.name} is saved.` : `${payload.name} is added. It can be chosen for leave requests now.`);
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title={record ? `Edit leave type: ${record.name}` : "New leave type"}
      description="A leave type of your own. The law sets no minimum for it; changes apply when saved and are recorded."
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
        <FormGrid columns={2}>
          <GridField label="Name" required error={errors.name} size="lg">
            <input name="name" value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Study leave" className={inputClass} />
          </GridField>
          <GridField label="Code" required error={errors.code} size="md" help="Capital letters and _ only" suffix="A–Z and _">
            <input name="code" value={form.code} maxLength={40} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z_]/g, ""))} placeholder="STUDY" className={`${inputClass} font-code`} />
          </GridField>
          <GridField label="Pay" required error={errors.leaveType} size="md">
            <SelectField
              name="leaveType"
              options={[
                { value: "Pay", label: "Paid" },
                { value: "Partial-Pay", label: "Half paid" },
                { value: "Non-Pay", label: "Unpaid" },
              ]}
              value={form.leaveType}
              onChange={(v) => set("leaveType", v as LeaveTypeFormData["leaveType"])}
            />
          </GridField>
          <GridField label="Days a year" error={errors.noOfDays} size="code" help="0 = no balance (unpaid leave)" suffix="0 = no balance">
            <NumberField name="noOfDays" value={form.noOfDays} onChange={(v) => set("noOfDays", v)} decimals={1} max={365} selectOnFocus showZero aria-label="Days a year" />
          </GridField>
          {hasBalance && (
            <>
              <GridField label="A share for joiners" size="md" help="Pro-rata from the joining date" suffix="pro-rata from joining">
                <YesNoField name="proRata" value={form.proRataForNewJoinees} onChange={(v) => set("proRataForNewJoinees", v)} aria-label="A share for joiners" />
              </GridField>
              <GridField label="Carried over" size="md">
                <YesNoField name="carryForward" value={form.carryForward} onChange={(v) => set("carryForward", v)} aria-label="Carried over to the next leave year" />
              </GridField>
              {form.carryForward && (
                <GridField label="Can be saved up to (days)" error={errors.accumulationCap} size="code" help="0: no limit" suffix="0 = no limit">
                  <NumberField name="accumulationCap" value={form.accumulationCap ?? 0} onChange={(v) => set("accumulationCap", v || null)} decimals={1} max={999} selectOnFocus aria-label="Can be saved up to" />
                </GridField>
              )}
              <GridField label={form.carryForward ? "Days over the limit" : "Days left at the year end"} size="lg">
                <SelectField
                  name="isEncashable"
                  options={[
                    { value: "lapse", label: "Lapse" },
                    { value: "pay", label: "Are paid out at basic salary" },
                  ]}
                  value={form.isEncashable ? "pay" : "lapse"}
                  onChange={(v) => set("isEncashable", v === "pay")}
                />
              </GridField>
            </>
          )}
          <GridField label="Ask for a certificate" size="md">
            <YesNoField name="requiresDocument" value={form.requiresDocument} onChange={(v) => setForm((f) => ({ ...f, requiresDocument: v, documentThresholdDays: v ? f.documentThresholdDays ?? 3 : null }))} aria-label="Ask for a certificate" />
          </GridField>
          {form.requiresDocument && (
            <GridField label="After … days in a row" error={errors.documentThresholdDays} size="code">
              <NumberField name="documentThresholdDays" value={form.documentThresholdDays ?? 0} onChange={(v) => set("documentThresholdDays", v)} decimals={0} max={365} selectOnFocus aria-label="Certificate after days in a row" />
            </GridField>
          )}
          <GridField label="Who can take it" size="md">
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
          <GridField label="Active" size="md" help="Off: can't be chosen for new requests" suffix="Off: not for new requests">
            <YesNoField name="isActive" value={form.isActive} onChange={(v) => set("isActive", v)} yesLabel="On" noLabel="Off" aria-label="Active" />
          </GridField>
        </FormGrid>
        <p className="border-t border-line px-4 py-3 text-xs text-ink">{sentence(form)}</p>
      </PropertyForm>
    </Window>
  );
}
