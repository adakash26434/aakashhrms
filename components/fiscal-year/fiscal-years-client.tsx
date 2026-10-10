"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck2, CalendarPlus, Lock, LockOpen, Percent, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import {
  closeFiscalYearAction,
  createFiscalYearAction,
  deleteFiscalYearAction,
  fiscalYearsPageAction,
  makeFiscalYearCurrentAction,
  reopenFiscalYearAction,
} from "@/app/actions/fiscal-year.actions";
import { FISCAL_YEAR_STATE_LABEL, REOPEN_REASON_MIN, fiscalYearDates } from "@/lib/engines/fiscal-year.engine";
import { TAX_CATEGORIES, TAX_CATEGORY_LABEL } from "@/lib/types/tax-rate";
import type { FiscalYearRow, FiscalYearsPage, FiscalYearState } from "@/lib/types/fiscal-year";

// Fiscal years (4.12, template A): Shrawan to Asar, made from the opening BS year. One year is
// current; a year is closed once it has ended and its pay runs are locked, and reopened only with
// a reason. The server decides what is possible (row.blocked); the buttons follow it.

const STATE_TONE: Record<FiscalYearState, string> = { current: "active", upcoming: "pending", past: "inactive", closed: "locked" };

type Open = { kind: "new" } | { kind: "current" | "close" | "delete" | "reopen"; year: FiscalYearRow } | null;

