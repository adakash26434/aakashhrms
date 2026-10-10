"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { ApprovalLevels, ApprovalPolicyWindow, APPROVAL_TYPE_LABEL } from "@/components/kit/approval-policy-window";
import { Confirm } from "@/components/kit/confirm";
import { Guide } from "@/components/kit/guide";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { Panel } from "@/components/kit/panel";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import {
  approvalSettingsPageAction,
  deleteSalaryApprovalRuleAction,
  moveSalaryApprovalRuleAction,
  saveLoanApprovalPolicyAction,
  saveSalaryApprovalPolicyAction,
  saveSalaryApprovalRuleAction,
} from "@/app/actions/approval-settings.actions";
import { EMPTY_CONDITIONS, MAX_RULES, RULE_NAME_MAX, describeApproval } from "@/lib/engines/approval-rules.engine";
import type { ApprovalModuleSettings, ApprovalPolicy, ApprovalRule, ApprovalRuleConditions, ApprovalRuleRow, ApprovalSettingsPage } from "@/lib/types/approval";

// Setup → Approvals (4.12d): who approves salary changes and loans, in one place. Salary changes
// add custom rules read in order — the first that applies decides — before the company policy.
// Requests already waiting keep their approvers. The server checks everything again.

type Open = { kind: "salaryPolicy" } | { kind: "loanPolicy" } | { kind: "rule"; rule: ApprovalRuleRow | null } | { kind: "deleteRule"; rule: ApprovalRuleRow } | null;

const keptNote = (n: number, what: string) => (n ? ` ${n} ${what}${n === 1 ? "" : "s"} already waiting keep the approvers they were sent to.` : "");

