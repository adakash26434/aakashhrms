"use client";

import { useMemo, useState } from "react";
import { Briefcase, Landmark, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { DateFormatProvider } from "@/lib/contexts/date-format-context";
import { DateFormatMenu } from "@/components/ui/date-format-menu";
import { useDensity } from "@/lib/kit/density";
import { STATUS_VOCABULARY, type StatusKey } from "@/lib/kit/status";
import { PageBar } from "@/components/frame/page-bar";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { FactBox } from "@/components/kit/fact-box";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { FormSkeleton } from "@/components/kit/skeleton";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs } from "@/components/kit/tabs";
import { Window, WindowButton } from "@/components/kit/window";
import { Worklist } from "@/components/kit/worklist";

// Sample data only (deterministic, no real records).
const FIRST = ["Sita", "Ram", "Anita", "Bikash", "Sumina", "Pramod", "Kushal", "Nirmala", "Hari", "Gita", "Suresh", "Asha"];
const LAST = ["Sharma", "Thapa", "Gurung", "Karki", "Shrestha", "Pokhrel", "Rai", "Magar", "Adhikari", "Bhandari"];
const DEPTS = ["Finance", "Operations", "Human Resources", "Sales", "IT"];
const STATUSES: StatusKey[] = ["active", "active", "active", "active", "onHold", "inactive"];

interface Row {
  id: string;
  code: string;
  name: string;
  dept: string;
  joined: string;
  basic: number;
  allowances: number;
  deductions: number;
  net: number;
  status: StatusKey;
  pan: string | null;
}

