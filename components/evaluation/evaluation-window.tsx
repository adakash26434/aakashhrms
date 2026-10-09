"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Window, WindowButton } from "@/components/kit/window";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { inputClass } from "@/components/kit/property-form";
import { getEvaluationAction, rateEvaluationStageAction } from "@/app/actions/evaluation.actions";
import { EVALUATION_STAGES, activeStages, stageDef, type EvaluationStage } from "@/lib/engines/evaluation.engine";
import type { EvaluationDetail } from "@/lib/types/evaluation";
import { cn } from "@/lib/utils";

// Scoring window (G1): the का.स.मू. form, stage by stage. Earlier stages show
// read-only with their percentage; the current stage takes marks from its
// assigned rater (or a user with APPROVE, acting for an absent rater).

interface EvaluationWindowProps {
  evaluationId: string | null;
  onClose: () => void;
  canFinalize: boolean;
  myUserId: string;
  onChanged: () => void;
}

export function EvaluationWindow({ evaluationId, onClose, canFinalize, myUserId, onChanged }: EvaluationWindowProps) {
  // Remounted per evaluation so marks, errors and the loaded detail reset.
  if (!evaluationId) return null;
  return <EvaluationWindowBody key={evaluationId} evaluationId={evaluationId} onClose={onClose} canFinalize={canFinalize} myUserId={myUserId} onChanged={onChanged} />;
}

