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
    <div className="overflow-x-auto rounded-2xl border border-payroll-light/80 bg-white shadow-payroll-xs">
      <table className="w-full text-left text-xs">
        <thead className="bg-payroll-cream/70 border-b border-payroll-light text-payroll-navy font-bold text-[11px] uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3.5">Timestamp</th>
            <th className="px-4 py-3.5">Changed By</th>
            <th className="px-4 py-3.5">Target Role</th>
            <th className="px-4 py-3.5">Action</th>
            <th className="px-4 py-3.5">Module</th>
            <th className="px-5 py-3.5 text-right">Change Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-payroll-light/50 bg-white">
          {logs.map((log) => {
            const isGranted = log.changeType === "GRANTED";

            return (
              <tr key={log.id} className="hover:bg-payroll-cream/40 transition-colors">
                {/* Timestamp */}
                <td className="px-5 py-3.5 font-mono text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                  {formatAuditTimestamp(log.createdAt)}
                </td>

                {/* Changed By */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-payroll-light/60 text-payroll-navy border border-payroll-light">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-payroll-navy block text-xs">
                        {log.changedByUserName || log.changedByUserEmail?.split("@")[0] || "Admin"}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">{log.changedByUserEmail}</span>
                    </div>
                  </div>
                </td>

                {/* Target Role */}
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-payroll-cream px-2.5 py-1 text-xs font-bold text-payroll-navy border border-payroll-light/80">
                    <Shield className="h-3 w-3 text-payroll-primary" />
                    {log.affectedRoleName}
                  </span>
                </td>

                {/* Permission Action */}
                <td className="px-4 py-3.5">
                  <Badge variant="info" size="sm">
                    {log.action || "ALL"}
                  </Badge>
                </td>

                {/* Module */}
                <td className="px-4 py-3.5">
                  <Badge variant="neutral" size="sm">
                    {log.module || "GLOBAL"}
                  </Badge>
                </td>

                {/* Change Type */}
                <td className="px-5 py-3.5 text-right">
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
