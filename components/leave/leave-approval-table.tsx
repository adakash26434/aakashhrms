"use client";

import { useState, useMemo } from "react";
import {
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeaveApplication } from "@/lib/types/leave";
import { getStatusBadgeVariant } from "@/lib/engines/leave.engine";

interface EnrichedApplication extends LeaveApplication {
  employeeName: string;
}

interface LeaveApprovalTableProps {
  applications: EnrichedApplication[];
  leaveTypeMap: Record<string, string>;
  onView: (app: EnrichedApplication) => void;
  onApprove: (app: EnrichedApplication) => void;
  onReject: (app: EnrichedApplication) => void;
}

type SortKey = "employeeName" | "leaveTypeId" | "effectiveFrom" | "noOfDays" | "appliedDate";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function SortHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-left text-[11px] uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1b3a1f]"
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

export function LeaveApprovalTable({
  applications,
  leaveTypeMap,
  onView,
  onApprove,
  onReject,
}: LeaveApprovalTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("appliedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedApplications = useMemo(() => {
    const list = [...applications];
    list.sort((a, b) => {
      const getValue = (app: EnrichedApplication) => {
        switch (sortKey) {
          case "employeeName": return app.employeeName.toLowerCase();
          case "leaveTypeId": return (leaveTypeMap[app.leaveTypeId] || app.leaveTypeId).toLowerCase();
          case "effectiveFrom": return new Date(app.effectiveFrom).getTime();
          case "appliedDate": return new Date(app.appliedDate).getTime();
          case "noOfDays": return app.noOfDays;
          default: return app.employeeName.toLowerCase();
        }
      };
      const left = getValue(a);
      const right = getValue(b);
      if (typeof left === "number" && typeof right === "number") {
        return sortDir === "asc" ? left - right : right - left;
      }
      const cmp = String(left).localeCompare(String(right), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [applications, leaveTypeMap, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e8d0] bg-white py-16">
        <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
        <p className="text-sm font-medium text-gray-500">All caught up!</p>
        <p className="mt-1 text-xs text-gray-400">
          No pending leave applications awaiting your review.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#d7e8d0]/80 bg-white shadow-sm">
      <table className="w-full min-w-180 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60">
            <SortHeader label="Employee" onClick={() => toggleSort("employeeName")} />
            <SortHeader label="Leave Type" onClick={() => toggleSort("leaveTypeId")} />
            <th scope="col" className="px-4 py-3 font-semibold">
              <span className="text-[11px] uppercase tracking-wider text-gray-500">From &rarr; To</span>
            </th>
            <SortHeader label="Days" onClick={() => toggleSort("noOfDays")} />
            <SortHeader label="Applied" onClick={() => toggleSort("appliedDate")} />
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="text-[11px] uppercase tracking-wider text-gray-500">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedApplications.map((app) => {
            const leaveTypeName = leaveTypeMap[app.leaveTypeId] || app.leaveTypeId;

            return (
              <tr
                key={app.id}
                className="border-b border-[#d7e8d0]/60 transition-colors hover:bg-[#f6faf6]/50 cursor-pointer"
                onClick={() => onView(app)}
              >
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d7e8d0] text-[11px] font-bold text-[#1b3a1f]">
                      {getInitials(app.employeeName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[#1b3a1f]">{app.employeeName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-600">{leaveTypeName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-[11px] text-gray-400">
                      {app.duration === "Half Day" ? "½ Day" : "Full Day"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="text-gray-600">{formatDate(app.effectiveFrom)}</div>
                  <div className="text-[11px] text-gray-400">&rarr; {formatDate(app.effectiveTo)}</div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className="font-semibold text-[#1b3a1f]">{app.noOfDays}</span>
                </td>
                <td className="px-4 py-3 align-middle text-gray-600">
                  {formatDate(app.appliedDate)}
                </td>
                <td className="px-4 py-3 text-right align-middle">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onView(app); }}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#d7e8d0]/50 hover:text-[#2e7d32]"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onApprove(app); }}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                      title="Approve"
                    >
                      <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onReject(app); }}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 transition-colors hover:bg-red-100 hover:text-red-800"
                      title="Reject"
                    >
                      <XCircle className="h-3.5 w-3.5 inline mr-1" />
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}