function EvaluationWindowBody({ evaluationId, onClose, canFinalize, myUserId, onChanged }: EvaluationWindowProps & { evaluationId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<EvaluationDetail | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getEvaluationAction(evaluationId);
      if (cancelled) return;
      if (result.success) setDetail(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluationId]);

  const stages = detail ? activeStages(detail.form) : [];
  const currentStage = detail && detail.status === "in_progress" ? (detail.stage as EvaluationStage) : null;
  const iRateNow = !!detail && !!currentStage && (detail.raters[currentStage] === myUserId || canFinalize);
  const actingForOther = !!detail && !!currentStage && detail.raters[currentStage] !== myUserId && canFinalize;
  const lastStage = detail && currentStage ? stages[stages.length - 1] === currentStage : false;

  const criteria = useMemo(() => (detail ? detail.form.sections.flatMap((s) => s.criteria) : []), [detail]);
  const complete = criteria.length > 0 && criteria.every((c) => marks[c.id]?.trim());

  const savedMarks = (stage: string, criterionId: string): number | null => {
    const hit = detail?.scores[stage]?.find((s) => s.criterionId === criterionId);
    return hit ? hit.marks : null;
  };

  const submit = () =>
    startTransition(async () => {
      if (!detail) return;
      setError(null);
      const result = await rateEvaluationStageAction({ evaluationId: detail.id, marks });
      if (result.success) {
        setDetail(result.data);
        setMarks({});
        setErrors({});
        onChanged();
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title={detail ? `${detail.employeeName} — ${detail.cycleLabel}` : "Evaluation"}
      description={detail ? `${detail.designation} · ${detail.branch}` : undefined}
      size="xl"
      dirty={Object.keys(marks).length > 0}
      footer={
        <>
          <WindowButton onClick={onClose}>Close</WindowButton>
          {detail?.status === "final" && (
            <WindowButton onClick={() => router.push(`/workforce/evaluation/${detail.id}`)}>
              <Printer className="h-3.5 w-3.5" /> Print form
            </WindowButton>
          )}
          {detail && iRateNow && (
            <WindowButton variant="primary" onClick={submit} disabled={pending || !complete}>
              {pending ? "Saving…" : lastStage ? "Save marks & finalize" : `Save ${currentStage ? stageDef(currentStage)?.name.toLowerCase() : ""} marks`}
            </WindowButton>
          )}
        </>
      }
    >
      {error && (
        <Notice tone="danger" className="mb-3">
          {error}
        </Notice>
      )}
      {!detail ? (
        <p className="p-4 text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {stages.map((stage) => {
              const def = stageDef(stage);
              const pct = detail.stagePercents[stage];
              const isCurrent = stage === currentStage;
              return (
                <span key={stage} className={cn("rounded-md border px-2 py-1", isCurrent ? "border-brand bg-brand/5 font-semibold text-brand-strong" : "border-line text-ink-muted")}>
                  {def?.name} ({detail.form.weights[stage]}%) — {detail.raterNames[stage] ?? "—"}
                  {pct !== undefined ? ` · ${pct}%` : isCurrent ? " · waiting" : ""}
                </span>
              );
            })}
            {detail.status === "final" && (
              <span className="rounded-md border border-success/40 bg-success-subtle px-2 py-1 font-semibold">
                Total {detail.total}% — {detail.band} {detail.bandNp && `· ${detail.bandNp}`}
              </span>
            )}
          </div>
          {actingForOther && (
            <Notice tone="warning">You are marking for {currentStage ? detail.raterNames[currentStage] : ""} (recorded in the audit log).</Notice>
          )}
          {detail.status === "in_progress" && !iRateNow && currentStage && (
            <Notice tone="info">Waiting for the {stageDef(currentStage)?.name.toLowerCase()} — {detail.raterNames[currentStage]}.</Notice>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-line-input text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-1.5 pr-2">Criterion</th>
                <th className="w-16 py-1.5 pr-2 text-right">Max</th>
                {stages.map((stage) => (
                  <th key={stage} className="w-24 py-1.5 pr-2 text-right">
                    {stageDef(stage)?.nameNp}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.form.sections.map((section) => (
                <SectionRows
                  key={section.id}
                  section={section}
                  stages={stages}
                  currentStage={iRateNow ? currentStage : null}
                  savedMarks={savedMarks}
                  marks={marks}
                  errors={errors}
                  onMark={(id, v) => setMarks((prev) => ({ ...prev, [id]: v }))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Window>
  );
}

function SectionRows({
  section,
  stages,
  currentStage,
  savedMarks,
  marks,
  errors,
  onMark,
}: {
  section: EvaluationDetail["form"]["sections"][number];
  stages: EvaluationStage[];
  currentStage: EvaluationStage | null;
  savedMarks: (stage: string, criterionId: string) => number | null;
  marks: Record<string, string>;
  errors: Record<string, string>;
  onMark: (criterionId: string, value: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={2 + stages.length} className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {section.name} {section.nameNp && <span className="normal-case">· {section.nameNp}</span>}
        </td>
      </tr>
      {section.criteria.map((c) => (
        <tr key={c.id} className="border-b border-line">
          <td className="py-1.5 pr-2">
            {c.name}
            {c.nameNp && <span className="text-ink-faint"> · {c.nameNp}</span>}
            {errors[c.id] && <span className="ml-2 text-xs text-danger">{errors[c.id]}</span>}
          </td>
          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-muted">{c.max}</td>
          {stages.map((stage) => {
            const saved = savedMarks(stage, c.id);
            if (stage === currentStage) {
              return (
                <td key={stage} className="py-1 pr-2 text-right">
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={c.max}
                    className={cn(inputClass, "h-7 w-20 text-right tabular-nums", errors[c.id] && "border-danger")}
                    value={marks[c.id] ?? ""}
                    onChange={(e) => onMark(c.id, e.target.value)}
                    aria-label={`${c.name} marks`}
                  />
                </td>
              );
            }
            return (
              <td key={stage} className="py-1.5 pr-2 text-right tabular-nums">
                {saved !== null ? saved : <span className="text-ink-faint">—</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export function evaluationStatusChip(status: "in_progress" | "final", stageName: string) {
  return status === "final" ? <StatusChip status="approved" label="Final" /> : <StatusChip status="pending" label={`With ${stageName.toLowerCase()}`} />;
}

export { EVALUATION_STAGES };
