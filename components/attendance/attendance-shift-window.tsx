"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Save, Snowflake, Trash2, TriangleAlert } from "lucide-react";
import { FormGroup, GridField, GridValue } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { saveShiftAction } from "@/app/actions/shift.actions";
import { hoursText } from "@/lib/engines/attendance-day.engine";
import { MAX_SEASONS, parseShift, plannedMinutes, plannedWeekMinutes, shiftWarnings } from "@/lib/engines/shift.engine";
import { ALLOWANCE_MAX } from "@/lib/engines/shift-allowance.engine";
import { WEEKDAYS } from "@/lib/engines/pay-period.engine";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { SHIFT_COLORS, type AttendancePageData, type ShiftColor, type ShiftKind, type ShiftSeason, type ShiftView, type ShiftWeekDay } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";
import { SHIFT_TONE } from "./attendance-shared";

const COLOR_NAME: Record<ShiftColor, string> = { green: "Green", blue: "Blue", amber: "Amber", rose: "Rose", slate: "Grey" };
const MONTHS = BS_MONTHS_EN.slice(1, 13).map((m, i) => ({ value: String(i + 1), label: m }));
/** Kartik 16 – Magh 15: the government's winter hours. */
const WINTER = { fromMonth: 7, fromDay: 16, toMonth: 10, toDay: 15 };

interface Form {
  code: string;
  name: string;
  color: ShiftColor;
  kind: ShiftKind;
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  otMinimumMinutes: number;
  week: ShiftWeekDay[];
  seasons: ShiftSeason[];
  allowancePerDay: number;
}

const blank: Form = {
  code: "",
  name: "",
  color: "blue",
  kind: "fixed",
  start: "09:00",
  end: "17:00",
  breakMinutes: 30,
  graceMinutes: 15,
  fullDayMinutes: 420,
  halfDayMinutes: 210,
  otMinimumMinutes: 30,
  week: WEEKDAYS.map((_, i) => ({ working: i !== 0 && i !== 6, start: null, end: null })),
  seasons: [],
  allowancePerDay: 0,
};

/**
 * A shift (company-wide roles): hours and day rules, the week (each day
 * working or off, with its own hours when they differ) and seasons (BS date
 * ranges with their own hours, every year). Labour Act checks show as you
 * type; they are reminders, not blocks.
 */
