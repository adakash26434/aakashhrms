"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Lock, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { deleteHolidayAction, holidaysPageAction, saveHolidayAction } from "@/app/actions/holiday.actions";
import { APPLIES_TO_LABEL, HOLIDAY_CATEGORY, NAME_MAX, NEW_HOLIDAY, daysInclusive, holidayFormIsValid, isAdDate, validateHolidayFields } from "@/lib/engines/holiday.engine";
import { HOLIDAY_CATEGORIES, type HolidayForm, type HolidayFormErrors, type HolidayRow, type HolidaysPage } from "@/lib/types/holiday";
import { cn } from "@/lib/utils";

// Holiday calendar (4.12c, template A + Window): the holidays of a fiscal year, BS first — the
// days, who gets them and for which branches. A branch role works on its own branches' holidays;
// nothing changes inside a closed attendance month. The server checks everything again.

type Open = { kind: "new" } | { kind: "edit" | "delete"; holiday: HolidayRow } | null;

const leaveNote = (n: number) =>
  n ? ` ${n} approved leave request${n === 1 ? " includes" : "s include"} these days: they were counted as leave before this holiday, so check ${n === 1 ? "it" : "them"} in Leave.` : "";

export function HolidaysClient({ initial }: { initial: HolidaysPage }) {
  const [data, setData] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({ year: String(initial.currentFiscalYear) });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [pending, start] = useTransition();
  const can = data.can;
  // A branch role with no branch can't give anyone a holiday.
  const canAdd = can.add && (data.companyWide || data.branches.length > 0);

  const reload = (message?: { tone: NoticeTone; text: string }) =>
    start(async () => {
      const result = await holidaysPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setData(result.data);
      if (message) setNotice(message);
    });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.holidays.filter(
      (h) =>
        (!filters.year || String(h.fiscalYear) === filters.year) &&
        (!filters.category || h.category === filters.category) &&
        (!q || `${h.name} ${h.categoryLabel} ${h.branches} ${h.fromBs} ${h.toBs}`.toLowerCase().includes(q))
    );
  }, [data.holidays, filters, search]);
  const active = rows.find((h) => h.id === activeId) ?? null;

  const columns: GridColumn<HolidayRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Holiday",
        width: 240,
        value: (h) => h.name,
        cell: (h) => (
          <span className="flex min-w-0 items-center gap-1.5" title={h.locked ?? undefined}>
            {h.locked && <Lock aria-label="Can't be changed" className="h-3 w-3 shrink-0 text-ink-faint" />}
            <span className="truncate font-medium">{h.name}</span>
          </span>
        ),
      },
      {
        id: "dates",
        header: "Dates",
        width: 240,
        value: (h) => h.fromAd,
        cell: (h) =>
          h.fromAd === h.toAd ? (
            <DateCell value={h.fromAd} variant="long" />
          ) : (
            <span className="whitespace-nowrap">
              <DateCell value={h.fromAd} variant="long" /> <span className="text-ink-faint">–</span> <DateCell value={h.toAd} variant="long" />
            </span>
          ),
      },
      { id: "days", header: "Days", type: "number", align: "right", width: 80, value: (h) => h.days, total: "sum" },
      { id: "category", header: "Category", width: 160, value: (h) => h.categoryLabel, cell: (h) => <span className="text-ink-muted">{h.categoryLabel}</span> },
      { id: "for", header: "For", width: 110, value: (h) => APPLIES_TO_LABEL[h.appliesTo], cell: (h) => <span className={h.appliesTo === "women" ? "text-ink" : "text-ink-muted"}>{APPLIES_TO_LABEL[h.appliesTo]}</span> },
      { id: "branches", header: "Branches", width: 200, value: (h) => h.branches, cell: (h) => <span className={cn("block truncate", h.branches === "All branches" ? "text-ink-muted" : "text-ink")} title={h.branches}>{h.branches}</span> },
    ],
    []
  );

  const noActive = "Choose a holiday";
  const filtered = !!(search || filters.category);
  return (
    <div>
      <PageBar
        title="Holiday calendar"
        description="Public and company holidays: the days attendance and leave count as holidays, by branch"
        actions={[
          { id: "new", label: "New holiday", icon: Plus, group: "create", shortcut: "Ctrl+N", primary: true, hidden: !canAdd, onClick: () => setOpen({ kind: "new" }) },
          { id: "edit", label: "Edit", icon: Pencil, group: "selection", shortcut: "F2", hidden: !can.edit, disabled: !active || !!active.locked, disabledReason: !active ? noActive : active.locked ?? undefined, onClick: () => active && setOpen({ kind: "edit", holiday: active }) },
          { id: "delete", label: "Delete", icon: Trash2, group: "selection", hidden: !can.delete, disabled: !active || !!active.locked, disabledReason: !active ? noActive : active.locked ?? undefined, onClick: () => active && setOpen({ kind: "delete", holiday: active }) },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => reload() },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <Guide
        id="holidays"
        title="How the holiday calendar works"
        className="mb-3"
        steps={[
          { title: "The days", text: "From the first day to the last. Attendance shows them as holidays and leave doesn't count them." },
          { title: "Who gets them", text: "Every branch or chosen branches (a regional festival), and everyone or women only (International Women's Day)." },
          { title: "Your branches", text: "A branch role sets holidays for its own branches; a holiday for every branch needs a company-wide role." },
          { title: "Closed months", text: "Once a branch's attendance month is closed, its holidays in that month stay as they are: reopen the month first." },
        ]}
      />
      <FilterStrip
        id="holidays"
        className="mb-3"
        filters={[
          { id: "year", label: "Fiscal year", allLabel: "All years", options: data.fiscalYears.map((y) => ({ value: String(y.year), label: y.year === data.currentFiscalYear ? `${y.label} (current)` : y.label })) },
          { id: "category", label: "Category", allLabel: "All categories", options: HOLIDAY_CATEGORIES.map((c) => ({ value: c, label: HOLIDAY_CATEGORY[c].label })) },
        ]}
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Search holidays" }}
      />
      <DataGrid
        id="holidays"
        label="Holidays"
        columns={columns}
        rows={rows}
        getRowId={(h) => h.id}
        activeRowId={activeId}
        onActiveRowChange={(h) => setActiveId(h.id)}
        onOpen={can.edit ? (h) => !h.locked && setOpen({ kind: "edit", holiday: h }) : undefined}
        pageSize={0}
        empty={{
          title: filtered ? "No holiday matches" : "No holidays in this year yet",
          description: canAdd && !filtered ? "Add the public holidays and festivals the company gives: Dashain, Tihar, New Year…" : undefined,
        }}
        maxHeight="none"
      />
      {!can.add && !can.edit && !can.delete && <p className="mt-3 text-xs text-ink-muted">Changing holidays needs Holidays → Add, Edit or Delete.</p>}

      {(open?.kind === "new" || open?.kind === "edit") && (
        <HolidayWindow
          key={open.kind === "edit" ? open.holiday.id : "new"}
          page={data}
          holiday={open.kind === "edit" ? open.holiday : null}
          onClose={() => setOpen(null)}
          onSaved={(text, tone, id) => {
            setOpen(null);
            setActiveId(id);
            reload({ tone, text });
          }}
        />
      )}
      <Confirm
        open={open?.kind === "delete"}
        tone="danger"
        title={`Delete ${open?.kind === "delete" ? open.holiday.name : ""}?`}
        message="Attendance and leave stop counting its days as holidays."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (open?.kind !== "delete") return;
          const result = await deleteHolidayAction(open.holiday.id);
          if (!result.success) throw new Error(result.error);
          setOpen(null);
          setActiveId(null);
          reload({ tone: "success", text: `${result.data.name} deleted.` });
        }}
        onCancel={() => setOpen(null)}
      />
    </div>
  );
}

