"use client";

import type { LeaveApplicationReportRow } from "@/lib/types/report";
import { FileText, CheckCircle2, Clock, XCircle } from "lucide-react";

interface LeaveApplicationsTableProps {
  rows: LeaveApplicationReportRow[];
  loading?: boolean;
}

export function LeaveApplicationsTable({ rows, loading }: LeaveApplicationsTableProps) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center border-b border-zinc-100">
        <div className="flex items-center space-x-2.5 text-zinc-500 text-xs font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <span>Loading leave applications log...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center border-b border-zinc-100 p-6 text-center">
        <div className="rounded-full bg-zinc-100 p-2.5 text-zinc-500">
          <FileText className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-xs font-semibold text-zinc-900">No Leave Applications Found</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          No leave application records were found for the selected filter criteria.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/50 bg-amber-50/70 px-2 py-0.5 text-xs font-medium text-amber-800">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200/50 bg-rose-50/70 px-2 py-0.5 text-xs font-medium text-rose-800">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr>
            <th className="px-4 py-3 text-center w-12">SN</th>
            <th className="px-4 py-3 min-w-36">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Leave Type</th>
            <th className="px-4 py-3">Applied Date</th>
            <th className="px-4 py-3">Effective Range</th>
            <th className="px-4 py-3 text-center">Days</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3">Reviewed By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 text-xs">
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-zinc-50/60 transition-colors">
              <td className="px-4 py-3.5 text-center font-medium text-zinc-400">{idx + 1}</td>
              <td className="px-4 py-3.5">
                <div className="font-medium text-zinc-900">{row.employeeName}</div>
                <div className="text-[11px] font-mono text-zinc-400">{row.employeeCode}</div>
              </td>
              <td className="px-4 py-3.5 text-zinc-600">{row.departmentName}</td>
              <td className="px-4 py-3.5 font-medium text-zinc-800">{row.leaveTypeName}</td>
              <td className="px-4 py-3.5 text-zinc-600 font-mono">{row.appliedDate}</td>
              <td className="px-4 py-3.5">
                <div className="font-mono text-zinc-700">
                  {row.effectiveFrom} → {row.effectiveTo}
                </div>
                <div className="text-[10px] text-zinc-400">{row.duration}</div>
              </td>
              <td className="px-4 py-3.5 text-center font-medium text-zinc-900 font-mono">
                {row.noOfDays}
              </td>
              <td className="max-w-xs truncate px-4 py-3.5 text-zinc-600" title={row.reason}>
                {row.reason}
              </td>
              <td className="px-4 py-3.5 text-center">{getStatusBadge(row.status)}</td>
              <td className="px-4 py-3.5 text-zinc-500">{row.reviewedBy || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
