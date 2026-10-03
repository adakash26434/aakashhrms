"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { NumberField } from "@/components/kit/number-field";
import { SelectField } from "@/components/kit/select-field";
import { WindowButton } from "@/components/kit/window";
import { loadLevelPresetAction } from "@/app/actions/organization.actions";
import type { LevelInput, OrgLevel, OrganizationData } from "@/lib/types/organization";
import { Row, TextInput, type FieldsProps } from "./organization-window";

export type LevelForm = LevelInput;

export function levelForm(l: OrgLevel | undefined, data: OrganizationData): LevelForm {
  const next = data.levels.reduce((n, x) => Math.max(n, x.levelNumber), 0) + 1;
  return {
    code: l?.code ?? "",
    name: l?.name ?? "",
    levelNumber: l?.levelNumber ?? next,
    labelNepali: l?.labelNepali ?? "",
    description: l?.description ?? "",
    minSalary: l?.minSalary ?? 0,
    maxSalary: l?.maxSalary ?? 0,
    rankOrder: l?.rankOrder ?? next,
  };
}

/** Grade level (Shreni / तह): the pay scale step; its starting salary seeds a new employee's basic. */
export function LevelFields({ form, set, errors, data, id, onDone }: FieldsProps<LevelForm>) {
  const record = data.levels.find((l) => l.id === id);
  const [preset, setPreset] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  const loadPreset = async () => {
    setConfirming(false);
    setLoading(true);
    const result = await loadLevelPresetAction(preset);
    setLoading(false);
    if (!result.success) {
      setPresetError(result.error);
      return;
    }
    onDone();
  };

  return (
    <>
      {record && record.usage.employees > 0 && (
        <p className="col-span-full rounded-md border border-info/25 bg-info-subtle px-2.5 py-1.5 text-xs text-info md:col-span-2">
          {record.usage.employees} employee{record.usage.employees === 1 ? " holds" : "s hold"} this level. Changing its code or name updates them too.
        </p>
      )}
      <Row label="Code" required error={errors.code} size="code" help="e.g. S6 or L-6. Employees hold the level by this code.">
        <TextInput name="code" value={form.code} onChange={(v) => set("code", v)} code upper maxLength={20} />
      </Row>
      <Row label="Level number" required error={errors.levelNumber} size="xs" help="1 = lowest step.">
        <NumberField name="levelNumber" decimals={0} value={form.levelNumber} onChange={(v) => set("levelNumber", v)} />
      </Row>
      <Row label="Name" required error={errors.name} size="lg">
        <TextInput name="name" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Officer Level 6" />
      </Row>
      <Row label="Nepali label" error={errors.labelNepali} size="lg">
        <TextInput name="labelNepali" value={form.labelNepali} onChange={(v) => set("labelNepali", v)} placeholder="e.g. तह ६ (अधिकृत)" />
      </Row>
      <Row label="Starting salary" error={errors.minSalary} size="amount" help="Filled in as a new employee's basic salary when this level is chosen.">
        <NumberField name="minSalary" prefix="NPR" value={form.minSalary} onChange={(v) => set("minSalary", v)} />
      </Row>
      <Row label="Maximum salary" error={errors.maxSalary} size="amount" help="Top of the scale (0 = not set).">
        <NumberField name="maxSalary" prefix="NPR" value={form.maxSalary} onChange={(v) => set("maxSalary", v)} />
      </Row>
      <Row label="Sort order" error={errors.rankOrder} size="xs" help="Order in lists (lowest first).">
        <NumberField name="rankOrder" decimals={0} value={form.rankOrder} onChange={(v) => set("rankOrder", v)} />
      </Row>
      <Row label="Description" error={errors.description} size="lg">
        <TextInput name="description" value={form.description} onChange={(v) => set("description", v)} maxLength={500} placeholder="Optional" />
      </Row>

      {!id && (
        <div className="col-span-full border-t border-line pt-3 md:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-ink-label">Or load a whole industry scale</p>
          <div className="flex flex-wrap items-center gap-2" data-enter-skip>
            <SelectField
              name="preset"
              options={data.levelPresets.map((p) => ({ value: p.key, label: p.label }))}
              value={preset}
              onChange={setPreset}
              placeholder="Choose a scale…"
              className="max-w-sm"
            />
            <WindowButton onClick={() => preset && setConfirming(true)} disabled={!preset || loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Load scale
            </WindowButton>
          </div>
          {presetError && <p className="mt-1 text-3xs font-medium text-danger">{presetError}</p>}
          <Confirm
            open={confirming}
            title="Load this scale?"
            message="Levels in the scale are added. A level whose code already exists gets the scale's name, Nepali label and order; your salaries stay. Nothing is removed."
            confirmLabel="Load scale"
            onConfirm={loadPreset}
            onCancel={() => setConfirming(false)}
          />
        </div>
      )}
    </>
  );
}
