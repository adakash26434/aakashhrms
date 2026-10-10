"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { History, RefreshCw, ScrollText } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Notice } from "@/components/kit/notice";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs } from "@/components/kit/tabs";
import { auditPageAction, permissionChangesAction } from "@/app/actions/audit.actions";
import { AUDIT_PERIODS } from "@/lib/engines/audit.engine";
import type { AuditPage, AuditRow } from "@/lib/types/audit";
import type { PermissionChange } from "@/lib/types/role";
import { nepalClock } from "@/lib/utils/nepal-time";
import { cn } from "@/lib/utils";
import { AuditDetail } from "./audit-detail";

// Admin → Audit log (4.13c, template A): who did what, as which role, when and from where — and
// what was refused. A period at a time (the newest 1,000 entries of it); the pane shows what
// changed, before → after. Addresses are the request's own or "Not recorded" (S59).

const ACTIONS = [
  { value: "ADD", label: "Added" },
  { value: "EDIT", label: "Changed" },
  { value: "DELETE", label: "Deleted" },
  { value: "APPROVE", label: "Approved" },
  { value: "LOCK", label: "Locked" },
  { value: "EXPORT", label: "Exported" },
  { value: "VIEW", label: "Viewed" },
];

const toValues = (f: AuditPage["filter"]): FilterValues => ({
  period: f.period === "all" ? "" : f.period,
  module: f.module,
  action: f.action,
  outcome: f.outcome,
  userId: f.userId,
});

