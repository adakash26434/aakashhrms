"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, DoorOpen, FileText, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { Amount } from "@/components/kit/amount";
import { EXIT_KINDS } from "@/lib/engines/exit.engine";
import { openExitCaseAction, getExitCaseAction, decideExitClearanceAction, completeExitCaseAction, cancelExitCaseAction } from "@/app/actions/exit.actions";
import type { ExitDetail, ExitListRow, ExitPageData } from "@/lib/types/exit";
import { cn } from "@/lib/utils";

// Exit workflow (G5): resignation / retirement / termination as a case —
// clearance checklist per unit, then Complete (employee goes Inactive,
// experience letter optional). Open a row for the case window.

const statusChip = (row: ExitListRow) =>
  row.status === "closed" ? (
    <StatusChip status="approved" label="Closed" />
  ) : row.status === "cancelled" ? (
    <StatusChip status="cancelled" label="Cancelled" />
  ) : row.blocked > 0 ? (
    <StatusChip status="onHold" label="Blocked" />
  ) : (
    <StatusChip status="pending" label={`Clearing ${row.cleared}/${row.totalUnits}`} />
  );

export function ExitClient({ data }: { data: ExitPageData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.cases.filter((c) => {
      if (filters.kind && c.kind !== filters.kind) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (q && ![c.employeeName, c.employeeCode].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.cases, filters, search]);

  const columns: GridColumn<ExitListRow>[] = [
    { id: "employee", header: "Employee", value: (c) => c.employeeName, sticky: true, cell: (c) => (
        <span>
          {c.employeeName} <span className="text-ink-faint">· {c.employeeCode}</span>
        </span>
      ) },
    { id: "kind", header: "Exit", value: (c) => c.kindName, width: 170, cell: (c) => (
        <span>
          {c.kindName} <span className="text-ink-faint">· {c.kindNameNp}</span>
        </span>
      ) },
    { id: "lwd", header: "Last working day", value: (c) => c.lastWorkingDayAd, cell: (c) => <DateCell value={c.lastWorkingDayAd} />, type: "date", width: 150 },
    { id: "status", header: "Status", value: (c) => c.status, width: 140, cell: (c) => statusChip(c) },
    { id: "letter", header: "Letter", value: (c) => c.letterNumber ?? "", width: 110, cell: (c) =>
        c.letterId ? (
          <button type="button" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline cursor-pointer" onClick={(ev) => { ev.stopPropagation(); router.push(`/workforce/letters/${c.letterId}`); }}>
            <FileText className="h-3.5 w-3.5" /> {c.letterNumber}
          </button>
        ) : null },
    { id: "by", header: "Opened by", value: (c) => c.openedByName, width: 140, defaultHidden: true },
  ];

  return (
    <div>
      <PageBar
        title="Exit"
        description="Resignation, retirement and other exits: clearance by unit, then Complete — the employee record changes only then"
        actions={[
          { id: "new", label: "New exit case", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.manage, onClick: () => setCreating(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <FilterStrip
        id="exit-cases"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Employee or code" }}
        filters={[
          { id: "kind", label: "Exit", options: EXIT_KINDS.map((k) => ({ value: k.code, label: `${k.name} · ${k.nameNp}` })), allLabel: "All kinds" },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "cancelled", label: "Cancelled" },
            ],
            allLabel: "All statuses",
          },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="exit-cases"
        label="Exit cases"
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        onOpen={(c) => setOpenId(c.id)}
        rowTone={(c) => (c.status === "cancelled" ? "danger" : c.blocked > 0 ? "warning" : c.status === "open" ? "info" : undefined)}
        exportModule="EMPLOYEES"
        exportName="exit-cases"
        defaultSort={{ columnId: "lwd", direction: "desc" }}
        empty={{ title: "No exit cases", description: data.permissions.manage ? "Open a case when a resignation or retirement comes in." : "Exit cases for employees in your scope appear here." }}
      />

      <NewExitWindow
        open={creating}
        employees={data.employees}
        onClose={() => setCreating(false)}
        onSaved={(row) => {
          setCreating(false);
          setNotice({ tone: "success", text: `Exit case opened for ${row.employeeName} (${row.kindName}).` });
          setOpenId(row.id);
          refresh();
        }}
      />
      {openId && (
        <ExitCaseWindow
          key={openId}
          caseId={openId}
          canManage={data.permissions.manage}
          canIssueLetter={data.permissions.issueLetter}
          onClose={() => setOpenId(null)}
          onNotice={(tone, text) => setNotice({ tone, text })}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function NewExitWindow({ open, employees, onClose, onSaved }: { open: boolean; employees: ExitPageData["employees"]; onClose: () => void; onSaved: (row: ExitListRow) => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [lastWorkingDayAd, setLastWorkingDayAd] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await openExitCaseAction({ employeeId, kind, noticeDate, lastWorkingDayAd, reason });
      if (result.success) {
        setEmployeeId("");
        setKind("");
        setNoticeDate("");
        setLastWorkingDayAd("");
        setReason("");
        onSaved(result.data);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title="New exit case"
      description="Opening a case starts the clearance checklist; nothing changes on the employee record until Complete."
      size="md"
      dirty={!!employeeId || !!kind || !!reason}
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !employeeId || !kind || !lastWorkingDayAd}>
            {pending ? "Opening…" : "Open case"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Exit">
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox options={employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Type a name or code" />
            </FieldRow>
            <FieldRow label="Kind" required error={errors.kind}>
              <SelectField options={EXIT_KINDS.map((k) => ({ value: k.code, label: `${k.name} · ${k.nameNp}` }))} value={kind} onChange={setKind} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Notice received" error={errors.noticeDate} help="When the resignation / decision came in (optional).">
              <DateField value={noticeDate} onChange={setNoticeDate} />
            </FieldRow>
            <FieldRow label="Last working day" required error={errors.lastWorkingDayAd}>
              <DateField value={lastWorkingDayAd} onChange={setLastWorkingDayAd} />
            </FieldRow>
            <FieldRow label="Reason" error={errors.reason}>
              <textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function ExitCaseWindow({ caseId, canManage, canIssueLetter, onClose, onNotice, onChanged }: { caseId: string; canManage: boolean; canIssueLetter: boolean; onClose: () => void; onNotice: (tone: "success" | "warning", text: string) => void; onChanged: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ExitDetail | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [issueLetter, setIssueLetter] = useState(true);
  const [letterLanguage, setLetterLanguage] = useState("np");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getExitCaseAction(caseId);
      if (cancelled) return;
      if (result.success) setDetail(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const decide = (unit: string, status: "cleared" | "blocked" | "pending") =>
    startTransition(async () => {
      setError(null);
      const result = await decideExitClearanceAction(caseId, unit, status, notes[unit] ?? "");
      if (result.success) {
        setDetail(result.data);
        onChanged();
      } else {
        const fieldError = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
        setError(fieldError ?? result.error);
      }
    });

  const complete = () =>
    startTransition(async () => {
      setError(null);
      const result = await completeExitCaseAction(caseId, { issueLetter: canIssueLetter && issueLetter, letterLanguage });
      if (result.success) {
        setDetail(result.data.detail);
        onChanged();
        if (result.data.letterWarning) onNotice("warning", result.data.letterWarning);
        else onNotice("success", `Exit completed — ${result.data.detail.employeeName} is now inactive.`);
        if (result.data.detail.letterId) router.push(`/workforce/letters/${result.data.detail.letterId}`);
      } else setError(result.error);
    });

  const cancel = () =>
    startTransition(async () => {
      setError(null);
      const result = await cancelExitCaseAction(caseId, cancelReason);
      if (result.success) {
        setDetail(result.data);
        setCancelling(false);
        onChanged();
        onNotice("success", "Exit case cancelled.");
      } else {
        const fieldError = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
        setError(fieldError ?? result.error);
      }
    });

  const open = detail?.status === "open";

  return (
    <Window
      open
      onClose={onClose}
      title={detail ? `${detail.kindName} — ${detail.employeeName}` : "Exit case"}
      description={detail ? `Last working day ${detail.lastWorkingDayBs} (${detail.lastWorkingDayAd}) · opened by ${detail.openedByName}` : undefined}
      size="lg"
      footer={
        <>
          <WindowButton onClick={onClose}>Close</WindowButton>
          {detail?.letterId && (
            <WindowButton onClick={() => router.push(`/workforce/letters/${detail.letterId}`)}>
              <FileText className="h-3.5 w-3.5" /> Experience letter
            </WindowButton>
          )}
          {open && canManage && (
            <>
              <WindowButton variant="danger" onClick={() => setCancelling((v) => !v)}>
                <Ban className="h-3.5 w-3.5" /> Cancel case
              </WindowButton>
              <WindowButton variant="primary" onClick={complete} disabled={pending || (detail?.blockers.length ?? 1) > 0}>
                <DoorOpen className="h-3.5 w-3.5" /> {pending ? "Working…" : "Complete exit"}
              </WindowButton>
            </>
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
          {detail.reason && <p className="text-sm text-ink-muted">Reason: {detail.reason}</p>}
          {detail.status === "cancelled" && <Notice tone="danger">Cancelled: {detail.cancelReason}</Notice>}

          <div className="rounded-md border border-line bg-surface-sunken p-3 text-xs">
            <p className="mb-1 font-semibold uppercase tracking-wide text-ink-muted">Before clearing</p>
            <p>
              Active staff loans: <strong>{detail.facts.activeLoans}</strong>
              {detail.facts.activeLoans > 0 && (
                <>
                  {" "}· outstanding <Amount value={Number(detail.facts.loanOutstanding)} />
                </>
              )}
            </p>
            <p>
              Device PINs: {detail.facts.devicePins.length === 0 ? "none" : detail.facts.devicePins.map((p) => `${p.device} (${p.pin})`).join(", ")}
              {detail.facts.devicePins.length > 0 && <span className="text-ink-faint"> — unmap under Time &amp; Leave → Devices</span>}
            </p>
            <p>
              Welfare funds held:{" "}
              {detail.facts.funds.length === 0 ? (
                "none"
              ) : (
                detail.facts.funds.map((f, i) => (
                  <span key={f.fund}>
                    {i > 0 && ", "}
                    {f.fund} <Amount value={Number(f.total)} />
                  </span>
                ))
              )}
              {detail.facts.funds.length > 0 && <span className="text-ink-faint"> — pay out under Payroll → Funds before completing</span>}
            </p>
            <p>
              Training bonds running: {detail.facts.bonds.length === 0 ? "none" : detail.facts.bonds.map((b) => `${b.title} (until ${b.bondEndsAd})`).join(", ")}
              {detail.facts.bonds.length > 0 && <span className="text-ink-faint"> — a settlement matter for Accounts, not a blocker</span>}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Clearance</h3>
            <div className="space-y-2">
              {detail.clearances.map((c) => (
                <div key={c.unit} className={cn("rounded-md border p-3", c.status === "cleared" ? "border-success/40 bg-success-subtle/40" : c.status === "blocked" ? "border-danger/40 bg-danger-subtle/40" : "border-line")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {c.unitName} <span className="font-normal text-ink-faint">· {c.unitNameNp}</span>
                    </p>
                    <StatusChip status={c.status === "cleared" ? "approved" : c.status === "blocked" ? "onHold" : "pending"} label={c.status === "cleared" ? "Cleared" : c.status === "blocked" ? "Blocked" : "Pending"} />
                    {c.decidedByName && <span className="text-xs text-ink-faint">by {c.decidedByName}</span>}
                    {open && canManage && (
                      <span className="ml-auto flex gap-1">
                        <WindowButton onClick={() => decide(c.unit, "cleared")} disabled={pending || c.status === "cleared"}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Clear
                        </WindowButton>
                        <WindowButton onClick={() => decide(c.unit, "blocked")} disabled={pending || c.status === "blocked"}>
                          <ShieldAlert className="h-3.5 w-3.5" /> Block
                        </WindowButton>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{c.hint}</p>
                  {c.note && <p className="mt-1 text-xs">{c.note}</p>}
                  {open && canManage && (
                    <input
                      className={`${inputClass} mt-2 max-w-none`}
                      placeholder="Note (required when blocking)"
                      value={notes[c.unit] ?? ""}
                      maxLength={500}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [c.unit]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {open && (
            <div className="rounded-md border border-line p-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Complete</h3>
              {detail.blockers.length > 0 ? (
                <ul className="list-inside list-disc text-xs text-ink-muted">
                  {detail.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">All clear. Completing marks {detail.employeeName} inactive and writes the exit record; the settlement itself is prepared in payroll.</p>
              )}
              {canIssueLetter && canManage && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={issueLetter} onChange={(e) => setIssueLetter(e.target.checked)} />
                    Issue the experience letter (कार्य अनुभव पत्र)
                  </label>
                  {issueLetter && (
                    <SelectField
                      aria-label="Letter language"
                      options={[
                        { value: "np", label: "नेपाली" },
                        { value: "en", label: "English" },
                      ]}
                      value={letterLanguage}
                      onChange={setLetterLanguage}
                      className="w-32"
                    />
                  )}
                </div>
              )}
              {cancelling && (
                <div className="mt-3 border-t border-line pt-2">
                  <label className="block text-sm text-ink">
                    Cancel reason
                    <textarea className={`${inputClass} mt-1 h-auto min-h-16 max-w-none py-2`} value={cancelReason} maxLength={500} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Resignation withdrawn" />
                  </label>
                  <WindowButton variant="danger" className="mt-2" onClick={cancel} disabled={pending || cancelReason.trim().length < 5}>
                    {pending ? "Cancelling…" : "Confirm cancel"}
                  </WindowButton>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Window>
  );
}
