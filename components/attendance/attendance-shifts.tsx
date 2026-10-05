"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, Pencil, Plus, Star, TriangleAlert } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { makeDefaultShiftAction, setBranchShiftAction, setShiftActiveAction } from "@/app/actions/shift.actions";
import { hoursText } from "@/lib/engines/attendance-day.engine";
import type { AttendancePageData, ShiftView } from "@/lib/types/attendance";
import { ShiftChip } from "./attendance-shared";
import { ShiftWindow } from "./attendance-shift-window";

/**
 * Shifts (4.5b): the company's own shifts. Company-wide roles define them
 * (hours, week with off days and own hours per weekday, seasons, day rules);
 * everyone with Attendance → Edit assigns them on the Roster tab. A day's
 * shift comes from the roster, else the person's assignment, else their
 * branch's default, else the company default.
 */
export function AttendanceShifts({ data, onSaved }: { data: AttendancePageData; onSaved: (text: string) => void }) {
  const can = data.permissions.settings;
  const [active, setActive] = useState<ShiftView | null>(data.shifts[0] ?? null);
  const [editing, setEditing] = useState<null | { shift: ShiftView | null; copy?: boolean }>(null);
  const [confirm, setConfirm] = useState<null | { kind: "default" | "archive" | "restore"; shift: ShiftView }>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingBranch, setSavingBranch] = useState<string | null>(null);
  const activeShifts = data.shifts.filter((s) => s.active);

  const columns = useMemo<GridColumn<ShiftView>[]>(
    () => [
      { id: "code", header: "Code", width: 90, value: (s) => s.code, cell: (s) => <ShiftChip code={s.code} color={s.color} /> },
      {
        id: "name",
        header: "Name",
        width: 180,
        value: (s) => s.name,
        cell: (s) => (
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-ink">{s.name}</span>
            {s.isDefault && <span className="rounded bg-brand-subtle px-1.5 py-0.5 text-3xs font-semibold text-brand-strong">Company default</span>}
          </span>
        ),
      },
      { id: "kind", header: "Type", width: 90, value: (s) => (s.kind === "flexible" ? "Flexible" : "Fixed") },
      { id: "summary", header: "Hours and week", width: 360, value: (s) => s.summary, cell: (s) => <span className="text-2xs text-ink-muted">{s.summary}</span> },
      { id: "week", header: "Hours a week", type: "number", width: 150, value: (s) => s.weekMinutes, cell: (s) => <span className={s.weekMinutes > 2880 ? "font-medium text-warning" : ""}>{hoursText(s.weekMinutes)}</span> },
      { id: "people", header: "People today", type: "number", width: 150, value: (s) => s.people },
      { id: "branches", header: "Branch default for", width: 190, value: (s) => s.branchNames.join(", "), cell: (s) => <span className="text-2xs text-ink-muted">{s.branchNames.join(", ") || "—"}</span> },
      {
        id: "checks",
        header: "Labour Act",
        width: 110,
        value: (s) => s.warnings.length,
        cell: (s) =>
          s.warnings.length ? (
            <span title={s.warnings.join("\n")} className="inline-flex items-center gap-1 text-2xs font-medium text-warning">
              <TriangleAlert className="h-3.5 w-3.5" /> {s.warnings.length} to check
            </span>
          ) : (
            <span className="text-2xs text-ink-faint">OK</span>
          ),
      },
      { id: "status", header: "Status", width: 100, value: (s) => (s.active ? "Active" : "Archived"), cell: (s) => <StatusChip status={s.active ? "active" : "inactive"} label={s.active ? "Active" : "Archived"} /> },
    ],
    []
  );

  const run = async (kind: "default" | "archive" | "restore", s: ShiftView) => {
    const result = kind === "default" ? await makeDefaultShiftAction(s.id) : await setShiftActiveAction(s.id, kind === "restore");
    setConfirm(null);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    onSaved(kind === "default" ? `${s.code} is now the company default shift.` : kind === "archive" ? `${s.code} archived.` : `${s.code} is active again.`);
  };

  const setBranch = async (branchId: string, shiftId: string) => {
    setSavingBranch(branchId);
    const result = await setBranchShiftAction(branchId, shiftId || null);
    setSavingBranch(null);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    onSaved("Branch default shift saved. Open months are worked out with it; closed months keep their results.");
  };

  return (
    <div className="space-y-3 p-3 @container">
      <div className="rounded-md border border-line bg-surface-panel px-3 py-2.5 text-xs text-ink-muted">
        <p>
          <span className="font-medium text-ink">Which shift applies on a day:</span> the roster day (a rotation, a swap or OFF), else the person&apos;s assigned shift, else their branch&apos;s default, else the company default.
        </p>
        <p className="mt-1">Changing a shift changes every open month; closed months keep their results. {can ? "" : "Only company-wide roles define shifts; you can assign them on the Roster tab."}</p>
      </div>
      {message && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      {can && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <WindowButton variant="primary" onClick={() => setEditing({ shift: null })}>
            <Plus className="h-3.5 w-3.5" /> New shift
          </WindowButton>
          <WindowButton disabled={!active} onClick={() => active && setEditing({ shift: active })}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </WindowButton>
          <WindowButton disabled={!active} onClick={() => active && setEditing({ shift: active, copy: true })}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </WindowButton>
          <WindowButton disabled={!active || active.isDefault || !active.active} onClick={() => active && setConfirm({ kind: "default", shift: active })}>
            <Star className="h-3.5 w-3.5" /> Make default
          </WindowButton>
          {active && !active.active ? (
            <WindowButton onClick={() => setConfirm({ kind: "restore", shift: active })}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </WindowButton>
          ) : (
            <WindowButton disabled={!active || active.isDefault} onClick={() => active && setConfirm({ kind: "archive", shift: active })}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </WindowButton>
          )}
          {active && <span className="text-ink-muted">Selected: {active.code}</span>}
        </div>
      )}
      <DataGrid
        id="attendance-shifts"
        label="Shifts"
        columns={columns}
        rows={data.shifts}
        getRowId={(s) => s.id}
        activeRowId={active?.id ?? null}
        onActiveRowChange={setActive}
        onOpen={(s) => setEditing({ shift: s })}
        rowTone={(s) => (!s.active ? undefined : s.warnings.length ? "warning" : undefined)}
        empty={{ title: "No shifts yet", description: "The General shift is created from Company setup the first time this page opens." }}
      />

      <section aria-label="Branch default shifts" className="rounded-lg border border-line bg-surface">
        <header className="border-b border-line px-3 py-2">
          <h3 className="text-sm font-semibold text-ink">Branch default shifts</h3>
          <p className="text-2xs text-ink-muted">For people in the branch without their own shift. Empty uses the company default.</p>
        </header>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 px-3 py-3 @min-[48rem]:grid-cols-2">
          {data.branches.map((b) => (
            <label key={b.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 flex-1 text-ink">{b.name}</span>
              <span className="w-48 shrink-0 @min-[48rem]:w-64">
                <SelectField
                  name={`branch-shift-${b.id}`}
                  aria-label={`Default shift for ${b.name}`}
                  options={activeShifts.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
                  value={data.branchDefaults[b.id] ?? ""}
                  onChange={(v) => setBranch(b.id, v)}
                  placeholder="Company default"
                  allowEmpty
                  disabled={!can || savingBranch === b.id}
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      {editing && (
        <ShiftWindow
          data={data}
          shift={editing.shift}
          copy={editing.copy}
          readOnly={!can}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            onSaved(text);
          }}
        />
      )}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === "default" ? `Make ${confirm.shift.code} the company default?` : confirm?.kind === "archive" ? `Archive ${confirm?.shift.code}?` : `Restore ${confirm?.shift.code}?`}
        message={
          confirm?.kind === "default"
            ? "Everyone without their own shift or a branch default works this shift from now on, in every open month. Closed months keep their results."
            : confirm?.kind === "archive"
              ? "It can no longer be assigned. Days that used it keep it. Refused while people are still on it from today on."
              : "It can be assigned again."
        }
        confirmLabel={confirm?.kind === "default" ? "Make default" : confirm?.kind === "archive" ? "Archive" : "Restore"}
        onConfirm={async () => {
          if (confirm) await run(confirm.kind, confirm.shift);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
