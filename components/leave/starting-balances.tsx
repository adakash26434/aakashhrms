"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Save } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { useDateText } from "@/components/kit/date-cell";
import { EditGrid, type EditGridColumn, type GridValueChange } from "@/components/kit/edit-grid";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { saveStartingBalancesAction, startingBalancesAction } from "@/app/actions/leave.actions";
import { fmt } from "@/lib/engines/leave.engine";
import type { StartingBalancesData } from "@/lib/types/leave";

type Row = StartingBalancesData["rows"][number];
const key = (employeeId: string, typeId: string) => `${employeeId}|${typeId}`;

/**
 * Starting balances (a company starts keeping leave in AakashHRMS): the
 * month leave is kept here from, and each person's balances on its first
 * day from the old records, typed or pasted from Excel. Saving records the
 * difference; entering the same figures again changes nothing. From that
 * month on, home leave is earned as attendance months close.
 */
export function StartingBalancesWindow({ onClose, onSaved }: { onClose: () => void; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const [data, setData] = useState<StartingBalancesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);

  const load = (pick?: { year: number; month: number }) => {
    setLoading(true);
    setFailure(null);
    startingBalancesAction(pick).then((r) => {
      setLoading(false);
      if (r.success) {
        setData(r.data);
        setValues({});
      } else setFailure(r.error);
    });
  };
  useEffect(() => {
    let live = true;
    startingBalancesAction().then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.success) setData(r.data);
      else setFailure(r.error);
    });
    return () => {
      live = false;
    };
  }, []);

  const changes = useMemo(() => {
    if (!data) return [];
    return Object.entries(values)
      .map(([k, days]) => {
        const [employeeId, leaveTypeId] = k.split("|");
        const now = data.rows.find((r) => r.employee.id === employeeId)?.cells[leaveTypeId]?.now ?? 0;
        return { employeeId, leaveTypeId, days, now };
      })
      .filter((c) => Math.round((c.days - c.now) * 100) !== 0);
  }, [data, values]);

  const columns = useMemo<EditGridColumn<Row>[]>(
    () =>
      data
        ? [
            { id: "name", header: "Employee", kind: "readonly", width: 200, pinned: true, align: "left", value: (r) => r.employee.fullName, format: (_v, r) => <span className="font-medium text-ink">{r.employee.fullName} <span className="font-code text-3xs text-ink-faint">{r.employee.employeeCode}</span></span> },
            { id: "joined", header: "Joined", kind: "readonly", width: 110, align: "left", value: (r) => r.joiningDate, format: (_v, r) => <span className="text-ink-muted">{dateText(r.joiningDate)}</span> },
            ...data.types.map(
              (t): EditGridColumn<Row> => ({
                id: t.id,
                header: t.name,
                kind: "number",
                width: 130,
                align: "right",
                hint: t.statutoryCode === "SICK" ? "What the person can still take on the first day of the month: this year's sick leave left plus what was saved" : t.statutoryCode === "HOME" ? "Home leave saved on the first day of the month" : undefined,
                value: (r) => (r.cells[t.id] ? (values[key(r.employee.id, t.id)] ?? r.cells[t.id]!.now) : null),
                original: (r) => r.cells[t.id]?.now ?? null,
                format: (v, r) => (r.cells[t.id] ? fmt(Number(v) || 0) : <span className="text-ink-faint">—</span>),
                editable: (r) => !!r.cells[t.id] && !r.own,
                lockedReason: (r) => (r.own ? "Your own balance: someone else enters it." : !r.cells[t.id] ? `${t.name} doesn't apply to this person.` : undefined),
                warning: (r) => {
                  const v = values[key(r.employee.id, t.id)];
                  return v !== undefined && t.cap !== null && v > t.cap ? `Above the ${t.cap}-day limit: the extra is paid out when the next leave year is opened.` : undefined;
                },
                error: (r) => {
                  const v = values[key(r.employee.id, t.id)];
                  return v !== undefined && (v < 0 || v > 999) ? "Between 0 and 999 days" : undefined;
                },
              })
            ),
          ]
        : [],
    [data, values, dateText]
  );

  const onChange = (list: GridValueChange[]) =>
    setValues((prev) => {
      const next = { ...prev };
      for (const c of list) next[`${c.rowId}|${c.colId}`] = c.value === null || c.value === "" ? 0 : Math.round(Number(c.value) * 100) / 100;
      return next;
    });

  const save = async () => {
    if (!data) return;
    const r = await saveStartingBalancesAction({ year: data.start.year, month: data.start.month, cells: changes.map((c) => ({ employeeId: c.employeeId, leaveTypeId: c.leaveTypeId, days: c.days })) });
    if (!r.success) throw new Error(r.error);
    onSaved(`Starting balances saved for ${r.data.people} employee${r.data.people === 1 ? "" : "s"}. Leave is kept in AakashHRMS from ${r.data.label}.`);
  };

  const invalid = changes.some((c) => c.days < 0 || c.days > 999);
  return (
    <Window
      open
      onClose={onClose}
      dirty={changes.length > 0}
      size="full"
      title="Starting balances"
      description="When the company starts keeping leave in AakashHRMS: each person's balances on the first day of that month, from the old records."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          {!failure && <p className="mr-auto text-2xs text-ink-muted">{changes.length ? `${changes.length} balance${changes.length === 1 ? "" : "s"} changed` : "Type or paste the balances; changed cells are marked."}</p>}
          <WindowCancel />
          <WindowButton variant="primary" onClick={() => setConfirming(true)} disabled={!changes.length || invalid}>
            <Save className="h-3.5 w-3.5" /> Save starting balances
          </WindowButton>
        </>
      }
    >
      {!data && loading && (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading balances…
        </p>
      )}
      {data && (
        <div className="@container space-y-3 text-xs">
          <section aria-label="How it works" className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <ol className="grid gap-x-4 gap-y-1.5 text-ink @3xl:grid-cols-2">
              <li>
                <span className="font-semibold">1. The month you start.</span> Leave is kept in AakashHRMS from the first day of this month. Balances before it come from your old records.
              </li>
              <li>
                <span className="font-semibold">2. Each person&apos;s balance on that day.</span> Home leave saved; sick leave they can still take (this year&apos;s left plus what was saved). Paste a block from Excel with Ctrl+V.
              </li>
              <li>
                <span className="font-semibold">3. From then on, month by month.</span> Each closed attendance month adds the home leave earned in it; sick leave is given when each new leave year opens. Substitute leave starts at 0.
              </li>
              <li>
                <span className="font-semibold">4. Corrections.</span> Enter a figure again here (only the difference is recorded) or use Adjust balance on one person. Every change shows in their history.
              </li>
            </ol>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">Leave is kept here from</span>
            {data.fixed ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-sunken px-2.5 py-1 font-semibold text-ink">
                <Lock className="h-3.5 w-3.5 text-ink-muted" /> {data.start.label} ({dateText(data.start.start)})
              </span>
            ) : (
              <div className="w-56">
                <SelectField
                  name="start-month"
                  options={data.months.map((m) => ({ value: `${m.year}-${m.month}`, label: `${m.label} (${dateText(m.start)})` }))}
                  value={`${data.start.year}-${data.start.month}`}
                  onChange={(v) => {
                    const [y, m] = v.split("-").map(Number);
                    load({ year: y, month: m });
                  }}
                />
              </div>
            )}
            <span className="text-2xs text-ink-muted">
              {data.fixed
                ? "Fixed when the first starting balances were saved."
                : "It is fixed when you save. Choose the first month whose attendance you will close here (changing it clears what you typed)."}{" "}
              Leave year {data.yearLabel}. {data.rows.length} employee{data.rows.length === 1 ? "" : "s"} employed on that day.
            </span>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" />}
          </div>

          <EditGrid
            label="Starting balances"
            rows={data.rows}
            getRowId={(r) => r.employee.id}
            columns={columns}
            onChange={onChange}
            maxHeight="50vh"
            empty={<p className="p-4 text-xs text-ink-muted">Nobody was employed on the first day of {data.start.label}. People who join later start from 0 and earn as they work.</p>}
          />
        </div>
      )}
      <Confirm
        open={confirming}
        title="Save starting balances?"
        message={`${changes.length} balance${changes.length === 1 ? "" : "s"} for ${new Set(changes.map((c) => c.employeeId)).size} employee${new Set(changes.map((c) => c.employeeId)).size === 1 ? "" : "s"} change to the figures entered, from the first day of ${data?.start.label ?? "the month"}.${data && !data.fixed ? ` This also fixes ${data.start.label} as the month leave is kept here from.` : ""}`}
        confirmLabel="Save"
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </Window>
  );
}