export function FiscalYearsClient({ initial }: { initial: FiscalYearsPage }) {
  const [data, setData] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial.years.find((y) => y.state === "current")?.id ?? initial.years[0]?.id ?? null);
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const active = data.years.find((y) => y.id === activeId) ?? null;

  const reload = (message?: string) =>
    start(async () => {
      const result = await fiscalYearsPageAction();
      if (result.success) setData(result.data);
      if (message) setNotice({ tone: "success", text: message });
    });

  /** Runs a move; on failure the dialog shows why (Confirm keeps itself open on a throw). */
  const run = async (action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) => {
    const result = await action();
    if (!result.success) throw new Error(result.error);
    setOpen(null);
    reload(done);
  };

  const columns: GridColumn<FiscalYearRow>[] = useMemo(
    () => [
      { id: "label", header: "Fiscal year", width: 130, value: (y) => y.startAD, cell: (y) => <span className="font-medium">{y.label}</span> },
      { id: "start", header: "Starts", type: "date", width: 120, value: (y) => y.startAD, cell: (y) => <DateCell value={y.startAD} /> },
      { id: "end", header: "Ends", type: "date", width: 120, value: (y) => y.endAD, cell: (y) => <DateCell value={y.endAD} /> },
      { id: "state", header: "Status", type: "status", width: 110, value: (y) => FISCAL_YEAR_STATE_LABEL[y.state], cell: (y) => <StatusChip status={STATE_TONE[y.state]} label={FISCAL_YEAR_STATE_LABEL[y.state]} /> },
      {
        id: "slabs",
        header: "Tax slabs",
        width: 250,
        value: (y) => Object.values(y.slabs).reduce((n, c) => n + c, 0),
        cell: (y) =>
          Object.keys(y.slabs).length ? (
            <span className="text-ink-muted">{TAX_CATEGORIES.filter((c) => y.slabs[c]).map((c) => `${TAX_CATEGORY_LABEL[c].en} ${y.slabs[c]}`).join(" · ")}</span>
          ) : (
            <span className="text-warning">Not set</span>
          ),
      },
      { id: "use", header: "In use", width: 300, value: (y) => y.inUse.join(", "), cell: (y) => (y.inUse.length ? <span className="text-ink-muted">{y.inUse.join(" · ")}</span> : <span className="text-ink-faint">Nothing yet</span>) },
      { id: "open", header: "Pay runs not locked", type: "number", align: "right", width: 140, defaultHidden: true, value: (y) => y.openRuns },
    ],
    []
  );

  const can = data.can;
  const blocked = (key: keyof FiscalYearRow["blocked"]) => (!active ? "Choose a fiscal year" : active.blocked[key]);

  return (
    <div>
      <PageBar
        title="Fiscal years"
        description="Shrawan to Asar. Leave and reports start from the current year; a pay run goes to the year its month falls in"
        actions={[
          { id: "new", label: "New fiscal year", icon: CalendarPlus, group: "create", shortcut: "Ctrl+N", primary: true, hidden: !can.add, onClick: () => setOpen({ kind: "new" }) },
          { id: "current", label: "Make current", icon: CalendarCheck2, group: "selection", hidden: !can.edit, disabled: !!blocked("makeCurrent"), disabledReason: blocked("makeCurrent") ?? undefined, onClick: () => active && setOpen({ kind: "current", year: active }) },
          { id: "close", label: "Close year", icon: Lock, group: "selection", hidden: !can.lock, disabled: !!blocked("close"), disabledReason: blocked("close") ?? undefined, onClick: () => active && setOpen({ kind: "close", year: active }) },
          { id: "reopen", label: "Reopen", icon: LockOpen, group: "selection", hidden: !can.lock, disabled: !!blocked("reopen"), disabledReason: blocked("reopen") ?? undefined, onClick: () => active && setOpen({ kind: "reopen", year: active }) },
          { id: "delete", label: "Delete", icon: Trash2, group: "selection", hidden: !can.edit, disabled: !!blocked("delete"), disabledReason: blocked("delete") ?? undefined, onClick: () => active && setOpen({ kind: "delete", year: active }) },
          { id: "slabs", label: "Tax slabs", icon: Percent, group: "output", href: active ? `/setup/tax-rates?year=${active.id}` : "/setup/tax-rates" },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => reload() },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <Guide
        id="fiscal-years"
        title="How fiscal years work"
        className="mb-3"
        steps={[
          { title: "One year is current", text: "A fiscal year runs from Shrawan 1 to the end of Asar. Leave and reports start from the current year; make the next one current when it begins. A pay run always goes to the year its month falls in, so Asar's payroll run in Shrawan still belongs to the old year." },
          { title: "Tax slabs per year", text: "Each year has its own tax slabs. A new year can copy last year's; change them under Tax slabs when the budget changes." },
          { title: "Close when done", text: "After a year ends and its pay runs are locked, close it: its slabs stay as they were. Reopening needs a reason and is recorded." },
        ]}
      />
      <DataGrid
        id="fiscal-years"
        label="Fiscal years"
        columns={columns}
        rows={data.years}
        getRowId={(y) => y.id}
        activeRowId={activeId}
        onActiveRowChange={(y) => setActiveId(y.id)}
        pageSize={0}
        empty={{ title: "No fiscal years yet", description: can.add ? "Add the year the company starts in." : undefined }}
        maxHeight="none"
      />

      {open?.kind === "new" && <NewYearWindow page={data} onClose={() => setOpen(null)} onCreated={(label) => (setOpen(null), reload(`${label} added.`))} />}
      {open?.kind === "reopen" && <ReopenWindow year={open.year} onClose={() => setOpen(null)} onDone={() => (setOpen(null), reload(`${open.year.label} reopened.`))} />}
      <Confirm
        open={open?.kind === "current"}
        title={`Make ${open && open.kind !== "new" ? open.year.label : ""} current?`}
        message="Leave and reports start from the current year. The year current until now stays open: its Asar payroll can still be run, and you close it once its pay runs are locked."
        confirmLabel="Make current"
        onConfirm={() => (open && open.kind === "current" ? run(() => makeFiscalYearCurrentAction(open.year.id), `${open.year.label} is the current fiscal year.`) : undefined)}
        onCancel={() => setOpen(null)}
      />
      <Confirm
        open={open?.kind === "close"}
        title={`Close ${open && open.kind !== "new" ? open.year.label : ""}?`}
        message="Its tax slabs stay as they are and the year can't be deleted. Reopening it later needs a reason."
        confirmLabel="Close year"
        onConfirm={() => (open && open.kind === "close" ? run(() => closeFiscalYearAction(open.year.id), `${open.year.label} closed.`) : undefined)}
        onCancel={() => setOpen(null)}
      />
      <Confirm
        open={open?.kind === "delete"}
        tone="danger"
        title={`Delete ${open && open.kind !== "new" ? open.year.label : ""}?`}
        message="Nothing uses this year yet. Its tax slabs are deleted with it."
        confirmLabel="Delete"
        onConfirm={() => (open && open.kind === "delete" ? run(() => deleteFiscalYearAction(open.year.id), `${open.year.label} deleted.`) : undefined)}
        onCancel={() => setOpen(null)}
      />
      {!can.add && !can.edit && !can.lock && (
        <p className="mt-3 text-xs text-ink-muted">
          Changing fiscal years needs Fiscal year → Add, Edit or Lock with a company-wide role. Tax slabs are under <Link href="/setup/tax-rates" className="underline underline-offset-2">Tax slabs</Link>.
        </p>
      )}
    </div>
  );
}

