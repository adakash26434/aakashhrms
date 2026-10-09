"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardDrive, Link2, Plus, RefreshCw, Upload } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { StatusChip } from "@/components/kit/status-chip";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import {
  saveDeviceAction,
  listDevicePinsAction,
  mapDevicePinAction,
  unmapDevicePinAction,
  importDevicePunchesAction,
} from "@/app/actions/device.actions";
import type { DeviceScreenRow, DevicesPageData } from "@/lib/services/device.service";

// Attendance devices (G3): the device register with health, PIN ↔ employee
// mapping (claiming waiting punches), unknown-PIN list and a paste-import
// that runs the same pipeline as a device push.

const HEALTH_CHIP: Record<DeviceScreenRow["health"], { status: string; label: string }> = {
  online: { status: "active", label: "Online" },
  quiet: { status: "pending", label: "Quiet" },
  silent: { status: "error", label: "Silent" },
  never: { status: "inactive", label: "Never seen" },
};

export function DevicesClient({ data }: { data: DevicesPageData }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<DeviceScreenRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [mapping, setMapping] = useState<DeviceScreenRow | null>(null);
  const [importing, setImporting] = useState<DeviceScreenRow | null>(null);
  const [prefillPin, setPrefillPin] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const deviceColumns: GridColumn<DeviceScreenRow>[] = [
    { id: "name", header: "Device", value: (d) => d.name, sticky: true },
    { id: "branch", header: "Branch", value: (d) => d.branch, width: 140 },
    { id: "serial", header: "Serial no.", value: (d) => d.serialNo, type: "code", width: 150 },
    { id: "health", header: "Health", value: (d) => HEALTH_CHIP[d.health].label, width: 110, cell: (d) => <StatusChip status={HEALTH_CHIP[d.health].status} label={HEALTH_CHIP[d.health].label} /> },
    { id: "lastPunch", header: "Last punch", value: (d) => (d.lastPunchAt ? d.lastPunchAt.slice(0, 16).replace("T", " ") : ""), width: 150 },
    { id: "mapped", header: "Mapped PINs", value: (d) => d.mappedUsers, type: "number", align: "right", width: 110 },
    { id: "unmatched", header: "Unknown PINs", value: (d) => d.unmatchedCount, type: "number", align: "right", width: 115, cell: (d) => (d.unmatchedCount > 0 ? <span className="font-semibold text-warning">{d.unmatchedCount}</span> : <span>0</span>) },
    { id: "enabled", header: "Enabled", value: (d) => (d.enabled ? "Yes" : "No"), width: 90, cell: (d) => <StatusChip status={d.enabled ? "active" : "inactive"} /> },
  ];

  const unmatchedColumns: GridColumn<DevicesPageData["unmatched"][number]>[] = [
    { id: "device", header: "Device", value: (u) => u.deviceName, sticky: true, width: 160 },
    { id: "pin", header: "PIN", value: (u) => u.deviceUserId, type: "code", width: 100 },
    { id: "count", header: "Punches", value: (u) => u.punchCount, type: "number", align: "right", width: 90 },
    { id: "last", header: "Latest", value: (u) => u.lastAt.slice(0, 16).replace("T", " "), width: 150 },
    { id: "map", header: "", value: () => "", width: 110, cell: (u) =>
        data.permissions.manage ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline cursor-pointer"
            onClick={(ev) => {
              ev.stopPropagation();
              const device = data.devices.find((d) => d.id === u.deviceId);
              if (device) {
                setPrefillPin(u.deviceUserId);
                setMapping(device);
              }
            }}
          >
            <Link2 className="h-3.5 w-3.5" /> Map PIN
          </button>
        ) : null },
  ];

  return (
    <div>
      <PageBar
        title="Attendance devices"
        description="ZKTeco-class terminals push punches themselves; set each device's cloud server to this host and register its serial here"
        actions={[
          { id: "add", label: "Add device", icon: Plus, group: "create", primary: true, hidden: !data.permissions.manage, onClick: () => setCreating(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <div className="space-y-6">
        <DataGrid
          id="attendance-devices"
          label="Attendance devices"
          columns={deviceColumns}
          rows={data.devices}
          getRowId={(d) => d.id}
          onOpen={data.permissions.manage ? (d) => setEditing(d) : undefined}
          toolbar={
            data.permissions.manage && data.devices.length > 0 ? (
              <div className="flex gap-2">
                <WindowButton onClick={() => setMapping(data.devices[0])}>
                  <Link2 className="h-3.5 w-3.5" /> PIN mapping
                </WindowButton>
                <WindowButton onClick={() => setImporting(data.devices[0])}>
                  <Upload className="h-3.5 w-3.5" /> Import punches
                </WindowButton>
              </div>
            ) : undefined
          }
          empty={{ title: "No devices yet", description: 'Add the terminal with its serial number, then point its "Cloud server" / ADMS setting at this host.' }}
          maxHeight="none"
          pageSize={20}
        />
        {data.unmatched.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">Unknown PINs — punches waiting</h2>
            <DataGrid id="device-unmatched" label="Unknown device PINs" columns={unmatchedColumns} rows={data.unmatched} getRowId={(u) => `${u.deviceId}:${u.deviceUserId}`} maxHeight="360px" empty={{ title: "None" }} />
          </div>
        )}
      </div>

      <DeviceFormWindow
        key={editing?.id ?? (creating ? "new" : "closed")}
        open={creating || !!editing}
        device={editing}
        branches={data.branches}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(name) => {
          setCreating(false);
          setEditing(null);
          setNotice(`Device "${name}" saved.`);
          refresh();
        }}
      />
      {mapping && (
        <PinMappingWindow
          key={`${mapping.id}:${prefillPin}`}
          device={mapping}
          devices={data.devices}
          employees={data.employees}
          prefillPin={prefillPin}
          canEdit={data.permissions.manage}
          onClose={() => {
            setMapping(null);
            setPrefillPin("");
          }}
          onChanged={(text) => {
            setNotice(text);
            refresh();
          }}
          onSwitchDevice={(d) => setMapping(d)}
        />
      )}
      {importing && (
        <ImportPunchesWindow
          device={importing}
          devices={data.devices}
          onClose={() => setImporting(null)}
          onSwitchDevice={(d) => setImporting(d)}
          onDone={(text) => {
            setImporting(null);
            setNotice(text);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function DeviceFormWindow({ open, device, branches, onClose, onSaved }: { open: boolean; device: DeviceScreenRow | null; branches: { id: string; name: string }[]; onClose: () => void; onSaved: (name: string) => void }) {
  // Remounted per device (key above), so state starts from the row.
  const [name, setName] = useState(device?.name ?? "");
  const [branchId, setBranchId] = useState(device?.branchId ?? "");
  const [serialNo, setSerialNo] = useState(device?.serialNo ?? "");
  const [enabled, setEnabled] = useState(device?.enabled ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveDeviceAction(device?.id ?? null, { name, branchId, serialNo, enabled, tzOffsetMinutes: 345 });
      if (result.success) onSaved(result.data.name);
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title={device ? `Edit device — ${device.name}` : "Add device"}
      description='On the terminal: Comm. → Cloud server (ADMS) → this host, port 443, and note the serial number shown under "Device info".'
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save device"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Device">
            <FieldRow label="Name" required error={errors.name}>
              <input className={inputClass} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Head office door"' />
            </FieldRow>
            <FieldRow label="Branch" required error={errors.branchId}>
              <SelectField options={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Serial no." required error={errors.serialNo} help="Exactly as the device shows it; punches are accepted from registered serials only.">
              <input className={`${inputClass} font-code`} value={serialNo} maxLength={60} onChange={(e) => setSerialNo(e.target.value.trim())} />
            </FieldRow>
            <FieldRow label="Enabled">
              <label className="flex h-8 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Accept punches from this device
              </label>
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

interface PinRow {
  id: string;
  deviceUserId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
}

function PinMappingWindow({ device, devices, employees, prefillPin, canEdit, onClose, onChanged, onSwitchDevice }: { device: DeviceScreenRow; devices: DeviceScreenRow[]; employees: DevicesPageData["employees"]; prefillPin: string; canEdit: boolean; onClose: () => void; onChanged: (text: string) => void; onSwitchDevice: (d: DeviceScreenRow) => void }) {
  // Remounted per device + prefill (key above), so state starts clean.
  const [pins, setPins] = useState<PinRow[] | null>(null);
  const [pin, setPin] = useState(prefillPin);
  const [employeeId, setEmployeeId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listDevicePinsAction(device.id);
      if (cancelled) return;
      if (result.success) setPins(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [device.id]);

  const map = () =>
    startTransition(async () => {
      setError(null);
      const result = await mapDevicePinAction(device.id, pin, employeeId);
      if (result.success) {
        onChanged(result.data.claimed > 0 ? `PIN ${pin} mapped; ${result.data.claimed} waiting punch(es) claimed.` : `PIN ${pin} mapped.`);
        setPin("");
        setEmployeeId("");
        const refreshed = await listDevicePinsAction(device.id);
        if (refreshed.success) setPins(refreshed.data);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  const remove = async (row: PinRow) => {
    const result = await unmapDevicePinAction(row.id);
    if (result.success) {
      onChanged(`PIN ${row.deviceUserId} unmapped.`);
      setPins((prev) => (prev ? prev.filter((p) => p.id !== row.id) : prev));
    } else setError(result.error);
  };

  return (
    <Window
      open
      onClose={onClose}
      title={`PIN mapping — ${device.name}`}
      description="The PIN is the user id enrolled on the terminal. Mapping a PIN claims its waiting punches."
      size="md"
      footer={<WindowButton onClick={onClose}>Close</WindowButton>}
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        {devices.length > 1 && (
          <SelectField
            aria-label="Device"
            options={devices.map((d) => ({ value: d.id, label: d.name }))}
            value={device.id}
            onChange={(id) => {
              const next = devices.find((d) => d.id === id);
              if (next) onSwitchDevice(next);
            }}
          />
        )}
        {canEdit && (
          <PropertyForm enterNavigation>
            <FieldGroup title="Map a PIN">
              <FieldRow label="PIN" required error={errors.deviceUserId}>
                <input className={`${inputClass} font-code max-w-40`} value={pin} maxLength={30} onChange={(e) => setPin(e.target.value.trim())} />
              </FieldRow>
              <FieldRow label="Employee" required error={errors.employeeId}>
                <Combobox options={employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Type a name or code" />
              </FieldRow>
              <FieldRow label="">
                <WindowButton variant="primary" onClick={map} disabled={pending || !pin || !employeeId}>
                  <Link2 className="h-3.5 w-3.5" /> {pending ? "Mapping…" : "Map & claim punches"}
                </WindowButton>
              </FieldRow>
            </FieldGroup>
          </PropertyForm>
        )}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Mapped PINs</h3>
          {!pins ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : pins.length === 0 ? (
            <p className="text-sm text-ink-muted">None yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {pins.map((row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="py-1.5 pr-2 font-code">{row.deviceUserId}</td>
                    <td className="py-1.5 pr-2">
                      {row.employeeName} <span className="text-ink-faint">· {row.employeeCode}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      {canEdit && (
                        <button type="button" className="text-xs text-ink-faint hover:text-danger cursor-pointer" onClick={() => remove(row)}>
                          Unmap
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Window>
  );
}

function ImportPunchesWindow({ device, devices, onClose, onSwitchDevice, onDone }: { device: DeviceScreenRow; devices: DeviceScreenRow[]; onClose: () => void; onSwitchDevice: (d: DeviceScreenRow) => void; onDone: (text: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setError(null);
      const result = await importDevicePunchesAction(device.id, text);
      if (result.success) {
        const r = result.data;
        onDone(`Imported: ${r.matched} matched, ${r.unmatched} unknown PIN(s), ${r.malformed} malformed line(s).`);
      } else setError(result.error);
    });

  return (
    <Window
      open
      onClose={onClose}
      title={`Import punches — ${device.name}`}
      description="Paste lines from the device's USB export (.dat): PIN, a tab, then the local time — the same format the device pushes. Times are the device's clock."
      size="md"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={run} disabled={pending || !text.trim()}>
            <HardDrive className="h-3.5 w-3.5" /> {pending ? "Importing…" : "Import"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {devices.length > 1 && (
          <SelectField
            aria-label="Device"
            options={devices.map((d) => ({ value: d.id, label: d.name }))}
            value={device.id}
            onChange={(id) => {
              const next = devices.find((d) => d.id === id);
              if (next) onSwitchDevice(next);
            }}
          />
        )}
        <textarea
          className={`${inputClass} h-auto min-h-48 max-w-none py-2 font-code text-xs`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"101\t2026-10-09 09:58:12\t0\t1\n102\t2026-10-09 10:01:40\t0\t1"}
        />
        <p className="text-xs text-ink-muted">Duplicates are ignored (a punch lands once); unknown PINs go to the waiting list for mapping.</p>
      </div>
    </Window>
  );
}
