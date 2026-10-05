"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Loader2, Plus, Repeat, Save, Trash2, Undo2, UserCog } from "lucide-react";
import { EditGrid, type EditGridColumn, type GridValueChange } from "@/components/kit/edit-grid";
import { useDateText } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { FormGrid, GridField, GridValue } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { assignShiftAction, rotateRosterAction, setRosterAction } from "@/app/actions/shift.actions";
import { bsDayOf, weekdayOf } from "@/lib/engines/pay-period.engine";
import { MAX_ROTATION_DAYS, rotate } from "@/lib/engines/shift.engine";
import type { AttendancePageData, RosterRow, ShiftView } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";
import { ShiftChip } from "./attendance-shared";

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const OFF = "OFF";
const USUAL = "USUAL";
const SOURCE_TEXT = { roster: "Roster day", assignment: "Assigned shift", branch: "Branch default", company: "Company default" } as const;

type Cell = typeof OFF | typeof USUAL | string;

/**
 * Roster (4.5b): each person's shift for every day of the month. Plain
 * codes come from their assigned shift or a default; bold codes are roster
 * days (a rotation, a swap, OFF). Type a shift code, OFF, or USUAL (back to
 * the usual shift); Ctrl+D fills down and Excel paste works. Assign shift
 * gives people a shift from a date; Rotate fills the roster from a pattern.
 * Closed months and your own row are read-only.
 */
