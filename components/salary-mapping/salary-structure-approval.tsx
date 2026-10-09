"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Plus, Save, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { useDateText } from "@/components/kit/date-cell";
import { PaneTimeline, approvalSteps, type TimelineStep } from "@/components/kit/pane";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { saveSalaryApprovalSettingsAction } from "@/app/actions/salary-structure.actions";
import { buildFlow, statusText, type ApprovalActor, type SubmitOutcome } from "@/lib/engines/approval.engine";
import { changedLines, earliestOpenDate, finalisedConflicts } from "@/lib/engines/salary-structure.engine";
import type { ApprovalActionKind, ApprovalPolicy, ApprovalRoute, ApprovalType } from "@/lib/types/approval";
import type { BatchRow, RetirementScheme, SalaryStructureData, StructureLines } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

// Shared by the Revise window, Bulk edit and the Approvals tab (Zoho Payroll
// style): what saving will do (the same engine the server uses), the save
// buttons, each change's approval timeline and status, and the settings
// window. The server re-checks everything; this only tells the user first.

export const money = (v: unknown) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  none: "No approval",
  simple: "Simple approval",
  multi_level: "Multi-level approval",
};

export const APPROVAL_ROUTE_LABEL: Record<ApprovalRoute, string> = {
  simple: "Approved by an approver",
  levels: "Approved by every level",
  final_approve: "Final approved by an administrator",
  not_required: "No approval needed",
  on_hire: "Starting salary on hire",
  policy: "Grade policy update",
};

const ACTION_LABEL: Record<ApprovalActionKind, string> = {
  submitted: "Submitted",
  approved: "Approved",
  final_approved: "Final approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  skipped: "Skipped",
  not_required: "Counted without approval",
};

/** The current user as the approval rules see them. */
export function salaryActor(data: SalaryStructureData): ApprovalActor {
  return { userId: data.currentUserId, employeeId: data.me.employeeId, canApprove: data.permissions.approve, isAdministrator: data.me.isAdministrator };
}

const nameOf = (data: SalaryStructureData) => (id: string) => data.approvers.find((a) => a.userId === id)?.name ?? "Unknown user";

/** What saving changes for these employees will do (same engine as the server). */
export function saveOutcome(data: SalaryStructureData, employeeIds: readonly string[]): SubmitOutcome & { canSaveAndApprove: boolean } {
  const outcome = buildFlow(data.approvalPolicy, { preparerId: data.currentUserId, preparerEmployeeId: data.me.employeeId, subjectEmployeeIds: employeeIds, approvers: data.approvers });
  const own = !outcome.approvedAtOnce && outcome.ownSubject;
  return { ...outcome, canSaveAndApprove: !outcome.approvedAtOnce && data.me.isAdministrator && !own };
}

/** One line saying what saving will do, and a warning when nobody else can approve. */
export function SaveOutcome({ data, outcome, className }: { data: SalaryStructureData; outcome: ReturnType<typeof saveOutcome>; className?: string }) {
  const name = nameOf(data);
  let text: string;
  if (outcome.approvedAtOnce) text = "Counts once saved: salary approval is switched off.";
  else if (outcome.ownSubject) text = "Includes your own salary, so another approver has to accept it.";
  else if (outcome.flow.type === "multi_level") {
    const active = outcome.flow.levels.filter((l) => !l.skipped);
    text = `Goes to ${active.map((l, i) => `Level ${i + 1}: ${name(l.userId)}`).join(", then ")}.`;
    if (outcome.flow.levels.some((l) => l.skipped)) text += " Levels you prepared or that concern the approver's own salary are skipped.";
  } else text = outcome.flow.fellBack ? "Every level was skipped, so any approver other than you can approve it." : "Waits for anyone who can approve salary changes (not you).";
  if (outcome.canSaveAndApprove) text += " As a company administrator you can also save and approve it now.";
  const stuck = !outcome.approvedAtOnce && !outcome.canSaveAndApprove && data.me.otherApprovers === 0;
  return (
    <span className={cn("text-2xs", stuck ? "text-warning" : "text-ink-muted", className)}>
      {text}
      {stuck && " Nobody else can approve salary changes yet: give a second user Salary structure → Approve."}
    </span>
  );
}

/**
 * The save buttons: Save (approval off), or Submit for approval, plus Save
 * and approve for a company administrator (a recorded Final approve; never
 * their own salary). Enter at the end of a form goes to the first one.
 */