function NewYearWindow({ page, onClose, onCreated }: { page: FiscalYearsPage; onClose: () => void; onCreated: (label: string) => void }) {
  const withSlabs = page.years.filter((y) => Object.keys(y.slabs).length);
  const [bsYear, setBsYear] = useState(page.nextYear);
  const [copyFrom, setCopyFrom] = useState(withSlabs.find((y) => y.state === "current")?.id ?? withSlabs[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dates = fiscalYearDates(bsYear);
  const exists = page.years.some((y) => y.startBS.startsWith(`${bsYear}-`));

  const create = () =>
    start(async () => {
      setError(null);
      const result = await createFiscalYearAction({ bsYear, copySlabsFrom: copyFrom || null });
      if (result.success) onCreated(result.data.label);
      else setError(result.error);
    });

  return (
    <Window
      open
      onClose={onClose}
      title="New fiscal year"
      description="Made from the year it opens in: Shrawan 1 to the end of Asar"
      size="md"
      dirty={bsYear !== page.nextYear}
      footer={
        <>
          <WindowCancel />
          <WindowButton variant="primary" onClick={create} disabled={pending || !dates || exists}>
            {pending ? "Adding…" : "Add fiscal year"}
          </WindowButton>
        </>
      }
    >
      {error && (
        <Notice tone="danger" className="mb-3">
          {error}
        </Notice>
      )}
      <PropertyForm onSubmit={create}>
        <FieldGroup title="Year">
          <FieldRow label="Opens in (BS year)" required error={!dates ? "A BS year between 2000 and 2098." : exists ? "This fiscal year already exists." : null} help={dates ? `${dates.label}: Shrawan 1, ${bsYear} to Asar ${dates.endBS.slice(8)}, ${bsYear + 1} BS (${dates.startAD} to ${dates.endAD})` : undefined}>
            <NumberField value={bsYear} onChange={setBsYear} decimals={0} min={2000} max={2098} selectOnFocus />
          </FieldRow>
          <FieldRow label="Tax slabs" help="A copy to start from; change it under Tax slabs when the budget changes.">
            <SelectField options={withSlabs.map((y) => ({ value: y.id, label: `Copy from ${y.label}` }))} value={copyFrom} onChange={setCopyFrom} allowEmpty placeholder="None — set them later" />
          </FieldRow>
        </FieldGroup>
      </PropertyForm>
      <p className="mt-3 text-xs text-ink-muted">The new year is not current yet: make it current when it begins.</p>
    </Window>
  );
}

function ReopenWindow({ year, onClose, onDone }: { year: FiscalYearRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const short = reason.trim().length < REOPEN_REASON_MIN;
  const reopen = () =>
    start(async () => {
      setError(null);
      const result = await reopenFiscalYearAction(year.id, reason);
      if (result.success) onDone();
      else setError(result.error);
    });
  return (
    <Window
      open
      onClose={onClose}
      title={`Reopen ${year.label}`}
      description="Its tax slabs can be changed again. The reason is kept in the audit log."
      size="md"
      dirty={reason.trim().length > 0}
      footer={
        <>
          <WindowCancel />
          <WindowButton variant="primary" onClick={reopen} disabled={pending || short}>
            {pending ? "Reopening…" : "Reopen year"}
          </WindowButton>
        </>
      }
    >
      {error && (
        <Notice tone="danger" className="mb-3">
          {error}
        </Notice>
      )}
      <PropertyForm>
        <FieldGroup title="Why">
          <FieldRow label="Reason" required help={`At least ${REOPEN_REASON_MIN} characters, e.g. the IRD notice that changed the year's slabs.`}>
            <textarea className={`${inputClass} h-24 py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </FieldRow>
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}
