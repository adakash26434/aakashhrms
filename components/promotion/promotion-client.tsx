"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { DateCell } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { savePromotionWeightsAction } from "@/app/actions/promotion.actions";
import type { PromotionWeights } from "@/lib/engines/promotion.engine";
import type { PromotionPageData, PromotionRow } from "@/lib/types/promotion";
import { cn } from "@/lib/utils";

// Promotion ranking (बढुवा): the composite per designation, computed live
// from का.स.मू. finals, seniority in post, training and discipline. The list
// advises; "Record promotion" opens a lifecycle event for the person.

export function PromotionClient({ data }: { data: PromotionPageData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (filters.designation && r.designationId !== filters.designation) return false;
      if (filters.ranked === "yes" && r.rank === null) return false;
      if (q && ![r.employeeName, r.employeeCode, r.branch].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.rows, filters, search]);

  const w = data.weights;
  const columns: GridColumn<PromotionRow>[] = [
    { id: "rank", header: "#", value: (r) => r.rank ?? 9999, width: 60, cell: (r) => (r.rank === null ? <span className="text-ink-faint">—</span> : <span className="font-semibold tabular-nums">{r.rank}</span>) },
    { id: "employee", header: "Employee", value: (r) => r.employeeName, sticky: true, cell: (r) => (
        <span>
          {r.employeeName} <span className="text-ink-faint">· {r.employeeCode}</span>
        </span>
      ) },
    { id: "designation", header: "Designation", value: (r) => r.designation, width: 160 },
    { id: "branch", header: "Branch", value: (r) => r.branch, width: 130, defaultHidden: true },
    { id: "composite", header: "Composite", value: (r) => r.composite, type: "number", width: 100, cell: (r) => <span className={cn("font-semibold tabular-nums", r.rank === null && "text-ink-faint")}>{r.composite.toFixed(1)}</span> },
    { id: "eval", header: `का.स.मू. (${w.evaluation})`, value: (r) => r.evaluationAvg ?? -1, type: "number", width: 120, cell: (r) => (r.evaluationAvg === null ? <span className="text-warning">none</span> : <span className="tabular-nums">{r.evaluationAvg.toFixed(1)}% → {r.evaluationPoints.toFixed(1)}</span>) },
    { id: "seniority", header: `Seniority (${w.seniority})`, value: (r) => r.yearsInPost, type: "number", width: 150, cell: (r) => <span className="tabular-nums">{r.yearsInPost.toFixed(1)} y → {r.seniorityPoints.toFixed(1)}</span> },
    { id: "since", header: "In post since", value: (r) => r.inPostSince, type: "date", width: 120, cell: (r) => <DateCell value={r.inPostSince} />, defaultHidden: true },
    { id: "training", header: `Training (${w.training})`, value: (r) => r.trainingHours, type: "number", width: 130, cell: (r) => <span className="tabular-nums">{r.trainingHours} h → {r.trainingPoints.toFixed(1)}</span> },
    { id: "penalty", header: "Discipline", value: (r) => r.penalty, type: "number", width: 100, cell: (r) => (r.penalty ? <span className="text-danger tabular-nums">−{r.penalty.toFixed(1)}</span> : <span className="text-ink-faint">—</span>) },
    { id: "action", header: "", value: () => "", width: 150, cell: (r) =>
        data.permissions.recordEvent && r.rank !== null ? (
          <button type="button" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline cursor-pointer" onClick={(ev) => { ev.stopPropagation(); router.push(`/workforce/lifecycle?new=promotion&employee=${r.employeeId}`); }}>
            Record promotion <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        ) : null },
  ];

  return (
    <div>
      <PageBar
        title="Promotion ranking"
        description={`बढुवा composite per designation: का.स.मू. ${w.evaluation} + seniority ${w.seniority} (full at ${w.seniorityFullYears} y) + training ${w.training} (full at ${w.trainingFullHours} h) − ${w.disciplinePenalty} per disciplinary outcome since ${data.disciplineSinceAd}. Advice only — the बढुवा is a lifecycle event.`}
        actions={[
          { id: "weights", label: "Weights", icon: SlidersHorizontal, group: "create", hidden: !data.permissions.editWeights, onClick: () => setWeightsOpen(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <FilterStrip
        id="promotion"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Employee, code or branch" }}
        filters={[
          { id: "designation", label: "Designation", options: data.designations.map((d) => ({ value: d.id, label: d.name })), allLabel: "All designations" },
          { id: "ranked", label: "Ranked", options: [{ value: "yes", label: "With evaluation only" }], allLabel: "Everyone" },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="promotion"
        label="Promotion ranking"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.employeeId}
        rowTone={(r) => (r.rank === 1 ? "info" : r.penalty > 0 ? "warning" : undefined)}
        exportModule={data.permissions.export ? "PERFORMANCE" : undefined}
        exportName="promotion-ranking"
        empty={{ title: "Nobody to rank", description: "Active employees in your scope appear here once a का.स.मू. cycle has finals." }}
      />
      {weightsOpen && <WeightsWindow weights={w} onClose={() => setWeightsOpen(false)} onSaved={() => { setWeightsOpen(false); setNotice("Weights saved; the ranking is recomputed."); refresh(); }} />}
    </div>
  );
}

function WeightsWindow({ weights, onClose, onSaved }: { weights: PromotionWeights; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<keyof PromotionWeights, string>>({
    evaluation: String(weights.evaluation),
    seniority: String(weights.seniority),
    training: String(weights.training),
    seniorityFullYears: String(weights.seniorityFullYears),
    trainingFullHours: String(weights.trainingFullHours),
    evaluationsCounted: String(weights.evaluationsCounted),
    disciplinePenalty: String(weights.disciplinePenalty),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof PromotionWeights) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sum = ["evaluation", "seniority", "training"].reduce((s, k) => s + (Number(form[k as keyof PromotionWeights]) || 0), 0);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await savePromotionWeightsAction(form);
      if (result.success) onSaved();
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  const field = (label: string, k: keyof PromotionWeights, help?: string) => (
    <FieldRow label={label} error={errors[k]} help={help}>
      <input className={`${inputClass} w-28`} inputMode="decimal" value={form[k]} onChange={set(k)} />
    </FieldRow>
  );

  return (
    <Window open onClose={onClose} title="Promotion weights" description="Per the bylaw's बढुवा rule. Shares must add up to 100; the ranking recomputes at once." size="md" dirty footer={<><WindowButton onClick={onClose}>Cancel</WindowButton><WindowButton variant="primary" onClick={save} disabled={pending || sum !== 100}>{pending ? "Saving…" : "Save"}</WindowButton></>}>
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title={`Shares (sum ${sum})`}>
            {field("का.स.मू. evaluation", "evaluation")}
            {field("Seniority in post", "seniority")}
            {field("Training", "training")}
          </FieldGroup>
          <FieldGroup title="Scales">
            {field("Years for full seniority", "seniorityFullYears")}
            {field("Hours for full training", "trainingFullHours")}
            {field("Evaluations averaged", "evaluationsCounted", "Latest N final evaluations.")}
            {field("Penalty per disciplinary outcome", "disciplinePenalty", "Composite points; outcomes other than no action, last 24 months.")}
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}
