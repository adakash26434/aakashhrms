"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
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
import { ASSET_CATEGORIES } from "@/lib/engines/asset.engine";
import { getAssetAction, issueAssetAction, retireAssetAction, returnAssetAction, saveAssetAction } from "@/app/actions/asset.actions";
import type { AssetDetail, AssetRow, AssetsPageData } from "@/lib/types/asset";

// Assets (G14): the register, an asset form and an asset window with issue /
// return / retire and the handover history.

const statusChip = (status: AssetRow["status"]) =>
  status === "issued" ? <StatusChip status="onHold" label="Issued" /> : status === "retired" ? <StatusChip status="cancelled" label="Retired" /> : <StatusChip status="approved" label="Available" />;

export function AssetsClient({ data }: { data: AssetsPageData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [editing, setEditing] = useState<AssetRow | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.assets.filter((a) => {
      if (filters.category && a.category !== filters.category) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (q && ![a.tag, a.name, a.holderName ?? "", a.holderCode ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.assets, filters, search]);

  const columns: GridColumn<AssetRow>[] = [
    { id: "tag", header: "Tag", value: (a) => a.tag, sticky: true, width: 130 },
    { id: "name", header: "Asset", value: (a) => a.name },
    { id: "category", header: "Category", value: (a) => a.categoryName, width: 160 },
    { id: "branch", header: "Branch", value: (a) => a.branch ?? "", width: 140 },
    { id: "holder", header: "Held by", value: (a) => a.holderName ?? "", cell: (a) => (a.holderName ? <span>{a.holderName} <span className="text-ink-faint">· {a.holderCode}</span></span> : <span className="text-ink-faint">—</span>) },
    { id: "since", header: "Since", value: (a) => a.issuedAd ?? "", type: "date", width: 120, cell: (a) => (a.issuedAd ? <DateCell value={a.issuedAd} /> : null) },
    { id: "status", header: "Status", value: (a) => a.status, width: 110, cell: (a) => statusChip(a.status) },
  ];

  return (
    <div>
      <PageBar
        title="Assets"
        description="Laptops, phones, keys, ID cards and other company property: who holds what, since when"
        actions={[
          { id: "new", label: "New asset", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.add, onClick: () => setEditing("new") },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <FilterStrip
        id="assets"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Tag, name or holder" }}
        filters={[
          { id: "category", label: "Category", options: ASSET_CATEGORIES.map((c) => ({ value: c.code, label: c.name })), allLabel: "All categories" },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "available", label: "Available" },
              { value: "issued", label: "Issued" },
              { value: "retired", label: "Retired" },
            ],
            allLabel: "All statuses",
          },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="assets"
        label="Assets"
        columns={columns}
        rows={rows}
        getRowId={(a) => a.id}
        onOpen={(a) => setOpenId(a.id)}
        rowTone={(a) => (a.status === "retired" ? "danger" : undefined)}
        exportModule="ASSETS"
        exportName="assets"
        defaultSort={{ columnId: "tag", direction: "asc" }}
        empty={{ title: "No assets", description: data.permissions.add ? "Register the first asset." : "Registered assets appear here." }}
      />

      {editing && (
        <AssetFormWindow
          key={editing === "new" ? "new" : editing.id}
          asset={editing === "new" ? null : editing}
          branches={data.branches}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setEditing(null);
            setNotice(`Saved ${row.tag} · ${row.name}.`);
            refresh();
          }}
        />
      )}
      {openId && <AssetWindow key={openId} assetId={openId} data={data} onClose={() => setOpenId(null)} onChanged={refresh} onEdit={(a) => setEditing(a)} />}
    </div>
  );
}

function AssetFormWindow({ asset, branches, onClose, onSaved }: { asset: AssetRow | null; branches: AssetsPageData["branches"]; onClose: () => void; onSaved: (row: AssetRow) => void }) {
  const [tag, setTag] = useState(asset?.tag ?? "");
  const [name, setName] = useState(asset?.name ?? "");
  const [category, setCategory] = useState(asset?.category ?? "");
  const [branchId, setBranchId] = useState(asset?.branchId ?? "");
  const [note, setNote] = useState(asset?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveAssetAction(asset?.id ?? null, { tag, name, category, branchId, note });
      if (result.success) onSaved(result.data);
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title={asset ? `Edit ${asset.tag}` : "New asset"}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Asset">
            <FieldRow label="Tag / serial" required error={errors.tag}>
              <input className={inputClass} value={tag} maxLength={50} onChange={(e) => setTag(e.target.value)} />
            </FieldRow>
            <FieldRow label="Name" required error={errors.name}>
              <input className={inputClass} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
            </FieldRow>
            <FieldRow label="Category" required error={errors.category}>
              <SelectField options={ASSET_CATEGORIES.map((c) => ({ value: c.code, label: c.name }))} value={category} onChange={setCategory} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Branch" error={errors.branchId}>
              <SelectField options={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} placeholder="Any" />
            </FieldRow>
            <FieldRow label="Note" error={errors.note}>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function AssetWindow({ assetId, data, onClose, onChanged, onEdit }: { assetId: string; data: AssetsPageData; onClose: () => void; onChanged: () => void; onEdit: (a: AssetRow) => void }) {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [issuedAd, setIssuedAd] = useState("");
  const [returnedAd, setReturnedAd] = useState("");
  const [condition, setCondition] = useState("good");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getAssetAction(assetId);
      if (cancelled) return;
      if (result.success) setDetail(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const run = (call: () => Promise<{ success: true; data: AssetDetail } | { success: false; error: string; validationErrors?: Record<string, string> }>) =>
    startTransition(async () => {
      setError(null);
      setErrors({});
      const result = await call();
      if (result.success) {
        setDetail(result.data);
        setNote("");
        onChanged();
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window open onClose={onClose} title={detail ? `${detail.tag} · ${detail.name}` : "Asset"} description={detail ? `${detail.categoryName}${detail.branch ? ` · ${detail.branch}` : ""}` : undefined} size="lg" footer={<WindowButton onClick={onClose}>Close window</WindowButton>}>
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {!detail && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {detail && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {statusChip(detail.status)}
              {detail.holderName && (
                <span className="text-sm">
                  Held by <strong>{detail.holderName}</strong> <span className="text-ink-faint">· {detail.holderCode}</span> since <DateCell value={detail.issuedAd!} />
                </span>
              )}
              {data.permissions.manage && <WindowButton onClick={() => onEdit(detail)}>Edit</WindowButton>}
              {data.permissions.manage && detail.status === "available" && (
                <WindowButton onClick={() => run(() => retireAssetAction(assetId))} disabled={pending}>
                  Retire
                </WindowButton>
              )}
            </div>

            {data.permissions.add && detail.status === "available" && (
              <PropertyForm>
                <FieldGroup title="Hand over">
                  <FieldRow label="To" required error={errors.employeeId}>
                    <Combobox options={data.employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Type a name or code" />
                  </FieldRow>
                  <FieldRow label="On" required error={errors.issuedAd}>
                    <DateField value={issuedAd} onChange={setIssuedAd} />
                  </FieldRow>
                  <FieldRow label="Note" error={errors.note}>
                    <input className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  </FieldRow>
                </FieldGroup>
                <WindowButton variant="primary" disabled={pending || !employeeId || !issuedAd} onClick={() => run(() => issueAssetAction(assetId, { employeeId, issuedAd, note }))}>
                  Hand over
                </WindowButton>
              </PropertyForm>
            )}

            {data.permissions.manage && detail.status === "issued" && (
              <PropertyForm>
                <FieldGroup title="Return">
                  <FieldRow label="On" required error={errors.returnedAd}>
                    <DateField value={returnedAd} onChange={setReturnedAd} />
                  </FieldRow>
                  <FieldRow label="Condition" required error={errors.condition}>
                    <SelectField
                      options={[
                        { value: "good", label: "Good" },
                        { value: "damaged", label: "Damaged" },
                        { value: "lost", label: "Lost (retires the asset)" },
                      ]}
                      value={condition}
                      onChange={setCondition}
                    />
                  </FieldRow>
                  <FieldRow label="Note" error={errors.note} help="Required when damaged or lost.">
                    <input className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  </FieldRow>
                </FieldGroup>
                <WindowButton variant="primary" disabled={pending || !returnedAd} onClick={() => run(() => returnAssetAction(assetId, { returnedAd, condition, note }))}>
                  Record return
                </WindowButton>
              </PropertyForm>
            )}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Handover history</p>
              {detail.handovers.length === 0 ? (
                <p className="text-sm text-ink-muted">Never handed over.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {detail.handovers.map((h) => (
                    <li key={h.id} className="rounded-md border border-line px-3 py-1.5">
                      {h.employeeName} <span className="text-ink-faint">· {h.employeeCode}</span> · <DateCell value={h.issuedAd} />
                      {h.returnedAd ? (
                        <>
                          {" "}→ <DateCell value={h.returnedAd} /> <span className="capitalize">({h.condition})</span>
                        </>
                      ) : (
                        <span className="text-warning"> · still out</span>
                      )}
                      {h.note && <p className="text-2xs text-ink-muted">{h.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Window>
  );
}
