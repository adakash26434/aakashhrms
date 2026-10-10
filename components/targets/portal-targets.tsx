"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { Notice } from "@/components/kit/notice";
import { SelectField } from "@/components/kit/select-field";
import { fileProblem } from "@/lib/engines/employee-document.engine";
import { employeeCanEdit } from "@/lib/engines/target.engine";
import { removeMyEvidenceAction, reviewTeamTargetAction, saveMyAchievementAction, submitMyTargetsAction } from "@/app/actions/my-targets.actions";
import { EvidenceList, fmt, pctText, targetStatusChip } from "@/components/targets/target-bits";
import { t, type EssKey, type EssLang } from "@/lib/i18n/ess";
import { TARGET_ATTACHMENT_MAX, type MyTargetsData, type PeriodScore, type TargetAttachmentRef, type TargetRow } from "@/lib/types/target";

// Targets (G15), portal side. The employee reports against each target and
// sends the period to the supervisor; the supervisor sees the team's reports,
// corrects the figure and forwards to HR or returns with a reason. The server
// decides who may do what — nothing here is access control.

const periodKey = (r: TargetRow) => `${r.employeeId}|${r.periodKind}|${r.fy}|${r.monthNo ?? ""}`;
const statusText = (lang: EssLang, s: TargetRow["status"]) => t(lang, `targets.status.${s}` as EssKey);

function groupByPeriod(rows: readonly TargetRow[]) {
  const groups = new Map<string, TargetRow[]>();
  for (const r of rows) groups.set(periodKey(r), [...(groups.get(periodKey(r)) ?? []), r]);
  return [...groups.values()].sort((a, b) => {
    const [x, y] = [a[0], b[0]];
    return y.fy.localeCompare(x.fy) || (y.periodKind === "year" ? 1 : 0) - (x.periodKind === "year" ? 1 : 0) || (y.monthNo ?? 0) - (x.monthNo ?? 0) || x.employeeName.localeCompare(y.employeeName);
  });
}

const scoreFor = (scores: readonly PeriodScore[], r: TargetRow) =>
  scores.find((s) => s.employeeId === r.employeeId && s.periodKind === r.periodKind && s.fy === r.fy && s.monthNo === r.monthNo)?.score ?? null;

