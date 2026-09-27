"use client";

import { AuditLogEntry } from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRecordTitle, formatAuditTimestamp } from "@/lib/engines/audit.engine";
import { ScrollText, Eye } from "lucide-react";

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  onViewDetails: (log: AuditLogEntry) => void;
}

const ACTION_VARIANTS: Record<
  string,
  "info" | "success" | "warning" | "danger" | "default"
> = {
  VIEW: "info",
  ADD: "success",
  EDIT: "warning",
  DELETE: "danger",
  APPROVE: "success",
  LOCK: "danger",
};

export function AuditLogTable({ logs, onViewDetails }: AuditLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="py-16 text-center">
        <ScrollText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-600 text-base font-semibold">
          No audit events found
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Try adjusting your filters or search query.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[11px]">
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Module</th>
            <th className="px-4 py-3">Record</th>
            <th className="px-4 py-3">IP Address</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3 text-center">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {logs.map((log) => {
            const recordDisplay =
              log.recordTitle ||
              formatRecordTitle(
                log.recordId,
                log.module,
                log.newValues,
                log.oldValues,
              );

            return (
              <tr
                key={log.id}
                className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors"
              >
                {/* TIMESTAMP */}
                <td className="px-4 py-4 font-mono text-zinc-500 whitespace-nowrap" suppressHydrationWarning>
                  {formatAuditTimestamp(log.createdAt)}
                </td>

                {/* USER */}
                <td className="px-4 py-4">
                  <div>
                    <span className="font-medium text-xs text-zinc-900 block">
                      {log.userName || log.userEmail?.split("@")[0] || "System"}
                    </span>
                    <span className="text-[11px] text-zinc-400 block font-mono">
                      {log.roleNameAtTime ||
                        log.userEmail ||
                        "System Administrator"}
                    </span>
                  </div>
                </td>

                {/* ACTION */}
                <td className="px-4 py-4">
                  <span className="inline-flex items-center rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-700 border border-zinc-200">
                    {log.action}
                  </span>
                </td>

                {/* MODULE */}
                <td className="px-4 py-4 font-medium text-zinc-800">
                  {log.module}
                </td>

                {/* RECORD */}
                <td
                  className="px-4 py-4 font-medium text-zinc-600 max-w-55 truncate"
                  title={recordDisplay}
                >
                  {recordDisplay}
                </td>

                {/* IP ADDRESS */}
                <td className="px-4 py-4 font-mono text-xs text-zinc-500">
                  {log.ipAddress || "—"}
                </td>

                {/* RESULT */}
                <td className="px-4 py-4">
                  <Badge
                    variant={log.result === "SUCCESS" ? "info" : "danger"}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                  >
                    {log.result}
                  </Badge>
                </td>

                {/* DETAILS */}
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => onViewDetails(log)}
                    className="inline-flex items-center justify-center h-7 w-7 rounded p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
