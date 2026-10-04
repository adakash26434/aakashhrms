"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FormGrid, GridField, GridValue } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { saveSalaryTemplateAction, setSalaryTemplateActiveAction } from "@/app/actions/salary-structure.actions";
import type { SalaryStructureData, TemplateInput, TemplateRow } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

const SCHEMES = [
  { value: "keep", label: "Keep each person's scheme" },
  { value: "ssf", label: "SSF" },
  { value: "pf", label: "Provident fund" },
  { value: "none", label: "None" },
];

/** Templates tab: standard structures (basic + pay heads) for levels or designations, applied in Bulk edit. */
export function SalaryStructureTemplates({ data }: { data: SalaryStructureData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const canEdit = data.permissions.edit;
  const levelName = (code: string) => data.levels.find((l) => l.code === code)?.code ?? code;
  const desigName = (id: string) => data.designations.find((d) => d.id === id)?.name ?? "";

  const columns = useMemo<GridColumn<TemplateRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", width: 100, value: (t) => t.code },
      { id: "name", header: "Template", width: 200, value: (t) => t.name, cell: (t) => <span className="font-medium text-ink">{t.name}</span> },
      { id: "fits", header: "Fits", width: 240, value: (t) => [t.levelCodes.map(levelName).join(", "), t.designationIds.map(desigName).join(", ")].filter(Boolean).join(" · ") || "Everyone" },
      { id: "basic", header: "Basic", width: 150, value: (t) => (t.basicMode === "level_start" ? "Level's starting salary" : t.basicAmount), cell: (t) => (t.basicMode === "level_start" ? <span className="text-ink-muted">Level&apos;s starting salary</span> : <Amount value={t.basicAmount} />) },
      { id: "heads", header: "Pay heads", type: "number", width: 90, value: (t) => t.heads.length },
      { id: "status", header: "Status", width: 90, value: (t) => (t.isActive ? "active" : "inactive"), cell: (t) => <StatusChip status={t.isActive ? "active" : "inactive"} /> },
      {
        id: "actions",
        header: "Actions",
        width: 140,
        sortable: false,
        hideable: false,
        value: () => "",
        cell: (t) =>
          canEdit ? (
            <span className="flex gap-2 text-2xs font-medium">
              <button type="button" tabIndex={-1} className="cursor-pointer text-brand-strong hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(t); }}>
                Edit
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="cursor-pointer text-ink-muted hover:underline"
                onClick={async (e) => {
                  e.stopPropagation();
                  await setSalaryTemplateActiveAction(t.id, !t.isActive);
                  router.refresh();
                }}
              >
                {t.isActive ? "Make inactive" : "Make active"}
              </button>
            </span>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, data.levels, data.designations]
  );

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">A template fills the Bulk edit table for the employees it fits (by level and / or designation). Grade counts are kept.</p>
        {canEdit && (
          <WindowButton variant="primary" onClick={() => setEditing("new")}>
            <Plus className="h-3.5 w-3.5" /> New template
          </WindowButton>
        )}
      </div>
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
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const amountOf = (id: string) => form.heads.find((h) => h.payHeadId === id);
  const setHead = (id: string, amount: number | null) =>
    set("heads", amount === null ? form.heads.filter((h) => h.payHeadId !== id) : [...form.heads.filter((h) => h.payHeadId !== id), { payHeadId: id, amount }]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      size="xl"
      title={template ? `Edit template · ${template.name}` : "New salary template"}
      description="Amounts are monthly. Heads left at 0 are not part of the template."
      footer={
        <>
          <WindowButton onClick={onClose} disabled={saving}>
            Cancel
          </WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save template
          </WindowButton>
        </>
      }
    >
      {failure && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
          {failure}
        </p>
      )}
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Code" required error={errors.code} size="code">
            <input name="code" value={form.code} maxLength={20} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} className={cn(inputClass, "font-code")} />
          </GridField>
          <GridField label="Name" required error={errors.name} size="lg">
            <input name="name" value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Officer (S6) standard" className={inputClass} />
          </GridField>
          <GridField label="Basic from level" size="md" help="Yes: each person gets their level's starting salary. No: the amount below.">
            <YesNoField name="basicMode" value={form.basicMode === "level_start"} onChange={(v) => set("basicMode", v ? "level_start" : "amount")} />
          </GridField>
          {form.basicMode === "level_start" ? (
            <GridValue label="Basic salary">Each person&apos;s level starting salary</GridValue>
          ) : (
            <GridField label="Basic salary" required error={errors.basicAmount} size="amount">
              <NumberField name="basicAmount" prefix="NPR" value={form.basicAmount} onChange={(v) => set("basicAmount", v)} />
            </GridField>
          )}
          <GridField label="Retirement scheme" size="md">
            <SelectField name="scheme" options={SCHEMES} value={form.scheme} onChange={(v) => set("scheme", v as TemplateInput["scheme"])} />
          </GridField>
          <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Fits (nothing ticked = everyone)</p>
          <GridField label="Levels" span={3} size="full">
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              {data.levels.map((l) => (
                <label key={l.code} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                  <input type="checkbox" name={`level.${l.code}`} className="h-3.5 w-3.5 accent-brand" checked={form.levelCodes.includes(l.code)} onChange={() => set("levelCodes", toggle(form.levelCodes, l.code))} />
                  {l.code}
                </label>
              ))}
            </div>
          </GridField>
          <GridField label="Designations" span={3} size="full">
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              {data.designations.map((d) => (
                <label key={d.id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                  <input type="checkbox" name={`designation.${d.id}`} className="h-3.5 w-3.5 accent-brand" checked={form.designationIds.includes(d.id)} onChange={() => set("designationIds", toggle(form.designationIds, d.id))} />
                  {d.name}
                </label>
              ))}
            </div>
          </GridField>
          <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Pay heads {errors.heads && <span className="normal-case text-danger">· {errors.heads}</span>}</p>
          {data.heads
            .filter((h) => h.kind === "amount" && !h.labelOnly)
            .map((h) => (
              <GridField key={h.id} label={h.name} size="amount" help={h.rule}>
                <NumberField name={`head.${h.id}`} prefix="NPR" value={amountOf(h.id)?.amount ?? 0} onChange={(v) => setHead(h.id, v > 0 ? v : null)} />
              </GridField>
            ))}
          {data.heads
            .filter((h) => h.kind === "computed")
            .map((h) => (
              <GridField key={h.id} label={h.name} size="md" help={h.rule} suffix={<span className="text-ink-faint">{h.rule}</span>}>
                <YesNoField name={`computed.${h.id}`} value={!!amountOf(h.id)} onChange={(v) => setHead(h.id, v ? 0 : null)} />
              </GridField>
            ))}
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}
