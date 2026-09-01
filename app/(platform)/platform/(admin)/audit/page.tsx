export const dynamic = "force-dynamic";

import React from "react";
import { FileText, ShieldAlert, CheckCircle2, UserCheck, Database, Calendar } from "lucide-react";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { platformAuditLogs, companies, platformUsers } from "@/lib/platform/schema";
import { desc, eq } from "drizzle-orm";

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
      <div>
        <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">Platform Audit Logs</h1>
        <p className="text-sm text-gray-600 mt-1">
          Immutable audit trail of all Super Admin control plane actions, company registrations, and provisioning pipelines.
        </p>
      </div>

      <div className="bg-white border border-payroll-light rounded-2xl shadow-payroll-sm overflow-hidden">
        <div className="p-4 bg-payroll-cream border-b border-payroll-light flex items-center justify-between">
          <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
            Audit Records ({logs.length})
          </span>
          <span className="text-xs text-gray-500">Showing last 50 events</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-gray-400 mx-auto" />
            <p className="text-gray-600 font-medium text-sm">No platform audit log records found.</p>
            <p className="text-gray-400 text-xs">
              Platform administrative actions (company registration, database provisioning) will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-600 font-semibold border-b border-gray-100">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Target Company</th>
                  <th className="p-3.5">Actor</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const isSuccess = log.action.includes("SUCCESS") || log.action.includes("REGISTER");
                  const metaObj = (log.meta as Record<string, any>) || {};

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3.5 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                          <span>{log.action}</span>
                        </span>
                      </td>
                      <td className="p-3.5">
                        {log.companyName ? (
                          <div>
                            <span className="font-bold text-gray-900 block">{log.companyName}</span>
                            <span className="text-[10px] font-mono text-payroll-primary">{log.companyCode}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">System Platform</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {log.actorName ? (
                          <div>
                            <span className="font-semibold text-gray-800 block">{log.actorName}</span>
                            <span className="text-[10px] text-gray-500">{log.actorEmail}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 font-mono text-[11px]">System Daemon</span>
                        )}
                      </td>
                      <td className="p-3.5 text-gray-600 font-mono text-[11px]">
                        {metaObj.dbName && <span>DB: {metaObj.dbName}</span>}
                        {metaObj.slug && <span>Slug: {metaObj.slug}</span>}
                        {metaObj.adminEmail && <span className="block text-[10px] text-gray-500">{metaObj.adminEmail}</span>}
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
