"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import { Tabs } from "@/components/kit/tabs";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { TRAVEL_MODES, computeClaim, tripDays } from "@/lib/engines/travel.engine";
import { moveTravelClaimAction, saveTravelClaimAction, saveTravelRateAction } from "@/app/actions/travel.actions";
import type { ClaimRow, RateCardRow, TravelPageData } from "@/lib/types/travel";

// TA-DA (G11): claims register (draft → submitted → approved → settled) with a
// live preview from the rate card while typing, and the rate-card tab.

const statusChip = (status: ClaimRow["status"]) =>
  status === "settled" ? (
    <StatusChip status="approved" label="Settled" />
  ) : status === "approved" ? (
    <StatusChip status="approved" label="Approved" />
  ) : status === "rejected" ? (
    <StatusChip status="rejected" label="Rejected" />
  ) : status === "submitted" ? (
    <StatusChip status="pending" label="Submitted" />
  ) : (
    <StatusChip status="draft" label="Draft" />
  );

type Result<T> = { success: true; data: T } | { success: false; error: string; validationErrors?: Record<string, string> };

export function TravelClient({ data }: { data: TravelPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState("claims");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [editing, setEditing] = useState<ClaimRow | "new" | null>(null);
  const [rateEditing, setRateEditing] = useState<RateCardRow | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.claims.filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (q && ![c.employeeName, c.employeeCode, c.purpose, c.toPlace].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.claims, filters, search]);

  const columns: GridColumn<ClaimRow>[] = [
    { id: "employee", header: "Employee", value: (c) => c.employeeName, sticky: true, cell: (c) => (
        <span>
          {c.employeeName} <span className="text-ink-faint">· {c.employeeCode}</span>
        </span>
      ) },
    { id: "trip", header: "Trip", value: (c) => `${c.fromPlace} → ${c.toPlace}`, cell: (c) => (
        <span>
          {c.fromPlace} → {c.toPlace} <span className="text-ink-faint">· {c.purpose}</span>
        </span>
      ) },
    { id: "start", header: "From", value: (c) => c.startAd, type: "date", width: 115, cell: (c) => <DateCell value={c.startAd} /> },
    { id: "days", header: "Days", value: (c) => c.days, width: 70 },
    { id: "gross", header: "Gross", value: (c) => c.gross, type: "number", width: 110, cell: (c) => <Amount value={c.gross} /> },
    { id: "advance", header: "Advance", value: (c) => c.advance, type: "number", width: 110, cell: (c) => <Amount value={c.advance} />, defaultHidden: true },
    { id: "payable", header: "Payable", value: (c) => c.payable, type: "number", width: 120, cell: (c) => <Amount value={c.payable} /> },
    { id: "status", header: "Status", value: (c) => c.status, width: 120, cell: (c) => statusChip(c.status) },
    { id: "by", header: "Recorded by", value: (c) => c.createdByName, width: 140, defaultHidden: true },
  ];

  const rateColumns: GridColumn<RateCardRow>[] = [
    { id: "name", header: "Card", value: (r) => r.name, sticky: true },
    { id: "designation", header: "Applies to", value: (r) => r.designation ?? "Default (everyone else)", width: 220 },
    { id: "da", header: "Daily allowance", value: (r) => r.dailyAllowance, type: "number", width: 140, cell: (r) => <Amount value={r.dailyAllowance} /> },
    { id: "lodging", header: "Lodging / night", value: (r) => r.lodgingPerNight, type: "number", width: 140, cell: (r) => <Amount value={r.lodgingPerNight} /> },
    { id: "km", header: "Per km", value: (r) => r.kmRate, type: "number", width: 100, cell: (r) => <Amount value={r.kmRate} /> },
    { id: "active", header: "Active", value: (r) => (r.isActive ? "Yes" : "No"), width: 80 },
  ];

  const onSaved = (text: string) => {
    setEditing(null);
    setRateEditing(null);
    setNotice({ tone: "success", text });
    router.refresh();
  };

  return (
    <div>
      <PageBar
        title="Travel / TA-DA"
        description="Field-visit claims from the rate card: days × daily allowance, lodging up to the ceiling, fare or kilometres, less any advance"
        actions={[
          { id: "new", label: "New claim", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.add || tab !== "claims", onClick: () => setEditing("new") },
          { id: "new-rate", label: "New rate card", icon: Plus, group: "create", primary: true, hidden: !data.permissions.manage || tab !== "rates", onClick: () => setRateEditing("new") },
          { id: "refresh", label: pending ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {data.rates.length === 0 && data.permissions.manage && (
        <Notice tone="warning" className="mb-3">
          No rate card yet: add a default card under Rate cards before recording claims.
        </Notice>
      )}
      <Tabs
        label="Travel"
        value={tab}
        onChange={setTab}
        items={[
          { id: "claims", label: "Claims", badge: data.claims.filter((c) => c.status === "submitted").length || undefined },
          { id: "rates", label: "Rate cards" },
        ]}
      >
        {tab === "claims" ? (
          <>
            <FilterStrip
              id="travel-claims"
              className="my-3"
              search={{ value: search, onChange: setSearch, placeholder: "Employee, purpose or place" }}
              filters={[
                {
                  id: "status",
                  label: "Status",
                  options: [
                    { value: "draft", label: "Draft" },
                    { value: "submitted", label: "Submitted" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "settled", label: "Settled" },
                  ],
                  allLabel: "All statuses",
                },
              ]}
              values={filters}
              onChange={setFilters}
            />
            <DataGrid
              id="travel-claims"
              label="Travel claims"
              columns={columns}
              rows={rows}
              getRowId={(c) => c.id}
              onOpen={(c) => setEditing(c)}
              rowTone={(c) => (c.status === "submitted" ? "info" : c.status === "rejected" ? "danger" : undefined)}
              exportModule="TRAVEL"
              exportName="travel-claims"
              defaultSort={{ columnId: "start", direction: "desc" }}
              empty={{ title: "No claims", description: data.permissions.add ? "Record a claim after the trip." : "Claims for employees in your scope appear here." }}
            />
          </>
        ) : (
          <DataGrid
            id="travel-rates"
            label="Rate cards"
            columns={rateColumns}
            rows={data.rates}
            getRowId={(r) => r.id}
            onOpen={(r) => (data.permissions.manage ? setRateEditing(r) : undefined)}
            defaultSort={{ columnId: "name", direction: "asc" }}
            empty={{ title: "No rate cards", description: "Add a default card; add designation cards only where rates differ." }}
          />
        )}
      </Tabs>

      {editing && <ClaimWindow key={editing === "new" ? "new" : editing.id} claim={editing === "new" ? null : editing} data={data} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {rateEditing && <RateWindow key={rateEditing === "new" ? "new" : rateEditing.id} rate={rateEditing === "new" ? null : rateEditing} designations={data.designations} onClose={() => setRateEditing(null)} onSaved={onSaved} />}
    </div>
  );
}

function RateWindow({ rate, designations, onClose, onSaved }: { rate: RateCardRow | null; designations: TravelPageData["designations"]; onClose: () => void; onSaved: (text: string) => void }) {
  const [name, setName] = useState(rate?.name ?? "");
  const [designationId, setDesignationId] = useState(rate?.designationId ?? "");
  const [dailyAllowance, setDailyAllowance] = useState(rate ? String(rate.dailyAllowance) : "");
  const [lodgingPerNight, setLodgingPerNight] = useState(rate ? String(rate.lodgingPerNight) : "");
  const [kmRate, setKmRate] = useState(rate ? String(rate.kmRate) : "");
  const [isActive, setIsActive] = useState(rate?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result: Result<RateCardRow> = await saveTravelRateAction(rate?.id ?? null, { name, designationId, dailyAllowance, lodgingPerNight, kmRate, isActive });
      if (result.success) onSaved(`Rate card saved: ${result.data.name}.`);
      else {
        setErrors(result.validationErrors ?? {});
        setError(result.error);
      }
    });

  return (
    <Window open onClose={onClose} title={rate ? "Edit rate card" : "New rate card"} size="md" dirty footer={<><WindowButton onClick={onClose}>Cancel</WindowButton><WindowButton variant="primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</WindowButton></>}>
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Rate card">
            <FieldRow label="Name" required error={errors.name}>
              <input className={inputClass} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </FieldRow>
            <FieldRow label="Applies to" error={errors.designationId} help="Leave empty for the default card.">
              <SelectField options={designations.map((d) => ({ value: d.id, label: d.name }))} value={designationId} onChange={setDesignationId} placeholder="Default (everyone else)" />
            </FieldRow>
            <FieldRow label="Daily allowance" required error={errors.dailyAllowance}>
              <input className={inputClass} inputMode="decimal" value={dailyAllowance} onChange={(e) => setDailyAllowance(e.target.value)} />
            </FieldRow>
            <FieldRow label="Lodging ceiling / night" error={errors.lodgingPerNight}>
              <input className={inputClass} inputMode="decimal" value={lodgingPerNight} onChange={(e) => setLodgingPerNight(e.target.value)} />
            </FieldRow>
            <FieldRow label="Own vehicle / km" error={errors.kmRate}>
              <input className={inputClass} inputMode="decimal" value={kmRate} onChange={(e) => setKmRate(e.target.value)} />
            </FieldRow>
            <FieldRow label="Active">
              <YesNoField value={isActive} onChange={setIsActive} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function ClaimWindow({ claim, data, onClose, onSaved }: { claim: ClaimRow | null; data: TravelPageData; onClose: () => void; onSaved: (text: string) => void }) {
  const editable = !claim || claim.status === "draft";
  const [employeeId, setEmployeeId] = useState(claim?.employeeId ?? "");
  const [purpose, setPurpose] = useState(claim?.purpose ?? "");
  const [fromPlace, setFromPlace] = useState(claim?.fromPlace ?? "");
  const [toPlace, setToPlace] = useState(claim?.toPlace ?? "");
  const [startAd, setStartAd] = useState(claim?.startAd ?? "");
  const [endAd, setEndAd] = useState(claim?.endAd ?? "");
  const [mode, setMode] = useState(claim?.mode ?? "");
  const [km, setKm] = useState(claim ? String(claim.km) : "");
  const [nights, setNights] = useState(claim ? String(claim.nights) : "0");
  const [fareActual, setFareActual] = useState(claim ? String(claim.fareActual) : "");
  const [lodgingActual, setLodgingActual] = useState(claim ? String(claim.lodgingActual) : "");
  const [advance, setAdvance] = useState(claim ? String(claim.advance) : "");
  const [note, setNote] = useState(claim?.note ?? "");
  const [decisionNote, setDecisionNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Live preview from the card that applies (designation → default); the server recomputes on save.
  const card = data.rates.find((r) => r.isActive && r.designationId === null);
  const preview =
    card && /^\d{4}-\d{2}-\d{2}$/.test(startAd) && /^\d{4}-\d{2}-\d{2}$/.test(endAd) && endAd >= startAd && tripDays(startAd, endAd) <= 60
      ? computeClaim({ startAd, endAd, mode, km: Number(km) || 0, fareActual: Number(fareActual) || 0, lodgingActual: Number(lodgingActual) || 0, nights: Number(nights) || 0, advance: Number(advance) || 0 }, card)
      : null;

  const form = { employeeId, purpose, fromPlace, toPlace, startAd, endAd, mode, km, nights, fareActual, lodgingActual, advance, note };

  const handle = (result: Result<ClaimRow>, text: (row: ClaimRow) => string) => {
    if (result.success) onSaved(text(result.data));
    else {
      setErrors(result.validationErrors ?? {});
      setError(result.error);
    }
  };
  const save = () =>
    startTransition(async () => {
      setError(null);
      handle(await saveTravelClaimAction(claim?.id ?? null, form), (row) => `Draft saved for ${row.employeeName}: payable ${row.payable.toFixed(2)}.`);
    });
  const saveAndSubmit = () =>
    startTransition(async () => {
      setError(null);
      const saved: Result<ClaimRow> = await saveTravelClaimAction(claim?.id ?? null, form);
      if (!saved.success) return handle(saved, () => "");
      handle(await moveTravelClaimAction(saved.data.id, "submitted", ""), (row) => `Submitted for ${row.employeeName}: payable ${row.payable.toFixed(2)}.`);
    });
  const move = (to: string) =>
    startTransition(async () => {
      setError(null);
      if (!claim) return;
      handle(await moveTravelClaimAction(claim.id, to, decisionNote), (row) => `Claim ${row.status}.`);
    });

  const amounts = claim && !editable ? { days: claim.days, dailyAllowance: claim.dailyAllowance.toFixed(2), lodging: claim.lodging.toFixed(2), travel: claim.travel.toFixed(2), gross: claim.gross.toFixed(2), advance: claim.advance.toFixed(2), payable: claim.payable.toFixed(2), lodgingCapped: claim.lodgingActual > claim.lodging } : preview;

  return (
    <Window
      open
      onClose={onClose}
      title={claim ? `${claim.employeeName} · ${claim.fromPlace} → ${claim.toPlace}` : "New travel claim"}
      description={claim ? `${claim.rateName || "rate card"} · recorded by ${claim.createdByName}` : "Amounts come from the rate card; only actuals and the advance are typed."}
      size="lg"
      dirty={editable}
      footer={
        <>
          <WindowButton onClick={onClose}>Close</WindowButton>
          {editable && data.permissions.add && (
            <>
              <WindowButton onClick={save} disabled={pending}>Save draft</WindowButton>
              <WindowButton variant="primary" onClick={saveAndSubmit} disabled={pending || !employeeId}>Save and submit</WindowButton>
            </>
          )}
          {claim?.status === "submitted" && data.permissions.approve && (
            <>
              <WindowButton onClick={() => move("draft")} disabled={pending}>Return to draft</WindowButton>
              <WindowButton onClick={() => move("rejected")} disabled={pending}>Reject</WindowButton>
              <WindowButton variant="primary" onClick={() => move("approved")} disabled={pending}>Approve</WindowButton>
            </>
          )}
          {claim?.status === "approved" && data.permissions.settle && (
            <WindowButton variant="primary" onClick={() => move("settled")} disabled={pending}>Mark settled (paid)</WindowButton>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {claim && <div className="flex items-center gap-2 text-xs">{statusChip(claim.status)}{claim.decisionNote && <span className="text-ink-muted">· {claim.decisionNote} ({claim.decidedByName})</span>}</div>}
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <PropertyForm enterNavigation>
            <FieldGroup title="Trip">
              <FieldRow label="Employee" required error={errors.employeeId}>
                <Combobox options={data.employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Type a name or code" disabled={!editable || !!claim} />
              </FieldRow>
              <FieldRow label="Purpose" required error={errors.purpose}>
                <input className={inputClass} value={purpose} maxLength={300} onChange={(e) => setPurpose(e.target.value)} disabled={!editable} />
              </FieldRow>
              <FieldRow label="From" required error={errors.fromPlace}>
                <input className={inputClass} value={fromPlace} maxLength={120} onChange={(e) => setFromPlace(e.target.value)} disabled={!editable} />
              </FieldRow>
              <FieldRow label="To" required error={errors.toPlace}>
                <input className={inputClass} value={toPlace} maxLength={120} onChange={(e) => setToPlace(e.target.value)} disabled={!editable} />
              </FieldRow>
              <FieldRow label="Start" required error={errors.startAd}>
                <DateField value={startAd} onChange={setStartAd} disabled={!editable} />
              </FieldRow>
              <FieldRow label="End" required error={errors.endAd}>
                <DateField value={endAd} onChange={setEndAd} disabled={!editable} />
              </FieldRow>
              <FieldRow label="Mode" required error={errors.mode}>
                <SelectField options={TRAVEL_MODES.map((m) => ({ value: m.code, label: m.name }))} value={mode} onChange={setMode} placeholder="Choose" disabled={!editable} />
              </FieldRow>
              {mode === "own_vehicle" ? (
                <FieldRow label="Kilometres" required error={errors.km}>
                  <input className={inputClass} inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} disabled={!editable} />
                </FieldRow>
              ) : (
                <FieldRow label="Fare paid" error={errors.fareActual}>
                  <input className={inputClass} inputMode="decimal" value={fareActual} onChange={(e) => setFareActual(e.target.value)} disabled={!editable} />
                </FieldRow>
              )}
              <FieldRow label="Nights" error={errors.nights}>
                <input className={inputClass} inputMode="numeric" value={nights} onChange={(e) => setNights(e.target.value)} disabled={!editable} />
              </FieldRow>
              <FieldRow label="Lodging paid" error={errors.lodgingActual} help="Capped at nights × the card's ceiling.">
                <input className={inputClass} inputMode="decimal" value={lodgingActual} onChange={(e) => setLodgingActual(e.target.value)} disabled={!editable} />
              </FieldRow>
              <FieldRow label="Advance taken" error={errors.advance}>
                <input className={inputClass} inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} disabled={!editable} />
              </FieldRow>
              <FieldRow label="Note" error={errors.note}>
                <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} disabled={!editable} />
              </FieldRow>
            </FieldGroup>
            {claim?.status === "submitted" && data.permissions.approve && (
              <FieldGroup title="Decision">
                <FieldRow label="Reason" error={errors.note} help="Required to reject or return.">
                  <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={decisionNote} maxLength={1000} onChange={(e) => setDecisionNote(e.target.value)} />
                </FieldRow>
              </FieldGroup>
            )}
          </PropertyForm>
          <aside className="rounded-lg border border-line bg-surface-sunken p-3 text-sm" aria-label="Amounts">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">{claim && !editable ? "Frozen amounts" : card ? `Preview · ${card.name}` : "Preview"}</p>
            {!amounts ? (
              <p className="text-ink-muted">{card ? "Enter the dates to see the amounts." : "No default rate card; the server uses the designation's card if there is one."}</p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-y-1">
                <dt className="text-ink-muted">Days</dt>
                <dd className="text-right tabular-nums">{amounts.days}</dd>
                <dt className="text-ink-muted">Daily allowance</dt>
                <dd className="text-right"><Amount value={Number(amounts.dailyAllowance)} /></dd>
                <dt className="text-ink-muted">Lodging{amounts.lodgingCapped ? " (capped)" : ""}</dt>
                <dd className="text-right"><Amount value={Number(amounts.lodging)} /></dd>
                <dt className="text-ink-muted">Travel</dt>
                <dd className="text-right"><Amount value={Number(amounts.travel)} /></dd>
                <dt className="font-medium">Gross</dt>
                <dd className="text-right font-medium"><Amount value={Number(amounts.gross)} /></dd>
                <dt className="text-ink-muted">Advance</dt>
                <dd className="text-right"><Amount value={-Number(amounts.advance)} /></dd>
                <dt className="font-semibold">Payable</dt>
                <dd className="text-right font-semibold"><Amount value={Number(amounts.payable)} /></dd>
              </dl>
            )}
          </aside>
        </div>
      </div>
    </Window>
  );
}