export function AttendanceRoster({ data, onSaved }: { data: AttendancePageData; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Map<string, Cell>>(new Map());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [active, setActive] = useState<{ rowId: string; colId: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [windowOpen, setWindowOpen] = useState<null | "assign" | "rotate">(null);
  const shiftById = useMemo(() => new Map(data.shifts.map((s) => [s.id, s])), [data.shifts]);
  const activeShifts = data.shifts.filter((s) => s.active);
  const dates = useMemo(() => (data.roster[0]?.days ?? []).map((d) => d.date), [data.roster]);
  const key = (employeeId: string, date: string) => `${employeeId}|${date}`;
  const canEdit = data.permissions.edit;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.roster.filter(
      (r) =>
        (!filters.department || r.employee.departmentId === filters.department) &&
        (!filters.shift || r.days.some((d) => d.shiftId === filters.shift && !d.off)) &&
        (!q || r.employee.fullName.toLowerCase().includes(q) || r.employee.employeeCode.toLowerCase().includes(q))
    );
  }, [data.roster, filters, search]);

  const editable = (r: RosterRow) => canEdit && !r.locked && r.employee.id !== data.myEmployeeId;
  const options = useMemo(
    () => [
      ...activeShifts.map((s) => ({ value: s.id, label: s.code })),
      { value: OFF, label: OFF },
      { value: USUAL, label: "USUAL (back to the usual shift)" },
    ],
    [activeShifts]
  );

  const current = (r: RosterRow, i: number): Cell => {
    const d = r.days[i];
    return d.off ? OFF : d.shiftId ?? "";
  };

  const columns = useMemo<EditGridColumn<RosterRow>[]>(() => {
    const cols: EditGridColumn<RosterRow>[] = [
      { id: "code", header: "Code", kind: "readonly", pinned: true, width: 84, align: "left", value: (r) => r.employee.employeeCode },
      { id: "name", header: "Employee", kind: "readonly", pinned: true, width: 160, align: "left", value: (r) => (r.employee.id === data.myEmployeeId ? `${r.employee.fullName} (you)` : r.employee.fullName) },
    ];
    dates.forEach((date, i) => {
      const bs = bsDayOf(date);
      const wd = weekdayOf(date);
      cols.push({
        id: `d:${date}`,
        header: `${bs.day} ${dateText(date)}`,
        headerNode: (
          <span className={cn("flex flex-col items-center leading-tight", date === data.today && "text-brand-strong")}>
            <span className="text-xs font-semibold">{bs.day}</span>
            <span className="text-3xs font-normal">{WEEKDAY_LETTER[wd]}</span>
            <span className="text-3xs font-normal text-ink-faint">{date.slice(8)}</span>
          </span>
        ),
        kind: "choice",
        width: 50,
        align: "center",
        options,
        value: (r) => edits.get(key(r.employee.id, date)) ?? current(r, i),
        original: (r) => current(r, i),
        editable,
        format: (_v, r) => {
          const d = r.days[i];
          const edited = edits.get(key(r.employee.id, date));
          if (edited === USUAL) return <span className="text-2xs font-semibold text-ink-muted" title="Back to the usual shift (not saved yet)">↺</span>;
          if (edited) {
            const s = shiftById.get(edited);
            return <ShiftChip code={s?.code ?? "?"} color={s?.color} off={edited === OFF} strong title="Changed here (not saved yet)" />;
          }
          const s = d.shiftId ? shiftById.get(d.shiftId) : undefined;
          return <ShiftChip code={s?.code ?? d.code} color={s?.color} off={d.off} strong={d.source === "roster"} title={`${SOURCE_TEXT[d.source]}${d.note ? `: ${d.note}` : ""}`} />;
        },
        hint: dateText(date, "long"),
      });
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, edits, data, options, shiftById]);

  const onChange = (changes: GridValueChange[]) => {
    setFailure(null);
    setEdits((cur) => {
      const next = new Map(cur);
      for (const ch of changes) {
        if (!ch.colId.startsWith("d:")) continue;
        const date = ch.colId.slice(2);
        const row = data.roster.find((r) => r.employee.id === ch.rowId);
        const i = row ? row.days.findIndex((d) => d.date === date) : -1;
        if (!row || i < 0 || !editable(row)) continue;
        const v = String(ch.value);
        if (v !== OFF && v !== USUAL && !activeShifts.some((s) => s.id === v)) continue;
        const day = row.days[i];
        const k = key(row.employee.id, date);
        // No change: the day already is that, or USUAL on a day that is not a roster day.
        if (v === USUAL ? day.source !== "roster" : v === current(row, i)) next.delete(k);
        else next.set(k, v);
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const cells = [...edits].map(([k, v]) => {
      const [employeeId, date] = k.split("|");
      return v === USUAL ? { employeeId, date, clear: true } : v === OFF ? { employeeId, date, off: true } : { employeeId, date, shiftId: v };
    });
    const result = await setRosterAction({ cells, note });
    setSaving(false);
    if (!result.success) {
      setFailure(result.error);
      return;
    }
    setEdits(new Map());
    setNote("");
    onSaved(`${result.data.count} roster day${result.data.count === 1 ? "" : "s"} saved.`);
  };

  const activeRow = active ? data.roster.find((r) => r.employee.id === active.rowId) : null;
  const activeDay = activeRow && active?.colId.startsWith("d:") ? activeRow.days.find((d) => d.date === active.colId.slice(2)) : null;
  const people = (selectedRows.length > 1 ? rows.filter((r) => selectedRows.includes(r.employee.id)) : rows).filter(editable);

  return (
    <div className="space-y-3 p-3 @container">
      <FilterStrip
        id="attendance-roster"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[
          { id: "department", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          { id: "shift", label: "Shift", allLabel: "Any shift", options: activeShifts.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })) },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {canEdit && (
          <>
            <WindowButton variant="primary" disabled={!people.length || !activeShifts.length} onClick={() => setWindowOpen("assign")}>
              <UserCog className="h-3.5 w-3.5" /> Assign shift
            </WindowButton>
            <WindowButton disabled={!people.length || !activeShifts.length} onClick={() => setWindowOpen("rotate")}>
              <Repeat className="h-3.5 w-3.5" /> Rotate
            </WindowButton>
            <span className="text-ink-muted">{selectedRows.length > 1 ? `${people.length} selected rows` : `All ${people.length} shown`} · select rows in the grid to act on some people</span>
          </>
        )}
        <ul className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-2xs text-ink-muted" aria-label="Shift codes">
          {activeShifts.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1">
              <ShiftChip code={s.code} color={s.color} /> {s.name}
            </li>
          ))}
          <li className="inline-flex items-center gap-1">
            <ShiftChip code="" off /> day off
          </li>
          <li className="inline-flex items-center gap-1">
            <ShiftChip code="AB" color="slate" strong /> roster day
          </li>
        </ul>
      </div>
      <EditGrid
        label={`Shift roster, ${data.period.label}`}
        rows={rows}
        getRowId={(r) => r.employee.id}
        columns={columns}
        onChange={onChange}
        onSelectRows={setSelectedRows}
        onActiveCellChange={(rowId, colId) => setActive({ rowId, colId })}
        maxHeight="calc(100vh - 440px)"
        empty={<span>Nobody in this month for the branch and filters chosen.</span>}
      />

      {edits.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-xs">
          <span className="font-medium text-ink">
            {edits.size} roster day{edits.size === 1 ? "" : "s"} changed
          </span>
          <input aria-label="Note for the change" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (optional), e.g. Swapped with Ram for Tihar" className={cn(inputClass, "min-w-64 max-w-none flex-1")} />
          <WindowButton
            onClick={() => {
              setEdits(new Map());
              setFailure(null);
            }}
            disabled={saving}
          >
            <Undo2 className="h-3.5 w-3.5" /> Discard
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save roster
          </WindowButton>
          {failure && (
            <p role="alert" className="w-full text-danger">
              {failure}
            </p>
          )}
        </div>
      )}

      {activeRow && activeDay && (
        <section aria-label="Selected day" className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs">
          <p className="font-semibold text-ink">
            {activeRow.employee.fullName} · {dateText(activeDay.date, "long")}
          </p>
          <p className="mt-0.5 text-ink-muted">
            {activeDay.off ? "Day off" : `${shiftById.get(activeDay.shiftId ?? "")?.name ?? activeDay.code}`} · {SOURCE_TEXT[activeDay.source]}
            {activeDay.note ? `: ${activeDay.note}` : ""}
          </p>
          <p className="mt-1 text-2xs text-ink-muted">
            Assigned shifts this month:{" "}
            {activeRow.assignments.length
              ? activeRow.assignments.map((a) => `${shiftById.get(a.shiftId)?.code ?? "?"} from ${dateText(a.from)}${a.to ? ` to ${dateText(a.to)}` : " (ongoing)"}`).join(" · ")
              : "none (branch or company default)"}
          </p>
          {activeRow.locked && <p className="mt-1 text-2xs text-ink-muted">This month is closed for the branch.</p>}
        </section>
      )}

      {windowOpen === "assign" && <AssignWindow data={data} people={people} shifts={activeShifts} onClose={() => setWindowOpen(null)} onSaved={onSaved} />}
      {windowOpen === "rotate" && <RotateWindow data={data} people={people} shifts={activeShifts} onClose={() => setWindowOpen(null)} onSaved={onSaved} />}
    </div>
  );
}

function Failure({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
      {text}
    </p>
  );
}

const firstOpenDay = (data: AttendancePageData) => (data.today >= data.period.start && data.today <= data.period.end ? data.today : data.period.start);

/** Gives the chosen people a shift from a date (to a date, or ongoing); their earlier shift ends the day before. */
function AssignWindow({ data, people, shifts, onClose, onSaved }: { data: AttendancePageData; people: RosterRow[]; shifts: ShiftView[]; onClose: () => void; onSaved: (t: string) => void }) {
  const [form, setForm] = useState({ shiftId: shifts.find((s) => !s.isDefault)?.id ?? shifts[0]?.id ?? "", from: firstOpenDay(data), to: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const dateText = useDateText();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const shift = shifts.find((s) => s.id === form.shiftId);
  const save = async () => {
    setSaving(true);
    const result = await assignShiftAction({ ...form, to: form.to || null, employeeIds: people.map((p) => p.employee.id) });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(`${result.data.count} ${result.data.count === 1 ? "person works" : "people work"} ${shift?.code ?? "the shift"} from ${dateText(form.from)}${form.to ? ` to ${dateText(form.to)}` : ""}.`);
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      size="md"
      title="Assign shift"
      description="Their usual shift from a date. Roster days (swaps, OFF) still win on their days."
      footer={
        <>
          <Failure text={failure} />
          <WindowButton onClick={onClose} disabled={saving}>Cancel</WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || !people.length}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Assign
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Shift" required error={errors.shiftId} size="md">
            <SelectField name="shiftId" options={shifts.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))} value={form.shiftId} onChange={(v) => set("shiftId", v)} />
          </GridField>
          <GridValue label="Hours">
            <span className="text-2xs text-ink-muted">{shift?.summary ?? "—"}</span>
          </GridValue>
          <GridField label="From" required error={errors.from} size="date">
            <DateField name="from" value={form.from} onChange={(v) => set("from", v)} />
          </GridField>
          <GridField label="Until" error={errors.to} size="date" help="Empty: ongoing">
            <DateField name="to" value={form.to} onChange={(v) => set("to", v)} />
          </GridField>
          <GridField label="Note" span={2} size="full">
            <input name="note" value={form.note} maxLength={300} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Moved to the night team" className={inputClass} />
          </GridField>
          <GridValue label="People" span={2}>
            <span className="text-xs text-ink">
              {people.length} {people.length === 1 ? "person" : "people"}: {people.slice(0, 6).map((p) => p.employee.fullName).join(", ")}
              {people.length > 6 ? ` and ${people.length - 6} more` : ""}
            </span>
          </GridValue>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}

/** Fills the roster from a rotation: shifts (or OFF) in order, each for N days or weeks, between two dates. */
function RotateWindow({ data, people, shifts, onClose, onSaved }: { data: AttendancePageData; people: RosterRow[]; shifts: ShiftView[]; onClose: () => void; onSaved: (t: string) => void }) {
  const [steps, setSteps] = useState<string[]>(shifts.slice(0, 2).map((s) => s.id).concat(shifts.length < 2 ? [OFF] : []));
  const [every, setEvery] = useState(1);
  const [unit, setUnit] = useState<"days" | "weeks">("weeks");
  const [from, setFrom] = useState(firstOpenDay(data));
  const [to, setTo] = useState(data.period.end);
  const [startAt, setStartAt] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const dateText = useDateText();
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const everyDays = unit === "weeks" ? every * 7 : every;
  const preview = useMemo(() => (from && to && to >= from ? rotate({ shiftIds: steps, everyDays: Math.max(1, everyDays), from, to, startAt }) : []), [steps, everyDays, from, to, startAt]);
  const stepOptions = [...shifts.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })), { value: OFF, label: "OFF (day off)" }];
  const label = (id: string) => (id === OFF ? OFF : byId.get(id)?.code ?? "?");

  const save = async () => {
    setSaving(true);
    const result = await rotateRosterAction({ shiftIds: steps, everyDays, from, to, startAt, employeeIds: people.map((p) => p.employee.id) });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(`Rotation saved: ${result.data.days} days for ${result.data.people} ${result.data.people === 1 ? "person" : "people"}.`);
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      size="lg"
      title="Rotate shifts"
      description="Fills the roster: each step for a number of days or weeks, in order, then round again. It replaces roster days in the dates chosen."
      footer={
        <>
          <Failure text={failure} />
          <WindowButton onClick={onClose} disabled={saving}>Cancel</WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || !people.length || steps.length < 2}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Fill roster
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridValue label="Steps, in order" span={2}>
            <div className="flex flex-wrap items-center gap-1.5">
              {steps.map((id, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="w-44">
                    <SelectField name={`step-${i}`} aria-label={`Step ${i + 1}`} options={stepOptions} value={id} onChange={(v) => setSteps((s) => s.map((x, j) => (j === i ? v : x)))} />
                  </span>
                  {steps.length > 2 && (
                    <WindowButton aria-label={`Remove step ${i + 1}`} title="Remove" onClick={() => setSteps((s) => s.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </WindowButton>
                  )}
                  {i < steps.length - 1 && <ArrowRightLeft aria-hidden className="h-3.5 w-3.5 text-ink-faint" />}
                </span>
              ))}
              {steps.length < 8 && (
                <WindowButton onClick={() => setSteps((s) => [...s, shifts[0]?.id ?? OFF])}>
                  <Plus className="h-3.5 w-3.5" /> Step
                </WindowButton>
              )}
            </div>
            {errors.shiftIds && <p className="mt-1 text-2xs text-danger">{errors.shiftIds}</p>}
          </GridValue>
          <GridField label="Each step lasts" error={errors.everyDays} size="code">
            <NumberField name="every" decimals={0} value={every} onChange={(v) => setEvery(Math.max(1, Math.min(31, Math.round(v) || 1)))} />
          </GridField>
          <GridField label="Unit" size="code">
            <SelectField
              name="unit"
              options={[
                { value: "days", label: "Days" },
                { value: "weeks", label: "Weeks" },
              ]}
              value={unit}
              onChange={(v) => setUnit(v === "days" ? "days" : "weeks")}
            />
          </GridField>
          <GridField label="From" required error={errors.from} size="date">
            <DateField name="from" value={from} onChange={setFrom} />
          </GridField>
          <GridField label="To" required error={errors.to} size="date" help={`At most ${MAX_ROTATION_DAYS} days at a time`}>
            <DateField name="to" value={to} onChange={setTo} />
          </GridField>
          <GridField label="Start with" error={errors.startAt} size="md" help="Different teams can start at different steps">
            <SelectField name="startAt" options={steps.map((id, i) => ({ value: String(i), label: `Step ${i + 1}: ${label(id)}` }))} value={String(startAt)} onChange={(v) => setStartAt(Number(v) || 0)} />
          </GridField>
          <GridValue label="People">
            <span className="text-xs text-ink">
              {people.length} {people.length === 1 ? "person" : "people"}
            </span>
          </GridValue>
          <GridValue label="Preview" span={2}>
            <div className="flex flex-wrap gap-1">
              {preview.slice(0, 28).map((d) => (
                <span key={d.date} className="flex flex-col items-center" title={dateText(d.date, "long")}>
                  <span className="text-3xs text-ink-faint">
                    {bsDayOf(d.date).day} {WEEKDAY_LETTER[weekdayOf(d.date)]}
                  </span>
                  <ShiftChip code={d.shiftId ? label(d.shiftId) : OFF} color={d.shiftId ? byId.get(d.shiftId)?.color : undefined} off={d.off} />
                </span>
              ))}
              {preview.length > 28 && <span className="self-end text-2xs text-ink-muted">… {preview.length - 28} more days</span>}
              {!preview.length && <span className="text-2xs text-ink-muted">Choose the dates.</span>}
            </div>
          </GridValue>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}
