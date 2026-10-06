"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, Loader2, Pencil, Send, ShieldCheck, Undo2, X } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { ReasonWindow } from "@/components/attendance/attendance-windows";
import { cancelLeaveExceptionRequestAction, decideLeavePolicyAction, previewLeavePolicyAction, proposeLeavePolicyAction, requestLeaveExceptionAction } from "@/app/actions/leave-policy.actions";
import { STATUTORY_FLOOR, fmt } from "@/lib/engines/leave.engine";
import { SETTING_LABEL, changeLines, daysBetween, exceptionErrors, exceptionState, floorText, valueText } from "@/lib/engines/leave-policy.engine";
import type { ExceptionRequestRow, LeavePolicyPageData, PolicyApplies, PolicyChangeView, PolicyException, PolicyPreview, PolicySetting, PolicyTypeRow, PolicyValues } from "@/lib/types/leave-policy";

type Decision = "approve" | "final_approve" | "reject" | "withdraw";

const ACTION_LABEL: Record<string, string> = { submitted: "Proposed", approved: "Approved", final_approved: "Final approved", rejected: "Rejected", withdrawn: "Withdrawn", not_required: "Changed by the system" };
const REQUEST_STATUS: Record<ExceptionRequestRow["status"], { status: string; label: string }> = {
  PENDING: { status: "pending", label: "Waiting for the platform" },
  APPROVED: { status: "approved", label: "Granted" },
  REJECTED: { status: "rejected", label: "Rejected" },
  CANCELLED: { status: "cancelled", label: "Withdrawn" },
};
const STATUS_LABEL: Record<string, { status: string; label: string }> = {
  approved: { status: "approved", label: "Approved" },
  rejected: { status: "rejected", label: "Rejected" },
  withdrawn: { status: "cancelled", label: "Withdrawn" },
  replaced: { status: "cancelled", label: "Replaced" },
};

/** One phrase per setting for the summary column ("12 days a year · saved up to 45 days"). */
function phrase(row: PolicyTypeRow, s: PolicySetting, v: PolicyValues): string {
  switch (s) {
    case "days":
      return `${fmt(v.days)} days ${row.creditedYearly ? "a year" : "each time"}`;
    case "paidDays":
      return `${fmt(v.paidDays ?? 0)} paid`;
    case "cap":
      return v.cap === null ? "no limit to saving" : `saved up to ${fmt(v.cap)} days`;
    case "accrualEveryDays":
      return `1 day for every ${fmt(v.accrualEveryDays ?? 20)} paid days`;
    case "certificateAfter":
      return v.certificateAfter === null ? "no certificate needed" : `certificate after ${fmt(v.certificateAfter)} days in a row`;
    case "expiryDays":
      return `taken within ${fmt(v.expiryDays ?? 21)} days`;
    case "allowHalfDay":
      return v.allowHalfDay ? "half days allowed" : "whole days only";
    case "dayBasis":
      return v.dayBasis === "calendar" ? "calendar days" : "working days only";
  }
}

/** Compared with the Labour Act itself (not an exception): more generous, the same, or below under an exception. */
function versusLaw(row: PolicyTypeRow): "more" | "law" | "below" {
  const law = STATUTORY_FLOOR[row.statutoryCode] ?? {};
  let more = false;
  for (const s of row.editable) {
    const f = (law as Record<string, number | undefined>)[s];
    const v = row.values[s];
    if (s === "dayBasis") {
      if (v === "working") more = true;
      continue;
    }
    if (s === "certificateAfter") {
      if (v === null || (f !== undefined && (v as number) > f)) more = true;
      else if (f !== undefined && (v as number) < f) return "below";
      continue;
    }
    if (f === undefined || typeof v !== "number") continue;
    const worse = s === "accrualEveryDays" ? v > f : v < f;
    const better = s === "accrualEveryDays" ? v < f : v > f;
    if (worse) return "below";
    if (better) more = true;
  }
  return more ? "more" : "law";
}

/**
 * Statutory leave policies (4.6c): the Labour Act's six leave types with the
 * company's settings. A change is proposed here and approved by a second
 * person (never the proposer); it can only be in the employees' favour.
 */
