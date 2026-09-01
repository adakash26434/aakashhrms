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
        <thead className="bg-[#f6faf6] border-b border-[#d7e8d0] text-[#1b3a1f] font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3.5">TIMESTAMP</th>
            <th className="px-4 py-3.5">USER</th>
            <th className="px-4 py-3.5">ACTION</th>
            <th className="px-4 py-3.5">MODULE</th>
            <th className="px-4 py-3.5">RECORD</th>
            <th className="px-4 py-3.5">IP ADDRESS</th>
            <th className="px-4 py-3.5">RESULT</th>
            <th className="px-5 py-3.5 text-center">DETAILS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d7e8d0]/60 bg-white">
          {logs.map((log) => {
            const actionVariant = ACTION_VARIANTS[log.action] || "default";
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
                className="hover:bg-[#f6faf6]/60 transition-colors"
              >
                {/* TIMESTAMP */}
                <td className="px-5 py-3.5 font-mono text-gray-600 whitespace-nowrap" suppressHydrationWarning>
                  {formatAuditTimestamp(log.createdAt)}
                </td>

                {/* USER */}
                <td className="px-4 py-3.5">
                  <div>
                    <span className="font-bold text-[#1b3a1f] block">
                      {log.userName || log.userEmail?.split("@")[0] || "System"}
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      {log.roleNameAtTime ||
                        log.userEmail ||
                        "System Administrator"}
                    </span>
                  </div>
                </td>

                {/* ACTION */}
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                    {log.action}
                  </span>
                </td>

                {/* MODULE */}
                <td className="px-4 py-3.5 font-medium text-gray-800">
                  {log.module}
                </td>

                {/* RECORD */}
                <td
                  className="px-4 py-3.5 font-medium text-gray-700 max-w-55 truncate"
                  title={recordDisplay}
                >
                  {recordDisplay}
                </td>

                {/* IP ADDRESS */}
                <td className="px-4 py-3.5 font-mono text-xs text-gray-600">
                  {log.ipAddress || "—"}
                </td>

                {/* RESULT */}
                <td className="px-4 py-3.5">
                  <Badge
                    variant={log.result === "SUCCESS" ? "info" : "danger"}
                    className="rounded-full px-2.5 py-0.5 text-[10px]"
                  >
                    {log.result}
                  </Badge>
                </td>

                {/* DETAILS */}
                <td className="px-5 py-3.5 text-center">
                  <button
                    onClick={() => onViewDetails(log)}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-full text-[#2e7d32] hover:bg-[#d7e8d0]/60 transition-colors cursor-pointer"
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
