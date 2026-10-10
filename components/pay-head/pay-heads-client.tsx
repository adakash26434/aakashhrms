"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Lock, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { deletePayHeadAction, payHeadsPageAction, savePayHeadAction } from "@/app/actions/pay-head.actions";
import { NEW_PAY_HEAD, PAY_HEAD_ROLES, calcLabel, calcNeedsPercent, payHeadFormIsValid, roleDef, validatePayHeadFields } from "@/lib/engines/pay-head.engine";
import type { PayHeadForm, PayHeadFormErrors, PayHeadRow, PayHeadsPage } from "@/lib/types/pay-head";
import { cn } from "@/lib/utils";

// Pay heads (4.12b, template A + Window): every allowance and deduction, what it is, how its
// amount is worked out and who it is for. What a head is sets its type and the flag payroll reads;
// statutory and feed heads keep their role and sums (only their names change). The server checks
// everything again and decides what can be deleted.

type Open = { kind: "new" } | { kind: "edit" | "delete"; head: PayHeadRow } | null;

export function PayHeadsClient({ initial }: { initial: PayHeadsPage }) {
  const [data, setData] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial.heads[0]?.id ?? null);
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [pending, start] = useTransition();
  const active = data.heads.find((h) => h.id === activeId) ?? null;
  const can = data.can;

  const reload = (message?: string) =>
    start(async () => {
      const result = await payHeadsPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setData(result.data);
      if (message) setNotice({ tone: "success", text: message });
    });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.heads.filter(
      (h) =>
        (!filters.type || h.type === filters.type) &&
        (!filters.role || h.role === filters.role) &&
        (!q || `${h.name} ${h.nameNp ?? ""} ${h.code}`.toLowerCase().includes(q))
    );
  }, [data.heads, filters, search]);

  // Sized to fit beside the navigator at 1440 px; "What it is" carries the type as + / −.
  const columns: GridColumn<PayHeadRow>[] = useMemo(
    () => [
      { id: "code", header: "Code", type: "code", width: 110, value: (h) => h.code },
      {
        id: "name",
        header: "Pay head",
        width: 210,
        value: (h) => h.name,
        cell: (h) => (
          <span className="min-w-0">
            <span className="block truncate font-medium">{h.name}</span>
            {h.nameNp && <span className="block truncate text-2xs text-ink-faint">{h.nameNp}</span>}
          </span>
        ),
      },
      {
        id: "role",
        header: "What it is",
        width: 200,
        value: (h) => h.roleLabel,
        cell: (h) => (
          <span className="inline-flex min-w-0 items-center gap-1.5" title={h.system ?? undefined}>
            <span aria-hidden className={cn("w-2.5 shrink-0 text-center font-semibold", h.type === "allowance" ? "text-success" : "text-danger")}>
              {h.type === "allowance" ? "+" : "−"}
            </span>
            <span className="sr-only">{h.type === "allowance" ? "Adds to pay:" : "Takes from pay:"}</span>
            {h.system && <Lock aria-label="System head" className="h-3 w-3 shrink-0 text-ink-faint" />}
            <span className="truncate">{h.roleLabel}</span>
          </span>
        ),
      },
      { id: "calc", header: "Amount", width: 180, value: (h) => h.calc, cell: (h) => <span className="block truncate text-ink-muted" title={h.calc}>{h.calc}</span> },
      { id: "tax", header: "Taxable", width: 100, value: (h) => (h.type === "allowance" ? (h.taxable ? "Yes" : "No") : ""), cell: (h) => (h.type === "allowance" ? (h.taxable ? "Yes" : "No") : <span className="text-ink-faint">–</span>) },
      { id: "for", header: "For", width: 170, value: (h) => h.appliesTo, cell: (h) => <span className={cn("block truncate", h.appliesTo === "Everyone" ? "text-ink-muted" : h.appliesTo.startsWith("No one") ? "text-warning" : "text-ink")} title={h.appliesTo}>{h.appliesTo}</span> },
      {
        id: "use",
        header: "In use",
        width: 130,
        value: (h) => h.usage.structures + h.usage.payslips + h.usage.templates,
        cell: (h) => {
          const parts = [
            h.usage.structures ? `${h.usage.structures} salary structure${h.usage.structures === 1 ? "" : "s"}` : "",
            h.usage.payslips ? `${h.usage.payslips} payslip line${h.usage.payslips === 1 ? "" : "s"}` : "",
            h.usage.templates ? `${h.usage.templates} template${h.usage.templates === 1 ? "" : "s"}` : "",
          ].filter(Boolean);
          return parts.length ? <span className="block truncate text-ink-muted" title={parts.join(" · ")}>{parts.join(" · ")}</span> : <span className="text-ink-faint">Not used</span>;
        },
      },
    ],
    []
  );

  const noActive = "Choose a pay head";
  return (
    <div>
      <PageBar
        title="Pay heads"
        description="Every allowance and deduction: what it is, how its amount is worked out and who it is for"
        actions={[
          { id: "new", label: "New pay head", icon: Plus, group: "create", shortcut: "Ctrl+N", primary: true, hidden: !can.add, onClick: () => setOpen({ kind: "new" }) },
          { id: "edit", label: "Edit", icon: Pencil, group: "selection", shortcut: "F2", hidden: !can.edit, disabled: !active, disabledReason: active ? undefined : noActive, onClick: () => active && setOpen({ kind: "edit", head: active }) },
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            group: "selection",
            hidden: !can.delete,
            disabled: !active || !!active.cannotDelete,
            disabledReason: !active ? noActive : active.cannotDelete ?? undefined,
            onClick: () => active && setOpen({ kind: "delete", head: active }),
          },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => reload() },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <Guide
        id="pay-heads"
        title="How pay heads work"
        className="mb-3"
        steps={[
          { title: "What it is", text: "An ordinary allowance or deduction, the festival or remote-area allowance, or a line worked out from attendance. It sets whether it adds to or takes from pay." },
          { title: "How much", text: "An amount typed for each employee in Salary structure, or a share of basic (or basic + grade) worked out every month." },
          { title: "Who it is for", text: "Everyone, or chosen departments and designations: Salary structure offers it only to them." },
          { title: "System heads", text: "Tax, PF, SSF, CIT and the lines other modules pay (TA-DA, arrears, reimbursements…) are worked out by payroll: only their names change." },
        ]}
      />
      <FilterStrip
        id="pay-heads"
        className="mb-3"
        filters={[
          { id: "type", label: "Type", allLabel: "All types", options: [{ value: "allowance", label: "Allowances" }, { value: "deduction", label: "Deductions" }] },
          { id: "role", label: "What it is", allLabel: "All kinds", options: PAY_HEAD_ROLES.filter((r) => data.heads.some((h) => h.role === r.value)).map((r) => ({ value: r.value, label: r.label })) },
        ]}
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Search pay heads" }}
      />
      <DataGrid
        id="pay-heads"
        label="Pay heads"
        columns={columns}
        rows={rows}
        getRowId={(h) => h.id}
        activeRowId={activeId}
        onActiveRowChange={(h) => setActiveId(h.id)}
        onOpen={can.edit ? (h) => setOpen({ kind: "edit", head: h }) : undefined}
        pageSize={0}
        empty={{ title: search || filters.type || filters.role ? "No pay head matches" : "No pay heads yet", description: can.add ? "Add the allowances and deductions the company pays." : undefined }}
        maxHeight="none"
      />
      {!can.add && !can.edit && !can.delete && <p className="mt-3 text-xs text-ink-muted">Changing pay heads needs Pay heads → Add, Edit or Delete with a company-wide role.</p>}

      {(open?.kind === "new" || open?.kind === "edit") && (
        <PayHeadWindow
          key={open.kind === "edit" ? open.head.id : "new"}
          page={data}
          head={open.kind === "edit" ? open.head : null}
          onClose={() => setOpen(null)}
          onSaved={(text, id) => {
            setOpen(null);
            if (id) setActiveId(id);
            reload(text);
          }}
        />
      )}
      <Confirm
        open={open?.kind === "delete"}
        tone="danger"
        title={`Delete ${open?.kind === "delete" ? open.head.name : ""}?`}
        message="Nothing uses it: no salary structure, template or payslip. It can't be brought back."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (open?.kind !== "delete") return;
          const result = await deletePayHeadAction(open.head.id);
          if (!result.success) throw new Error(result.error);
          const name = open.head.name;
          setOpen(null);
          reload(`${name} deleted.`);
        }}
        onCancel={() => setOpen(null)}
      />
    </div>
  );
}

