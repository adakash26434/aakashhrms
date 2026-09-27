"use client";

import { PermissionChangeLogEntry } from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Shield, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { formatAuditTimestamp } from "@/lib/engines/audit.engine";

interface PermissionChangeTableProps {
  logs: PermissionChangeLogEntry[];
}

export function PermissionChangeTable({ logs }: PermissionChangeTableProps) {
  if (logs.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          icon={<Shield className="h-6 w-6 text-payroll-primary" />}
          title="No permission changes recorded"
          description="Security adjustments and permission allocation changes made to custom and system roles will be logged here with complete forensic audit details."
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-zinc-500 font-semibold text-[11px] uppercase tracking-wider">
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">Changed By</th>
            <th className="px-4 py-3">Target Role</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Module</th>
            <th className="px-4 py-3 text-right">Change Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {logs.map((log) => {
            const isGranted = log.changeType === "GRANTED";

            return (
              <tr key={log.id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                {/* Timestamp */}
                <td className="px-4 py-4 font-mono text-zinc-500 whitespace-nowrap" suppressHydrationWarning>
                  {formatAuditTimestamp(log.createdAt)}
                </td>

                {/* Changed By */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-medium text-zinc-900 block text-xs">
                        {log.changedByUserName || log.changedByUserEmail?.split("@")[0] || "Admin"}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">{log.changedByUserEmail}</span>
                    </div>
                  </div>
                </td>

                {/* Target Role */}
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 border border-zinc-200">
                    <Shield className="h-3 w-3 text-zinc-500" />
                    {log.affectedRoleName}
                  </span>
                </td>

                {/* Permission Action */}
                <td className="px-4 py-4">
                  <Badge variant="info" size="sm">
                    {log.action || "ALL"}
                  </Badge>
                </td>

                {/* Module */}
                <td className="px-4 py-4">
                  <Badge variant="neutral" size="sm">
                    {log.module || "GLOBAL"}
                  </Badge>
                </td>

                {/* Change Type */}
                <td className="px-4 py-4 text-right">
                  {isGranted ? (
                    <Badge variant="success" size="sm">
                      <ShieldCheck className="h-3 w-3 mr-1" /> GRANTED
                    </Badge>
                  ) : (
                    <Badge variant="danger" size="sm">
                      <ShieldAlert className="h-3 w-3 mr-1" /> REVOKED
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