export function ShiftWindow({
  data,
  shift,
  copy,
  readOnly,
  onClose,
  onSaved,
}: {
  data: AttendancePageData;
  shift: ShiftView | null;
  copy?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const initial = useMemo<Form>(() => {
    if (!shift) return blank;
    const { code, name, color, kind, start, end, breakMinutes, graceMinutes, fullDayMinutes, halfDayMinutes, otMinimumMinutes, week, seasons, allowancePerDay } = shift;
    return {
      code: copy ? "" : code,
      name: copy ? `${name} (copy)` : name,
      color,
      kind,
      start,
      end,
      breakMinutes,
      graceMinutes,
      fullDayMinutes,
      halfDayMinutes,
      otMinimumMinutes,
      week: WEEKDAYS.map((_, i) => ({ working: week[i]?.working ?? true, start: week[i]?.start ?? null, end: week[i]?.end ?? null })),
      seasons: seasons.map((s) => ({ ...s })),
      allowancePerDay,
    };
  }, [shift, copy]);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Row checks (week, seasons) show once a save has been tried, not while a row is still being filled in.
  const [tried, setTried] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setDay = (i: number, v: Partial<ShiftWeekDay>) => setForm((f) => ({ ...f, week: f.week.map((w, j) => (j === i ? { ...w, ...v } : w)) }));
  const setSeason = (i: number, v: Partial<ShiftSeason>) => setForm((f) => ({ ...f, seasons: f.seasons.map((s, j) => (j === i ? { ...s, ...v } : s)) }));
  const editingId = shift && !copy ? shift.id : null;

  // Live checks: the same parser and Labour Act reminders the server uses.
  const parsed = useMemo(() => parseShift(form), [form]);
  const warnings = parsed.value ? shiftWarnings(parsed.value) : [];
  const weekMinutes = parsed.value ? plannedWeekMinutes(parsed.value) : 0;
  const shownErrors = { ...errors };

  const save = async () => {
    if (readOnly) return;
    setTried(true);
    setSaving(true);
    const result = await saveShiftAction({ ...form, id: editingId });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    const w = result.data.warnings.length;
    onSaved(`${form.code.toUpperCase()} saved${w ? ` with ${w} Labour Act reminder${w === 1 ? "" : "s"} to check` : ""}. Open months are worked out with it; closed months keep their results.`);
  };

  const dayHours = (w: ShiftWeekDay) => (w.working ? hoursText(plannedMinutes(w.start && w.end ? w.start : form.start, w.start && w.end ? w.end : form.end, form.breakMinutes)) : "Off");
  const hasWinter = form.seasons.some((s) => s.fromMonth === WINTER.fromMonth && s.fromDay === WINTER.fromDay);

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={!readOnly && JSON.stringify(form) !== JSON.stringify(initial)}
      size="xl"
      title={readOnly ? `Shift ${shift?.code ?? ""}` : editingId ? `Edit shift ${shift?.code}` : "New shift"}
      description="Hours, the week and seasons. Changes apply to every open month; closed months keep their results."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving}>{readOnly ? "Close" : "Cancel"}</WindowCancel>
          {!readOnly && (
            <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save shift
            </WindowButton>
          )}
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-3 bg-surface-panel p-3">
        <fieldset disabled={readOnly || saving} className="space-y-3">
          <FormGroup index={1} title="Shift" description="A short code shows on the roster; the name everywhere else.">
            <GridField label="Code" required error={shownErrors.code} size="code" help="1–10 letters or numbers, e.g. MOR, EVE, N1">
              <input name="code" value={form.code} maxLength={10} onChange={(e) => set("code", e.target.value.toUpperCase())} className={cn(inputClass, "font-mono uppercase")} />
            </GridField>
            <GridField label="Name" required error={shownErrors.name} size="lg">
              <input name="name" value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Morning shift" className={inputClass} />
            </GridField>
            <GridField label="Colour" size="md">
              <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label="Colour">
                {SHIFT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={form.color === c}
                    title={COLOR_NAME[c]}
                    onClick={() => set("color", c)}
                    className={cn("h-6 min-w-10 cursor-pointer rounded px-1.5 text-2xs font-semibold", SHIFT_TONE[c], form.color === c ? "ring-2 ring-focus" : "ring-1 ring-line")}
                  >
                    {form.code || "ABC"}
                  </button>
                ))}
              </div>
            </GridField>
            <GridField label="Type" size="md" help={form.kind === "flexible" ? "Work the full day's hours any time inside the hours below; nobody is late" : "Fixed start and end; late and early are counted"}>
              <SelectField
                name="kind"
                options={[
                  { value: "fixed", label: "Fixed hours" },
                  { value: "flexible", label: "Flexible hours" },
                ]}
                value={form.kind}
                onChange={(v) => set("kind", v === "flexible" ? "flexible" : "fixed")}
              />
            </GridField>
          </FormGroup>

          <FormGroup index={2} title="Hours and day rules" description="An end earlier than the start is a night shift: it ends the next morning and belongs to the day it starts.">
            <GridField label={form.kind === "flexible" ? "Earliest start" : "Starts"} required error={shownErrors.start} size="code">
              <input name="start" type="time" value={form.start} onChange={(e) => set("start", e.target.value)} className={inputClass} />
            </GridField>
            <GridField label={form.kind === "flexible" ? "Latest end" : "Ends"} required error={shownErrors.end} size="code">
              <input name="end" type="time" value={form.end} onChange={(e) => set("end", e.target.value)} className={inputClass} />
            </GridField>
            <GridField label="Break" error={shownErrors.breakMinutes} size="code" suffix="minutes" help="Taken off days longer than 5 hours (Labour Act: half an hour's rest after 5 hours)">
              <NumberField name="breakMinutes" decimals={0} value={form.breakMinutes} onChange={(v) => set("breakMinutes", v)} showZero />
            </GridField>
            {form.kind === "fixed" && (
              <GridField label="Grace" error={shownErrors.graceMinutes} size="code" suffix="minutes" help="Arriving within this is not late">
                <NumberField name="graceMinutes" decimals={0} value={form.graceMinutes} onChange={(v) => set("graceMinutes", v)} showZero />
              </GridField>
            )}
            <GridField label="Full day from" error={shownErrors.fullDayMinutes} size="code" suffix={`minutes (${hoursText(form.fullDayMinutes)})`} help="Shorter days (own hours, seasons) need their own planned hours">
              <NumberField name="fullDayMinutes" decimals={0} value={form.fullDayMinutes} onChange={(v) => set("fullDayMinutes", v)} />
            </GridField>
            <GridField label="Half day from" error={shownErrors.halfDayMinutes} size="code" suffix={`minutes (${hoursText(form.halfDayMinutes)})`} help="Less than this worked is absent">
              <NumberField name="halfDayMinutes" decimals={0} value={form.halfDayMinutes} onChange={(v) => set("halfDayMinutes", v)} />
            </GridField>
            <GridField label="Overtime from" error={shownErrors.otMinimumMinutes} size="code" suffix="minutes" help="Extra time below this is not overtime">
              <NumberField name="otMinimumMinutes" decimals={0} value={form.otMinimumMinutes} onChange={(v) => set("otMinimumMinutes", v)} showZero />
            </GridField>
          </FormGroup>

          <FormGroup index={3} title="Shift allowance" description="Paid through payroll for each day worked on this shift, e.g. a night allowance. Changes reach open months; closed months keep what they counted.">
            <GridField
              label="Per day worked"
              error={shownErrors.allowancePerDay ?? (tried ? parsed.errors.allowancePerDay : undefined)}
              size="amount"
              suffix="NPR a day"
              help={
                form.allowancePerDay > 0
                  ? `A full day (or on duty) counts 1, a half day ½; work on a holiday or weekly off counts by its hours. 20 days worked: NPR ${(form.allowancePerDay * 20).toLocaleString("en-IN")}.`
                  : "0: no allowance for this shift."
              }
            >
              <NumberField name="allowancePerDay" decimals={2} max={ALLOWANCE_MAX} value={form.allowancePerDay} onChange={(v) => set("allowancePerDay", v)} showZero selectOnFocus />
            </GridField>
          </FormGroup>

          <FormGroup index={4} title="Week" description="Off days are the weekly holiday. Own hours are for a different day, e.g. a short Friday or a Saturday morning." columns={2}>
            <div className="col-span-full overflow-x-auto">
              <table className="w-full min-w-[34rem] text-xs">
                <thead>
                  <tr className="text-left text-3xs uppercase tracking-wide text-ink-muted">
                    <th className="py-1 pr-2 font-medium">Day</th>
                    <th className="py-1 pr-2 font-medium">Working</th>
                    <th className="py-1 pr-2 font-medium">Own start</th>
                    <th className="py-1 pr-2 font-medium">Own end</th>
                    <th className="py-1 font-medium">Planned</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((d, i) => {
                    const w = form.week[i];
                    return (
                      <tr key={d} className="border-t border-line">
                        <td className="py-1 pr-2 text-ink">{d}</td>
                        <td className="py-1 pr-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5">
                            <input type="checkbox" name={`week.${i}.working`} className="h-3.5 w-3.5 accent-brand" checked={w.working} onChange={(e) => setDay(i, { working: e.target.checked, start: e.target.checked ? w.start : null, end: e.target.checked ? w.end : null })} />
                            {w.working ? "Working" : "Off"}
                          </label>
                        </td>
                        <td className="py-1 pr-2">
                          <input aria-label={`${d} own start`} type="time" value={w.start ?? ""} disabled={!w.working} onChange={(e) => setDay(i, { start: e.target.value || null })} className={cn(inputClass, "w-32")} />
                        </td>
                        <td className="py-1 pr-2">
                          <input aria-label={`${d} own end`} type="time" value={w.end ?? ""} disabled={!w.working} onChange={(e) => setDay(i, { end: e.target.value || null })} className={cn(inputClass, "w-32")} />
                        </td>
                        <td className={cn("py-1 tabular-nums", w.working ? "text-ink" : "text-ink-faint")}>
                          {form.kind === "flexible" && w.working ? hoursText(form.fullDayMinutes) : dayHours(w)}
                          {(errors[`week.${i}`] || (tried ? parsed.errors[`week.${i}`] : undefined)) && <span className="ml-2 text-danger">{errors[`week.${i}`] || (tried ? parsed.errors[`week.${i}`] : undefined)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(errors.week || (tried ? parsed.errors.week : undefined)) && <p className="mt-1 text-2xs text-danger">{errors.week || (tried ? parsed.errors.week : undefined)}</p>}
            </div>
          </FormGroup>

          <FormGroup
            index={5}
            title="Seasons"
            description="Hours for part of the year, every year by BS date. Own weekday hours still win."
            columns={2}
            aside={
              !readOnly && (
                <span className="flex gap-1.5">
                  {!hasWinter && data.winterHours && form.seasons.length < MAX_SEASONS && (
                    <WindowButton onClick={() => set("seasons", [...form.seasons, { name: "Winter", ...WINTER, start: data.winterHours!.start, end: data.winterHours!.end }])}>
                      <Snowflake className="h-3.5 w-3.5" /> Add winter hours
                    </WindowButton>
                  )}
                  <WindowButton disabled={form.seasons.length >= MAX_SEASONS} onClick={() => set("seasons", [...form.seasons, { name: "", fromMonth: 1, fromDay: 1, toMonth: 1, toDay: 31, start: form.start, end: form.end }])}>
                    <Plus className="h-3.5 w-3.5" /> Add season
                  </WindowButton>
                </span>
              )
            }
          >
            <div className="col-span-full space-y-2">
              {!form.seasons.length && <p className="text-2xs text-ink-muted">No seasons: the same hours all year. Government offices work 09:00–16:00 from Kartik 16 to Magh 15.</p>}
              {form.seasons.map((s, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface px-2 py-2 text-xs">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-3xs uppercase tracking-wide text-ink-muted">Season</span>
                    <input aria-label="Season name" value={s.name} maxLength={30} onChange={(e) => setSeason(i, { name: e.target.value })} className={cn(inputClass, "w-28")} placeholder="Winter" />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-3xs uppercase tracking-wide text-ink-muted">From</span>
                    <span className="flex gap-1">
                      <NumberField aria-label="From day" name={`season-${i}-fromDay`} decimals={0} max={32} selectOnFocus value={s.fromDay} onChange={(v) => setSeason(i, { fromDay: v })} className="w-14" />
                      <span className="w-28">
                        <SelectField name={`season-${i}-from`} aria-label="From month" options={MONTHS} value={String(s.fromMonth)} onChange={(v) => setSeason(i, { fromMonth: Number(v) })} />
                      </span>
                    </span>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-3xs uppercase tracking-wide text-ink-muted">To</span>
                    <span className="flex gap-1">
                      <NumberField aria-label="To day" name={`season-${i}-toDay`} decimals={0} max={32} selectOnFocus value={s.toDay} onChange={(v) => setSeason(i, { toDay: v })} className="w-14" />
                      <span className="w-28">
                        <SelectField name={`season-${i}-to`} aria-label="To month" options={MONTHS} value={String(s.toMonth)} onChange={(v) => setSeason(i, { toMonth: Number(v) })} />
                      </span>
                    </span>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-3xs uppercase tracking-wide text-ink-muted">Starts</span>
                    <input aria-label="Season start" type="time" value={s.start} onChange={(e) => setSeason(i, { start: e.target.value })} className={cn(inputClass, "w-32")} />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-3xs uppercase tracking-wide text-ink-muted">Ends</span>
                    <input aria-label="Season end" type="time" value={s.end} onChange={(e) => setSeason(i, { end: e.target.value })} className={cn(inputClass, "w-32")} />
                  </label>
                  {!readOnly && (
                    <WindowButton aria-label={`Remove ${s.name || "season"}`} title="Remove" onClick={() => set("seasons", form.seasons.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </WindowButton>
                  )}
                  {(errors[`seasons.${i}`] || (tried ? parsed.errors[`seasons.${i}`] : undefined)) && <p className="w-full text-2xs text-danger">{errors[`seasons.${i}`] || (tried ? parsed.errors[`seasons.${i}`] : undefined)}</p>}
                </div>
              ))}
              {(errors.seasons || (tried ? parsed.errors.seasons : undefined)) && <p className="text-2xs text-danger">{errors.seasons || (tried ? parsed.errors.seasons : undefined)}</p>}
            </div>
          </FormGroup>

          <FormGroup index={6} title="Labour Act checks" description="Reminders from the Labour Act 2074; the company decides." columns={2}>
            <GridValue label="Planned a week">
              <span className={cn("text-sm tabular-nums", weekMinutes > 2880 ? "text-warning" : "text-ink")}>{parsed.value ? hoursText(weekMinutes) : "—"}</span>
              <span className="block text-2xs text-ink-muted">The Labour Act allows 48 hours a week and 8 a day.</span>
            </GridValue>
            <div className="col-span-full space-y-1">
              {warnings.length ? (
                warnings.map((w) => (
                  <p key={w} className="flex items-start gap-1.5 text-xs text-warning">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                  </p>
                ))
              ) : (
                <p className="text-xs text-ink-muted">{parsed.value ? "Nothing to check." : "Fill in the fields above to see the checks."}</p>
              )}
            </div>
          </FormGroup>
        </fieldset>
      </PropertyForm>
    </Window>
  );
}
