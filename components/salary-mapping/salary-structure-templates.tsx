"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, TriangleAlert } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FormGrid, GridField, GridValue } from "@/components/kit/form-grid";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { deleteSalaryTemplateAction, saveSalaryTemplateAction, setSalaryTemplateActiveAction } from "@/app/actions/salary-structure.actions";
import { EMPTY_LINES, applyTemplate, estimatePay, needsStructure, setupLines, templateCoverage, templateFits } from "@/lib/engines/salary-structure.engine";
import type { SalaryStructureData, StructureLines, StructureRow, TemplateInput, TemplateRow } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";
import { SalaryBreakdown } from "./salary-breakdown";

const SCHEMES = [
  { value: "keep", label: "Keep each person's scheme" },
  { value: "ssf", label: "SSF" },
  { value: "pf", label: "Provident fund" },
  { value: "none", label: "None" },
];
const SCHEME_TEXT: Record<string, string> = { keep: "Keep", ssf: "SSF", pf: "PF", none: "None" };
const LIMITED = "Limited in Pay heads to some departments / designations: only those employees get it from this template.";

/**
 * Templates tab: standard structures (basic, scheme and pay heads) for levels
 * and / or designations. A template fills a structure once (Add new, Revise
 * salary, Bulk edit, or Apply to employees here); editing it later changes
 * nobody's salary until a change is sent and approved.
 */
