export const dynamic = "force-dynamic";

import React from "react";
import { FileText, ShieldAlert, CheckCircle2, UserCheck, Database, Calendar, User } from "lucide-react";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { platformAuditLogs, companies, platformUsers } from "@/lib/platform/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PlatformAuditLogsPage() {
  await ensurePlatformTablesExist();

  const logs = await platformDb
    .select({
      id: platformAuditLogs.id,
      action: platformAuditLogs.action,
      meta: platformAuditLogs.meta,
      ipAddress: platformAuditLogs.ipAddress,
      createdAt: platformAuditLogs.createdAt,
      companyName: companies.displayName,
      companyCode: companies.companyCode,
      actorName: platformUsers.name,
      actorEmail: platformUsers.email,
    })
    .from(platformAuditLogs)
    .leftJoin(companies, eq(platformAuditLogs.companyId, companies.id))
    .leftJoin(platformUsers, eq(platformAuditLogs.actorPlatformUserId, platformUsers.id))
    .orderBy(desc(platformAuditLogs.createdAt))
    .limit(50);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
          Platform Forensic Audit Logs
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
          Immutable audit trail of all Super Admin control plane operations, company lifecycle changes, and database pipelines.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
            Audit Records ({logs.length})
          </span>
          <Badge variant="neutral" size="sm" className="font-mono text-zinc-600 bg-zinc-100 border-zinc-200">
            Last 50 Events
          </Badge>
        </div>

        {logs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<FileText className="w-6 h-6 text-zinc-500" />}
              title="No platform audit log records found"
              description="Platform administrative actions (company registration, database provisioning, lifecycle updates) will be automatically captured here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-transparent text-2xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target Organization</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Forensic Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {logs.map((log) => {
                  const isSuccess = log.action.includes("SUCCESS") || log.action.includes("REGISTER") || log.action.includes("PROVISION");
                  const metaObj = (log.meta as Record<string, any>) || {};

                  return (
                    <tr key={log.id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 font-mono text-2xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge
                          variant={isSuccess ? "success" : "info"}
                          size="sm"
                          className="font-mono font-medium gap-1"
                        >
                          {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                          <span>{log.action}</span>
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5">
                        {log.companyName ? (
                          <div>
                            <span className="font-medium text-zinc-900 block">{log.companyName}</span>
                            <span className="text-2xs font-mono text-zinc-500">{log.companyCode}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 font-medium">System Platform</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {log.actorName ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 text-2xs font-medium">
                              <User className="h-3 w-3" />
                            </div>
                            <div>
                              <span className="font-medium text-zinc-900 block">{log.actorName}</span>
                              <span className="text-2xs text-zinc-400">{log.actorEmail}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-500 font-mono text-2xs">System Daemon</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-zinc-600 font-mono text-2xs">
                        {metaObj.dbName && <div>DB: <span className="font-medium text-zinc-900">{metaObj.dbName}</span></div>}
                        {metaObj.slug && <div>Slug: <span className="text-zinc-700">{metaObj.slug}</span></div>}
                        {metaObj.adminEmail && <div className="text-2xs text-zinc-400">{metaObj.adminEmail}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
