"use client";

import { PermissionChangeLogEntry } from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { formatAuditTimestamp } from "@/lib/engines/audit.engine";

interface PermissionChangeTableProps {
  logs: PermissionChangeLogEntry[];
}

export function PermissionChangeTable({ logs }: PermissionChangeTableProps) {
  if (logs.length === 0) {
    return (
      <div className="py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-600 text-base font-semibold">No permission changes recorded</p>
        <p className="text-gray-400 text-xs mt-1">Changes made to role permissions will automatically appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#f6faf6] border-b border-[#d7e8d0] text-[#1b3a1f] font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3.5">Timestamp</th>
            <th className="px-4 py-3.5">Changed By</th>
            <th className="px-4 py-3.5">Target Role</th>
            <th className="px-4 py-3.5">Permission Action</th>
            <th className="px-4 py-3.5">Module</th>
            <th className="px-5 py-3.5 text-right">Change Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d7e8d0]/60 bg-white">
          {logs.map((log) => {
            const isGranted = log.changeType === "GRANTED";

            return (
              <tr key={log.id} className="hover:bg-[#f6faf6]/60 transition-colors">
                {/* Timestamp */}
                <td className="px-5 py-3.5 font-mono text-gray-600 whitespace-nowrap" suppressHydrationWarning>
                  {formatAuditTimestamp(log.createdAt)}
                </td>

                {/* Changed By */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-[#1b3a1f] block">
                        {log.changedByUserName || log.changedByUserEmail?.split("@")[0] || "Admin"}
                      </span>
                      <span className="text-[11px] text-gray-400">{log.changedByUserEmail}</span>
                    </div>
                  </div>
                </td>

                {/* Target Role */}
                <td className="px-4 py-3.5 font-medium text-gray-800">
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    <Shield className="h-3 w-3 text-slate-500" />
                    {log.affectedRoleName}
                  </span>
                </td>

                {/* Permission Action */}
                <td className="px-4 py-3.5">
                  <Badge variant="info" className="font-mono text-[10px]">
                    {log.action || "ALL"}
                  </Badge>
                </td>

                {/* Module */}
                <td className="px-4 py-3.5">
                  <Badge variant="neutral" className="font-medium text-[10px]">
                    {log.module || "GLOBAL"}
                  </Badge>
                </td>

                {/* Change Type */}
                <td className="px-5 py-3.5 text-right">
                  {isGranted ? (
                    <Badge variant="success" className="gap-1 font-semibold">
                      <ShieldCheck className="h-3 w-3" /> GRANTED
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="gap-1 font-semibold">
                      <ShieldAlert className="h-3 w-3" /> REVOKED
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