export function ApprovalSettingsClient({ initial }: { initial: ApprovalSettingsPage }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [pending, start] = useTransition();

  const reload = (message?: { tone: NoticeTone; text: string }) =>
    start(async () => {
      const result = await approvalSettingsPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setData(result.data);
      if (message) setNotice(message);
    });

  const move = (rule: ApprovalRuleRow, step: -1 | 1) =>
    start(async () => {
      if (!data.salary) return;
      const result = await moveSalaryApprovalRuleAction(rule.id, step, data.salary.rulesVersion);
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      const fresh = await approvalSettingsPageAction();
      if (fresh.success) setData(fresh.data);
    });

  const nameOf = (m: ApprovalModuleSettings) => (id: string) => m.approvers.find((a) => a.userId === id)?.name ?? "a removed user";
  const policyLine = (m: ApprovalModuleSettings) => (
    <span>
      <span className="font-medium text-ink">{APPROVAL_TYPE_LABEL[m.policy.type]}</span>
      {m.policy.type === "multi_level" ? ` · ${describeApproval(m.policy, nameOf(m))}` : m.policy.type === "simple" ? " · anyone with Approve, never the person who prepared it" : " · counts once saved (never one's own)"}
    </span>
  );

  return (
    <div>
      <PageBar
        title="Approvals"
        description="Who approves salary changes and loans before they count; nobody approves their own"
        actions={[{ id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => reload() }]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <Guide
        id="approvals"
        title="How approvals work"
        className="mb-3"
        steps={[
          { title: "A policy per module", text: "No approval, any approver (simple), or named approvers in order (multi-level)." },
          { title: "Custom rules", text: "For salary changes: the first rule that applies sends the change to its own approvers; otherwise the company policy decides." },
          { title: "Never your own", text: "A level is skipped when its approver prepared the change or is in it. Company administrators can Final approve." },
          { title: "Waiting requests", text: "Keep the approvers they were sent to: a new setting counts for what is saved from now on." },
        ]}
      />

      <div className="grid gap-4">
        {data.salary && (
          <Panel title="Salary changes" meta={data.salary.rules.length ? `${data.salary.rules.length} custom rule${data.salary.rules.length === 1 ? "" : "s"}` : undefined}>
            <div className="space-y-4 px-4 py-3">
              <SettingRow label="Company policy" value={policyLine(data.salary)} action={data.salary.canEdit ? <WindowButton onClick={() => setOpen({ kind: "salaryPolicy" })}>Change…</WindowButton> : null} />
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-ink">Custom rules</p>
                    <p className="text-2xs text-ink-muted">Read in order: the first rule that applies decides who approves; otherwise the company policy does.</p>
                  </div>
                  {data.salary.canEdit && (
                    <WindowButton onClick={() => setOpen({ kind: "rule", rule: null })} disabled={data.salary.rules.length >= MAX_RULES || pending} title={data.salary.rules.length >= MAX_RULES ? `At most ${MAX_RULES} rules` : undefined}>
                      <Plus className="h-3.5 w-3.5" /> Add rule
                    </WindowButton>
                  )}
                </div>
                {data.salary.rules.length ? (
                  <ol className="divide-y divide-line rounded-md border border-line">
                    {data.salary.rules.map((r, i) => (
                      <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-2xs font-semibold text-brand-strong">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{r.name}</p>
                          <p className="text-xs text-ink-muted">When: {r.conditions}</p>
                          <p className="text-xs text-ink">Approved by: {r.approval}</p>
                        </div>
                        {data.salary!.canEdit && (
                          <span className="flex gap-1">
                            <WindowButton aria-label={`Move ${r.name} up`} title="Move up" disabled={i === 0 || pending} onClick={() => move(r, -1)}>
                              <ArrowUp className="h-3.5 w-3.5" />
                            </WindowButton>
                            <WindowButton aria-label={`Move ${r.name} down`} title="Move down" disabled={i === data.salary!.rules.length - 1 || pending} onClick={() => move(r, 1)}>
                              <ArrowDown className="h-3.5 w-3.5" />
                            </WindowButton>
                            <WindowButton aria-label={`Edit ${r.name}`} title="Edit" disabled={pending} onClick={() => setOpen({ kind: "rule", rule: r })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </WindowButton>
                            <WindowButton aria-label={`Delete ${r.name}`} title="Delete" disabled={pending} onClick={() => setOpen({ kind: "deleteRule", rule: r })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </WindowButton>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-md border border-dashed border-line px-3 py-2.5 text-xs text-ink-muted">No custom rules: every salary change follows the company policy.</p>
                )}
              </div>
              <p className="text-2xs text-ink-muted">
                {data.salary.pending ? `${data.salary.pending} salary change${data.salary.pending === 1 ? "" : "s"} waiting keep the approvers they were sent to. ` : ""}
                {!data.salary.canEdit && "Changing these needs Salary structure → Approve with a company-wide role."}
              </p>
            </div>
          </Panel>
        )}

        {data.loans && (
          <Panel title="Loans and advances">
            <div className="space-y-2 px-4 py-3">
              <SettingRow label="Company policy" value={policyLine(data.loans)} action={data.loans.canEdit ? <WindowButton onClick={() => setOpen({ kind: "loanPolicy" })}>Change…</WindowButton> : null} />
              <p className="text-2xs text-ink-muted">
                {data.loans.pending ? `${data.loans.pending} request${data.loans.pending === 1 ? "" : "s"} waiting keep the approvers they were sent to. ` : ""}
                {!data.loans.canEdit && "Changing this needs Loans → Approve with a company-wide role."}
              </p>
            </div>
          </Panel>
        )}

        <Panel title="Set elsewhere">
          <ul className="divide-y divide-line">
            {[
              { href: "/payroll/controls", title: "Pay runs, bank / PAN / tax status changes", text: "Maker-checker under Payroll → Payroll controls." },
              { href: "/timeAndLeave/leaves", title: "Leave requests", text: "Approved by users with Leave approvals → Approve within their scope, never their own." },
              { href: "/timeAndLeave/attendance", title: "Attendance adjustments", text: "Approved by the employee's supervisor or users with Attendance → Approve." },
            ].map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink group-hover:underline">{e.title}</span>
                    <span className="block text-xs text-ink-muted">{e.text}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {open?.kind === "salaryPolicy" && data.salary && (
        <ApprovalPolicyWindow
          title="Company policy · Salary changes"
          description="Who approves salary changes no custom rule applies to. Company administrators can always Final approve; nobody approves their own salary."
          policy={data.salary.policy}
          approvers={data.salary.approvers}
          help={{
            simple: "Any user who can approve salary changes approves it, never the person who prepared it.",
            multi_level: "Named approvers in order: Level 2 acts only after Level 1. Approved when the last level approves.",
            none: "Changes count once saved. A change to someone's own salary still needs another approver.",
          }}
          pendingNote={data.salary.pending ? `${data.salary.pending} change${data.salary.pending === 1 ? "" : "s"} waiting keep the approvers they were sent to.` : "Applies to changes saved from now on."}
          levelsHint="A level is skipped when its approver prepared the change or their own salary is in it. Approvers away can delegate in Users."
          noApproverHint="No active user can approve salary changes yet. Give a role Salary structure → Approve in Roles."
          onSave={async (policy) => {
            const result = await saveSalaryApprovalPolicyAction(policy);
            if (!result.success) return { ok: false, error: result.error, errors: ("validationErrors" in result && result.validationErrors) || {} };
            setOpen(null);
            reload({ tone: "success", text: `Salary approval policy saved.${keptNote(result.data.pendingKept, "change")}` });
            return { ok: true };
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === "loanPolicy" && data.loans && (
        <ApprovalPolicyWindow
          title="Company policy · Loans and advances"
          description="Who approves loan and salary advance requests before they are disbursed. Company administrators can Final approve; nobody approves their own loan."
          policy={data.loans.policy}
          approvers={data.loans.approvers}
          help={{
            simple: "Any user with Loans → Approve approves it, never the person who asked.",
            multi_level: "Named approvers in order: Level 2 acts only after Level 1. Approved when the last level approves.",
            none: "Requests are approved once made. A request about the person asking still needs someone else.",
          }}
          pendingNote={data.loans.pending ? `${data.loans.pending} request${data.loans.pending === 1 ? "" : "s"} waiting keep the approvers they were sent to.` : "Applies to requests made from now on."}
          levelsHint="A level is skipped when its approver asked for the loan or it is their own. Approvers away can delegate in Users."
          noApproverHint="No active user can approve loans yet. Give a role Loans → Approve in Roles."
          onSave={async (policy) => {
            const result = await saveLoanApprovalPolicyAction(policy);
            if (!result.success) return { ok: false, error: result.error, errors: ("validationErrors" in result && result.validationErrors) || {} };
            setOpen(null);
            reload({ tone: "success", text: `Loan approval policy saved.${keptNote(result.data.pendingKept, "request")}` });
            return { ok: true };
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === "rule" && data.salary && (
        <RuleWindow
          page={data}
          rule={open.rule}
          onClose={() => setOpen(null)}
          onSaved={(name, added) => {
            setOpen(null);
            reload({ tone: "success", text: `${name} ${added ? "added" : "saved"}: it applies to salary changes saved from now on.` });
          }}
        />
      )}
      <Confirm
        open={open?.kind === "deleteRule"}
        tone="danger"
        title={`Delete the rule ${open?.kind === "deleteRule" ? open.rule.name : ""}?`}
        message="Salary changes it applied to follow the next rule that applies, or the company policy. Changes already waiting keep their approvers."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (open?.kind !== "deleteRule" || !data.salary) return;
          const result = await deleteSalaryApprovalRuleAction(open.rule.id, data.salary.rulesVersion);
          if (!result.success) throw new Error(result.error);
          setOpen(null);
          reload({ tone: "success", text: `${result.data.name} deleted.` });
        }}
        onCancel={() => setOpen(null)}
      />
    </div>
  );
}

function SettingRow({ label, value, action }: { label: string; value: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-32 shrink-0 text-xs font-medium text-ink-label">{label}</span>
      <span className="min-w-0 flex-1 text-xs text-ink-muted">{value}</span>
      {action}
    </div>
  );
}

/** A condition that is checked only when ticked. */
function Condition({ label, checked, onToggle, children, error }: { label: string; checked: boolean; onToggle: (on: boolean) => void; children?: ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5 px-4 py-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={checked} onChange={(e) => onToggle(e.target.checked)} /> {label}
      </label>
      {checked && <div className="pl-6">{children}</div>}
      {error && <p className="pl-6 text-2xs text-danger">{error}</p>}
    </div>
  );
}

const DEFAULTS = { raisePercentOver: 10, monthlyChangeOver: 50_000, newTotalOver: 100_000 };

function RuleWindow({ page, rule, onClose, onSaved }: { page: ApprovalSettingsPage; rule: ApprovalRuleRow | null; onClose: () => void; onSaved: (name: string, added: boolean) => void }) {
  const salary = page.salary!;
  const initial: ApprovalRule = rule ? { id: rule.id, name: rule.name, when: rule.when, then: rule.then } : { id: "", name: "", when: { ...EMPTY_CONDITIONS }, then: { type: "multi_level", levels: [""] } };
  const [form, setForm] = useState<ApprovalRule>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const setWhen = <K extends keyof ApprovalRuleConditions>(key: K, value: ApprovalRuleConditions[K]) => {
    setForm((f) => ({ ...f, when: { ...f.when, [key]: value } }));
    setErrors({});
    setFailure(null);
  };
  const setThen = (then: ApprovalPolicy) => {
    setForm((f) => ({ ...f, then }));
    setErrors({});
    setFailure(null);
  };
  const toggleId = (key: "branchIds" | "departmentIds", id: string, on: boolean) => setWhen(key, on ? [...form.when[key], id] : form.when[key].filter((x) => x !== id));

  const save = () =>
    start(async () => {
      const send: ApprovalRule = { ...form, then: form.then.type === "multi_level" ? { type: "multi_level", levels: form.then.levels.filter(Boolean) } : { type: "simple", levels: [] } };
      const result = await saveSalaryApprovalRuleAction(send, salary.rulesVersion);
      if (result.success) return onSaved(result.data.name, !rule);
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setErrors(result.validationErrors);
    });

  const list = (key: "branchIds" | "departmentIds", options: { id: string; name: string }[]) => (
    <div className="max-h-40 max-w-md overflow-y-auto rounded-md border border-line bg-surface px-2 py-1">
      {options.map((o) => (
        <label key={o.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-ink">
          <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={form.when[key].includes(o.id)} onChange={(e) => toggleId(key, o.id, e.target.checked)} />
          <span className="truncate">{o.name}</span>
        </label>
      ))}
      {!options.length && <p className="py-1 text-2xs text-ink-faint">None set up yet.</p>}
    </div>
  );

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="lg"
      title={rule ? `Rule: ${rule.name}` : "New approval rule"}
      description="Salary changes this rule applies to go to its approvers instead of the company policy."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={save} disabled={saving || (!!rule && !dirty)}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {rule ? "Save rule" : "Add rule"}
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save}>
        <FieldGroup title="The rule">
          <FieldRow label="Name" required error={errors.name ?? null}>
            <input name="name" className={inputClass} value={form.name} maxLength={RULE_NAME_MAX} placeholder="e.g. Large raises" onChange={(e) => (setForm((f) => ({ ...f, name: e.target.value })), setErrors({}), setFailure(null))} />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="When" description="Every condition ticked must hold. The conditions about a person must hold for the same person in the change.">
          <Condition label="Someone's raise is more than" checked={form.when.raisePercentOver !== null} onToggle={(on) => setWhen("raisePercentOver", on ? DEFAULTS.raisePercentOver : null)} error={errors.raisePercentOver}>
            <span className="flex items-center gap-2">
              <NumberField name="raisePercentOver" value={form.when.raisePercentOver ?? 0} onChange={(n) => setWhen("raisePercentOver", n)} decimals={2} max={999} showZero selectOnFocus className="max-w-28" />
              <span className="text-xs text-ink-muted">% of their total salary</span>
            </span>
          </Condition>
          <Condition label="Someone's new total salary is more than" checked={form.when.newTotalOver !== null} onToggle={(on) => setWhen("newTotalOver", on ? DEFAULTS.newTotalOver : null)} error={errors.newTotalOver}>
            <NumberField name="newTotalOver" value={form.when.newTotalOver ?? 0} onChange={(n) => setWhen("newTotalOver", n)} decimals={0} prefix="NPR" grouped showZero selectOnFocus className="max-w-48" />
          </Condition>
          <Condition label="Someone is in these branches" checked={form.when.branchIds.length > 0 || (errors.branchIds !== undefined)} onToggle={(on) => setWhen("branchIds", on && page.branches[0] ? [page.branches[0].id] : [])} error={errors.branchIds}>
            {list("branchIds", page.branches)}
          </Condition>
          <Condition label="Someone is in these departments" checked={form.when.departmentIds.length > 0 || (errors.departmentIds !== undefined)} onToggle={(on) => setWhen("departmentIds", on && page.departments[0] ? [page.departments[0].id] : [])} error={errors.departmentIds}>
            {list("departmentIds", page.departments)}
          </Condition>
          <Condition label="The monthly salary bill changes by more than" checked={form.when.monthlyChangeOver !== null} onToggle={(on) => setWhen("monthlyChangeOver", on ? DEFAULTS.monthlyChangeOver : null)} error={errors.monthlyChangeOver}>
            <span className="flex flex-wrap items-center gap-2">
              <NumberField name="monthlyChangeOver" value={form.when.monthlyChangeOver ?? 0} onChange={(n) => setWhen("monthlyChangeOver", n)} decimals={0} prefix="NPR" grouped showZero selectOnFocus className="max-w-48" />
              <span className="text-xs text-ink-muted">up or down, all the people in the change together</span>
            </span>
          </Condition>
          {errors.when && <p className="px-4 pb-2 text-2xs text-danger">{errors.when}</p>}
        </FieldGroup>
        <FieldGroup title="Approved by">
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap gap-4 text-xs text-ink">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="then" className="h-3.5 w-3.5 accent-brand" checked={form.then.type === "simple"} onChange={() => setThen({ type: "simple", levels: [] })} /> Any approver
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="then" className="h-3.5 w-3.5 accent-brand" checked={form.then.type === "multi_level"} onChange={() => setThen({ type: "multi_level", levels: form.then.levels.length ? form.then.levels : [""] })} /> Approvers in order
              </label>
            </div>
            {form.then.type === "multi_level" && (
              <ApprovalLevels
                levels={form.then.levels}
                onChange={(levels) => setThen({ type: "multi_level", levels })}
                approvers={salary.approvers}
                errors={errors}
                hint="A level is skipped when its approver prepared the change or their own salary is in it."
              />
            )}
            {form.then.type === "simple" && <p className="text-2xs text-ink-muted">Anyone with Salary structure → Approve, never the person who prepared the change.</p>}
          </div>
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}
