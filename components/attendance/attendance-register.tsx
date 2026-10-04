"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Save, TimerReset, Undo2 } from "lucide-react";
import { EditGrid, type EditGridColumn, type GridValueChange } from "@/components/kit/edit-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { inputClass } from "@/components/kit/property-form";
import { WindowButton } from "@/components/kit/window";
import { setAttendanceOverridesAction } from "@/app/actions/attendance.actions";
import { hoursText, localClock } from "@/lib/engines/attendance-day.engine";
import { bsDayOf, weekdayOf } from "@/lib/engines/pay-period.engine";
import { DAY_CODE, OVERRIDE_TYPES, type AttendancePageData, type DayResult, type OverrideType, type RegisterRow } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";
import { DayCode, DayLegend } from "./attendance-shared";
import { AdjustmentWindow, PunchWindow } from "./attendance-windows";

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const CLEAR = "auto";
const OPTIONS = [
  ...OVERRIDE_TYPES.map((t) => ({ value: t, label: `${DAY_CODE[t].code} · ${DAY_CODE[t].name}` })),
  { value: CLEAR, label: "↺ · Back to the rules (clear HR setting)" },
];

/**
 * Register: one row per employee, one column per day of the month (BS day
 * with its AD date). Editing a day sets an HR override (one reason per
 * save); the pane below explains the selected day and offers a punch or an
 * adjustment. Closed months, future days, days outside employment and your
 * own row are read-only.
 */