export function SaveButtons({
  outcome,
  saving,
  disabled,
  onSave,
  submitRef,
  plainLabel = "Save",
}: {
  outcome: ReturnType<typeof saveOutcome>;
  saving: false | "submit" | "approve";
  disabled?: boolean;
  onSave: (approveNow: boolean) => void;
  submitRef?: React.Ref<HTMLButtonElement>;
  plainLabel?: string;
}) {
  return (
    <>
      <WindowButton ref={submitRef} variant="primary" onClick={() => onSave(false)} disabled={disabled || !!saving}>
        {saving === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {outcome.approvedAtOnce ? plainLabel : "Submit for approval"}
      </WindowButton>
      {outcome.canSaveAndApprove && (
        <WindowButton onClick={() => onSave(true)} disabled={disabled || !!saving} title="Save and Final approve it now (recorded as approved by you)">
          {saving === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Save and approve
        </WindowButton>
      )}
    </>
  );
}

/** "Level 1 of 2 · Hari Thapa", "Waiting for an approver", "Approved". */
export function batchStatusText(batch: BatchRow, data: SalaryStructureData): string {
  return statusText({ status: batch.status, flow: batch.flow, currentLevel: batch.currentLevel }, nameOf(data));
}

/**
 * Payroll is approved or locked up to some month for these employees: the
 * first date a change may take effect, as an error message (null when open).
 */
export function usePayrollLock(data: SalaryStructureData) {
  const dateText = useDateText();
  return (effectiveFrom: string, employeeIds: readonly string[]): string | null => {
    if (!effectiveFrom) return null;
    const conflicts = finalisedConflicts(effectiveFrom, data.finalisedUntil, employeeIds);
    if (!conflicts.size) return null;
    const open = earliestOpenDate(data.finalisedUntil, [...conflicts.keys()]);
    return `Payroll is being prepared up to ${dateText([...conflicts.values()].sort().pop()!)} for ${conflicts.size === 1 ? "this employee" : `${conflicts.size} employees`}: lock or discard that run first, or choose ${dateText(open)} or later. Months already locked are paid as arrears.`;
  };
}

/** The approval timeline of a change ("View approval"): each step, then the levels still to come. */
export function ApprovalTimeline({ batch, data }: { batch: BatchRow; data: SalaryStructureData }) {
  const dateText = useDateText();
  const name = nameOf(data);
  const done = new Set(batch.timeline.filter((t) => t.action === "approved").map((t) => t.level));
  const upcoming = batch.status === "pending" && batch.flow.type === "multi_level" ? batch.flow.levels.filter((l) => !l.skipped && !done.has(l.level)) : [];
  const steps: TimelineStep[] = [
    ...approvalSteps(batch.timeline, { label: ACTION_LABEL, dateText }),
    ...upcoming.map((l, i) => ({ id: `up-${l.level}`, label: i === 0 ? "Waiting" : "Then", detail: `Level ${l.level}`, who: name(l.userId), tone: (i === 0 ? "waiting" : "next") as TimelineStep["tone"] })),
    ...(batch.status === "pending" && batch.flow.type === "simple" ? [{ id: "waiting", label: "Waiting", who: `any approver other than ${batch.preparedBy}`, tone: "waiting" as const }] : []),
  ];
  return <PaneTimeline steps={steps} />;
}

/** The current user's standing for the approval rules, shown on the Approvals tab. */
export function ApproverStanding({ data }: { data: SalaryStructureData }) {
  const own = data.rows.find((r) => r.employeeId === data.me.employeeId);
  const p = data.approvalPolicy;
  return (
    <ul className="space-y-1 text-2xs text-ink-muted">
      <li className="flex items-start gap-1.5">
        <ShieldCheck aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-brand" />
        <span>
          <span className="font-medium text-ink">{APPROVAL_TYPE_LABEL[p.type]}</span>
          {p.type === "multi_level" ? ` · ${p.levels.map((id, i) => `Level ${i + 1}: ${nameOf(data)(id)}`).join(" → ")}` : p.type === "simple" ? " · anyone with Approve, never the preparer" : " · changes count once saved"}
          {data.me.isAdministrator ? ". You are a company administrator: you can Final approve." : data.permissions.approve ? ". You can approve." : "."}
        </span>
      </li>
      <li className="flex items-start gap-1.5">
        <UserCheck aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-brand" />
        {data.me.employeeId
          ? `Your account is linked to ${own ? `${own.fullName} (${own.employeeCode})` : "your employee record"}: changes to that salary always need another approver.`
          : "Your account is not linked to an employee record, so your own salary cannot be recognised. Link it in Users if you are also an employee."}
      </li>
      {data.me.otherApprovers === 0 && (
        <li className="flex items-start gap-1.5 text-warning">
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          Nobody else can approve salary changes. Give a second user (for example the owner) Salary structure → Approve.
        </li>
      )}
    </ul>
  );
}

/** Approval settings (company administrators): none / simple / multi-level with ordered approvers. */
export function ApprovalSettingsWindow({ data, onClose, onSaved }: { data: SalaryStructureData; onClose: () => void; onSaved: (pendingKept: number) => void }) {
  const initial: ApprovalPolicy = data.approvalPolicy;
  const [policy, setPolicy] = useState<ApprovalPolicy>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const eligible = data.approvers.filter((a) => a.active && a.canApprove);
  const pending = data.batches.filter((b) => b.status === "pending").length;
  const setLevels = (levels: string[]) => setPolicy((p) => ({ ...p, levels }));
  const move = (i: number, d: -1 | 1) => {
    const next = [...policy.levels];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setLevels(next);
  };

  const save = async () => {
    setSaving(true);
    const result = await saveSalaryApprovalSettingsAction({ type: policy.type, levels: policy.type === "multi_level" ? policy.levels.filter(Boolean) : [] });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors?.settings ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(result.data.pendingKept);
  };

  const TYPES: { value: ApprovalType; help: string }[] = [
    { value: "simple", help: "Any user who can approve salary changes approves it, never the person who prepared it." },
    { value: "multi_level", help: "Named approvers in order: Level 2 acts only after Level 1. Approved when the last level approves." },
    { value: "none", help: "Changes count once saved. A change to someone's own salary still needs another approver." },
  ];

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(policy) !== JSON.stringify(initial)}
      size="lg"
      title="Approval settings · Salary changes"
      description="Who approves salary revisions before they count. Company administrators can always Final approve; nobody approves their own salary."
      footer={
        <>
          {failure ? (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          ) : (
            <span className="mr-auto text-2xs text-ink-muted">{pending ? `${pending} change${pending === 1 ? "" : "s"} waiting keep the approvers they were sent to.` : "Applies to changes saved from now on."}</span>
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
        {TYPES.map((t) => (
          <label key={t.value} className={cn("flex cursor-pointer gap-2.5 rounded-md border px-3 py-2", policy.type === t.value ? "border-brand bg-brand-subtle" : "border-line hover:bg-surface-sunken")}>
            <input type="radio" name="approval-type" className="mt-0.5 h-4 w-4 accent-brand" checked={policy.type === t.value} onChange={() => setPolicy({ type: t.value, levels: t.value === "multi_level" ? (policy.levels.length ? policy.levels : [""]) : policy.levels })} />
            <span>
              <span className="block text-sm font-medium text-ink">{APPROVAL_TYPE_LABEL[t.value]}</span>
              <span className="block text-2xs text-ink-muted">{t.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {policy.type === "multi_level" && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-ink">
            Approvers in order {errors.levels && <span className="font-normal text-danger">· {errors.levels}</span>}
          </p>
          <ol className="space-y-2">
            {policy.levels.map((id, i) => {
              const who = data.approvers.find((a) => a.userId === id);
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
                      onChange={(v) => setLevels(policy.levels.map((x, j) => (j === i ? v : x)))}
                      placeholder="Choose an approver"
                    />
                    {error && <p className="mt-0.5 text-2xs text-danger">{error}</p>}
                    {!error && who && !who.employeeId && <p className="mt-0.5 text-2xs text-warning">Not linked to an employee record: their own salary cannot be recognised.</p>}
                  </div>
                  <span className="flex gap-1">
                    <WindowButton aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </WindowButton>
                    <WindowButton aria-label="Move down" title="Move down" disabled={i === policy.levels.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </WindowButton>
                    <WindowButton aria-label="Remove level" title="Remove level" disabled={policy.levels.length === 1} onClick={() => setLevels(policy.levels.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </WindowButton>
                  </span>
                </li>
              );
            })}
          </ol>
          {policy.levels.length < 5 && (
            <WindowButton className="mt-2" onClick={() => setLevels([...policy.levels, ""])}>
              <Plus className="h-3.5 w-3.5" /> Add level
            </WindowButton>
          )}
          <p className="mt-2 text-2xs text-ink-muted">A level is skipped when its approver prepared the change or their own salary is in it. Approvers away can delegate in Users.</p>
        </div>
      )}
      {eligible.length === 0 && <p className="mt-3 text-2xs text-warning">No active user can approve salary changes yet. Give a role Salary structure → Approve in Roles.</p>}
    </Window>
  );
}

const SCHEME_NAME: Record<RetirementScheme, string> = { ssf: "SSF", pf: "PF", none: "None" };

/** What changed for one employee, with old → new values ("Basic 22,000.00 → 24,500.00"). */
export function describeChanges(before: StructureLines, after: StructureLines, heads: SalaryStructureData["heads"]): string[] {
  const name = (id: string) => heads.find((h) => h.id === id)?.name ?? "Pay head";
  return changedLines(before, after).map((k) => {
    if (k === "basic") return `Basic ${money(before.basic)} → ${money(after.basic)}`;
    if (k === "gradeCount") return `Grades ${before.gradeCount} → ${after.gradeCount}`;
    if (k === "gradeAmount") return `Grade ${money(before.gradeAmount)} → ${money(after.gradeAmount)}${after.gradeManual ? " (by hand)" : ""}`;
    if (k === "scheme") return `Scheme ${SCHEME_NAME[before.scheme]} → ${SCHEME_NAME[after.scheme]}`;
    if (k === "computed") {
      const added = after.computed.filter((id) => !before.computed.includes(id)).map(name);
      const removed = before.computed.filter((id) => !after.computed.includes(id)).map(name);
      return [added.length ? `Adds ${added.join(", ")}` : "", removed.length ? `Removes ${removed.join(", ")}` : ""].filter(Boolean).join("; ");
    }
    return `${name(k)} ${money(before.amounts[k] ?? 0)} → ${money(after.amounts[k] ?? 0)}`;
  });
}
