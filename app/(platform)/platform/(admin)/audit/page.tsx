export const dynamic = "force-dynamic";

import React from "react";
import { FileText, ShieldAlert, CheckCircle2, UserCheck, Database, Calendar, User } from "lucide-react";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { platformAuditLogs, companies, platformUsers } from "@/lib/platform/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
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

      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white overflow-hidden">
        <div className="p-4 sm:p-5 bg-payroll-cream/50 border-b border-payroll-light/60 flex items-center justify-between">
          <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
            Audit Records ({logs.length})
          </span>
          <Badge variant="neutral" size="sm" className="font-mono">
            Last 50 Events
          </Badge>
        </div>

        {logs.length === 0 ? (
          <CardContent className="py-12">
            <EmptyState
              icon={<FileText className="w-6 h-6 text-payroll-primary" />}
              title="No platform audit log records found"
              description="Platform administrative actions (company registration, database provisioning, lifecycle updates) will be automatically captured here."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-payroll-cream/70 text-payroll-navy font-bold border-b border-payroll-light text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Target Organization</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Forensic Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-payroll-light/50 bg-white">
                {logs.map((log) => {
                  const isSuccess = log.action.includes("SUCCESS") || log.action.includes("REGISTER") || log.action.includes("PROVISION");
                  const metaObj = (log.meta as Record<string, any>) || {};

                  return (
                    <tr key={log.id} className="hover:bg-payroll-cream/40 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge
                          variant={isSuccess ? "success" : "info"}
                          size="sm"
                          className="font-mono font-bold gap-1"
                        >
                          {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                          <span>{log.action}</span>
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5">
                        {log.companyName ? (
                          <div>
                            <span className="font-bold text-payroll-navy block">{log.companyName}</span>
                            <span className="text-[10px] font-mono text-payroll-primary font-bold">{log.companyCode}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-medium">System Platform</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {log.actorName ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-payroll-cream text-payroll-primary border border-payroll-light text-[10px] font-bold">
                              <User className="h-3 w-3" />
                            </div>
                            <div>
                              <span className="font-bold text-payroll-navy block">{log.actorName}</span>
                              <span className="text-[10px] text-gray-400">{log.actorEmail}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 font-mono text-[11px]">System Daemon</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-gray-600 font-mono text-[11px]">
                        {metaObj.dbName && <div>DB: <span className="font-bold text-payroll-navy">{metaObj.dbName}</span></div>}
                        {metaObj.slug && <div>Slug: <span className="text-payroll-primary">{metaObj.slug}</span></div>}
                        {metaObj.adminEmail && <div className="text-[10px] text-gray-400">{metaObj.adminEmail}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
