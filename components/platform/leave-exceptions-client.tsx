"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { ReasonWindow } from "@/components/attendance/attendance-windows";
import { EDITABLE, LAW, SETTING_LABEL, exceptionErrors, exceptionSettings, exceptionState, floorOn, floorText } from "@/lib/engines/leave-policy.engine";
import { fmt } from "@/lib/engines/leave.engine";
import type { ExceptionInput } from "@/lib/engines/leave-policy.engine";
import type { ExceptionRequestView, PlatformExceptionView } from "@/lib/platform/leave-exceptions";
import type { PolicySetting } from "@/lib/types/leave-policy";

type Data = { requests: ExceptionRequestView[]; exceptions: PlatformExceptionView[]; companies: { id: string; name: string; code: string }[] };

const TYPE_NAME: Record<string, string> = { HOME: "Home leave", SICK: "Sick leave", MATERNITY: "Maternity leave", PATERNITY: "Maternity care", MOURNING: "Mourning leave", SUBSTITUTE: "Substitute leave" };
const REQUEST_STATUS: Record<string, { status: string; label: string }> = {
  PENDING: { status: "pending", label: "To review" },
  APPROVED: { status: "approved", label: "Granted" },
  REJECTED: { status: "rejected", label: "Rejected" },
  CANCELLED: { status: "cancelled", label: "Withdrawn" },
};
const STATE: Record<string, { status: string; label: string }> = {
  active: { status: "active", label: "In force" },
  scheduled: { status: "review", label: "Starts later" },
  ended: { status: "inactive", label: "Ended" },
  revoked: { status: "cancelled", label: "Revoked" },
};
const today = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);
const what = (i: Pick<ExceptionInput, "statutoryCode" | "setting" | "value">) => `${TYPE_NAME[i.statutoryCode] ?? i.statutoryCode} · ${SETTING_LABEL[i.setting as PolicySetting] ?? i.setting}: ${i.value === null ? "—" : fmt(i.value)}`;
const lawOf = (i: Pick<ExceptionInput, "statutoryCode" | "setting">) => floorText(i.setting as PolicySetting, floorOn(i.statutoryCode, "2000-01-01", []).floor) ?? "—";

async function call(url: string, method: string, body?: unknown): Promise<{ success: boolean; error?: string; validationErrors?: Record<string, string>; data?: unknown }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return await res.json();
  } catch {
    return { success: false, error: "The platform could not be reached." };
  }
}

/**
 * Platform → Leave exceptions (4.6d): companies' requests to lower one Labour
 * Act minimum (with the directive), and the exceptions granted. A super admin
 * grants (value and dates may be adjusted), rejects with a reason, grants one
 * directly, or revokes one with a reason. Each is audited and copied to the
 * company at once (and again on every policy sync).
 */
