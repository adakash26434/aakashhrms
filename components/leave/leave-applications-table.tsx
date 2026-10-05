"use client";

import React, {useMemo, useState } from "react";
import {
  ArrowUpDown,
  Eye,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeaveApplication } from "@/lib/types/leave";
const STATUS_VARIANT: Record<LeaveApplication["status"], "warning" | "success" | "danger" | "neutral"> = { Pending: "warning", Approved: "success", Rejected: "danger", Cancelled: "neutral" };
import { cn } from "@/lib/utils";

interface EnrichedApplication extends LeaveApplication {
  employeeName: string;
}

interface LeaveApplicationsTableProps {
  applications: EnrichedApplication[];
  leaveTypeMap: Record<string, string>;
  onView: (app: EnrichedApplication) => void;
  onEdit: (app: EnrichedApplication) => void;
  onDelete: (id: string) => void;
}

type SortKey =
  | "employeeName"
  | "leaveTypeId"
  | "effectiveFrom"
  | "effectiveTo"
  | "noOfDays"
  | "status"
  | "appliedDate";

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
    <th scope="col" className="px-4 py-4 font-semibold">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-left text-2xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-950"
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function LeaveExpandableRow({
  application,
  leaveTypeName,
}: {
  application: EnrichedApplication;
  leaveTypeName: string;
}) {
  return (
    <div className="border-b border-zinc-100 bg-zinc-50/40 px-4 py-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DetailCard title="Leave Details">
          <div className="space-y-1.5">
            <DetailRow label="Type" value={leaveTypeName} />
            <DetailRow label="Duration" value={application.duration} />
            <DetailRow label="Days" value={String(application.noOfDays)} />
            <DetailRow
              label="Applied"
              value={formatDate(application.appliedDate)}
            />
          </div>
        </DetailCard>

        <DetailCard title="Reason">
          <p className="text-xs text-zinc-900">{application.reason}</p>
          {application.remarks && (
            <p className="mt-1 text-2xs text-zinc-500">
              Note: {application.remarks}
            </p>
          )}
        </DetailCard>

        <DetailCard title="Review">
          {application.status === "Pending" ? (
            <p className="text-xs text-zinc-500">Awaiting review</p>
          ) : (
            <div className="space-y-1.5">
              <DetailRow
                label="Status"
                value={
                  <Badge variant={STATUS_VARIANT[application.status]}>
                    {application.status}
                  </Badge>
                }
              />
              {application.reviewRemarks && (
                <DetailRow
                  label="Remarks"
                  value={application.reviewRemarks}
                />
              )}
            </div>
          )}
        </DetailCard>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-zinc-200/60 bg-white p-3 shadow-xs ${className ?? ""}`}
    >
      <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-right font-medium text-zinc-900">{value}</span>
    </div>
  );
}

export function LeaveApplicationsTable({
  applications,
  leaveTypeMap,
  onView,
  onEdit,
  onDelete,
}: LeaveApplicationsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("appliedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedApplications = useMemo(() => {
    const list = [...applications];
    list.sort((a, b) => {
      const getValue = (app: EnrichedApplication) => {
        switch (sortKey) {
          case "employeeName":
            return app.employeeName.toLowerCase();
          case "leaveTypeId":
            return (leaveTypeMap[app.leaveTypeId] || app.leaveTypeId).toLowerCase();
          case "effectiveFrom":
            return new Date(app.effectiveFrom).getTime();
          case "effectiveTo":
            return new Date(app.effectiveTo).getTime();
          case "appliedDate":
            return new Date(app.appliedDate).getTime();
          case "noOfDays":
            return app.noOfDays;
          case "status":
            return app.status;
          default:
            return app.employeeName.toLowerCase();
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
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-zinc-500">No leave applications found</p>
        <p className="mt-1 text-xs text-zinc-400">
          Try adjusting your filters or create a new application.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full min-w-200 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-2xs font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-2xs uppercase tracking-wider text-zinc-500">
            <th scope="col" className="w-10 px-4 py-4" />
            <SortHeader label="Employee" onClick={() => toggleSort("employeeName")} />
            <SortHeader label="Leave Type" onClick={() => toggleSort("leaveTypeId")} />
            <SortHeader label="From" onClick={() => toggleSort("effectiveFrom")} />
            <SortHeader label="To" onClick={() => toggleSort("effectiveTo")} />
            <SortHeader label="Days" onClick={() => toggleSort("noOfDays")} />
            <SortHeader label="Status" onClick={() => toggleSort("status")} />
            <th scope="col" className="px-4 py-4 text-right font-semibold">
              <span className="text-2xs uppercase tracking-wider text-zinc-500">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedApplications.map((app) => {
            const isExpanded = expandedId === app.id;
            const leaveTypeName = leaveTypeMap[app.leaveTypeId] || app.leaveTypeId;

            return (
              <React.Fragment key={app.id}>
                <tr className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60">
                  <td className="px-4 py-4 align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : app.id);
                      }}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label={isExpanded ? "Collapse row" : "Expand row"}
                    >
                      {isExpanded ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-2xs font-medium text-white shadow-2xs">
                        {getInitials(app.employeeName)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-950">
                          {app.employeeName}
                        </div>
                        <div className="text-2xs text-zinc-400">
                          {formatDate(app.appliedDate)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-zinc-700">{leaveTypeName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-zinc-400" />
                      <span className="text-2xs text-zinc-400">
                        {app.duration === "Half Day" ? "½ Day" : "Full Day"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle text-zinc-600">
                    {formatDate(app.effectiveFrom)}
                  </td>
                  <td className="px-4 py-4 align-middle text-zinc-600">
                    {formatDate(app.effectiveTo)}
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <span className="font-semibold text-zinc-950 tabular-nums">
                      {app.noOfDays}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <Badge variant={STATUS_VARIANT[app.status]}>
                      {app.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-right align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onView(app)}
                        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {app.status === "Pending" && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(app);
                            }}
                            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(app.id);
                            }}
                            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {app.status !== "Pending" && (
                        <button
                          type="button"
                          className="rounded p-1.5 text-zinc-400 cursor-default"
                          disabled
                          title={app.status}
                        >
                          {app.status === "Approved" ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <LeaveExpandableRow
                        application={app}
                        leaveTypeName={leaveTypeName}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}