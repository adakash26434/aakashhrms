"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Plus, RefreshCw, Wallet } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { getFundLinesAction, postFundEntryAction, saveFundTypeAction } from "@/app/actions/fund.actions";
import type { FundBalanceRow, FundLineView, FundTypeView, FundsPageData } from "@/lib/types/fund";

// Welfare funds (G9): fund types with provision totals, member balances and
// the posting window. Contributions post themselves (BS day 1 job); openings,
// payouts and adjustments are posted here.

type FundsTab = "balances" | "funds";

export function FundsClient({ data }: { data: FundsPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<FundsTab>("balances");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [posting, setPosting] = useState<{ fundTypeId?: string; employeeId?: string } | null>(null);
  const [editingFund, setEditingFund] = useState<FundTypeView | null>(null);
  const [creatingFund, setCreatingFund] = useState(false);
  const [linesFor, setLinesFor] = useState<FundBalanceRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const balanceRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.balances.filter((b) => {
      if (filters.fund && b.fundTypeId !== filters.fund) return false;
      if (q && ![b.employeeName, b.employeeCode].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.balances, filters, search]);

  const balanceColumns: GridColumn<FundBalanceRow>[] = [
    { id: "employee", header: "Employee", value: (b) => b.employeeName, sticky: true, cell: (b) => (
        <span>
          {b.employeeName} <span className="text-ink-faint">· {b.employeeCode}</span>
        </span>
      ) },
    { id: "fund", header: "Fund", value: (b) => b.fundName, width: 170 },
    { id: "branch", header: "Branch", value: (b) => b.branch, width: 140, defaultHidden: true },
    { id: "employeeShare", header: "Employee share", value: (b) => Number(b.employeeShare), type: "amount", align: "right", width: 140, cell: (b) => <Amount value={Number(b.employeeShare)} />, total: "sum" },
    { id: "employerShare", header: "Employer share", value: (b) => Number(b.employerShare), type: "amount", align: "right", width: 140, cell: (b) => <Amount value={Number(b.employerShare)} />, total: "sum" },
    { id: "total", header: "Total", value: (b) => Number(b.total), type: "amount", align: "right", width: 140, cell: (b) => <Amount value={Number(b.total)} />, total: "sum" },
  ];

  const fundColumns: GridColumn<FundTypeView>[] = [
    { id: "name", header: "Fund", value: (f) => f.name, sticky: true, cell: (f) => (
        <span>
          {f.name} {f.nameNp && <span className="text-ink-faint">· {f.nameNp}</span>}
        </span>
      ) },
    { id: "code", header: "Code", value: (f) => f.code, type: "code", width: 110 },
    { id: "rule", header: "Monthly contribution", value: (f) =>
        f.contributionMode === "percent_basic"
          ? `${f.employeeValue}% + ${f.employerValue}% of basic`
          : `${f.employeeValue} + ${f.employerValue}`,
      width: 190 },
    { id: "members", header: "Members", value: (f) => f.members, type: "number", align: "right", width: 90 },
    { id: "total", header: "Provision", value: (f) => Number(f.total), type: "amount", align: "right", width: 150, cell: (f) => <Amount value={Number(f.total)} /> },
    { id: "active", header: "Active", value: (f) => (f.isActive ? "Yes" : "No"), width: 90, cell: (f) => <StatusChip status={f.isActive ? "active" : "inactive"} /> },
  ];

  const tabs: (TabItem & { id: FundsTab })[] = [
    { id: "balances", label: "Balances", icon: Wallet },
    { id: "funds", label: "Funds", icon: Landmark },
  ];

  return (
    <div>
      <PageBar
        title="Welfare funds"
        description="Staff welfare, medical and gratuity funds — contributions post on BS day 1; payouts never take a share below zero"
        actions={[
          { id: "post", label: "Post entry", icon: Plus, group: "create", primary: true, hidden: !data.permissions.post, onClick: () => setPosting({}) },
          { id: "new-fund", label: "New fund", icon: Landmark, group: "create", hidden: !data.permissions.manageTypes, onClick: () => setCreatingFund(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <Tabs variant="folder" items={tabs} value={tab} onChange={(next) => setTab(next as FundsTab)} label="Fund views">
        {tab === "balances" && (
          <div className="p-3">
            <FilterStrip
              id="fund-balances"
              className="mb-3"
              search={{ value: search, onChange: setSearch, placeholder: "Employee or code" }}
              filters={[{ id: "fund", label: "Fund", options: data.funds.map((f) => ({ value: f.id, label: f.name })), allLabel: "All funds" }]}
              values={filters}
              onChange={setFilters}
            />
            <DataGrid
              id="fund-balances"
              label="Fund balances"
              columns={balanceColumns}
              rows={balanceRows}
              getRowId={(b) => `${b.fundTypeId}:${b.employeeId}`}
              onOpen={(b) => setLinesFor(b)}
              exportModule="WELFARE_FUNDS"
              exportName="fund-balances"
              empty={{ title: "No balances yet", description: "Balances appear once contributions post (BS day 1) or openings are entered." }}
            />
          </div>
        )}
        {tab === "funds" && (
          <div className="p-3">
            <DataGrid
              id="fund-types"
              label="Funds"
              columns={fundColumns}
              rows={data.funds}
              getRowId={(f) => f.id}
              onOpen={data.permissions.manageTypes ? (f) => setEditingFund(f) : undefined}
              empty={{ title: "No funds yet", description: data.permissions.manageTypes ? "Create the welfare / medical / gratuity funds your bylaws set." : "Funds appear here once set up." }}
              maxHeight="none"
            />
          </div>
        )}
      </Tabs>

      <FundTypeWindow
        key={editingFund?.id ?? (creatingFund ? "new" : "closed")}
        open={creatingFund || !!editingFund}
        fund={editingFund}
        onClose={() => {
          setCreatingFund(false);
          setEditingFund(null);
        }}
        onSaved={(name) => {
          setCreatingFund(false);
          setEditingFund(null);
          setNotice(`Fund "${name}" saved.`);
          refresh();
        }}
      />
      {posting && (
        <PostingWindow
          funds={data.funds.filter((f) => f.isActive)}
          employees={data.employees}
          initial={posting}
          onClose={() => setPosting(null)}
          onSaved={() => {
            setPosting(null);
            setNotice("Entry posted.");
            refresh();
          }}
        />
      )}
      {linesFor && (
        <LinesWindow
          key={`${linesFor.fundTypeId}:${linesFor.employeeId}`}
          row={linesFor}
          canPost={data.permissions.post}
          onPost={() => {
            setPosting({ fundTypeId: linesFor.fundTypeId, employeeId: linesFor.employeeId });
            setLinesFor(null);
          }}
          onClose={() => setLinesFor(null)}
        />
      )}
    </div>
  );
}

function FundTypeWindow({ open, fund, onClose, onSaved }: { open: boolean; fund: FundTypeView | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [code, setCode] = useState(fund?.code ?? "");
  const [name, setName] = useState(fund?.name ?? "");
  const [nameNp, setNameNp] = useState(fund?.nameNp ?? "");
  const [mode, setMode] = useState(fund?.contributionMode ?? "fixed");
  const [employeeValue, setEmployeeValue] = useState(fund ? String(fund.employeeValue) : "0");
  const [employerValue, setEmployerValue] = useState(fund ? String(fund.employerValue) : "0");
  const [isActive, setIsActive] = useState(fund?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveFundTypeAction(fund?.id ?? null, { code, name, nameNp, contributionMode: mode, employeeValue: Number(employeeValue), employerValue: Number(employerValue), isActive });
      if (result.success) onSaved(result.data.name);
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title={fund ? `Edit fund — ${fund.name}` : "New fund"}
      description="Contributions post for every active employee on BS day 1 with the rule below."
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save fund"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Fund">
            <FieldRow label="Name" required error={errors.name}>
              <input className={inputClass} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Staff welfare fund" />
            </FieldRow>
            <FieldRow label="Name (नेपाली)" error={errors.nameNp}>
              <input className={inputClass} value={nameNp} maxLength={100} onChange={(e) => setNameNp(e.target.value)} placeholder="कर्मचारी कल्याण कोष" />
            </FieldRow>
            <FieldRow label="Code" required error={errors.code} help={fund ? "A fund's code never changes (postings reference it)." : "Short id, e.g. welfare."}>
              <input className={`${inputClass} font-code`} value={code} maxLength={30} readOnly={!!fund} onChange={(e) => setCode(e.target.value.toLowerCase())} />
            </FieldRow>
            <FieldRow label="Contribution" error={errors.contributionMode}>
              <SelectField
                options={[
                  { value: "fixed", label: "Fixed amounts per month" },
                  { value: "percent_basic", label: "Percent of basic salary" },
                ]}
                value={mode}
                onChange={(v) => setMode(v === "percent_basic" ? "percent_basic" : "fixed")}
              />
            </FieldRow>
            <FieldRow label={mode === "percent_basic" ? "Employee %" : "Employee / month"} required error={errors.employeeValue}>
              <input type="number" min={0} step={mode === "percent_basic" ? 0.1 : 1} className={`${inputClass} w-32 text-right tabular-nums`} value={employeeValue} onChange={(e) => setEmployeeValue(e.target.value)} />
            </FieldRow>
            <FieldRow label={mode === "percent_basic" ? "Employer %" : "Employer / month"} required error={errors.employerValue}>
              <input type="number" min={0} step={mode === "percent_basic" ? 0.1 : 1} className={`${inputClass} w-32 text-right tabular-nums`} value={employerValue} onChange={(e) => setEmployerValue(e.target.value)} />
            </FieldRow>
            <FieldRow label="Active">
              <label className="flex h-8 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Contributions post monthly
              </label>
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function PostingWindow({ funds, employees, initial, onClose, onSaved }: { funds: FundTypeView[]; employees: FundsPageData["employees"]; initial: { fundTypeId?: string; employeeId?: string }; onClose: () => void; onSaved: () => void }) {
  const [fundTypeId, setFundTypeId] = useState(initial.fundTypeId ?? "");
  const [employeeId, setEmployeeId] = useState(initial.employeeId ?? "");
  const [kind, setKind] = useState("payout");
  const [employeeAmount, setEmployeeAmount] = useState("0");
  const [employerAmount, setEmployerAmount] = useState("0");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await postFundEntryAction({ fundTypeId, employeeId, kind, employeeAmount: Number(employeeAmount), employerAmount: Number(employerAmount), note });
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
      title="Post fund entry"
      description="Openings start a balance; payouts are entered positive and never exceed a share; adjustments correct mistakes (the ledger is append-only)."
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !fundTypeId || !employeeId}>
            {pending ? "Posting…" : "Post"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Entry">
            <FieldRow label="Fund" required error={errors.fundTypeId}>
              <SelectField options={funds.map((f) => ({ value: f.id, label: f.name }))} value={fundTypeId} onChange={setFundTypeId} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox options={employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))} value={employeeId} onChange={setEmployeeId} placeholder="Type a name or code" />
            </FieldRow>
            <FieldRow label="Kind">
              <SelectField
                options={[
                  { value: "payout", label: "Payout (भुक्तानी)" },
                  { value: "opening", label: "Opening balance" },
                  { value: "adjustment", label: "Adjustment (correction)" },
                ]}
                value={kind}
                onChange={setKind}
              />
            </FieldRow>
            <FieldRow label="Employee share" required error={errors.employeeAmount}>
              <input type="number" step={0.01} className={`${inputClass} w-36 text-right tabular-nums`} value={employeeAmount} onChange={(e) => setEmployeeAmount(e.target.value)} />
            </FieldRow>
            <FieldRow label="Employer share" required error={errors.employerAmount}>
              <input type="number" step={0.01} className={`${inputClass} w-36 text-right tabular-nums`} value={employerAmount} onChange={(e) => setEmployerAmount(e.target.value)} />
            </FieldRow>
            <FieldRow label="Note" error={errors.note} help="Required for adjustments.">
              <input className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function LinesWindow({ row, canPost, onPost, onClose }: { row: FundBalanceRow; canPost: boolean; onPost: () => void; onClose: () => void }) {
  const [lines, setLines] = useState<FundLineView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getFundLinesAction(row.fundTypeId, row.employeeId);
      if (cancelled) return;
      if (result.success) setLines(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [row.fundTypeId, row.employeeId]);

  return (
    <Window
      open
      onClose={onClose}
      title={`${row.fundName} — ${row.employeeName}`}
      description={`Balance: employee ${row.employeeShare} · employer ${row.employerShare} · total ${row.total}`}
      size="md"
      footer={
        <>
          <WindowButton onClick={onClose}>Close</WindowButton>
          {canPost && (
            <WindowButton variant="primary" onClick={onPost}>
              <Plus className="h-3.5 w-3.5" /> Post entry
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
      {!lines ? (
        <p className="p-4 text-sm text-ink-muted">Loading…</p>
      ) : lines.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">No lines yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-line-input text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-1.5 pr-2">Posted</th>
              <th className="py-1.5 pr-2">Kind</th>
              <th className="py-1.5 pr-2">Ref</th>
              <th className="py-1.5 pr-2 text-right">Employee</th>
              <th className="py-1.5 pr-2 text-right">Employer</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-1.5 pr-2 tabular-nums">{l.postedAt.slice(0, 10)}</td>
                <td className="py-1.5 pr-2 capitalize">{l.kind}</td>
                <td className="py-1.5 pr-2 font-code text-2xs text-ink-muted">{l.ref}</td>
                <td className="py-1.5 pr-2 text-right"><Amount value={Number(l.employeeAmount)} /></td>
                <td className="py-1.5 pr-2 text-right"><Amount value={Number(l.employerAmount)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Window>
  );
}