export function AuditClient({ initial }: { initial: AuditPage }) {
  const [data, setData] = useState(initial);
  const [values, setValues] = useState<FilterValues>(toValues(initial.filter));
  const [search, setSearch] = useState(initial.filter.search);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState("entries");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = useRef(true);

  const query = useMemo(() => ({ ...values, period: values.period || "all", search }), [values, search]);

  // Filters ask the server again (search after a pause); the URL keeps the choices, never the search text.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(
      () =>
        start(async () => {
          const result = await auditPageAction(query);
          if (!result.success) return setError(result.error);
          setError(null);
          setData(result.data);
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(values)) if (v) params.set(k === "userId" ? "user" : k, v);
          if (!values.period) params.set("period", "all");
          window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
        }),
      search !== data.filter.search ? 350 : 0
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the filters change
  }, [query]);

  const refresh = () =>
    start(async () => {
      const result = await auditPageAction(query);
      if (!result.success) return setError(result.error);
      setError(null);
      setData(result.data);
    });

  const columns: GridColumn<AuditRow>[] = useMemo(
    () => [
      {
        id: "at",
        header: "When",
        width: 110,
        type: "date",
        value: (r) => r.at,
        cell: (r) => (
          <span className="tabular-nums">
            <DateCell value={r.at} />
            <span className="block text-2xs text-ink-faint">{nepalClock(new Date(r.at))}</span>
          </span>
        ),
      },
      {
        id: "who",
        header: "Who",
        width: 190,
        value: (r) => r.who,
        cell: (r) => (
          <span className="min-w-0">
            <span className={cn("block truncate", r.userId ? "font-medium text-ink" : "text-ink-muted")}>{r.who}</span>
            <span className="block truncate text-2xs text-ink-faint">{r.role ?? (r.userId ? "Role not recorded" : "Scheduled job or system")}</span>
          </span>
        ),
      },
      { id: "action", header: "Did", width: 90, value: (r) => r.actionLabel },
      { id: "module", header: "Module", width: 160, value: (r) => r.moduleLabel, cell: (r) => <span className="block truncate" title={r.moduleLabel}>{r.moduleLabel}</span> },
      { id: "record", header: "Record", width: 220, value: (r) => r.record, cell: (r) => <span className="block truncate" title={r.record}>{r.record}</span> },
      {
        id: "result",
        header: "Result",
        width: 150,
        value: (r) => r.resultLabel,
        cell: (r) => <StatusChip status={r.refused ? "rejected" : r.result === "FAILURE" ? "error" : "approved"} label={r.refused ? "Refused" : r.resultLabel} />,
      },
      {
        id: "address",
        header: "Address",
        width: 120,
        value: (r) => r.address ?? "Not recorded",
        cell: (r) => (r.address ? <span className="font-code text-2xs">{r.address}</span> : <span className="text-ink-faint">Not recorded</span>),
      },
    ],
    []
  );

  const activeRow = data.rows.find((r) => r.id === activeId) ?? null;
  const periodLabel = AUDIT_PERIODS.find((p) => p.value === data.filter.period)?.label.toLowerCase() ?? "the period";
  const shown = data.rows.length;
  return (
    <div>
      <PageBar
        title="Audit log"
        description={`${data.total.toLocaleString("en-IN")} entr${data.total === 1 ? "y" : "ies"} ${data.filter.period === "all" ? "in all" : `in ${periodLabel}`}${data.refused ? ` · ${data.refused.toLocaleString("en-IN")} refused` : ""} · who did what, as which role, when and from where`}
        actions={[{ id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: refresh }]}
      />
      {error && (
        <Notice tone="danger" className="mb-3" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      <Tabs
        label="Audit log"
        value={tab}
        onChange={setTab}
        items={[
          { id: "entries", label: "Entries", icon: ScrollText },
          { id: "permissions", label: "Permission changes", icon: History },
        ]}
      >
        <div className="pt-3">
          <FilterStrip
            id="admin-audit"
            className="mb-3"
            values={values}
            onChange={(next) => setValues(next)}
            search={tab === "entries" ? { value: search, onChange: setSearch, placeholder: "Search the record or who" } : undefined}
            filters={[
              { id: "period", label: "Period", allLabel: "All time", options: AUDIT_PERIODS.filter((p) => p.value !== "all").map((p) => ({ value: p.value, label: p.label })) },
              ...(tab === "entries"
                ? [
                    { id: "userId", label: "Who", allLabel: "Everyone", options: data.users.map((u) => ({ value: u.id, label: u.label })) },
                    { id: "module", label: "Module", allLabel: "All modules", options: data.modules },
                    { id: "action", label: "Did", allLabel: "Anything", options: ACTIONS },
                    { id: "outcome", label: "Result", allLabel: "Done or refused", options: [{ value: "done", label: "Done" }, { value: "refused", label: "Refused" }] },
                  ]
                : []),
            ]}
          />
          {tab === "entries" ? (
            <>
              {data.total > shown && (
                <p className="mb-2 text-2xs text-ink-muted">
                  The newest {shown.toLocaleString("en-IN")} of {data.total.toLocaleString("en-IN")} entries: narrow the period or the filters to see older ones.
                </p>
              )}
              <SplitView
                id="admin-audit"
                detailTitle={activeRow ? `${activeRow.actionLabel}: ${activeRow.record}` : activeId ? "Entry" : undefined}
                onCloseDetail={() => setActiveId(null)}
                detail={activeId ? <AuditDetail key={activeId} id={activeId} /> : null}
                master={
                  <DataGrid
                    id="admin-audit"
                    label="Audit entries"
                    columns={columns}
                    rows={data.rows}
                    loading={pending && !data.rows.length}
                    getRowId={(r) => r.id}
                    activeRowId={activeId}
                    onActiveRowChange={(r) => setActiveId(r.id)}
                    onOpen={(r) => setActiveId(r.id)}
                    rowTone={(r) => (r.refused ? "danger" : undefined)}
                    pageSize={100}
                    maxHeight="calc(100vh - 330px)"
                    exportModule={data.can.export ? "AUDIT_LOG" : undefined}
                    exportName="Audit log"
                    empty={{ title: "No entries", description: "Nothing matches in this period: choose a longer period or clear the filters." }}
                  />
                }
              />
            </>
          ) : (
            <PermissionChanges key={values.period || "all"} period={values.period || "all"} />
          )}
        </div>
      </Tabs>
    </div>
  );
}

function PermissionChanges({ period }: { period: string }) {
  const [rows, setRows] = useState<PermissionChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    permissionChangesAction({ period }).then((result) => {
      if (!live) return;
      if (result.success) setRows(result.data);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [period]);

  const columns: GridColumn<PermissionChange>[] = [
    { id: "at", header: "When", width: 150, type: "date", value: (r) => r.at, cell: (r) => <span className="tabular-nums"><DateCell value={r.at} /> <span className="text-ink-faint">{nepalClock(new Date(r.at))}</span></span> },
    { id: "by", header: "By", width: 170, value: (r) => r.by },
    { id: "role", header: "Role", width: 180, value: (r) => r.roleName, cell: (r) => <span className={cn("block truncate", !r.roleId && "text-ink-faint")} title={r.roleId ? undefined : "This role was deleted"}>{r.roleName}{!r.roleId && " (deleted)"}</span> },
    { id: "change", header: "Change", width: 110, value: (r) => (r.change === "GRANTED" ? "Given" : "Taken away"), cell: (r) => <span className={r.change === "GRANTED" ? "font-medium text-success" : "font-medium text-danger"}>{r.change === "GRANTED" ? "Given" : "Taken away"}</span> },
    { id: "permission", header: "Permission", width: 320, value: (r) => r.permission },
  ];
  if (error) return <Notice tone="danger">{error}</Notice>;
  return <DataGrid id="admin-audit-permissions" label="Permission changes" columns={columns} rows={rows ?? []} loading={!rows} getRowId={(r) => r.id} pageSize={100} maxHeight="calc(100vh - 330px)" empty={{ title: "No permission changes", description: "Nothing was given or taken away in this period." }} />;
}