export function AttendanceRegister({ data, onSaved }: { data: AttendancePageData; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Map<string, OverrideType | typeof CLEAR>>(new Map());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [active, setActive] = useState<{ rowId: string; colId: string } | null>(null);
  const [windowFor, setWindowFor] = useState<null | { kind: "punch" | "adjustment"; employeeId: string; date: string }>(null);
  const dates = useMemo(() => (data.register[0]?.days ?? []).map((d) => d.date), [data.register]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.register.filter(
      (r) =>
        (!filters.department || r.employee.departmentId === filters.department) &&
        (!filters.issue || (filters.issue === "missing" ? r.summary.missingPunchDays > 0 : filters.issue === "unpaid" ? r.summary.unpaidDays > 0 : r.summary.lateDays > 0)) &&
        (!q || r.employee.fullName.toLowerCase().includes(q) || r.employee.employeeCode.toLowerCase().includes(q))
    );
  }, [data.register, filters, search]);

  const editable = (r: RegisterRow, d: DayResult) =>
    data.permissions.edit && !r.locked && d.dayType !== "not_employed" && d.date <= data.today && r.employee.id !== data.myEmployeeId;
  const key = (employeeId: string, date: string) => `${employeeId}|${date}`;

  const columns = useMemo<EditGridColumn<RegisterRow>[]>(() => {
    const cols: EditGridColumn<RegisterRow>[] = [
      { id: "code", header: "Code", kind: "readonly", pinned: true, width: 84, align: "left", value: (r) => r.employee.employeeCode },
      { id: "name", header: "Employee", kind: "readonly", pinned: true, width: 160, align: "left", value: (r) => (r.employee.id === data.myEmployeeId ? `${r.employee.fullName} (you)` : r.employee.fullName) },
    ];
    dates.forEach((date, i) => {
      const bs = bsDayOf(date);
      const wd = weekdayOf(date);
      const off = data.rules.shift.weeklyOffs.includes(wd);
      cols.push({
        id: `d:${date}`,
        header: `${bs.day} ${dateText(date)}`,
        headerNode: (
          <span className={cn("flex flex-col items-center leading-tight", off && "text-ink-faint", date === data.today && "text-brand-strong")}>
            <span className="text-xs font-semibold">{bs.day}</span>
            <span className="text-3xs font-normal">{WEEKDAY_LETTER[wd]}</span>
            <span className="text-3xs font-normal text-ink-faint">{date.slice(8)}</span>
          </span>
        ),
        kind: "choice",
        width: 46,
        align: "center",
        options: OPTIONS,
        value: (r) => edits.get(key(r.employee.id, date)) ?? r.days[i].dayType,
        original: (r) => r.days[i].dayType,
        editable: (r) => editable(r, r.days[i]),
        format: (v, r) => {
          const day = r.days[i];
          const edited = edits.get(key(r.employee.id, date));
          if (!edited) return <DayCode day={day} />;
          if (edited === CLEAR) return <span className="text-2xs font-semibold text-ink-muted">↺</span>;
          return <DayCode day={{ ...day, dayType: edited, flags: ["override"], rule: "Changed here (not saved yet)" }} />;
        },
        hint: `${dateText(date, "long")}`,
      });
    });
    cols.push(
      { id: "payable", header: "Paid days", group: "Month", kind: "readonly", width: 76, value: (r) => r.summary.payableDays },
      { id: "unpaid", header: "Unpaid", group: "Month", kind: "readonly", width: 70, value: (r) => r.summary.unpaidDays + r.summary.notEmployedDays },
      { id: "late", header: "Late", group: "Month", kind: "readonly", width: 56, value: (r) => r.summary.lateDays },
      { id: "ot", header: "OT h", group: "Month", kind: "readonly", width: 60, value: (r) => Math.round(((r.summary.otWorkDayMinutes + r.summary.otOffDayMinutes) / 60) * 10) / 10 }
    );
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, edits, data]);

  const onChange = (changes: GridValueChange[]) => {
    setFailure(null);
    setEdits((cur) => {
      const next = new Map(cur);
      for (const ch of changes) {
        if (!ch.colId.startsWith("d:")) continue;
        const date = ch.colId.slice(2);
        const row = data.register.find((r) => r.employee.id === ch.rowId);
        const day = row?.days.find((d) => d.date === date);
        if (!row || !day || !editable(row, day)) continue;
        const v = String(ch.value);
        const valid = v === CLEAR || (OVERRIDE_TYPES as readonly string[]).includes(v);
        if (!valid) continue;
        // Choosing what the day already is (and it is not an override) is no change.
        if (v === day.dayType && !day.flags.includes("override")) next.delete(key(row.employee.id, date));
        else if (v === CLEAR && !day.flags.includes("override")) next.delete(key(row.employee.id, date));
        else next.set(key(row.employee.id, date), v as OverrideType | typeof CLEAR);
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const cells = [...edits].map(([k, v]) => {
      const [employeeId, date] = k.split("|");
      return { employeeId, date, type: v === CLEAR ? null : v };
    });
    const result = await setAttendanceOverridesAction({ cells, reason });
    setSaving(false);
    if (!result.success) {
      setFailure(result.validationErrors?.reason ?? result.error);
      return;
    }
    setEdits(new Map());
    setReason("");
    onSaved(`${result.data.count} day${result.data.count === 1 ? "" : "s"} saved.`);
  };

  const activeRow = active ? data.register.find((r) => r.employee.id === active.rowId) : null;
  const activeDay = activeRow && active?.colId.startsWith("d:") ? activeRow.days.find((d) => d.date === active.colId.slice(2)) : null;

  return (
    <div className="space-y-3 p-3 @container">
      <FilterStrip
        id="attendance-register"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[
          { id: "department", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          {
            id: "issue",
            label: "Show",
            allLabel: "Everyone",
            options: [
              { value: "missing", label: "With missing punches" },
              { value: "unpaid", label: "With unpaid days" },
              { value: "late", label: "With late days" },
            ],
          },
        ]}
      />
      <DayLegend />
      <EditGrid
        label={`Attendance register, ${data.period.label}`}
        rows={rows}
        getRowId={(r) => r.employee.id}
        columns={columns}
        onChange={onChange}
        onActiveCellChange={(rowId, colId) => setActive({ rowId, colId })}
        maxHeight="calc(100vh - 420px)"
        empty={<span>Nobody in this month for the branch and filters chosen.</span>}
      />

      {edits.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-xs">
          <span className="font-medium text-ink">
            {edits.size} day{edits.size === 1 ? "" : "s"} changed (set by HR)
          </span>
          <input
            aria-label="Reason for the change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Reason, e.g. Field visit confirmed by manager"
            className={cn(inputClass, "min-w-64 max-w-none flex-1")}
          />
          <WindowButton onClick={() => { setEdits(new Map()); setFailure(null); }} disabled={saving}>
            <Undo2 className="h-3.5 w-3.5" /> Discard
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={saving || reason.trim().length < 3}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save changes
          </WindowButton>
          {failure && <p role="alert" className="w-full text-danger">{failure}</p>}
        </div>
      )}

      {activeRow && activeDay && (
        <section aria-label="Selected day" className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">
                {activeRow.employee.fullName} · {dateText(activeDay.date, "long")}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
                <DayCode day={activeDay} /> {DAY_CODE[activeDay.dayType].name}: {activeDay.rule}
              </p>
            </div>
            {activeDay.date <= data.today && activeDay.dayType !== "not_employed" && !activeRow.locked && activeRow.employee.id !== data.myEmployeeId && (
              <span className="flex gap-2">
                {data.permissions.add && (
                  <WindowButton onClick={() => setWindowFor({ kind: "punch", employeeId: activeRow.employee.id, date: activeDay.date })}>
                    <Plus className="h-3.5 w-3.5" /> Add punch
                  </WindowButton>
                )}
                {data.permissions.add && (
                  <WindowButton onClick={() => setWindowFor({ kind: "adjustment", employeeId: activeRow.employee.id, date: activeDay.date })}>
                    <TimerReset className="h-3.5 w-3.5" /> Adjustment
                  </WindowButton>
                )}
              </span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 @min-[40rem]:grid-cols-6">
            {[
              ["In", localClock(activeDay.firstIn) || "—"],
              ["Out", localClock(activeDay.lastOut) || "—"],
              ["Worked", activeDay.workMinutes ? hoursText(activeDay.workMinutes) : "—"],
              ["Late", activeDay.lateMinutes ? `${activeDay.lateMinutes} min` : "—"],
              ["Left early", activeDay.earlyMinutes ? `${activeDay.earlyMinutes} min` : "—"],
              ["Overtime", activeDay.otWorkDayMinutes + activeDay.otOffDayMinutes ? hoursText(activeDay.otWorkDayMinutes + activeDay.otOffDayMinutes) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-3xs uppercase tracking-wide text-ink-muted">{k}</dt>
                <dd className="tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {activeRow.locked && <p className="mt-2 text-2xs text-ink-muted">This month is closed for the branch: reopen it in Month close to change days.</p>}
        </section>
      )}

      {windowFor?.kind === "punch" && <PunchWindow data={data} initial={windowFor} onClose={() => setWindowFor(null)} onSaved={(t) => { setWindowFor(null); onSaved(t); }} />}
      {windowFor?.kind === "adjustment" && <AdjustmentWindow data={data} initial={windowFor} onClose={() => setWindowFor(null)} onSaved={(t) => { setWindowFor(null); onSaved(t); }} />}
    </div>
  );
}