/** A tick list for the departments or designations a head is for (none ticked: all). Deleted ones still ticked are listed so they can be unticked. */
function ChoiceList({ label, gone, options, value, onChange }: { label: string; gone: string; options: { id: string; name: string }[]; value: string[]; onChange: (next: string[]) => void }) {
  const set = new Set(value);
  const known = new Set(options.map((o) => o.id));
  const rows = [...options, ...value.filter((id) => !known.has(id)).map((id) => ({ id, name: gone }))];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-ink-muted">
        {label} <span className="font-normal text-ink-faint">· {value.length ? `${value.length} chosen` : "all"}</span>
      </legend>
      <div className="max-h-44 overflow-y-auto rounded-md border border-line bg-surface px-2 py-1">
        {rows.length ? (
          rows.map((o) => (
            <label key={o.id} className={cn("flex cursor-pointer items-center gap-2 py-1 text-xs", known.has(o.id) ? "text-ink" : "text-ink-faint italic")}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand"
                checked={set.has(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))}
              />
              <span className="truncate">{o.name}</span>
            </label>
          ))
        ) : (
          <p className="py-1 text-2xs text-ink-faint">None set up yet.</p>
        )}
      </div>
    </fieldset>
  );
}

function PayHeadWindow({ page, head, onClose, onSaved }: { page: PayHeadsPage; head: PayHeadRow | null; onClose: () => void; onSaved: (text: string, id?: string) => void }) {
  const initial = head?.form ?? NEW_PAY_HEAD;
  const [form, setForm] = useState<PayHeadForm>(initial);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<PayHeadFormErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [everyone, setEveryone] = useState(!initial.departmentIds.length && !initial.designationIds.length);
  const [saving, start] = useTransition();
  const system = head?.system ?? null;
  const def = roleDef(form.role);
  const otherNames = page.heads.filter((h) => h.id !== head?.id).map((h) => h.name);
  const errors: PayHeadFormErrors = serverErrors ?? (tried ? validatePayHeadFields(form, otherNames) : {});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  // A new head takes a role a company may add; an existing one may also keep its own.
  const roles = PAY_HEAD_ROLES.filter((r) => r.creatable || r.value === head?.role);

  const set = <K extends keyof PayHeadForm>(key: K, value: PayHeadForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
    setFailure(null);
  };
  const setRole = (role: PayHeadForm["role"]) => {
    const next = roleDef(role);
    setForm((f) => ({ ...f, role, calc: next.calcs.includes(f.calc) ? f.calc : next.calcs[0] ?? "typed", taxable: next.type === "allowance" ? f.taxable : false }));
    setServerErrors(null);
  };

  const save = () =>
    start(async () => {
      setTried(true);
      const send = everyone ? { ...form, departmentIds: [], designationIds: [] } : form;
      if (!payHeadFormIsValid(validatePayHeadFields(send, otherNames))) return setFailure("Check the highlighted fields.");
      if (!everyone && !send.departmentIds.length && !send.designationIds.length) return setFailure("Tick at least one department or designation, or choose Everyone.");
      const result = await savePayHeadAction(head?.id ?? null, send);
      if (result.success) return onSaved(head ? `${result.data.name} saved.` : `${result.data.name} added (${result.data.code}).`, result.data.id);
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
    });

  const needsPercent = def.calcs.length > 0 && calcNeedsPercent(form.role, form.calc);
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty || everyone !== (!initial.departmentIds.length && !initial.designationIds.length)}
      size="lg"
      title={head ? `${head.name} (${head.code})` : "New pay head"}
      description={system ?? "What it is sets whether it adds to or takes from pay, and what payroll does with it."}
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={save} disabled={saving || (!!head && !dirty && everyone === (!initial.departmentIds.length && !initial.designationIds.length))}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {head ? "Save" : "Add pay head"}
          </WindowButton>
        </>
      }
    >
      <PropertyForm enterNavigation onSubmit={save}>
        <FieldGroup title="The pay head">
          <FieldRow label="Name" required error={errors.name ?? null}>
            <input name="name" className={inputClass} value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
          </FieldRow>
          <FieldRow label="Nepali name" help="Printed on the Nepali payslip; the English name when empty." error={errors.nameNp ?? null}>
            <input name="nameNp" className={inputClass} value={form.nameNp} maxLength={60} onChange={(e) => set("nameNp", e.target.value)} lang="ne" />
          </FieldRow>
          <FieldRow label="What it is" required help={system ? undefined : def.hint} error={errors.role ?? null}>
            {system ? (
              <p className="flex items-center gap-1.5 pt-1.5 text-sm text-ink">
                <Lock className="h-3.5 w-3.5 text-ink-faint" /> {def.label}
              </p>
            ) : (
              <SelectField name="role" options={roles.map((r) => ({ value: r.value, label: r.label, hint: r.type === "allowance" ? "adds to pay" : "takes from pay" }))} value={form.role} onChange={(v) => setRole(v as PayHeadForm["role"])} />
            )}
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="Amount">
          {def.calcs.length && !system ? (
            <>
              <FieldRow label="Worked out as" required error={errors.calc ?? null}>
                <SelectField name="calc" options={def.calcs.map((c) => ({ value: c, label: calcLabel(form.role, c) }))} value={form.calc} onChange={(v) => set("calc", v as PayHeadForm["calc"])} />
              </FieldRow>
              {needsPercent && (
                <FieldRow label="Percentage" required error={errors.percent ?? null} help={`Each month: ${form.percent || "…"}% of ${form.calc === "basic" ? "basic salary" : "basic + grade"}.`}>
                  <NumberField name="percent" value={form.percent} onChange={(n) => set("percent", n)} decimals={2} max={100} selectOnFocus className="max-w-32" />
                </FieldRow>
              )}
            </>
          ) : (
            <p className="px-4 py-3 text-xs text-ink-muted">{head?.calc ?? def.hint}</p>
          )}
          {def.type === "allowance" && (
            <FieldRow label="Taxable income" help={system ? undefined : "Allowances are taxable unless the law exempts them, such as reimbursed actual costs."}>
              {system ? <p className="pt-1.5 text-sm text-ink">{form.taxable ? "Yes" : "No"}</p> : <YesNoField name="taxable" value={form.taxable} onChange={(v) => set("taxable", v)} />}
            </FieldRow>
          )}
        </FieldGroup>
        <FieldGroup title="Who it is for" description="Salary structure offers the head only to these employees.">
          {system ? (
            <p className="px-4 py-3 text-xs text-ink-muted">{head?.appliesTo ?? "Everyone"}</p>
          ) : (
            <div className="space-y-3 px-4 py-3">
              <div className="flex flex-wrap gap-4 text-xs text-ink">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="for" className="h-3.5 w-3.5 accent-brand" checked={everyone} onChange={() => setEveryone(true)} /> Everyone
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="for" className="h-3.5 w-3.5 accent-brand" checked={!everyone} onChange={() => setEveryone(false)} /> Chosen departments and designations
                </label>
              </div>
              {!everyone && (
                <div className="grid gap-3 md:grid-cols-2">
                  <ChoiceList label="Departments" gone="A deleted department" options={page.departments} value={form.departmentIds} onChange={(v) => set("departmentIds", v)} />
                  <ChoiceList label="Designations" gone="A deleted designation" options={page.designations} value={form.designationIds} onChange={(v) => set("designationIds", v)} />
                  {(errors.departmentIds || errors.designationIds) && <p className="text-2xs text-danger md:col-span-2">{errors.departmentIds ?? errors.designationIds}</p>}
                  <p className="text-2xs text-ink-faint md:col-span-2">None ticked in a list means all of them.</p>
                </div>
              )}
            </div>
          )}
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}
