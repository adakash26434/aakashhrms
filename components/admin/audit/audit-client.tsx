"use client";

import { useState, useTransition } from "react";
import {
  AuditLogEntry,
  AuditLogKPIs,
  AuditLogFilter,
  ActionType,
} from "@/lib/types/audit";
import { AuditLogTable } from "./audit-log-table";
import { AuditDetailModal } from "./audit-detail-modal";
import { getAuditLogsAction } from "@/app/actions/audit.actions";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Search,
  Download,
  Activity,
} from "lucide-react";

interface AuditClientProps {
  initialLogs: AuditLogEntry[];
  initialTotalCount: number;
  initialKPIs: AuditLogKPIs;
}

export function AuditClient({
  initialLogs,
  initialTotalCount,
  initialKPIs,
}: AuditClientProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [kpis, setKpis] = useState<AuditLogKPIs>(initialKPIs);

  const [isPending, startTransition] = useTransition();

  // Filters state
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");
  const [resultFilter, setResultFilter] = useState<string>("all");

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleFilterChange = (
    newSearch: string,
    newAction: ActionType | "all",
    newResult: string,
  ) => {
    setSearch(newSearch);
    setActionFilter(newAction);
    setResultFilter(newResult);

    startTransition(async () => {
      const filter: AuditLogFilter = {
        search: newSearch,
        action: newAction,
        result: newResult,
      };

      const res = await getAuditLogsAction(filter);
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setTotalCount(res.data.totalCount);
        setKpis(res.data.kpis);
      }
    });
  };

  const handleViewDetails = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const toast = useToast();

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.warning("No audit logs to export.");
      return;
    }

    try {
      const headers = [
        "Timestamp",
        "User Email",
        "Action",
        "Module",
        "Record",
        "Result",
        "IP Address",
      ];
      const rows = logs.map((l) => [
        new Date(l.createdAt).toISOString(),
        l.userEmail || "System",
        l.action,
        l.module,
        l.recordTitle || l.recordId || "",
        l.result,
        l.ipAddress || "",
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [
          headers.join(","),
          ...rows.map((e) => e.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `aakashhrms_audit_log_${new Date().toISOString().substring(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Audit logs CSV exported successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export audit logs.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
        {/* Total Events */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Total system audit logs</p>
              <Activity className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.totalEvents.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Immutable compliance event log
          </div>
        </div>

        {/* Events Today */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Security events today</p>
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.todayEvents.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Recorded since 00:00 midnight
          </div>
        </div>

        {/* Denied Attempts */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Denied access attempts</p>
              <ShieldAlert className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.deniedEvents.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Blocked unauthorized requests
          </div>
        </div>

        {/* System Activity */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Active audit scope</p>
              <Shield className="h-4 w-4 text-zinc-600" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 font-sans">
                All Modules
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Enterprise-wide telemetry active
          </div>
        </div>
      </div>

      {/* ── Main System Activity Log Table ── */}
      <Card className="p-4 overflow-visible">
        {/* Header & Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-payroll-border pb-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-payroll-primary" />
            <h3 className="text-base font-bold text-payroll-navy">
              System Change Logs ({totalCount})
            </h3>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs by user, module, record title..."
              value={search}
              onChange={(e) =>
                handleFilterChange(e.target.value, actionFilter, resultFilter)
              }
              className="w-full rounded-lg border border-payroll-border bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) =>
              handleFilterChange(
                search,
                e.target.value as ActionType | "all",
                resultFilter,
              )
            }
            className="rounded-lg border border-payroll-border bg-white px-3 py-2 text-sm text-payroll-navy outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
          >
            <option value="all">All Actions</option>
            <option value="VIEW">VIEW</option>
            <option value="ADD">ADD</option>
            <option value="EDIT">EDIT</option>
            <option value="DELETE">DELETE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="LOCK">LOCK</option>
          </select>

          {/* Result Filter */}
          <select
            value={resultFilter}
            onChange={(e) =>
              handleFilterChange(search, actionFilter, e.target.value)
            }
            className="rounded-lg border border-payroll-border bg-white px-3 py-2 text-sm text-payroll-navy outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
          >
            <option value="all">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DENIED_PERMISSION">DENIED PERMISSION</option>
          </select>
        </div>

        {/* Activity Logs Table */}
        <div className="mt-4">
          <AuditLogTable logs={logs} onViewDetails={handleViewDetails} />
        </div>
      </Card>

      {/* Audit Detail Modal */}
      <AuditDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        log={selectedLog}
      />
    </div>
  );
}