export function LeavePolicy({ data, onDone }: { data: LeavePolicyPageData; onDone: (text: string) => void }) {
  const dateText = useDateText();
  const [view, setView] = useState<"waiting" | "all">(data.waitingForMe ? "waiting" : "all");
  const rows = useMemo(() => (view === "waiting" ? data.types.filter((t) => t.pending && (t.pending.can.approve || t.pending.can.finalApprove)) : data.types), [data.types, view]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = data.types.find((t) => t.id === activeId) ?? null;
  const [proposing, setProposing] = useState<PolicyTypeRow | null>(null);
  const [asking, setAsking] = useState<PolicyTypeRow | null>(null);
  const [withdrawing, setWithdrawing] = useState<ExceptionRequestRow | null>(null);
  const [deciding, setDeciding] = useState<{ change: PolicyChangeView; decision: Decision; typeName: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const decide = async (note?: string): Promise<string | null> => {
    if (!deciding) return null;
    const r = await decideLeavePolicyAction([deciding.change.id], deciding.decision, note);
    if (!r.success) return r.error;
    if (r.data.failed.length) return r.data.failed[0].error;
    const word = { approve: "approved", final_approve: "approved", reject: "rejected", withdraw: "withdrawn" }[deciding.decision];
    setDeciding(null);
    onDone(`The change to ${deciding.typeName} was ${word}.`);
    return null;
  };

  const columns = useMemo<GridColumn<PolicyTypeRow>[]>(
    () => [
      {
        id: "name",
        header: "Leave type",
        width: 170,
        sticky: true,
        value: (r) => r.name,
        cell: (r) => (
          <span className="font-medium text-ink" title={r.law}>
            {r.name}
          </span>
        ),
      },
      {
        id: "settings",
        header: "Settings",
        width: 430,
        value: (r) => r.editable.map((s) => phrase(r, s, r.values)).join(" · "),
        cell: (r) => <span className="block truncate" title={r.editable.map((s) => phrase(r, s, r.values)).join(" · ")}>{r.editable.map((s) => phrase(r, s, r.values)).join(" · ")}</span>,
      },
      {
        id: "law",
        header: "Against the law",
        width: 170,
        value: (r) => versusLaw(r),
        cell: (r) => {
          const v = versusLaw(r);
          return v === "more" ? <StatusChip status="approved" label="More than the law" /> : v === "below" ? <StatusChip status="review" label="Under an exception" /> : <StatusChip status="draft" label="As the law" />;
        },
      },
      {
        id: "status",
        header: "Changes",
        width: 170,
        value: (r) => (r.pending ? "waiting" : r.scheduled ? "scheduled" : ""),
        cell: (r) =>
          r.pending ? (
            <StatusChip status="pending" label="Waiting for approval" />
          ) : r.scheduled ? (
            <StatusChip status="review" label={`From ${dateText(r.scheduled.effectiveFrom ?? "")}`} />
          ) : (
            <span className="text-ink-faint">—</span>
          ),
      },
    ],
    [dateText]
  );

  return (
    <div className="p-3">
      <Guide
        id="leave-policy"
        className="mb-3"
        title="How leave policies work"
        steps={[
          { title: "The law is the minimum", text: "These six leave types follow the Labour Act. You can give more, never less." },
          { title: "Propose a change", text: "Pick a leave type, then Propose a change. Say why; you see what it means for employees." },
          { title: "A second person approves", text: "Someone else with Leave types → Approve approves it. Nobody approves their own change." },
          { title: "When it applies", text: "Days a year from the next leave year (or now, topped up). Everything else once approved." },
        ]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which leave types" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
          {(
            [
              ["waiting", `Waiting for me (${data.waitingForMe})`],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`cursor-pointer rounded px-3 py-1 font-medium ${view === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken"}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-2xs text-ink-muted">
          {data.leaveYear ? `Leave year ${data.leaveYear.label}` : "No current leave year"}
          {data.nextYearStart ? ` · the next one starts ${dateText(data.nextYearStart)}` : ""}
        </span>
      </div>
      {data.endingSoon.map(({ typeName, exception: e }) => (
        <Notice key={e.id} tone="warning" className="mb-3" title={`${typeName}: the exception "${e.legalBasis}" ends ${e.validUntil ? dateText(e.validUntil) : ""}`}>
          From the next day the minimum for &quot;{SETTING_LABEL[e.setting]}&quot; is the Labour Act&apos;s again, unless the platform grants a new exception. Ask now if the directive still applies.
        </Notice>
      ))}
      {data.platformUnavailable && (
        <Notice tone="info" className="mb-3">
          The platform could not be reached, so exception requests aren&apos;t shown. Everything else works.
        </Notice>
      )}
      {message && (
        <Notice tone="danger" className="mb-3" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      )}
      <SplitView
        id="leave-policy"
        detailTitle={active ? active.name : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <PolicyPane
              row={active}
              data={data}
              onPropose={() => setProposing(active)}
              onAsk={() => setAsking(active)}
              onWithdrawAsk={setWithdrawing}
              onDecide={(change, decision) => setDeciding({ change, decision, typeName: active.name })}
            />
          ) : null
        }
        master={
          <DataGrid
            id="leave-policy"
            label="Statutory leave policies"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            activeRowId={activeId}
            onActiveRowChange={(r) => setActiveId(r.id)}
            onOpen={(r) => setActiveId(r.id)}
            pageSize={20}
            empty={view === "waiting" ? { title: "Nothing waiting for you", description: "Leave policy changes someone else proposed appear here for you to approve." } : { title: "No statutory leave types", description: "The platform sets them up when the company is created." }}
          />
        }
      />

      {asking && <AskExceptionWindow row={asking} today={data.today} onClose={() => setAsking(null)} onSaved={(text) => { setAsking(null); onDone(text); }} />}
      <Confirm
        open={!!withdrawing}
        title="Withdraw this exception request?"
        message="The platform will not review it. You can ask again later."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          if (!withdrawing) return;
          const r = await cancelLeaveExceptionRequestAction(withdrawing.id);
          setWithdrawing(null);
          if (!r.success) setMessage(r.error);
          else onDone("The exception request was withdrawn.");
        }}
        onCancel={() => setWithdrawing(null)}
      />
      {proposing && <ProposeWindow row={proposing} data={data} onClose={() => setProposing(null)} onSaved={(text) => { setProposing(null); onDone(text); }} />}
      <Confirm
        open={deciding?.decision === "approve" || deciding?.decision === "final_approve"}
        title={deciding?.decision === "final_approve" ? "Final approve this change?" : "Approve this change?"}
        message="The Labour Act minimum is checked again. Settings that apply now change at once for new requests, month closes and grants."
        confirmLabel={deciding?.decision === "final_approve" ? "Final approve" : "Approve"}
        onConfirm={async () => {
          const e = await decide();
          if (e) {
            setDeciding(null);
            setMessage(e);
          }
        }}
        onCancel={() => setDeciding(null)}
      />
      <Confirm
        open={deciding?.decision === "withdraw"}
        title="Withdraw this proposal?"
        message="It will not be decided. You can propose another change afterwards."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          const e = await decide();
          if (e) {
            setDeciding(null);
            setMessage(e);
          }
        }}
        onCancel={() => setDeciding(null)}
      />
      {deciding?.decision === "reject" && (
        <ReasonWindow title={`Reject the change to ${deciding.typeName}?`} description="Say why. The person who proposed it sees your reason." action="Reject" danger onClose={() => setDeciding(null)} onConfirm={(reason) => decide(reason)} />
      )}
    </div>
  );
}

function ChangeLines({ change }: { change: PolicyChangeView }) {
  return (
    <ul className="space-y-0.5">
      {changeLines(change.before, change.after).map((l) => (
        <li key={l} className="text-ink">
          {l}
        </li>
      ))}
    </ul>
  );
}

function whenText(change: PolicyChangeView, dateText: (d: string) => string): string {
  if (change.applies === "next_year" && change.effectiveFrom) return `Days a year from ${dateText(change.effectiveFrom)} (the next leave year); the rest once approved.`;
  if (change.applies === "top_up") return "Once approved; everyone employed this leave year is topped up (pro-rata from joining).";
  return "Once approved, for new requests, month closes and grants.";
}

function PolicyPane({
  row,
  data,
  onPropose,
  onAsk,
  onWithdrawAsk,
  onDecide,
}: {
  row: PolicyTypeRow;
  data: LeavePolicyPageData;
  onPropose: () => void;
  onAsk: () => void;
  onWithdrawAsk: (r: ExceptionRequestRow) => void;
  onDecide: (change: PolicyChangeView, decision: Decision) => void;
}) {
  const dateText = useDateText();
  const p = row.pending;
  return (
    <div className="space-y-3 text-xs">
      <section aria-label="Settings" className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <h3 className="mb-1.5 flex justify-between text-2xs font-semibold uppercase tracking-wide text-ink-muted">
          <span>Settings</span>
          <span className="font-normal normal-case tracking-normal">{row.law}</span>
        </h3>
        <table className="w-full table-fixed text-2xs">
          <colgroup>
            <col className="w-32" />
            <col />
            <col className="w-40" />
          </colgroup>
          <thead>
            <tr className="text-left text-ink-faint">
              <th className="pb-1 font-medium">Setting</th>
              <th className="pb-1 font-medium">Yours</th>
              <th className="pb-1 font-medium">Minimum</th>
            </tr>
          </thead>
          <tbody>
            {row.editable.map((s) => (
              <tr key={s} className="border-t border-line align-top">
                <td className="py-1 pr-2 text-ink-muted">{SETTING_LABEL[s]}</td>
                <td className="py-1 pr-2 font-medium text-ink">{s === "days" ? `${fmt(row.values.days)} days ${row.creditedYearly ? "a year" : "each time"}` : valueText(s, row.values[s])}</td>
                <td className="py-1 text-ink-muted">
                  {floorText(s, row.floor) ?? "—"}
                  {row.floorSource[s]?.startsWith("Exception") && <span className="block text-3xs text-info">under an exception</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {row.exceptions.map((e) => (
          <ExceptionNote key={e.id} e={e} today={data.today} />
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          {data.permissions.propose && !p && (
            <WindowButton variant="primary" onClick={onPropose}>
              <Pencil className="h-3.5 w-3.5" /> Propose a change…
            </WindowButton>
          )}
          {data.permissions.askException && row.exceptionSettings.length > 0 && (
            <WindowButton onClick={onAsk} title="For a regulated company whose regulator sets a different minimum">
              <FileText className="h-3.5 w-3.5" /> Ask for an exception…
            </WindowButton>
          )}
        </div>
        {!data.permissions.propose && <p className="mt-2 text-2xs text-ink-muted">Changes are proposed by someone with a company-wide role and Leave types → Edit.</p>}
      </section>

      {p && (
        <section aria-label="Waiting for approval" className="rounded-lg border border-warning/40 bg-surface px-3 py-2.5">
          <h3 className="mb-1.5 flex items-center justify-between text-2xs font-semibold uppercase tracking-wide text-ink-muted">
            <span>Waiting for approval</span>
            <StatusChip status="pending" label="Waiting" />
          </h3>
          <ChangeLines change={p} />
          <p className="mt-1 text-2xs text-ink-muted">{whenText(p, dateText)}</p>
          <p className="mt-1 text-ink">“{p.reason}”</p>
          <p className="mt-0.5 text-2xs text-ink-muted">
            Proposed by {p.preparedBy} · {dateText(p.preparedAt.slice(0, 10))}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.can.approve && (
              <WindowButton variant="primary" onClick={() => onDecide(p, "approve")}>
                <Check className="h-3.5 w-3.5" /> Approve
              </WindowButton>
            )}
            {!p.can.approve && p.can.finalApprove && (
              <WindowButton variant="primary" onClick={() => onDecide(p, "final_approve")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Final approve
              </WindowButton>
            )}
            {p.can.reject && (
              <WindowButton variant="danger" onClick={() => onDecide(p, "reject")}>
                <X className="h-3.5 w-3.5" /> Reject
              </WindowButton>
            )}
            {p.can.withdraw && (
              <WindowButton onClick={() => onDecide(p, "withdraw")}>
                <Undo2 className="h-3.5 w-3.5" /> Withdraw
              </WindowButton>
            )}
          </div>
          {p.can.reason && !p.can.approve && <p className="mt-1.5 text-2xs text-ink-muted">{p.can.reason}</p>}
          {p.can.withdraw && data.otherApprovers.length === 0 && (
            <Notice tone="warning" className="mt-2" title="Nobody else can approve this yet">
              Give a second user a company-wide role with Leave types → Approve in{" "}
              <Link href="/admin/roles" className="font-medium text-brand underline">
                Roles &amp; permissions
              </Link>
              . Until then the change waits; nothing changes for employees.
            </Notice>
          )}
          <Timeline change={p} />
        </section>
      )}

      {row.scheduled && (
        <Notice tone="info" title={`Approved: from ${dateText(row.scheduled.effectiveFrom ?? "")}`}>
          {changeLines(row.scheduled.before, row.scheduled.after).join(" · ")}. Applies on the first day of the next leave year.
        </Notice>
      )}

      {row.exceptionRequests.length > 0 && (
        <section aria-label="Exception requests" className="rounded-lg border border-line bg-surface px-3 py-2.5">
          <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Exception requests</h3>
          <ol className="space-y-2">
            {row.exceptionRequests.slice(0, 5).map((r) => (
              <li key={r.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink">
                    {SETTING_LABEL[r.setting]}: {r.value === null ? "—" : fmt(r.value)} · {dateText(r.validFrom)} – {dateText(r.validUntil)}
                  </span>
                  <StatusChip status={REQUEST_STATUS[r.status].status} label={REQUEST_STATUS[r.status].label} />
                </div>
                <p className="text-2xs text-ink-muted">
                  {r.legalBasis}
                  {r.reference ? ` · ${r.reference}` : ""} · asked by {r.requestedBy} · {dateText(r.requestedAt.slice(0, 10))}
                </p>
                {r.status === "REJECTED" && r.rejectionReason && <p className="text-2xs text-danger">Rejected: “{r.rejectionReason}”</p>}
                {r.status === "APPROVED" && r.granted && (r.granted.validUntil !== r.validUntil || r.granted.validFrom !== r.validFrom || r.granted.value !== r.value) && (
                  <p className="text-2xs text-ink-muted">
                    Granted as {r.granted.value === null ? "—" : fmt(r.granted.value)}, {dateText(r.granted.validFrom)} – {r.granted.validUntil ? dateText(r.granted.validUntil) : "open"}
                  </p>
                )}
                {r.status === "PENDING" && data.permissions.askException && (
                  <WindowButton className="mt-1" onClick={() => onWithdrawAsk(r)}>
                    <Undo2 className="h-3.5 w-3.5" /> Withdraw
                  </WindowButton>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-label="History" className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">History</h3>
        {row.history.length === 0 ? (
          <p className="text-2xs text-ink-muted">No changes yet: the settings are the platform&apos;s, from the Labour Act.</p>
        ) : (
          <ol className="space-y-2">
            {row.history.map((h) => (
              <li key={h.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <ChangeLines change={h} />
                  <StatusChip status={h.source === "system" ? "locked" : STATUS_LABEL[h.status]?.status ?? h.status} label={h.source === "system" ? "By the system" : h.scheduled ? "Scheduled" : STATUS_LABEL[h.status]?.label} />
                </div>
                <p className="mt-0.5 text-2xs text-ink-muted">“{h.reason}”</p>
                <p className="text-2xs text-ink-faint">
                  {h.source === "system" ? "" : `Proposed by ${h.preparedBy} · `}
                  {dateText(h.preparedAt.slice(0, 10))}
                  {h.decidedBy ? ` · ${h.status === "approved" ? "approved" : h.status} by ${h.decidedBy}` : ""}
                  {h.decisionNote && h.status === "rejected" ? `: “${h.decisionNote}”` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Timeline({ change }: { change: PolicyChangeView }) {
  const dateText = useDateText();
  return (
    <ol className="mt-2 space-y-1 border-t border-line pt-2 text-2xs">
      {change.timeline.map((t) => (
        <li key={t.id}>
          <span className="font-medium text-ink">{ACTION_LABEL[t.action] ?? t.action}</span>{" "}
          <span className="text-ink-muted">
            · {t.actorName} · {dateText(t.at.slice(0, 10))}
          </span>
        </li>
      ))}
      {change.status === "pending" && <li className="text-ink-muted">Waiting for a second person with Leave types → Approve</li>}
    </ol>
  );
}

/** The window to propose a change: only the type's settings, the minimum under each, a reason, a live preview. */
function ProposeWindow({ row, data, onClose, onSaved }: { row: PolicyTypeRow; data: LeavePolicyPageData; onClose: () => void; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const [start] = useState(() => ({ values: { ...row.values } as PolicyValues, applies: "next_year" as PolicyApplies, reason: "" }));
  const [form, setForm] = useState(start);
  const [preview, setPreview] = useState<PolicyPreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof PolicyValues>(k: K, v: PolicyValues[K]) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }));
  const changed = row.editable.filter((s) => form.values[s] !== row.values[s]);
  const asksWhen = row.creditedYearly && changed.includes("days");
  const input = { leaveTypeId: row.id, values: Object.fromEntries(changed.map((s) => [s, form.values[s]])), applies: form.applies, reason: form.reason };
  // The preview follows the settings and "when", not the reason being typed.
  const previewKey = JSON.stringify({ values: input.values, applies: input.applies });

  useEffect(() => {
    const what = JSON.parse(previewKey) as { values: Record<string, unknown>; applies: PolicyApplies };
    if (!Object.keys(what.values).length) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await previewLeavePolicyAction({ leaveTypeId: row.id, ...what });
      if (!live) return;
      if (r.success) {
        setPreview(r.data);
        setErrors(r.data.errors);
      } else setFailure(r.error);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [previewKey, row.id]);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const r = await proposeLeavePolicyAction(input);
    setSaving(false);
    if (!r.success) {
      setErrors(r.validationErrors ?? {});
      setFailure(r.error);
      return;
    }
    onSaved(
      r.data.otherApprovers > 0
        ? `The change to ${r.data.typeName} is waiting for a second person to approve it.`
        : `The change to ${r.data.typeName} is saved, but nobody else can approve it yet: give a second user Leave types → Approve.`
    );
  };

  const help = (s: PolicySetting) => {
    const f = floorText(s, row.floor);
    return f ? `Minimum: ${f}` : undefined;
  };
  const shown = preview && changed.length ? preview : null;
  // A setting below the minimum (or a missing "when") can't be sent; the reason is checked on Send.
  const refused = !!shown && Object.keys(shown.errors).some((k) => k !== "reason");

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title={`Propose a change: ${row.name}`}
      description={`Only in the employees' favour (${row.law} is the minimum). Someone else approves it before anything changes.`}
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || !changed.length || refused}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send for approval
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          {row.editable.includes("days") && (
            <GridField label={row.creditedYearly ? "Days a year" : "Days each time"} error={errors.days} size="code" help={help("days")} suffix={help("days")}>
              <NumberField name="days" value={form.values.days} onChange={(v) => set("days", v)} decimals={1} max={365} selectOnFocus aria-label="Days" />
            </GridField>
          )}
          {row.editable.includes("paidDays") && (
            <GridField label="Paid days" error={errors.paidDays} size="code" help={help("paidDays")} suffix={help("paidDays")}>
              <NumberField name="paidDays" value={form.values.paidDays ?? 0} onChange={(v) => set("paidDays", v)} decimals={1} max={365} selectOnFocus aria-label="Paid days" />
            </GridField>
          )}
          {row.editable.includes("accrualEveryDays") && (
            <GridField label="1 day for every … paid days" error={errors.accrualEveryDays} size="code" help={help("accrualEveryDays")} suffix={help("accrualEveryDays")}>
              <NumberField name="accrualEveryDays" value={form.values.accrualEveryDays ?? 20} onChange={(v) => set("accrualEveryDays", v)} decimals={0} max={365} selectOnFocus aria-label="Paid days for one day of home leave" />
            </GridField>
          )}
          {row.editable.includes("cap") && (
            <GridField label="Can be saved up to (days)" error={errors.cap} size="code" help={help("cap")} suffix={help("cap")}>
              <NumberField name="cap" value={form.values.cap ?? 0} onChange={(v) => set("cap", v)} decimals={1} max={365} selectOnFocus aria-label="Can be saved up to" />
            </GridField>
          )}
          {row.editable.includes("certificateAfter") && (
            <>
              <GridField label="Ask for a certificate" size="md">
                <YesNoField name="askCertificate" value={form.values.certificateAfter !== null} onChange={(yes) => set("certificateAfter", yes ? (row.values.certificateAfter ?? row.floor.certificateAfter ?? 3) : null)} aria-label="Ask for a certificate" />
              </GridField>
              {form.values.certificateAfter !== null && (
                <GridField label="After … days in a row" error={errors.certificateAfter} size="code" help={help("certificateAfter")} suffix={help("certificateAfter")}>
                  <NumberField name="certificateAfter" value={form.values.certificateAfter} onChange={(v) => set("certificateAfter", v)} decimals={0} max={365} selectOnFocus aria-label="Certificate after days in a row" />
                </GridField>
              )}
            </>
          )}
          {row.editable.includes("expiryDays") && (
            <GridField label="Must be taken within (days)" error={errors.expiryDays} size="code" help={help("expiryDays")} suffix={help("expiryDays")}>
              <NumberField name="expiryDays" value={form.values.expiryDays ?? 21} onChange={(v) => set("expiryDays", v)} decimals={0} max={365} selectOnFocus aria-label="Must be taken within days" />
            </GridField>
          )}
          {row.editable.includes("dayBasis") && (
            <GridField label="Days counted" error={errors.dayBasis} size="lg" help="The law counts every calendar day; counting working days only gives more leave">
              <SelectField
                name="dayBasis"
                options={[
                  { value: "calendar", label: "Every calendar day (the law)" },
                  { value: "working", label: "Working days only" },
                ]}
                value={form.values.dayBasis}
                onChange={(v) => set("dayBasis", v as PolicyValues["dayBasis"])}
              />
            </GridField>
          )}
          {row.editable.includes("allowHalfDay") && (
            <GridField label="Half days allowed" error={errors.allowHalfDay} size="md">
              <YesNoField name="allowHalfDay" value={form.values.allowHalfDay} onChange={(v) => set("allowHalfDay", v)} aria-label="Half days allowed" />
            </GridField>
          )}
          {asksWhen && (
            <GridField label="Days a year apply" error={errors.applies} span={2} size="full">
              <SelectField
                name="applies"
                options={[
                  { value: "next_year", label: data.nextYearStart ? `From the next leave year (${dateText(data.nextYearStart)})` : "From the next leave year" },
                  { value: "top_up", label: "From approval, and top up everyone for this year" },
                ]}
                value={form.applies}
                onChange={(v) => setForm((f) => ({ ...f, applies: v as PolicyApplies }))}
              />
            </GridField>
          )}
          <GridField label="Why" required error={errors.reason} span={2} size="full">
            <input name="reason" value={form.reason} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Board decision of 5 Asoj: 15 sick days for all staff" className={inputClass} />
          </GridField>
        </FormGrid>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs">
          {!changed.length && <p className="text-ink-muted">Change a setting to see what it means for employees.</p>}
          {refused && <p className="font-medium text-danger">Not in the employees&apos; favour: change the highlighted setting. Going below the Labour Act needs an exception from the platform.</p>}
          {shown && !refused && (
            <>
              <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">What changes</h3>
              <ul className="space-y-0.5">
                {shown.lines.map((l) => (
                  <li key={l.setting} className="text-ink">
                    {l.text}
                    <span className="text-ink-muted">
                      {" — "}
                      {shown.deferred.includes(l.setting) && shown.effectiveFrom ? `from ${dateText(shown.effectiveFrom)}` : shown.applies === "top_up" && l.setting === "days" ? "once approved, topped up for this year" : "once approved"}
                    </span>
                  </li>
                ))}
              </ul>
              {shown.topUp && (
                <p className="text-ink-muted">
                  Top-up now: {shown.topUp.people} employee{shown.topUp.people === 1 ? "" : "s"}
                  {shown.topUp.examples.length ? ` (${shown.topUp.examples.map((e) => `${e.name} +${fmt(e.days)}`).join(", ")}${shown.topUp.people > shown.topUp.examples.length ? ", …" : ""})` : ""}.
                </p>
              )}
            </>
          )}
          <p className="text-2xs text-ink-muted">
            {data.otherApprovers.length
              ? `Approved by someone else: ${data.otherApprovers.slice(0, 4).join(", ")}${data.otherApprovers.length > 4 ? ", …" : ""}.`
              : "Nobody else can approve it yet: give a second user a company-wide role with Leave types → Approve."}
          </p>
        </div>
      </PropertyForm>
    </Window>
  );
}

/** One exception in the settings box: what it lowers, the directive, its dates, and how long is left. */
function ExceptionNote({ e, today }: { e: PolicyException; today: string }) {
  const dateText = useDateText();
  const state = exceptionState(e, today);
  const left = e.validUntil ? daysBetween(today, e.validUntil) : null;
  const tone = state === "active" && left !== null && left <= 30 ? "warning" : "info";
  const when = state === "revoked" ? "withdrawn by the platform" : state === "ended" ? "ended" : state === "scheduled" ? `starts ${dateText(e.validFrom)}` : left !== null ? `${left} day${left === 1 ? "" : "s"} left` : "in force";
  return (
    <Notice tone={tone} className="mt-2" title={`Exception: ${e.legalBasis}`}>
      {SETTING_LABEL[e.setting]}: down to {valueText(e.setting, e.value ?? undefined)} · {dateText(e.validFrom)} – {e.validUntil ? dateText(e.validUntil) : "open"} · {when}
      {e.reference ? ` · ${e.reference}` : ""}
      {state === "revoked" && e.revokeReason ? `: “${e.revokeReason}”` : ""}
      {state === "active" ? ". Propose the change to use it." : ""}
    </Notice>
  );
}

/**
 * Ask the platform to lower one Labour Act minimum for this company, with the
 * directive that allows it (e.g. a regulator's). Checked here as you type with
 * the same rules the platform uses; nothing changes until it is granted.
 */
function AskExceptionWindow({ row, today, onClose, onSaved }: { row: PolicyTypeRow; today: string; onClose: () => void; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const yearOn = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
  // Starts at the law's own value for the setting: nothing is asked until it is changed.
  const lawValue = (s: string) => (row.floor as Record<string, number | undefined>)[s] ?? 0;
  const [start] = useState(() => ({ setting: row.exceptionSettings[0] as string, value: lawValue(row.exceptionSettings[0]), legalBasis: "", reference: "", validFrom: today, validUntil: yearOn(today), reason: "" }));
  const [form, setForm] = useState(start);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
  };
  const setting = form.setting as PolicySetting;
  const lawText = floorText(setting, row.floor);
  const live = exceptionErrors({ statutoryCode: row.statutoryCode, setting, value: form.value, legalBasis: form.legalBasis, reference: form.reference, validFrom: form.validFrom, validUntil: form.validUntil }, today);
  // A changed value is checked at once; everything else once Send was tried.
  const errors = { ...(tried ? live : live.value && form.value !== lawValue(form.setting) ? { value: live.value } : {}), ...serverErrors };
  const integer = setting === "accrualEveryDays" || setting === "certificateAfter" || setting === "expiryDays";

  const save = async () => {
    setTried(true);
    if (Object.keys(live).length || form.reason.trim().length < 8) {
      if (form.reason.trim().length < 8) setServerErrors({ reason: "Say why the company needs it (at least a sentence)" });
      return;
    }
    setSaving(true);
    setFailure(null);
    const r = await requestLeaveExceptionAction({ statutoryCode: row.statutoryCode, ...form });
    setSaving(false);
    if (!r.success) {
      setServerErrors(r.validationErrors ?? {});
      setFailure(r.error);
      return;
    }
    onSaved(`The exception request for ${r.data.typeName} was sent to the platform. You'll see their answer here.`);
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title={`Ask for an exception: ${row.name}`}
      description="Only for a company whose regulator (e.g. Nepal Rastra Bank) or another law sets a different minimum. The platform checks the directive and grants it for set dates."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send to the platform
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Setting" required error={errors.setting} size="lg">
            <SelectField
              name="setting"
              options={row.exceptionSettings.map((s) => ({ value: s, label: SETTING_LABEL[s] }))}
              value={form.setting}
              onChange={(v) => {
                setForm((f) => ({ ...f, setting: v, value: lawValue(v) }));
                setServerErrors({});
              }}
            />
          </GridField>
          <GridField label="Down to" required error={errors.value} size="code" suffix={lawText ? `Law: ${lawText}` : undefined} help={lawText ? `The Labour Act: ${lawText}` : undefined}>
            <NumberField name="value" value={form.value} onChange={(v) => set("value", v)} decimals={integer ? 0 : 1} max={365} selectOnFocus showZero aria-label="Value under the exception" />
          </GridField>
          <GridField label="Directive or law" required error={errors.legalBasis} span={2} size="full">
            <input name="legalBasis" value={form.legalBasis} maxLength={300} onChange={(e) => set("legalBasis", e.target.value)} placeholder="e.g. Nepal Rastra Bank directive 3/2083 on staff service" className={inputClass} />
          </GridField>
          <GridField label="Number and date" error={errors.reference} span={2} size="full">
            <input name="reference" value={form.reference} maxLength={300} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. Ref. 12, issued 1 Asar 2083" className={inputClass} />
          </GridField>
          <GridField label="From" required error={errors.validFrom} size="date">
            <DateField name="validFrom" value={form.validFrom} onChange={(v) => set("validFrom", v)} />
          </GridField>
          <GridField label="Until" required error={errors.validUntil} size="date">
            <DateField name="validUntil" value={form.validUntil} onChange={(v) => set("validUntil", v)} />
          </GridField>
          <GridField label="Why" required error={errors.reason} span={2} size="full">
            <input name="reason" value={form.reason} maxLength={1000} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. The directive stops staff saving up annual leave from Shrawan 2083" className={inputClass} />
          </GridField>
        </FormGrid>
        <div className="space-y-1 border-t border-line px-4 py-3 text-xs">
          <p className="text-ink">
            {SETTING_LABEL[setting]}: the law&apos;s {lawText ?? "minimum"} → {valueText(setting, form.value)}, {form.validFrom ? dateText(form.validFrom) : "…"} – {form.validUntil ? dateText(form.validUntil) : "…"}.
          </p>
          <p className="text-2xs text-ink-muted">If it is granted, you still propose the change here and a second person approves it. When it ends, the setting goes back to the law by itself.</p>
        </div>
      </PropertyForm>
    </Window>
  );
}
