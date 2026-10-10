"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import type { ApprovalPolicy, ApprovalType } from "@/lib/types/approval";
import { cn } from "@/lib/utils";

// Approval settings for one module (company administrators): no approval, simple (anyone with the
// module's Approve, never the preparer) or multi-level (named approvers in order). Salary changes
// and loans use it; the approval engine (lib/engines/approval.engine.ts) applies the policy and the
// server validates it again.

export const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  none: "No approval",
  simple: "Simple approval",
  multi_level: "Multi-level approval",
};

export interface PolicyApprover {
  userId: string;
  name: string;
  employeeId: string | null;
  active: boolean;
  canApprove: boolean;
}

export type PolicySaveResult = { ok: true } | { ok: false; error: string; errors?: Record<string, string> };

const ORDER: ApprovalType[] = ["simple", "multi_level", "none"];

export function ApprovalPolicyWindow({
  title,
  description,
  policy: initial,
  approvers,
  help,
  pendingNote,
  levelsHint,
  noApproverHint,
  onSave,
  onClose,
}: {
  title: string;
  description: string;
  policy: ApprovalPolicy;
  approvers: readonly PolicyApprover[];
  /** One line per type, in the module's words. */
  help: Record<ApprovalType, string>;
  /** What happens to requests already waiting (shown in the footer). */
  pendingNote: string;
  /** Under the levels: when a level is skipped. */
  levelsHint: string;
  /** Shown when no active user can approve yet. */
  noApproverHint: string;
  onSave: (policy: ApprovalPolicy) => Promise<PolicySaveResult>;
  onClose: () => void;
}) {
  const [policy, setPolicy] = useState<ApprovalPolicy>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const eligible = approvers.filter((a) => a.active && a.canApprove);
  const setLevels = (levels: string[]) => setPolicy((p) => ({ ...p, levels }));

  const save = async () => {
    setSaving(true);
    const result = await onSave({ type: policy.type, levels: policy.type === "multi_level" ? policy.levels.filter(Boolean) : [] });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setFailure(result.error);
    }
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(policy) !== JSON.stringify(initial)}
      size="lg"
      title={title}
      description={description}
      footer={
        <>
          {failure ? (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          ) : (
            <span className="mr-auto text-2xs text-ink-muted">{pendingNote}</span>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save settings
          </WindowButton>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-ink">Approval type</legend>
        {ORDER.map((type) => (
          <label key={type} className={cn("flex cursor-pointer gap-2.5 rounded-md border px-3 py-2", policy.type === type ? "border-brand bg-brand-subtle" : "border-line hover:bg-surface-sunken")}>
            <input
              type="radio"
              name="approval-type"
              className="mt-0.5 h-4 w-4 accent-brand"
              checked={policy.type === type}
              onChange={() => setPolicy({ type, levels: type === "multi_level" ? (policy.levels.length ? policy.levels : [""]) : policy.levels })}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{APPROVAL_TYPE_LABEL[type]}</span>
              <span className="block text-2xs text-ink-muted">{help[type]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {policy.type === "multi_level" && <ApprovalLevels className="mt-4" levels={policy.levels} onChange={setLevels} approvers={approvers} errors={errors} hint={levelsHint} />}
      {eligible.length === 0 && <p className="mt-3 text-2xs text-warning">{noApproverHint}</p>}
    </Window>
  );
}

/** Named approvers in order (Level 1 first), at most five; errors keyed "levels" and "level.N". */
export function ApprovalLevels({
  levels,
  onChange,
  approvers,
  errors,
  hint,
  className,
}: {
  levels: string[];
  onChange: (levels: string[]) => void;
  approvers: readonly PolicyApprover[];
  errors: Record<string, string>;
  hint?: string;
  className?: string;
}) {
  const eligible = approvers.filter((a) => a.active && a.canApprove);
  const move = (i: number, d: -1 | 1) => {
    const next = [...levels];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold text-ink">
        Approvers in order {errors.levels && <span className="font-normal text-danger">· {errors.levels}</span>}
      </p>
      <ol className="space-y-2">
        {levels.map((id, i) => {
          const who = approvers.find((a) => a.userId === id);
          const error = errors[`level.${i + 1}`];
          return (
            <li key={i} className="flex flex-wrap items-start gap-2">
              <span className="mt-1.5 w-16 shrink-0 text-xs font-medium text-ink-label">Level {i + 1}</span>
              <div className="min-w-56 flex-1">
                <Combobox
                  name={`level.${i + 1}`}
                  aria-label={`Level ${i + 1} approver`}
                  options={eligible.map((a) => ({ value: a.userId, label: a.name, hint: a.employeeId ? undefined : "not linked to an employee" }))}
                  value={id}
                  onChange={(v) => onChange(levels.map((x, j) => (j === i ? v : x)))}
                  placeholder="Choose an approver"
                />
                {error && <p className="mt-0.5 text-2xs text-danger">{error}</p>}
                {!error && who && !who.employeeId && <p className="mt-0.5 text-2xs text-warning">Not linked to an employee record: their own record cannot be recognised.</p>}
              </div>
              <span className="flex gap-1">
                <WindowButton aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </WindowButton>
                <WindowButton aria-label="Move down" title="Move down" disabled={i === levels.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </WindowButton>
                <WindowButton aria-label="Remove level" title="Remove level" disabled={levels.length === 1} onClick={() => onChange(levels.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </WindowButton>
              </span>
            </li>
          );
        })}
      </ol>
      {levels.length < 5 && (
        <WindowButton className="mt-2" onClick={() => onChange([...levels, ""])}>
          <Plus className="h-3.5 w-3.5" /> Add level
        </WindowButton>
      )}
      {hint && <p className="mt-2 text-2xs text-ink-muted">{hint}</p>}
    </div>
  );
}
