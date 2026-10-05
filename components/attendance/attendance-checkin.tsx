"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, LocateFixed, Pencil, Plus, Save, Wifi } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, FormGroup, GridField, GridValue } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { saveAttendanceRulesAction } from "@/app/actions/attendance.actions";
import { addCheckinExceptionAction, removeCheckinExceptionAction, saveBranchCheckinAction } from "@/app/actions/checkin.actions";
import { CHECKIN_RULES, CHECKIN_RULE_LABEL, DEFAULT_RADIUS_M, parseNetwork, type CheckinRule } from "@/lib/engines/checkin.engine";
import type { AttendancePageData, BranchCheckin, CheckinException } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

const RULE_HELP: Record<CheckinRule, string> = {
  off: "Nobody in the branch clocks in from the browser.",
  anywhere: "From any place, no check (only for fully remote teams).",
  network: "Only on the office internet connection (best for desk staff).",
  location: "Only within the radius of the office (phones; desktops are often too rough).",
  network_or_location: "On the office network, or within the radius (desk staff and phones).",
  network_and_location: "On the office network and within the radius (strictest).",
};

/**
 * Web clock-in (4.5c): the company switch, each branch's rule (office
 * network, location, either, both, anywhere or off) and the people who may
 * clock in from anywhere without approval. Outside the allowed place a
 * clock-in goes to the employee's approver. Company-wide roles change these.
 */
