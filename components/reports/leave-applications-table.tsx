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
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-100 bg-white">
        <div className="flex items-center space-x-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <span className="text-sm font-medium">Loading leave applications log...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-gray-200/80 bg-white p-6 text-center">
        <div className="rounded-full bg-green-50 p-3 text-green-600">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-gray-900">No Leave Applications Found</h3>
        <p className="mt-1 text-xs text-gray-500">
          No leave application records were found for the selected filter criteria.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Pending
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-gray-700">
              <th className="px-4 py-3 font-semibold">SN</th>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Leave Type</th>
              <th className="px-4 py-3 font-semibold">Applied Date</th>
              <th className="px-4 py-3 font-semibold">Effective Range</th>
              <th className="px-4 py-3 font-semibold text-center">Days</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold text-center">Status</th>
              <th className="px-4 py-3 font-semibold">Reviewed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => (
              <tr key={row.id || idx} className="transition-colors hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-500">{idx + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-gray-900">{row.employeeName}</div>
                  <div className="text-[11px] font-mono text-gray-400">{row.employeeCode}</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{row.departmentName}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{row.leaveTypeName}</td>
                <td className="px-4 py-2.5 text-gray-600">{row.appliedDate}</td>
                <td className="px-4 py-2.5">
                  <div className="font-mono text-gray-700">
                    {row.effectiveFrom} → {row.effectiveTo}
                  </div>
                  <div className="text-[10px] text-gray-400">{row.duration}</div>
                </td>
                <td className="px-4 py-2.5 text-center font-bold text-gray-900">
                  {row.noOfDays}
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 text-gray-600" title={row.reason}>
                  {row.reason}
                </td>
                <td className="px-4 py-2.5 text-center">{getStatusBadge(row.status)}</td>
                <td className="px-4 py-2.5 text-gray-500">{row.reviewedBy || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