const ROWS: Row[] = Array.from({ length: 60 }, (_, i) => {
  const basic = 25000 + ((i * 7919) % 90000);
  const allowances = Math.round(basic * (0.08 + (i % 5) * 0.03));
  const deductions = Math.round(basic * 0.11 + (i % 4) * 900);
  return {
    id: `r${i}`,
    code: `EMP-${String(i + 1).padStart(3, "0")}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
    dept: DEPTS[i % DEPTS.length],
    joined: `20${18 + (i % 8)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    basic,
    allowances,
    deductions,
    net: i === 7 ? -1250 : basic + allowances - deductions,
    status: STATUSES[i % STATUSES.length],
    pan: i % 9 === 4 ? null : `60${String(1000000 + i * 7341).slice(0, 7)}`,
  };
});

const COLUMNS: GridColumn<Row>[] = [
  { id: "code", header: "Code", value: (r) => r.code, type: "code", width: 96, sticky: true },
  { id: "name", header: "Employee", value: (r) => r.name, width: 180, sticky: true },
  { id: "dept", header: "Department", value: (r) => r.dept, width: 140 },
  { id: "joined", header: "Joined", value: (r) => r.joined, type: "date" },
  { id: "basic", header: "Basic", value: (r) => r.basic, type: "amount", total: "sum" },
  { id: "allowances", header: "Allowances", value: (r) => r.allowances, type: "amount", total: "sum" },
  { id: "deductions", header: "Deductions", value: (r) => r.deductions, type: "amount", total: "sum" },
  { id: "net", header: "Net pay", value: (r) => r.net, type: "amount", total: "sum", cell: (r) => <Amount value={r.net} emphasis /> },
  { id: "pan", header: "PAN", value: (r) => r.pan, type: "code", defaultHidden: true },
  { id: "status", header: "Status", value: (r) => r.status, type: "status", width: 110 },
];

const LEAVES = [
  { id: "l1", name: "Sita Sharma", type: "Annual leave", days: 3, from: "2026-10-12", reason: "Family wedding in Pokhara" },
  { id: "l2", name: "Ram Thapa", type: "Sick leave", days: 1, from: "2026-10-05", reason: "Fever, medical note attached" },
  { id: "l3", name: "Anita Gurung", type: "Dashain (festival)", days: 5, from: "2026-10-18", reason: "Dashain at home" },
];

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function KitV2Gallery() {
  return (
    <DateFormatProvider>
      <GalleryBody />
    </DateFormatProvider>
  );
}

function GalleryBody() {
  const [density, setDensity] = useDensity();
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Row | null>(null);
  const [gridState, setGridState] = useState<"data" | "loading" | "empty" | "error">("data");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("personal");
  const [draftName, setDraftName] = useState("Sita Sharma");
  const baseName = active?.name ?? "Sita Sharma";
  const openEditor = (row: Row | null = active) => {
    setDraftName(row?.name ?? "Sita Sharma");
    setEditing(true);
  };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [queue, setQueue] = useState(LEAVES);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ROWS.filter(
      (r) =>
        (!filters.dept || r.dept === filters.dept) &&
        (!filters.status || r.status === filters.status) &&
        (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
    );
  }, [filters, search]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-sm font-semibold text-ink">Component kit v2 (Phase 3)</p>
        <span className="text-xs text-ink-muted">Dates follow the BS/AD switch · density applies to every grid</span>
        <div className="ml-auto flex items-center gap-2">
          <DateFormatMenu size="sm" />
          <button
            type="button"
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            className="h-8 rounded-md border border-line px-2.5 text-xs font-medium text-ink hover:bg-surface-sunken cursor-pointer"
          >
            Rows: {density === "compact" ? "Compact 28px" : "Comfortable 32px"}
          </button>
        </div>
      </div>

      <Section
        title="Register: PageBar + FilterStrip + DataGrid + SplitView + FactBox (3.1–3.3, E2, E9)"
        note="Click a row for the detail pane · ↑↓ Enter Space Shift+↑↓ Ctrl+A Ctrl+C · drag column edges · Columns menu (PAN is hidden by default) · first two columns stay pinned when scrolling sideways · orange/red edges flag rows needing attention."
      >
        <div className="rounded-lg border border-line bg-surface p-4">
          <PageBar
            title="Employees"
            description="60 sample employees, Ashwin 2083"
            status={<StatusChip status="active" label="Payroll open" />}
            actions={[
              { id: "new", label: "New employee", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", onClick: () => openEditor(null) },
              { id: "edit", label: "Edit", icon: Pencil, group: "selection", disabled: !active, disabledReason: "Select a row first", onClick: () => openEditor() },
              { id: "delete", label: "Delete", icon: Trash2, group: "selection", disabled: selected.size === 0, disabledReason: "Select rows to delete", onClick: () => setConfirmOpen(true) },
            ]}
          />
          <div className="mb-2 flex flex-wrap gap-1">
            {(["data", "loading", "empty", "error"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setGridState(s)}
                className={`h-7 rounded-md px-2 text-2xs font-medium cursor-pointer ${gridState === s ? "bg-ink text-white" : "border border-line text-ink-muted"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mb-3">
                  <FilterStrip
                    id="kit-employees"
                    values={filters}
                    onChange={setFilters}
                    search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
                    filters={[
                      { id: "dept", label: "Department", allLabel: "All departments", options: DEPTS.map((d) => ({ value: d, label: d })) },
                      { id: "status", label: "Status", allLabel: "All statuses", options: (["active", "onHold", "inactive"] as StatusKey[]).map((s) => ({ value: s, label: STATUS_VOCABULARY[s].label })) },
                    ]}
                  />
          </div>
          <SplitView
            id="kit-employees"
            detailTitle={active ? `${active.name} · ${active.code}` : undefined}
            onCloseDetail={() => setActive(null)}
            detail={
              active && (
                <div className="space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <StatusChip status={active.status} />
                    <span className="text-xs text-ink-muted">{active.dept}</span>
                  </div>
                  <FactBox
                    sections={[
                      {
                        title: "This year (FY 2083/84)",
                        facts: [
                          { label: "Gross to date", value: <Amount value={(active.basic + active.allowances) * 3} /> },
                          { label: "TDS deducted", value: <Amount value={Math.round(active.basic * 0.04) * 3} /> },
                          { label: "SSF (11% + 20%)", value: <Amount value={Math.round(active.basic * 0.31) * 3} /> },
                        ],
                      },
                      {
                        title: "Leave & loans",
                        facts: [
                          { label: "Annual leave left", value: "8.5 days" },
                          { label: "Sick leave left", value: active.status === "onHold" ? "-1 day" : "4 days", tone: active.status === "onHold" ? "danger" : "default" },
                          { label: "Open loan", value: <Amount value={active.net < 0 ? 85000 : 0} />, tone: active.net < 0 ? "warning" : "default" },
                        ],
                      },
                      {
                        title: "Record",
                        facts: [
                          { label: "Joined", value: <DateCell value={active.joined} /> },
                          { label: "PAN", value: active.pan ?? "Missing", tone: active.pan ? "default" : "warning" },
                        ],
                      },
                    ]}
                  />
                </div>
              )
            }
            master={
              <DataGrid
                id="kit-employees"
                label="Employees"
                columns={COLUMNS}
                rows={gridState === "empty" ? [] : rows}
                getRowId={(r) => r.id}
                loading={gridState === "loading"}
                error={gridState === "error" ? { message: "The server did not respond.", reference: "7F3A21C9", onRetry: () => setGridState("data") } : null}
                empty={{ title: "No employees match", description: "Clear the filters or add an employee.", action: <WindowButton variant="primary" onClick={() => setFilters({})}>Clear filters</WindowButton> }}
                selectable
                selected={selected}
                onSelectedChange={setSelected}
                activeRowId={active?.id ?? null}
                onActiveRowChange={setActive}
                onOpen={(r) => {
                  setActive(r);
                  openEditor(r);
                }}
                rowTone={(r) => (r.net < 0 ? "danger" : !r.pan ? "warning" : undefined)}
                defaultSort={{ columnId: "name", direction: "asc" }}
                pageSize={25}
                exportModule="EMPLOYEES"
                exportName="Employees sample"
                maxHeight="420px"
              />
            }
          />
        </div>
      </Section>

      <Section title="Status vocabulary, money and dates (3.6)">
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_VOCABULARY) as StatusKey[]).map((k) => (
              <StatusChip key={k} status={k} />
            ))}
            <StatusChip status="UNDER_REVIEW" />
            <StatusChip status="Something custom" />
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <span>Lakh grouping: <Amount value={452300.5} /></span>
            <span>Negative: <Amount value={-1250} /></span>
            <span>Accounting: <Amount value={-1250} parentheses /></span>
            <span>KPI compact: <Amount value={84200000} compact prefix="NPR" emphasis /></span>
            <span>BS date (hover for AD): <DateCell value="2026-10-02" /></span>
            <span>Long: <DateCell value="2026-10-02" variant="long" /></span>
          </div>
        </div>
      </Section>

      <Section title="Window + PropertyForm + Tabs (3.4, 3.5)" note="Esc closes · Tab stays inside · edit the name, then try to close: the dirty guard asks first.">
        <div className="flex flex-wrap gap-2">
          <WindowButton variant="primary" onClick={() => openEditor()}>
            Open employee window
          </WindowButton>
          <WindowButton variant="danger" onClick={() => setConfirmOpen(true)}>
            Typed confirmation
          </WindowButton>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="mb-3 text-xs text-ink-muted">Form skeleton (E11):</p>
          <FormSkeleton fields={3} />
        </div>
      </Section>

      <Section title="Worklist (E3)" note="Approve with A, reject with R (asks for a reason), move with J / K.">
        <Worklist
          title="Leave approvals"
          items={queue}
          getId={(l) => l.id}
          renderSummary={(l) => (
            <span className="block">
              <span className="block font-medium text-ink">{l.name}</span>
              <span className="text-ink-faint">
                {l.type} · {l.days} day{l.days === 1 ? "" : "s"}
              </span>
            </span>
          )}
          renderDetail={(l) => (
            <div className="space-y-3">
              <p className="text-base font-semibold text-ink">{l.name}</p>
              <FactBox
                sections={[
                  {
                    title: "Request",
                    facts: [
                      { label: "Type", value: l.type },
                      { label: "From", value: <DateCell value={l.from} /> },
                      { label: "Days", value: l.days },
                    ],
                  },
                ]}
              />
              <p className="text-sm text-ink-muted">“{l.reason}”</p>
            </div>
          )}
          onApprove={(l) => setQueue((q) => q.filter((x) => x.id !== l.id))}
          onReject={(l) => setQueue((q) => q.filter((x) => x.id !== l.id))}
        />
        {queue.length === 0 && (
          <WindowButton onClick={() => setQueue(LEAVES)}>Reset sample queue</WindowButton>
        )}
      </Section>

      <Window
        open={editing}
        onClose={() => setEditing(false)}
        title={active ? `Edit ${active.name}` : "New employee"}
        description="Sample form — nothing is saved."
        size="lg"
        dirty={draftName !== baseName}
        footer={
          <>
            <WindowButton onClick={() => setEditing(false)}>Cancel</WindowButton>
            <WindowButton variant="primary" onClick={() => setEditing(false)}>
              Save
            </WindowButton>
          </>
        }
      >
        <Tabs
          label="Employee sections"
          orientation="vertical"
          value={tab}
          onChange={setTab}
          items={[
            { id: "personal", label: "Personal", icon: UserRound },
            { id: "job", label: "Job", icon: Briefcase },
            { id: "bank", label: "Bank & tax", icon: Landmark, badge: <StatusChip status="pending" label="1" /> },
          ]}
        >
          <PropertyForm>
            {tab === "personal" && (
              <FieldGroup title="Personal details" description="As on citizenship certificate">
                <FieldRow label="Full name" required help="Shown on payslips and the bank file.">
                  <input className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                </FieldRow>
                <FieldRow label="Date of birth" error="Employee must be at least 16 years old.">
                  <input className={inputClass} defaultValue="2012-02-30" />
                </FieldRow>
                <FieldRow label="Employee code" readOnly>
                  <input className={inputClass} defaultValue="EMP-001" />
                </FieldRow>
              </FieldGroup>
            )}
            {tab === "job" && (
              <FieldGroup title="Position">
                <FieldRow label="Department" required>
                  <select className={inputClass} defaultValue="Finance">
                    {DEPTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="Notes" wide>
                  <textarea className={`${inputClass} h-20 max-w-none py-1.5`} />
                </FieldRow>
              </FieldGroup>
            )}
            {tab === "bank" && (
              <FieldGroup title="Bank & tax">
                <FieldRow label="PAN" help="9 digits, issued by the IRD.">
                  <input className={`${inputClass} font-code`} defaultValue="601234567" />
                </FieldRow>
                <FieldRow label="Account number">
                  <input className={`${inputClass} font-code`} defaultValue="0010012345678" />
                </FieldRow>
              </FieldGroup>
            )}
          </PropertyForm>
        </Tabs>
      </Window>

      <Confirm
        open={confirmOpen}
        title="Unlock payroll for Ashwin 2083?"
        tone="danger"
        confirmLabel="Unlock payroll"
        requireText="UNLOCK"
        message={
          <>
            Unlocking lets anyone with payroll access change a run that may already be paid. This is recorded in the audit log.
          </>
        }
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 600));
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
