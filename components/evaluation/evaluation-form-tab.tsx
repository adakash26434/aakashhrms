"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Notice } from "@/components/kit/notice";
import { WindowButton } from "@/components/kit/window";
import { inputClass } from "@/components/kit/property-form";
import { saveEvaluationFormAction } from "@/app/actions/evaluation.actions";
import { EVALUATION_STAGES, type EvaluationForm } from "@/lib/engines/evaluation.engine";
import { cn } from "@/lib/utils";

// Form tab (G1): the company's का.स.मू. form — stage weights, grade bands and
// sections → criteria with max marks. Saving never touches evaluations
// already started (each froze its own copy of the form).

export function EvaluationFormTab({ initial, canEdit, onSaved }: { initial: EvaluationForm; canEdit: boolean; onSaved: () => void }) {
  const [form, setForm] = useState<EvaluationForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const rawTotal = form.sections.reduce((n, s) => n + s.criteria.reduce((m, c) => m + (Number.isFinite(c.max) ? c.max : 0), 0), 0);
  const weightTotal = EVALUATION_STAGES.reduce((n, s) => n + (form.weights[s.code] ?? 0), 0);

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const result = await saveEvaluationFormAction(form);
      if (result.success) {
        setSaved(true);
        onSaved();
      } else setError(result.error);
    });

  const setSection = (i: number, patch: Partial<EvaluationForm["sections"][number]>) =>
    setForm((prev) => ({ ...prev, sections: prev.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setCriterion = (i: number, j: number, patch: Partial<EvaluationForm["sections"][number]["criteria"][number]>) =>
    setSection(i, { criteria: form.sections[i].criteria.map((c, k) => (k === j ? { ...c, ...patch } : c)) });

  const ro = !canEdit;

  return (
    <div className="max-w-4xl space-y-5 p-3">
      {error && <Notice tone="danger" onDismiss={() => setError(null)}>{error}</Notice>}
      {saved && <Notice tone="success" onDismiss={() => setSaved(false)}>Form saved. Evaluations already started keep the form they began with.</Notice>}

      <section className="rounded-lg border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">Stage weights</h3>
        <div className="flex flex-wrap items-end gap-4">
          {EVALUATION_STAGES.map((stage) => (
            <label key={stage.code} className="text-xs text-ink-muted">
              {stage.name} · {stage.nameNp}
              <input
                type="number"
                min={0}
                max={100}
                readOnly={ro}
                className={`${inputClass} mt-1 w-24 text-right tabular-nums`}
                value={form.weights[stage.code] ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, weights: { ...prev.weights, [stage.code]: Math.max(0, Math.round(Number(e.target.value) || 0)) } }))}
              />
            </label>
          ))}
          <p className={cn("pb-2 text-xs", weightTotal === 100 ? "text-ink-muted" : "font-semibold text-danger")}>= {weightTotal} (must be 100; a stage at 0 is skipped)</p>
        </div>
      </section>

      {form.sections.map((section, i) => (
        <section key={section.id} className="rounded-lg border border-line p-4">
          <div className="mb-2 flex items-center gap-2">
            <input readOnly={ro} className={`${inputClass} max-w-56`} value={section.name} maxLength={120} onChange={(e) => setSection(i, { name: e.target.value })} placeholder="Section" />
            <input readOnly={ro} className={`${inputClass} max-w-56`} value={section.nameNp} maxLength={120} onChange={(e) => setSection(i, { nameNp: e.target.value })} placeholder="खण्डको नाम" />
            {!ro && (
              <button type="button" className="ml-auto text-ink-faint hover:text-danger cursor-pointer" aria-label={`Remove section ${section.name}`} onClick={() => setForm((prev) => ({ ...prev, sections: prev.sections.filter((_, j) => j !== i) }))}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-1 pr-2">Criterion</th>
                <th className="py-1 pr-2">मापदण्ड</th>
                <th className="w-20 py-1 pr-2 text-right">Max</th>
                {!ro && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {section.criteria.map((c, j) => (
                <tr key={c.id} className="border-b border-line">
                  <td className="py-1 pr-2"><input readOnly={ro} className={`${inputClass} max-w-none`} value={c.name} maxLength={120} onChange={(e) => setCriterion(i, j, { name: e.target.value })} /></td>
                  <td className="py-1 pr-2"><input readOnly={ro} className={`${inputClass} max-w-none`} value={c.nameNp} maxLength={120} onChange={(e) => setCriterion(i, j, { nameNp: e.target.value })} /></td>
                  <td className="py-1 pr-2"><input readOnly={ro} type="number" min={1} max={100} className={`${inputClass} w-20 text-right tabular-nums`} value={Number.isFinite(c.max) ? c.max : ""} onChange={(e) => setCriterion(i, j, { max: Number(e.target.value) })} /></td>
                  {!ro && (
                    <td className="py-1 text-right">
                      <button type="button" className="text-ink-faint hover:text-danger cursor-pointer" aria-label={`Remove ${c.name}`} onClick={() => setSection(i, { criteria: section.criteria.filter((_, k) => k !== j) })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!ro && (
            <WindowButton className="mt-2" onClick={() => setSection(i, { criteria: [...section.criteria, { id: `${section.id}c${Date.now() % 100000}`, name: "", nameNp: "", max: 10 }] })}>
              <Plus className="h-3.5 w-3.5" /> Criterion
            </WindowButton>
          )}
        </section>
      ))}

      <section className="rounded-lg border border-line p-4">
        <h3 className="mb-2 text-sm font-semibold">Grade bands (by final %)</h3>
        <table className="w-full max-w-xl text-sm">
          <tbody>
            {form.bands.map((band, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-1 pr-2"><input readOnly={ro} type="number" min={0} max={100} className={`${inputClass} w-20 text-right tabular-nums`} value={band.min} onChange={(e) => setForm((prev) => ({ ...prev, bands: prev.bands.map((b, j) => (j === i ? { ...b, min: Number(e.target.value) } : b)) }))} aria-label="Band minimum percent" /></td>
                <td className="py-1 pr-2"><input readOnly={ro} className={`${inputClass} max-w-none`} value={band.label} maxLength={50} onChange={(e) => setForm((prev) => ({ ...prev, bands: prev.bands.map((b, j) => (j === i ? { ...b, label: e.target.value } : b)) }))} /></td>
                <td className="py-1 pr-2"><input readOnly={ro} className={`${inputClass} max-w-none`} value={band.labelNp} maxLength={50} onChange={(e) => setForm((prev) => ({ ...prev, bands: prev.bands.map((b, j) => (j === i ? { ...b, labelNp: e.target.value } : b)) }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex items-center gap-3">
        {!ro && (
          <>
            <WindowButton onClick={() => setForm((prev) => ({ ...prev, sections: [...prev.sections, { id: `s${Date.now() % 100000}`, name: "", nameNp: "", criteria: [{ id: `s${Date.now() % 100000}c1`, name: "", nameNp: "", max: 10 }] }] }))}>
              <Plus className="h-3.5 w-3.5" /> Section
            </WindowButton>
            <WindowButton variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save form"}
            </WindowButton>
          </>
        )}
        <p className="text-xs text-ink-muted">Raw marks per stage: {rawTotal}. Each stage scores all criteria; the final total weights the stages.</p>
      </div>
    </div>
  );
}