export function LeaveExceptionsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [exceptionId, setExceptionId] = useState<string | null>(null);
  const [granting, setGranting] = useState<null | { request: ExceptionRequestView | null }>(null);
  const [rejecting, setRejecting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call("/api/platform/leave-exceptions", "GET");
    setLoading(false);
    if (r.success) setData(r.data as Data);
    else setNotice({ tone: "danger", text: r.error ?? "Could not load leave exceptions." });
  }, []);
  useEffect(() => {
    // Loads once on open; Refresh loads again.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const requests = data?.requests ?? [];
  const exceptions = data?.exceptions ?? [];
  const request = requests.find((r) => r.id === requestId) ?? null;
  const exception = exceptions.find((e) => e.id === exceptionId) ?? null;
  const waiting = requests.filter((r) => r.status === "PENDING").length;
  const now = today();

  const requestColumns = useMemo<GridColumn<ExceptionRequestView>[]>(
    () => [
      { id: "company", header: "Company", width: 170, sticky: true, value: (r) => r.companyName, cell: (r) => <span className="font-medium text-ink">{r.companyName} <span className="font-code text-3xs text-ink-faint">{r.companyCode}</span></span> },
      { id: "what", header: "Asks for", width: 250, value: (r) => what(r.input), cell: (r) => <span title={`The law: ${lawOf(r.input)}`}>{what(r.input)}</span> },
      { id: "basis", header: "Directive", width: 160, value: (r) => r.input.legalBasis, cell: (r) => <span className="block truncate" title={`${r.input.legalBasis}${r.input.reference ? ` · ${r.input.reference}` : ""}`}>{r.input.legalBasis}</span> },
      { id: "dates", header: "Dates", width: 200, value: (r) => r.input.validFrom, cell: (r) => <span className="tabular-nums">{r.input.validFrom} – {r.input.validUntil}</span> },
      { id: "by", header: "Asked by", width: 150, value: (r) => r.requestedBy },
      { id: "status", header: "Status", width: 110, value: (r) => r.status, cell: (r) => <StatusChip status={REQUEST_STATUS[r.status]?.status ?? r.status} label={REQUEST_STATUS[r.status]?.label} /> },
    ],
    []
  );
  const exceptionColumns = useMemo<GridColumn<PlatformExceptionView>[]>(
    () => [
      { id: "company", header: "Company", width: 170, sticky: true, value: (e) => e.companyName, cell: (e) => <span className="font-medium text-ink">{e.companyName} <span className="font-code text-3xs text-ink-faint">{e.companyCode}</span></span> },
      { id: "what", header: "Exception", width: 250, value: (e) => what(e), cell: (e) => <span title={`The law: ${lawOf(e)}`}>{what(e)}</span> },
      { id: "basis", header: "Directive", width: 160, value: (e) => e.legalBasis, cell: (e) => <span className="block truncate" title={`${e.legalBasis}${e.reference ? ` · ${e.reference}` : ""}`}>{e.legalBasis}</span> },
      { id: "dates", header: "Dates", width: 200, value: (e) => e.validFrom, cell: (e) => <span className="tabular-nums">{e.validFrom} – {e.validUntil ?? "open"}</span> },
      { id: "copied", header: "Copied", width: 110, value: (e) => e.syncedAt ?? "", cell: (e) => (e.syncedAt ? <span className="text-ink-muted">{e.syncedAt.slice(0, 10)}</span> : <StatusChip status="pending" label="Not yet" />) },
      { id: "state", header: "Status", width: 120, value: (e) => exceptionState(e, now), cell: (e) => <StatusChip status={STATE[exceptionState(e, now)].status} label={STATE[exceptionState(e, now)].label} /> },
    ],
    [now]
  );

  const done = (text: string) => {
    setNotice({ tone: "success", text });
    void load();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Leave exceptions</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            A company whose regulator or another law sets a different minimum (e.g. a Nepal Rastra Bank directive) may go below one Labour Act setting, for set dates. Without an exception nobody can go below the law.
          </p>
        </div>
        <div className="flex gap-2">
          <WindowButton variant="primary" onClick={() => setGranting({ request: null })}>
            <Plus className="h-3.5 w-3.5" /> New exception…
          </WindowButton>
          <WindowButton onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </WindowButton>
        </div>
      </div>
      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <section aria-label="Requests from companies" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold text-ink">
            Requests from companies {waiting ? <span className="text-warning">· {waiting} to review</span> : null}
          </h2>
          <WindowButton variant="primary" onClick={() => request && setGranting({ request })} disabled={request?.status !== "PENDING"}>
            <Check className="h-3.5 w-3.5" /> Grant…
          </WindowButton>
          <WindowButton variant="danger" onClick={() => setRejecting(true)} disabled={request?.status !== "PENDING"}>
            <X className="h-3.5 w-3.5" /> Reject…
          </WindowButton>
        </div>
        {request && (
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink">
            <span className="font-medium">Why:</span> “{request.reason}”{request.input.reference ? ` · ${request.input.reference}` : ""}
            {request.rejectionReason ? <span className="text-danger"> · Rejected: “{request.rejectionReason}”</span> : null}
            {request.reviewedBy ? <span className="text-ink-muted"> · reviewed by {request.reviewedBy}</span> : null}
          </p>
        )}
        <DataGrid
          id="platform-leave-exception-requests"
          label="Leave exception requests"
          columns={requestColumns}
          rows={requests}
          getRowId={(r) => r.id}
          activeRowId={requestId}
          onActiveRowChange={(r) => setRequestId(r.id)}
          onOpen={(r) => r.status === "PENDING" && setGranting({ request: r })}
          loading={loading && !data}
          pageSize={25}
          empty={{ title: "No requests", description: "A company asks from Time & Leave → Policies → Leave types → Ask for an exception." }}
        />
      </section>

      <section aria-label="Exceptions granted" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold text-ink">Exceptions granted</h2>
          <WindowButton variant="danger" onClick={() => setRevoking(true)} disabled={!exception || !!exception.revokedAt || exceptionState(exception, now) === "ended"}>
            <Ban className="h-3.5 w-3.5" /> Revoke…
          </WindowButton>
        </div>
        {exception?.revokeReason && <p className="text-xs text-ink-muted">Revoked: “{exception.revokeReason}”</p>}
        <DataGrid
          id="platform-leave-exceptions"
          label="Leave exceptions"
          columns={exceptionColumns}
          rows={exceptions}
          getRowId={(e) => e.id}
          activeRowId={exceptionId}
          onActiveRowChange={(e) => setExceptionId(e.id)}
          loading={loading && !data}
          pageSize={25}
          empty={{ title: "No exceptions", description: "Granted exceptions appear here, and in the company's Leave types." }}
        />
      </section>

      {granting && data && (
        <GrantWindow
          request={granting.request}
          companies={data.companies}
          onClose={() => setGranting(null)}
          onSaved={(text) => {
            setGranting(null);
            done(text);
          }}
        />
      )}
      {rejecting && request && (
        <ReasonWindow
          title={`Reject the request from ${request.companyName}?`}
          description="Say why. The company sees your reason under Leave types."
          action="Reject"
          danger
          onClose={() => setRejecting(false)}
          onConfirm={async (reason) => {
            const r = await call(`/api/platform/leave-exceptions/requests/${request.id}`, "PATCH", { reason });
            if (!r.success) return r.validationErrors?.reason ?? r.error ?? "Not rejected.";
            setRejecting(false);
            done(`The request from ${request.companyName} was rejected.`);
            return null;
          }}
        />
      )}
      {revoking && exception && (
        <ReasonWindow
          title={`Revoke the exception for ${exception.companyName}?`}
          description="From today the company's setting goes back to the Labour Act minimum (recorded in its history). Say why; the company sees it."
          action="Revoke"
          danger
          onClose={() => setRevoking(false)}
          onConfirm={async (reason) => {
            const r = await call(`/api/platform/leave-exceptions/${exception.id}`, "PATCH", { reason });
            if (!r.success) return r.validationErrors?.reason ?? r.error ?? "Not revoked.";
            setRevoking(false);
            done(`The exception for ${exception.companyName} was revoked${(r.data as { copied?: boolean })?.copied === false ? "; it will reach the company at the next policy sync" : ""}.`);
            return null;
          }}
        />
      )}
    </div>
  );
}

/** Grant: from a company's request (value and dates may be adjusted) or directly for a chosen company. */
function GrantWindow({ request, companies, onClose, onSaved }: { request: ExceptionRequestView | null; companies: Data["companies"]; onClose: () => void; onSaved: (text: string) => void }) {
  const first = Object.keys(EDITABLE)[0];
  const [start] = useState(() =>
    request
      ? { companyId: request.companyId, ...request.input, value: request.input.value ?? 0 }
      : { companyId: "", statutoryCode: first, setting: exceptionSettings(first)[0] as string, value: 0, legalBasis: "", reference: "", validFrom: today(), validUntil: `${Number(today().slice(0, 4)) + 1}${today().slice(4)}` }
  );
  const [form, setForm] = useState(start);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
  };
  const settings = exceptionSettings(form.statutoryCode);
  const errors: Record<string, string> = { ...exceptionErrors(form, today()), ...(form.companyId ? {} : { companyId: "Choose the company" }), ...serverErrors };
  const lawText = floorText(form.setting as PolicySetting, floorOn(form.statutoryCode, "2000-01-01", []).floor);
  const company = companies.find((c) => c.id === form.companyId);

  const save = async () => {
    if (Object.keys(errors).length) return;
    setSaving(true);
    setFailure(null);
    const r = await call("/api/platform/leave-exceptions", "POST", { ...form, requestId: request?.id ?? null });
    setSaving(false);
    if (!r.success) {
      setServerErrors(r.validationErrors ?? {});
      setFailure(r.error ?? "Not granted.");
      return;
    }
    onSaved(`Exception granted to ${company?.name ?? request?.companyName ?? "the company"}${(r.data as { copied?: boolean })?.copied === false ? "; it will reach the company at the next policy sync" : " and copied to the company"}.`);
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title={request ? `Grant the request from ${request.companyName}` : "New leave exception"}
      description="Lowers one Labour Act minimum for one company, between two dates, with the legal basis. The company still proposes the change with a second person's approval; when it ends, the law applies again."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || Object.keys(errors).length > 0}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Grant
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Company" required error={errors.companyId} span={2} size="lg">
            {request ? (
              <span className="pt-1.5 text-xs font-medium text-ink">
                {request.companyName} <span className="font-code text-3xs text-ink-faint">{request.companyCode}</span>
              </span>
            ) : (
              <SelectField name="companyId" options={companies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} value={form.companyId} onChange={(v) => set("companyId", v)} placeholder="Choose a company" />
            )}
          </GridField>
          <GridField label="Leave type" required error={errors.statutoryCode} size="lg">
            <SelectField
              name="statutoryCode"
              options={Object.keys(EDITABLE)
                .filter((c) => exceptionSettings(c).length)
                .map((c) => ({ value: c, label: `${TYPE_NAME[c] ?? c} (${LAW[c]})` }))}
              value={form.statutoryCode}
              onChange={(v) => setForm((f) => ({ ...f, statutoryCode: v, setting: exceptionSettings(v)[0] as string }))}
              disabled={!!request}
            />
          </GridField>
          <GridField label="Setting" required error={errors.setting} size="lg">
            <SelectField name="setting" options={settings.map((s) => ({ value: s, label: SETTING_LABEL[s] }))} value={form.setting} onChange={(v) => set("setting", v)} disabled={!!request} />
          </GridField>
          <GridField label="Down to" required error={errors.value} size="code" suffix={lawText ? `Law: ${lawText}` : undefined}>
            <NumberField name="value" value={form.value} onChange={(v) => set("value", v)} decimals={1} max={365} selectOnFocus showZero aria-label="Value under the exception" />
          </GridField>
          <GridField label="Directive or law" required error={errors.legalBasis} span={2} size="full">
            <input name="legalBasis" value={form.legalBasis} maxLength={300} onChange={(e) => set("legalBasis", e.target.value)} placeholder="e.g. Nepal Rastra Bank directive 3/2083" className={inputClass} />
          </GridField>
          <GridField label="Number and date" error={errors.reference} span={2} size="full">
            <input name="reference" value={form.reference} maxLength={300} onChange={(e) => set("reference", e.target.value)} className={inputClass} />
          </GridField>
          <GridField label="From" required error={errors.validFrom} size="date">
            <DateField name="validFrom" value={form.validFrom} onChange={(v) => set("validFrom", v)} />
          </GridField>
          <GridField label="Until" required error={errors.validUntil} size="date">
            <DateField name="validUntil" value={form.validUntil} onChange={(v) => set("validUntil", v)} />
          </GridField>
        </FormGrid>
        {request && (
          <p className="border-t border-line px-4 py-3 text-xs text-ink">
            <span className="font-medium">The company says:</span> “{request.reason}” · asked by {request.requestedBy}
          </p>
        )}
      </PropertyForm>
    </Window>
  );
}