export function SalaryStructureTemplates({ data, onApply }: { data: SalaryStructureData; onApply?: (templateId: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const canEdit = data.permissions.edit;
  const canDelete = data.permissions.delete;
  const desigName = (id: string) => data.designations.find((d) => d.id === id)?.name ?? "";
  const coverage = useMemo(() => templateCoverage(data.templates, data.rows), [data.templates, data.rows]);
  // Levels without a starting salary: "basic from level" keeps the person's basic there.
  const noScale = (t: TemplateRow) =>
    t.basicMode === "level_start" ? (t.levelCodes.length ? t.levelCodes : data.levels.map((l) => l.code)).filter((c) => !(data.levels.find((l) => l.code === c)?.minSalary ?? 0)) : [];

  const remove = async (t: TemplateRow) => {
    const result = await deleteSalaryTemplateAction(t.id);
    // Shown inside the confirmation window, which stays open.
    if (!result.success) throw new Error(result.error);
    setDeleting(null);
    setActiveId(null);
    setDone(`Template "${t.name}" deleted.`);
    router.refresh();
  };

  const toggleActive = async (t: TemplateRow) => {
    setFailure(null);
    setDone(null);
    const result = await setSalaryTemplateActiveAction(t.id, !t.isActive);
    if (!result.success) {
      setFailure(result.error);
      return;
    }
    router.refresh();
  };

  const columns = useMemo<GridColumn<TemplateRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", width: 90, value: (t) => t.code },
      { id: "name", header: "Template", width: 150, value: (t) => t.name, cell: (t) => <span className="font-medium text-ink">{t.name}</span> },
      { id: "fits", header: "Fits", width: 130, value: (t) => [t.levelCodes.join(", "), t.designationIds.map(desigName).join(", ")].filter(Boolean).join(" · ") || "Everyone" },
      {
        id: "employees",
        header: "Employees",
        width: 120,
        value: (t) => coverage.get(t.id)?.count ?? 0,
        cell: (t) => {
          const c = coverage.get(t.id);
          return (
            <span className="flex items-center gap-1.5 tabular-nums" title={c?.overlaps.length ? `Also fit by ${c.overlaps.join(", ")}. Add new picks the first by name.` : undefined}>
              {c?.count ?? 0}
              {c && c.overlaps.length > 0 && t.isActive && (
                <span className="inline-flex items-center gap-0.5 text-2xs text-warning">
                  <TriangleAlert aria-hidden className="h-3 w-3" /> overlaps
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: "basic",
        header: "Basic",
        width: 165,
        value: (t) => (t.basicMode === "level_start" ? "Level's starting salary" : t.basicAmount),
        cell: (t) => {
          if (t.basicMode !== "level_start") return <Amount value={t.basicAmount} />;
          const missing = noScale(t);
          return (
            <span className="text-ink-muted" title={missing.length ? `No starting salary set for ${missing.join(", ")} (Setup → Levels): their current basic is kept.` : undefined}>
              Level&apos;s starting salary{missing.length > 0 && <TriangleAlert aria-label="Some levels have no starting salary" className="ml-1 inline h-3 w-3 text-warning" />}
            </span>
          );
        },
      },
      { id: "scheme", header: "Scheme", width: 90, value: (t) => SCHEME_TEXT[t.scheme] ?? t.scheme },
      { id: "heads", header: "Pay heads", type: "number", width: 110, value: (t) => t.heads.length, defaultHidden: true },
      { id: "status", header: "Status", width: 100, value: (t) => (t.isActive ? "active" : "inactive"), cell: (t) => <StatusChip status={t.isActive ? "active" : "inactive"} /> },
      {
        id: "actions",
        header: "Actions",
        width: canDelete ? 290 : 240,
        sortable: false,
        hideable: false,
        value: () => "",
        cell: (t) =>
          canEdit || canDelete ? (
            <span className="flex gap-3 text-2xs font-medium">
              {canEdit && (
                <button type="button" tabIndex={-1} className="cursor-pointer text-brand-strong hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(t); }}>
                  Edit
                </button>
              )}
              {canEdit && onApply && t.isActive && (
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={!coverage.get(t.id)?.count}
                  title={coverage.get(t.id)?.count ? "Open Bulk edit with everyone it fits, the template applied" : "Nobody fits this template"}
                  className="cursor-pointer text-brand-strong hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply(t.id);
                  }}
                >
                  Apply to employees
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="cursor-pointer text-ink-muted hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleActive(t);
                  }}
                >
                  {t.isActive ? "Make inactive" : "Make active"}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="cursor-pointer text-danger hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFailure(null);
                    setDone(null);
                    setDeleting(t);
                  }}
                >
                  Delete
                </button>
              )}
            </span>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, canDelete, data.levels, data.designations, coverage, onApply]
  );

  return (
    <div className="p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="max-w-3xl text-xs text-ink-muted">
          A template is a standard salary for a level and / or designation: basic, retirement scheme, allowances and deductions. Add new and Bulk add start
          from the first one that fits; Revise salary and Bulk edit can apply one. It fills the salary once: editing a template changes nobody until you use
          Apply to employees and the change is approved. Grade counts are kept.
        </p>
        {canEdit && (
          <WindowButton variant="primary" onClick={() => setEditing("new")}>
            <Plus className="h-3.5 w-3.5" /> New template
          </WindowButton>
        )}
      </div>
      {failure && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {failure}
        </p>
      )}
      {done && (
        <p role="status" className="mb-3 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-xs text-ink">
          {done}
        </p>
      )}
      <DataGrid
        id="salary-templates"
        label="Salary templates"
        columns={columns}
        rows={data.templates}
        getRowId={(t) => t.id}
        activeRowId={activeId}
        onActiveRowChange={(t) => setActiveId(t.id)}
        onOpen={(t) => canEdit && setEditing(t)}
        empty={{ title: "No templates yet", description: "Create one for each level or designation that shares a standard salary." }}
      />
      <Confirm
        open={!!deleting}
        tone="danger"
        title={deleting ? `Delete template · ${deleting.name}` : "Delete template"}
        confirmLabel="Delete template"
        message={
          deleting && (
            <>
              <p>
                <strong>{deleting.name}</strong> ({deleting.code}) is removed for good. Salaries already filled from it do not change: each salary keeps its
                own amounts.
              </p>
              {(coverage.get(deleting.id)?.count ?? 0) > 0 && deleting.isActive && (
                <p className="mt-2">
                  It fits {coverage.get(deleting.id)!.count} employee{coverage.get(deleting.id)!.count === 1 ? "" : "s"} now, so Add new will no longer offer it
                  to them.
                </p>
              )}
              <p className="mt-2 text-ink-muted">To keep it for later, use Make inactive instead.</p>
            </>
          )
        }
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
        onCancel={() => setDeleting(null)}
      />
      {editing && (
        <TemplateWindow
          data={data}
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TemplateWindow({ data, template, onClose, onSaved }: { data: SalaryStructureData; template: TemplateRow | null; onClose: () => void; onSaved: () => void }) {
  const initial: TemplateInput = template ?? { code: "", name: "", levelCodes: [], designationIds: [], basicMode: "level_start", basicAmount: 0, scheme: "keep", heads: [] };
  const [form, setForm] = useState<TemplateInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const amountOf = (id: string) => form.heads.find((h) => h.payHeadId === id);
  const setHead = (id: string, amount: number | null) =>
    set("heads", amount === null ? form.heads.filter((h) => h.payHeadId !== id) : [...form.heads.filter((h) => h.payHeadId !== id), { payHeadId: id, amount }]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  // Limited: some department or designation is left out in Pay heads (every one ticked = everyone).
  const limited = (h: SalaryStructureData["heads"][number]) =>
    (h.appliesTo.departmentIds.length > 0 && data.departments.some((d) => !h.appliesTo.departmentIds.includes(d.id))) ||
    (h.appliesTo.designationIds.length > 0 && data.designations.some((d) => !h.appliesTo.designationIds.includes(d.id)));

  // Who it fits now, other active templates fitting the same people, levels without a starting salary.
  const fits = data.rows.filter((r) => templateFits(form, r));
  const asRow: TemplateRow = { ...form, id: template?.id ?? "(new)", isActive: true };
  const overlaps = templateCoverage([...data.templates.filter((t) => t.id !== template?.id && t.isActive), asRow], data.rows).get(asRow.id)?.overlaps ?? [];
  const noScale = form.basicMode === "level_start" ? (form.levelCodes.length ? form.levelCodes : data.levels.map((l) => l.code)).filter((c) => !(data.levels.find((l) => l.code === c)?.minSalary ?? 0)) : [];

  // Preview: the template on one employee it fits (as Add new / Revise would fill it).
  const previewRows = fits.length ? fits : data.rows;
  const preview: StructureRow | null = previewRows.find((r) => r.employeeId === previewId) ?? previewRows[0] ?? null;
  const previewLines = useMemo((): StructureLines | null => {
    if (!preview) return null;
    const levelStart = data.levels.find((l) => l.code === preview.levelCode)?.minSalary ?? 0;
    const start = preview.current?.lines ?? { ...EMPTY_LINES, basic: levelStart };
    return needsStructure(preview)
      ? setupLines(start, form, preview.ssfExpected, data.heads, data.gradePolicy, { levelStart: preview.current ? null : levelStart, employee: preview })
      : applyTemplate(form, start, data.heads, levelStart, data.gradePolicy, preview);
  }, [preview, form, data.levels, data.heads, data.gradePolicy]);
  const previewTotals = useMemo(
    () => (preview && previewLines ? estimatePay(previewLines, data.heads, preview.profile, data.tax, { ssfBase: data.ssfBase, pfPercent: data.pfPercent }) : null),
    [preview, previewLines, data.heads, data.tax, data.ssfBase, data.pfPercent]
  );

  const save = async () => {
    setSaving(true);
    const result = await saveSalaryTemplateAction(template?.id ?? null, form);
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors?.template ?? {});
      setFailure(result.error);
      return;
    }
    onSaved();
  };

  const headGroup = (title: string, list: SalaryStructureData["heads"]) =>
    list.length ? (
      <div key={title} className="contents">
        <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
        {list.map((h) =>
          h.kind === "computed" ? (
            <GridField key={h.id} label={h.name} size="md" help={limited(h) ? `${h.rule}. ${LIMITED}` : h.rule} suffix={<span className={limited(h) ? "text-warning" : "text-ink-faint"}>{limited(h) ? "limited" : h.rule}</span>}>
              <YesNoField name={`computed.${h.id}`} value={!!amountOf(h.id)} onChange={(v) => setHead(h.id, v ? 0 : null)} />
            </GridField>
          ) : (
            <GridField key={h.id} label={h.name} size="amount" help={limited(h) ? LIMITED : h.rule} suffix={limited(h) ? <span className="text-warning">limited</span> : undefined}>
              <NumberField name={`head.${h.id}`} prefix="NPR" value={amountOf(h.id)?.amount ?? 0} onChange={(v) => setHead(h.id, v > 0 ? v : null)} />
            </GridField>
          )
        )}
      </div>
    ) : null;
  const amountHeads = data.heads.filter((h) => h.kind === "amount" && !h.labelOnly);

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      size="full"
      title={template ? `Edit template · ${template.name}` : "New salary template"}
      description="Amounts are monthly. Heads left at 0 are not part of the template. Saving changes nobody's salary."
      footer={
        <>
          {failure ? (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          ) : (
            <span className="mr-auto text-2xs text-ink-muted">
              Fits {fits.length} employee{fits.length === 1 ? "" : "s"} now.
            </span>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save template
          </WindowButton>
        </>
      }
    >
      <div className="-mx-4 -my-4 grid @container lg:grid-cols-[minmax(0,1fr)_18rem]">
        <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="space-y-0 bg-surface-panel">
          <FormGrid columns={2}>
            <GridField label="Code" required error={errors.code} size="code">
              <input name="code" value={form.code} maxLength={20} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} className={cn(inputClass, "font-code")} />
            </GridField>
            <GridField label="Name" required error={errors.name} size="lg">
              <input name="name" value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Officer (S6) standard" className={inputClass} />
            </GridField>
            <GridField label="Basic from level" size="md" help="Yes: each person gets their level's starting salary (Setup → Levels). No: the amount here.">
              <YesNoField name="basicMode" value={form.basicMode === "level_start"} onChange={(v) => set("basicMode", v ? "level_start" : "amount")} />
            </GridField>
            {form.basicMode === "level_start" ? (
              <GridValue label="Basic salary">Each person&apos;s level starting salary</GridValue>
            ) : (
              <GridField label="Basic salary" required error={errors.basicAmount} size="amount">
                <NumberField name="basicAmount" prefix="NPR" value={form.basicAmount} onChange={(v) => set("basicAmount", v)} />
              </GridField>
            )}
            {noScale.length > 0 && (
              <div className="col-span-full px-3 pb-2">
                <Notice tone="warning" title="Some levels have no starting salary">
                  {noScale.join(", ")} {noScale.length === 1 ? "has" : "have"} no starting salary in Setup → Levels, so people there keep their current basic
                  (or start at 0 with no salary yet). Set the starting salaries, or give the template a basic amount.
                </Notice>
              </div>
            )}
            <GridField label="Retirement scheme" size="md" help="Keep: SSF where the company has it and the employment type is eligible, for someone with no structure yet; otherwise their current scheme.">
              <SelectField name="scheme" options={SCHEMES} value={form.scheme} onChange={(v) => set("scheme", v as TemplateInput["scheme"])} />
            </GridField>
            <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Fits (nothing ticked = everyone)</p>
            <GridField label="Levels" span={3} size="full">
              <div className="grid gap-x-4 gap-y-1 pt-1 @lg:grid-cols-2 @3xl:grid-cols-3">
                {data.levels.map((l) => (
                  <label key={l.code} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`level.${l.code}`} className="h-3.5 w-3.5 accent-brand" checked={form.levelCodes.includes(l.code)} onChange={() => set("levelCodes", toggle(form.levelCodes, l.code))} />
                    <span className="font-code text-2xs text-ink-muted">{l.code}</span>
                    <span className="truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </GridField>
            <GridField label="Designations" span={3} size="full">
              <div className="grid gap-x-4 gap-y-1 pt-1 @lg:grid-cols-2 @3xl:grid-cols-3">
                {data.designations.map((d) => (
                  <label key={d.id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`designation.${d.id}`} className="h-3.5 w-3.5 accent-brand" checked={form.designationIds.includes(d.id)} onChange={() => set("designationIds", toggle(form.designationIds, d.id))} />
                    <span className="truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </GridField>
            {overlaps.length > 0 && (
              <div className="col-span-full px-3 pb-2">
                <Notice tone="warning" title="Overlaps another template">
                  Some people it fits are also fit by {overlaps.join(", ")}. Add new and Bulk add use the first by name, so narrow the levels or designations
                  if that is not what you want.
                </Notice>
              </div>
            )}
            {errors.heads && <p className="col-span-full px-3 text-2xs text-danger">{errors.heads}</p>}
            {headGroup("Allowances (monthly)", amountHeads.filter((h) => h.type === "allowance"))}
            {headGroup("Deductions (monthly)", amountHeads.filter((h) => h.type !== "allowance"))}
            {headGroup("Worked out by payroll", data.heads.filter((h) => h.kind === "computed"))}
          </FormGrid>
        </PropertyForm>

        <aside aria-label="Preview" className="border-t border-line bg-surface px-4 py-4 lg:border-l lg:border-t-0">
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Preview</p>
          {preview && previewLines && previewTotals ? (
            <>
              <label className="mb-3 block text-2xs font-medium text-ink-label">
                {fits.length ? "For an employee it fits" : "Nobody fits yet; for"}
                <SelectField
                  name="previewFor"
                  options={previewRows.map((r) => ({ value: r.employeeId, label: `${r.fullName} (${r.employeeCode})` }))}
                  value={preview.employeeId}
                  onChange={setPreviewId}
                />
              </label>
              <SalaryBreakdown totals={previewTotals} lines={previewLines} heads={data.heads} compact />
              <p className="mt-2 text-3xs text-ink-faint">As Add new or Revise salary would fill it for this person (their grade kept); nothing is saved.</p>
            </>
          ) : (
            <p className="text-xs text-ink-muted">No employees to preview with.</p>
          )}
        </aside>
      </div>
    </Window>
  );
}