function HolidayWindow({ page, holiday, onClose, onSaved }: { page: HolidaysPage; holiday: HolidayRow | null; onClose: () => void; onSaved: (text: string, tone: NoticeTone, id: string) => void }) {
  // A branch role always chooses branches; with one branch it is chosen for them.
  const fresh: HolidayForm = page.companyWide ? NEW_HOLIDAY : { ...NEW_HOLIDAY, branchIds: page.branches.length === 1 ? [page.branches[0].id] : [] };
  const initial = holiday?.form ?? fresh;
  const [form, setForm] = useState<HolidayForm>(initial);
  const [allBranches, setAllBranches] = useState(page.companyWide && !initial.branchIds.length);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<HolidayFormErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const saveRef = useRef<HTMLButtonElement>(null);
  const errors: HolidayFormErrors = serverErrors ?? (tried ? validateHolidayFields(form) : {});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || allBranches !== (page.companyWide && !initial.branchIds.length);
  const days = isAdDate(form.from) && isAdDate(form.to) && form.to >= form.from ? daysInclusive(form.from, form.to) : 0;

  const set = <K extends keyof HolidayForm>(key: K, value: HolidayForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
    setFailure(null);
  };
  // The last day follows the first until it is set on its own.
  const setFrom = (iso: string) => {
    setForm((f) => ({ ...f, from: iso, to: !f.to || f.to === f.from || (iso && f.to < iso) ? iso : f.to }));
    setServerErrors(null);
    setFailure(null);
  };

  const save = () =>
    start(async () => {
      setTried(true);
      const send: HolidayForm = { ...form, to: form.to || form.from, branchIds: allBranches ? [] : form.branchIds };
      if (!holidayFormIsValid(validateHolidayFields(send))) return setFailure("Check the highlighted fields.");
      if (!allBranches && !send.branchIds.length) return setFailure("Tick at least one branch.");
      const result = await saveHolidayAction(holiday?.id ?? null, send);
      if (result.success) {
        const note = leaveNote(result.data.leaveInside);
        return onSaved(`${result.data.name} ${holiday ? "saved" : "added"}.${note}`, note ? "warning" : "success", result.data.id);
      }
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
    });

  const ticked = new Set(form.branchIds);
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="md"
      title={holiday ? holiday.name : "New holiday"}
      description="The days attendance and leave count as holidays, for the people they reach."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || (!!holiday && !dirty)}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {holiday ? "Save" : "Add holiday"}
          </WindowButton>
        </>
      }
    >
      <PropertyForm enterNavigation={{ end: () => saveRef.current }} onSubmit={save}>
        <FieldGroup title="The holiday">
          <FieldRow label="Name" required error={errors.name ?? null}>
            <input name="name" className={inputClass} value={form.name} maxLength={NAME_MAX} placeholder="e.g. Dashain" onChange={(e) => set("name", e.target.value)} />
          </FieldRow>
          <FieldRow label="Category" required help={HOLIDAY_CATEGORY[form.category]?.hint} error={errors.category ?? null}>
            <SelectField name="category" options={HOLIDAY_CATEGORIES.map((c) => ({ value: c, label: HOLIDAY_CATEGORY[c].label }))} value={form.category} onChange={(v) => set("category", v as HolidayForm["category"])} />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="Days">
          <FieldRow label="First day" required error={errors.from ?? null}>
            <DateField name="from" value={form.from} onChange={setFrom} />
          </FieldRow>
          <FieldRow label="Last day" required error={errors.to ?? null} help={days ? `${days} day${days === 1 ? "" : "s"} off.` : "The same as the first day for a one-day holiday."}>
            <DateField name="to" value={form.to} onChange={(v) => set("to", v)} />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="Who gets it">
          <FieldRow label="For" required error={errors.appliesTo ?? null} help={form.appliesTo === "women" ? "Women only: International Women's Day." : undefined}>
            <div className="flex flex-wrap gap-4 pt-1.5 text-xs text-ink">
              {(["everyone", "women"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="appliesTo" className="h-3.5 w-3.5 accent-brand" checked={form.appliesTo === v} onChange={() => set("appliesTo", v)} /> {APPLIES_TO_LABEL[v]}
                </label>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Branches" required error={errors.branchIds ?? null}>
            <div className="space-y-2 pt-1.5">
              {page.companyWide && (
                <div className="flex flex-wrap gap-4 text-xs text-ink">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="branches" className="h-3.5 w-3.5 accent-brand" checked={allBranches} onChange={() => setAllBranches(true)} /> All branches
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="branches" className="h-3.5 w-3.5 accent-brand" checked={!allBranches} onChange={() => setAllBranches(false)} /> Chosen branches
                  </label>
                </div>
              )}
              {!allBranches && (
                <div className="max-h-44 overflow-y-auto rounded-md border border-line bg-surface px-2 py-1">
                  {page.branches.map((b) => (
                    <label key={b.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-ink">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-brand"
                        checked={ticked.has(b.id)}
                        onChange={(e) => set("branchIds", e.target.checked ? [...form.branchIds, b.id] : form.branchIds.filter((x) => x !== b.id))}
                      />
                      <span className="truncate">{b.name}</span>
                    </label>
                  ))}
                  {form.branchIds
                    .filter((id) => !page.branches.some((b) => b.id === id))
                    .map((id) => (
                      <label key={id} className="flex cursor-pointer items-center gap-2 py-1 text-xs italic text-ink-faint">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked onChange={() => set("branchIds", form.branchIds.filter((x) => x !== id))} />
                        <span className="truncate">A branch outside your list</span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          </FieldRow>
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}