function YearPicker({ lang, years, value, onChange }: { lang: EssLang; years: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">{t(lang, "targets.year")}</span>
      <div className="w-40">
        <SelectField options={years.map((y) => ({ value: y, label: y }))} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

const cardClass = "overflow-hidden rounded-xl border border-line bg-surface shadow-xs";
const buttonClass = "inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

// ---- the employee --------------------------------------------------------------

export function MyTargetsClient({ lang, data }: { lang: EssLang; data: MyTargetsData }) {
  const router = useRouter();
  const [fy, setFy] = useState(data.currentFy);
  const [open, setOpen] = useState<TargetRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const groups = useMemo(() => groupByPeriod(data.rows.filter((r) => r.fy === fy)), [data.rows, fy]);
  const L = (k: EssKey) => t(lang, k);

  const submit = (rows: TargetRow[]) =>
    startTransition(async () => {
      setNotice(null);
      const result = await submitMyTargetsAction(rows.map((r) => r.id));
      if (result.success) {
        setNotice({ tone: "success", text: L("targets.submitted") });
        router.refresh();
      } else setNotice({ tone: "danger", text: result.error });
    });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{L("targets.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{L("targets.description")}</p>
        </div>
        <YearPicker lang={lang} years={data.fiscalYears} value={fy} onChange={setFy} />
      </header>
      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}
      {groups.length === 0 && <p className="text-sm text-ink-muted">{L("targets.none")}</p>}
      {groups.map((rows) => {
        const ready = rows.filter((r) => employeeCanEdit(r.status) && r.achievedValue !== null);
        return (
          <section key={periodKey(rows[0])} className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-sunken px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">
                {rows[0].periodLabel} <span className="font-normal text-ink-muted">· {L(rows[0].periodKind === "month" ? "targets.monthly" : "targets.yearly")}</span>
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-ink-muted">{L("targets.score")}: <span className="font-semibold text-ink">{pctText(scoreFor(data.scores, rows[0]))}</span></span>
                {ready.length > 0 && (
                  <button type="button" className={primaryClass} disabled={pending} onClick={() => submit(ready)}>
                    {L("targets.submit")} ({ready.length})
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="px-4 py-2">{L("targets.target")}</th>
                    <th className="px-4 py-2 text-right">{L("targets.goal")}</th>
                    <th className="px-4 py-2 text-right">{L("targets.weight")}</th>
                    <th className="px-4 py-2 text-right">{L("targets.reported")}</th>
                    <th className="px-4 py-2 text-right">{L("targets.achieved")}</th>
                    <th className="px-4 py-2">{L("targets.status")}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line/60">
                      <td className="px-4 py-2 font-medium text-ink">{r.title}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(r.targetValue, r.unit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.weight}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(r.achievedValue, r.unit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{pctText(r.pct)}</td>
                      <td className="px-4 py-2" title={statusText(lang, r.status)}>{targetStatusChip(r.status)}</td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" className={buttonClass} onClick={() => setOpen(r)}>
                          {employeeCanEdit(r.status) ? L("targets.report") : L("targets.view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {open && (
        <ReportWindow
          key={open.id}
          lang={lang}
          row={data.rows.find((r) => r.id === open.id) ?? open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReportWindow({ lang, row, onClose, onSaved }: { lang: EssLang; row: TargetRow; onClose: () => void; onSaved: () => void }) {
  const editable = employeeCanEdit(row.status);
  const L = (k: EssKey) => t(lang, k);
  const [value, setValue] = useState(row.achievedValue === null ? "" : String(row.achievedValue));
  const [note, setNote] = useState(row.achievedNote);
  const [files, setFiles] = useState<TargetAttachmentRef[]>(row.attachments);
  const [staged, setStaged] = useState<TargetAttachmentRef[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const picker = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    const problem = fileProblem(file.size);
    if (problem) return setError(problem);
    if (files.length + staged.length >= TARGET_ATTACHMENT_MAX) return setError(`At most ${TARGET_ATTACHMENT_MAX} files can be attached.`);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/targets/evidence", { method: "POST", body });
      const json = (await res.json()) as { success: boolean; data?: TargetAttachmentRef; error?: string };
      if (json.success && json.data) setStaged((s) => [...s, json.data!]);
      else setError(json.error ?? "The upload failed.");
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  };

  const remove = (file: TargetAttachmentRef, from: "saved" | "staged") =>
    startTransition(async () => {
      const result = await removeMyEvidenceAction(file.id);
      if (!result.success) return setError(result.error);
      if (from === "saved") setFiles((l) => l.filter((f) => f.id !== file.id));
      else setStaged((l) => l.filter((f) => f.id !== file.id));
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveMyAchievementAction(row.id, { achievedValue: value, note }, staged.map((f) => f.id));
      if (result.success) onSaved();
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title={`${row.title} · ${row.periodLabel}`}
      size="md"
      dirty={editable}
      footer={
        <>
          <WindowButton onClick={onClose}>{editable ? "Cancel" : "Close"}</WindowButton>
          {editable && (
            <WindowButton variant="primary" onClick={save} disabled={pending || uploading}>
              {pending ? "…" : L("targets.save")}
            </WindowButton>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {row.status === "returned" && row.returnReason && (
          <Notice tone="warning" title={L("targets.returnedWhy")}>{row.returnReason}</Notice>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          {targetStatusChip(row.status)}
          <span>{L("targets.goal")}: <span className="font-semibold text-ink">{fmt(row.targetValue, row.unit)}</span></span>
          <span>{L("targets.weight")}: {row.weight}%</span>
        </div>
        <PropertyForm enterNavigation>
          <FieldGroup title={L("targets.myAchievement")}>
            <FieldRow label={`${L("targets.reported")}${row.unit ? ` (${row.unit})` : ""}`} required={editable} error={errors.achievedValue}>
              {editable ? <input className={inputClass} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /> : <span className="text-sm text-ink">{fmt(row.achievedValue, row.unit)}</span>}
            </FieldRow>
            <FieldRow label={L("targets.note")} error={errors.note}>
              {editable ? (
                <textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
              ) : (
                <span className="whitespace-pre-wrap text-sm text-ink">{row.achievedNote || "—"}</span>
              )}
            </FieldRow>
            <FieldRow label={L("targets.files")} error={errors.attachments}>
              <div className="space-y-2">
                {(files.length > 0 || staged.length === 0) && <EvidenceList files={files} onRemove={editable ? (f) => remove(f, "saved") : undefined} />}
                {staged.length > 0 && <EvidenceList files={staged} onRemove={(f) => remove(f, "staged")} />}
                {editable && (
                  <>
                    <input ref={picker} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" data-enter-skip onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    <button type="button" data-enter-skip className={buttonClass} disabled={uploading} onClick={() => picker.current?.click()}>
                      <Paperclip aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                      {uploading ? "…" : L("targets.attach")}
                    </button>
                  </>
                )}
              </div>
            </FieldRow>
          </FieldGroup>
          {(row.verifiedValue !== null || row.reviewerNote) && (
            <FieldGroup title={L("targets.supervisorNote")}>
              <FieldRow label={L("targets.verified")}><span className="text-sm text-ink">{fmt(row.verifiedValue, row.unit)}</span></FieldRow>
              {row.reviewerNote && <FieldRow label={L("targets.note")}><span className="whitespace-pre-wrap text-sm text-ink">{row.reviewerNote}</span></FieldRow>}
            </FieldGroup>
          )}
        </PropertyForm>
      </div>
    </Window>
  );
}

// ---- the supervisor ------------------------------------------------------------

export function TeamTargetsClient({ lang, data }: { lang: EssLang; data: MyTargetsData }) {
  const router = useRouter();
  const [fy, setFy] = useState(data.currentFy);
  const [view, setView] = useState<"waiting" | "all">("waiting");
  const [open, setOpen] = useState<TargetRow | null>(null);
  const L = (k: EssKey) => t(lang, k);
  const rows = useMemo(() => data.rows.filter((r) => r.fy === fy && (view === "all" || r.status === "submitted")), [data.rows, fy, view]);
  const waiting = data.rows.filter((r) => r.fy === fy && r.status === "submitted").length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{L("team.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{L("team.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
            <button type="button" className={`px-3 py-2 ${view === "waiting" ? "bg-brand text-white" : "bg-surface text-ink"}`} onClick={() => setView("waiting")}>{L("team.waiting")} ({waiting})</button>
            <button type="button" className={`px-3 py-2 ${view === "all" ? "bg-brand text-white" : "bg-surface text-ink"}`} onClick={() => setView("all")}>{L("team.all")}</button>
          </div>
          <YearPicker lang={lang} years={data.fiscalYears} value={fy} onChange={setFy} />
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{L("team.none")}</p>
      ) : (
        <div className={cardClass}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-sunken text-left text-xs text-ink-muted">
                  <th className="px-4 py-2">{L("team.employee")}</th>
                  <th className="px-4 py-2">{L("targets.target")}</th>
                  <th className="px-4 py-2 text-right">{L("targets.goal")}</th>
                  <th className="px-4 py-2 text-right">{L("targets.reported")}</th>
                  <th className="px-4 py-2 text-right">{L("targets.achieved")}</th>
                  <th className="px-4 py-2">{L("targets.status")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="px-4 py-2 font-medium text-ink">{r.employeeName}<span className="block text-xs font-normal text-ink-faint">{r.periodLabel}</span></td>
                    <td className="px-4 py-2">{r.title}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(r.targetValue, r.unit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(r.achievedValue, r.unit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pctText(r.pct)}</td>
                    <td className="px-4 py-2">{targetStatusChip(r.status)}</td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" className={r.status === "submitted" ? primaryClass : buttonClass} onClick={() => setOpen(r)}>
                        {r.status === "submitted" ? L("team.review") : L("targets.view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {open && (
        <ReviewWindow
          key={open.id}
          lang={lang}
          row={data.rows.find((r) => r.id === open.id) ?? open}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReviewWindow({ lang, row, onClose, onDone }: { lang: EssLang; row: TargetRow; onClose: () => void; onDone: () => void }) {
  const L = (k: EssKey) => t(lang, k);
  const reviewable = row.status === "submitted";
  const [verified, setVerified] = useState(String(row.verifiedValue ?? row.achievedValue ?? ""));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "forward" | "return") =>
    startTransition(async () => {
      setError(null);
      const result = await reviewTeamTargetAction(row.id, decision, verified, note);
      if (result.success) onDone();
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title={`${row.employeeName} · ${row.title}`}
      size="md"
      footer={
        <>
          <WindowButton onClick={onClose}>Close</WindowButton>
          {reviewable && (
            <>
              <WindowButton onClick={() => decide("return")} disabled={pending}>{L("team.return")}</WindowButton>
              <WindowButton variant="primary" onClick={() => decide("forward")} disabled={pending}>{L("team.forward")}</WindowButton>
            </>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          {targetStatusChip(row.status)}
          <span>{row.periodLabel}</span>
          <span>{L("targets.goal")}: <span className="font-semibold text-ink">{fmt(row.targetValue, row.unit)}</span></span>
          <span>{L("targets.achieved")}: <span className="font-semibold text-ink">{pctText(row.pct)}</span></span>
        </div>
        <PropertyForm enterNavigation>
          <FieldGroup title={L("targets.myAchievement")}>
            <FieldRow label={L("targets.reported")}><span className="text-sm text-ink">{fmt(row.achievedValue, row.unit)}</span></FieldRow>
            <FieldRow label={L("targets.note")}><span className="whitespace-pre-wrap text-sm text-ink">{row.achievedNote || "—"}</span></FieldRow>
            <FieldRow label={L("targets.files").split(" (")[0]}><EvidenceList files={row.attachments} /></FieldRow>
          </FieldGroup>
          {reviewable ? (
            <FieldGroup title={L("team.forward")}>
              <FieldRow label={L("team.verifiedValue")} error={errors.verifiedValue}>
                <input className={inputClass} inputMode="decimal" value={verified} onChange={(e) => setVerified(e.target.value)} />
              </FieldRow>
              <FieldRow label={L("team.reason")} error={errors.note}>
                <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </FieldRow>
            </FieldGroup>
          ) : (
            (row.verifiedValue !== null || row.reviewerNote) && (
              <FieldGroup title={L("targets.supervisorNote")}>
                <FieldRow label={L("targets.verified")}><span className="text-sm text-ink">{fmt(row.verifiedValue, row.unit)}</span></FieldRow>
                {row.reviewerNote && <FieldRow label={L("targets.note")}><span className="whitespace-pre-wrap text-sm text-ink">{row.reviewerNote}</span></FieldRow>}
              </FieldGroup>
            )
          )}
        </PropertyForm>
      </div>
    </Window>
  );
}