export function AttendanceCheckin({ data, onSaved }: { data: AttendancePageData; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const can = data.permissions.settings;
  const settings = data.checkin;
  const [editing, setEditing] = useState<BranchCheckin | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CheckinException | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const columns = useMemo<GridColumn<BranchCheckin>[]>(
    () => [
      { id: "branch", header: "Branch", width: 180, value: (b) => b.branchName, cell: (b) => <span className="font-medium text-ink">{b.branchName}</span> },
      { id: "rule", header: "Rule", width: 230, value: (b) => CHECKIN_RULE_LABEL[b.rule], cell: (b) => <span className={b.rule === "off" ? "text-ink-faint" : "text-ink"}>{CHECKIN_RULE_LABEL[b.rule]}</span> },
      { id: "networks", header: "Office network", width: 220, value: (b) => b.networks.join(", "), cell: (b) => <span className="truncate font-mono text-2xs text-ink-muted">{b.networks.join(", ") || "—"}</span> },
      { id: "location", header: "Office location", width: 220, value: (b) => (b.latitude !== null ? `${b.latitude}, ${b.longitude}` : ""), cell: (b) => <span className="text-2xs text-ink-muted">{b.latitude !== null ? `${b.latitude}, ${b.longitude} · ${b.radiusM} m` : "—"}</span> },
      { id: "people", header: "People", type: "number", width: 100, value: (b) => b.people },
    ],
    []
  );

  if (!settings) return null;

  const toggle = async (enabled: boolean) => {
    setSwitching(true);
    const res = await saveAttendanceRulesAction({ noRecord: data.rules.noRecord, lateEnabled: data.rules.lateRule.enabled, lateCount: data.rules.lateRule.count, webCheckIn: enabled });
    setSwitching(false);
    if (!res.success) {
      setMessage(res.error);
      return;
    }
    onSaved(enabled ? "Web clock-in is on. Each branch follows its rule; branches set to Off stay off." : "Web clock-in is off for the company.");
  };

  return (
    <div className="space-y-3 p-3 @container">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-panel px-3 py-2.5 text-xs">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Web clock-in</p>
          <p className="mt-0.5 text-ink-muted">
            Employees clock in and out from Self-service (and staff from the top bar). Outside the allowed place a clock-in goes to their supervisor for approval. Location is read only at the moment of clocking.
          </p>
        </div>
        <span className="flex items-center gap-2">
          <YesNoField name="webCheckIn" aria-label="Web clock-in for the company" value={data.rules.webCheckIn.enabled} onChange={toggle} yesLabel="On" noLabel="Off" disabled={!can || switching} />
        </span>
      </div>
      {message && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      <DataGrid
        id="attendance-checkin"
        label="Web clock-in by branch"
        columns={columns}
        rows={settings.branches}
        getRowId={(b) => b.branchId}
        onOpen={can ? (b) => setEditing(b) : undefined}
        toolbar={
          can ? (
            <span className="text-2xs text-ink-muted">
              <Pencil className="mr-1 inline h-3 w-3" />
              Double-click a branch to set its rule
            </span>
          ) : undefined
        }
        rowTone={(b) => (data.rules.webCheckIn.enabled && b.rule !== "off" ? "success" : undefined)}
        empty={{ title: "No branches", description: "Add branches in Workforce → Organization." }}
      />

      <section aria-label="Allowed to clock in from anywhere" className="rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Allowed to clock in from anywhere</h3>
            <p className="text-2xs text-ink-muted">Field staff, or a client visit until a date: their clock-ins count without approval.</p>
          </div>
          {can && (
            <WindowButton onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> Add person
            </WindowButton>
          )}
        </header>
        {settings.exceptions.length ? (
          <ul className="divide-y divide-line text-xs">
            {settings.exceptions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                <span className="w-24 font-mono text-2xs text-ink-muted">{e.employeeCode}</span>
                <span className="min-w-40 flex-1 font-medium text-ink">{e.employeeName}</span>
                <span className="text-ink-muted">
                  {dateText(e.from)} – {e.to ? dateText(e.to) : "ongoing"}
                </span>
                <span className="min-w-40 flex-1 text-ink-muted">{e.reason}</span>
                {can && (
                  <button type="button" onClick={() => setRemoving(e)} className="cursor-pointer text-2xs font-medium text-danger hover:underline">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-xs text-ink-muted">Nobody yet.</p>
        )}
      </section>

      {editing && <BranchWindow branch={editing} myIp={settings.myIp} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); onSaved(t); }} />}
      {adding && <ExceptionWindow data={data} onClose={() => setAdding(false)} onSaved={(t) => { setAdding(false); onSaved(t); }} />}
      <Confirm
        open={!!removing}
        title={`Remove ${removing?.employeeName ?? ""}?`}
        message="Their clock-ins outside the allowed place will go for approval again. Entries already made stay."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          const res = await removeCheckinExceptionAction(removing.id);
          setRemoving(null);
          if (!res.success) setMessage(res.error);
          else onSaved(`${removing.employeeName} no longer clocks in from anywhere.`);
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

/** A branch's rule, office networks and office location. */
function BranchWindow({ branch, myIp, onClose, onSaved }: { branch: BranchCheckin; myIp: string; onClose: () => void; onSaved: (t: string) => void }) {
  const [start] = useState(() => ({
    rule: branch.rule,
    networks: branch.networks.join("\n"),
    latitude: branch.latitude === null ? "" : String(branch.latitude),
    longitude: branch.longitude === null ? "" : String(branch.longitude),
    radiusM: branch.radiusM || DEFAULT_RADIUS_M,
  }));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState<string | null>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const usesNetwork = form.rule === "network" || form.rule === "network_or_location" || form.rule === "network_and_location";
  const usesLocation = form.rule === "location" || form.rule === "network_or_location" || form.rule === "network_and_location";
  const lines = form.networks.split(/[\n,]/).map((l) => l.trim()).filter(Boolean);
  const badLine = lines.find((l) => !parseNetwork(l));
  const ipKnown = myIp && myIp !== "unknown";

  const save = async () => {
    setSaving(true);
    const res = await saveBranchCheckinAction({ branchId: branch.branchId, rule: form.rule, networks: lines, latitude: form.latitude, longitude: form.longitude, radiusM: form.radiusM });
    setSaving(false);
    if (!res.success) {
      setErrors(res.validationErrors ?? {});
      setFailure(res.error);
      return;
    }
    onSaved(`${branch.branchName}: ${CHECKIN_RULE_LABEL[form.rule]}.`);
  };

  const here = () => {
    if (!navigator.geolocation) {
      setLocating("This browser can't share its location.");
      return;
    }
    setLocating("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }));
        setLocating(`Set from your location (±${Math.round(p.coords.accuracy)} m). Stand inside the office for the best result.`);
      },
      () => setLocating("Location was not shared. Allow it in the browser, or type the coordinates."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title={`Web clock-in: ${branch.branchName}`}
      description={`${branch.people} people. Outside the allowed place, a clock-in goes to the employee's approver.`}
      footer={
        <>
          {failure && <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">{failure}</p>}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-3 bg-surface-panel p-3">
        <FormGroup index={1} title="Rule" description={RULE_HELP[form.rule]} columns={2}>
          <GridField label="Clock in from" required error={errors.rule} span={2} size="lg">
            <SelectField data-autofocus name="rule" options={CHECKIN_RULES.map((r) => ({ value: r, label: CHECKIN_RULE_LABEL[r] }))} value={form.rule} onChange={(v) => set("rule", v as CheckinRule)} />
          </GridField>
        </FormGroup>
        <FormGroup index={2} title="Office network" description="The office's public internet address, or a range. One per line." columns={2}>
          <GridField label="Addresses" error={errors.networks ?? (badLine ? `"${badLine}" is not an address or range` : undefined)} span={2} size="full" help="e.g. 103.10.28.5 or 103.10.28.0/24 (IPv6 works too)">
            <textarea name="networks" rows={3} value={form.networks} onChange={(e) => set("networks", e.target.value)} className={cn(inputClass, "h-auto max-w-none py-1.5 font-mono")} disabled={!usesNetwork && form.rule !== "off"} />
          </GridField>
          <GridValue label="This computer" span={2}>
            {ipKnown ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink">{myIp}</span>
                {!lines.includes(myIp) && (
                  <WindowButton onClick={() => set("networks", [...lines, myIp].join("\n"))}>
                    <Wifi className="h-3.5 w-3.5" /> Add this network
                  </WindowButton>
                )}
                <span className="text-2xs text-ink-muted">Use it only when you are on the office connection.</span>
              </span>
            ) : (
              <span className="text-2xs text-ink-muted">Your address isn&apos;t visible here (e.g. on a local test server). Ask your internet provider for the office address.</span>
            )}
          </GridValue>
        </FormGroup>
        <FormGroup index={3} title="Office location" description="The office point and how far from it counts." columns={2}>
          <GridField label="Latitude" error={errors.latitude} size="code">
            <input name="latitude" inputMode="decimal" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="27.717245" className={inputClass} />
          </GridField>
          <GridField label="Longitude" error={errors.longitude} size="code">
            <input name="longitude" inputMode="decimal" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="85.323960" className={inputClass} />
          </GridField>
          <GridField label="Radius" error={errors.radiusM} size="code" suffix="metres" help="150 m suits most offices; phones are usually within 20 m">
            <NumberField name="radiusM" decimals={0} max={5000} value={form.radiusM} onChange={(v) => set("radiusM", v)} />
          </GridField>
          <GridValue label="Where I am">
            <WindowButton onClick={here} disabled={!usesLocation && form.rule !== "off"}>
              <LocateFixed className="h-3.5 w-3.5" /> Use my current location
            </WindowButton>
            {locating && <span className="mt-1 block text-2xs text-ink-muted">{locating}</span>}
          </GridValue>
        </FormGroup>
      </PropertyForm>
    </Window>
  );
}

/** Someone who may clock in from anywhere, with a reason, from a date to a date (or ongoing). */
function ExceptionWindow({ data, onClose, onSaved }: { data: AttendancePageData; onClose: () => void; onSaved: (t: string) => void }) {
  const [start] = useState(() => ({ employeeId: "", from: data.today, to: "", reason: "" }));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const people = data.register.filter((r) => r.employee.id !== data.myEmployeeId).map((r) => ({ value: r.employee.id, label: r.employee.fullName, hint: r.employee.employeeCode }));
  const save = async () => {
    setSaving(true);
    const res = await addCheckinExceptionAction({ ...form, to: form.to || null });
    setSaving(false);
    if (!res.success) {
      setErrors(res.validationErrors ?? {});
      setFailure(res.error);
      return;
    }
    onSaved(`${people.find((p) => p.value === form.employeeId)?.label ?? "They"} can clock in from anywhere${form.to ? " until the date set" : ""}.`);
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="md"
      title="Allow clock-in from anywhere"
      description="Their clock-ins count without approval, wherever they are. You can't add yourself."
      footer={
        <>
          {failure && <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">{failure}</p>}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Allow
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Employee" required error={errors.employeeId} span={2} size="lg">
            <Combobox name="employeeId" options={people} value={form.employeeId} onChange={(v) => set("employeeId", v)} placeholder="Search employee" />
          </GridField>
          <GridField label="From" required size="date">
            <DateField name="from" value={form.from} onChange={(v) => set("from", v)} />
          </GridField>
          <GridField label="Until" error={errors.to} size="date" help="Empty: ongoing">
            <DateField name="to" value={form.to} onChange={(v) => set("to", v)} />
          </GridField>
          <GridField label="Reason" required error={errors.reason} span={2} size="full">
            <input name="reason" value={form.reason} maxLength={300} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Field sales, Pokhara client visit" className={inputClass} />
          </GridField>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}

