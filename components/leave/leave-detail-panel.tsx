"use client";

import {useMemo } from "react";
import {
  Calendar,
  MessageSquare,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { SidePanel } from "@/components/ui/side-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeaveStatus } from "@/lib/types/leave";
import { getStatusBadgeVariant } from "@/lib/engines/leave.engine";

interface EnrichedApplication {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerName?: string | null;
  leaveTypeId: string;
  leaveTypeName?: string;
  appliedDate: Date;
  effectiveFrom: Date;
  effectiveTo: Date;
  duration: "Full Day" | "Half Day";
  noOfDays: number;
  reason: string;
  remarks: string | null;
  status: LeaveStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewRemarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LeaveDetailPanelProps {
  open: boolean;
  application: EnrichedApplication | null;
  leaveTypeName: string;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
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

export function LeaveDetailPanel({
  open,
  application,
  leaveTypeName,
  onClose,
  onApprove,
  onReject,
}: LeaveDetailPanelProps) {
  const statusVariant = useMemo(() => {
    if (!application) return "default" as const;
    return getStatusBadgeVariant(application.status);
  }, [application]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="xl"
      header={
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#1b3a1f]">
            Leave Application
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Detailed leave request information
          </p>
        </div>
      }
      footer={
        <>
          <div className="mr-auto text-xs text-gray-500">
            {application ? (
              <>
                Applied on {formatDate(application.appliedDate)}
              </>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {application?.status === "Pending" && (
            <>
              <Button
                type="button"
                variant="danger"
                onClick={onReject}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                onClick={onApprove}
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
            </>
          )}
        </>
      }
    >
      {application && (
        <div className="space-y-6">
          {/* Employee Info Header */}
          <div className="flex items-center gap-3 rounded-xl border border-[#d7e8d0]/80 bg-[#f6faf6]/50 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2e7d32] text-base font-bold text-white">
              {getInitials(application.employeeName)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-[#1b3a1f]">
                {application.employeeName}
              </h3>
              <p className="text-xs text-gray-500">Employee</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant}>{application.status}</Badge>
                <Badge variant="info">{application.duration}</Badge>
              </div>
            </div>
          </div>

          {/* Leave Details */}
          <DetailSection title="Leave Details" icon={Calendar}>
            <FieldGrid>
              <Field label="Leave Type" value={leaveTypeName} />
              <Field label="Duration" value={application.duration} />
              <Field label="Number of Days" value={`${application.noOfDays} day(s)`} />
              <Field
                label="From"
                value={formatDate(application.effectiveFrom)}
              />
              <Field
                label="To"
                value={formatDate(application.effectiveTo)}
              />
            </FieldGrid>
          </DetailSection>

          {/* Reason */}
          <DetailSection title="Reason & Remarks" icon={MessageSquare}>
            <div className="px-4 py-3">
              <p className="text-sm text-[#1b3a1f]">{application.reason}</p>
              {application.remarks && (
                <div className="mt-3 rounded-lg bg-[#f6faf6] p-3">
                  <p className="text-xs font-medium text-gray-500">
                    Additional Remarks:
                  </p>
                  <p className="mt-1 text-sm text-[#1b3a1f]">
                    {application.remarks}
                  </p>
                </div>
              )}
            </div>
          </DetailSection>

          {/* Review Info */}
          {application.status !== "Pending" && (
            <DetailSection
              title={application.status === "Approved" ? "Approved By" : "Rejected By"}
              icon={application.status === "Approved" ? CheckCircle : XCircle}
            >
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d7e8d0] text-[11px] font-bold text-[#1b3a1f]">
                    {application.reviewerName
                      ? getInitials(application.reviewerName)
                      : "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1b3a1f]">
                      {application.reviewerName || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {application.status === "Approved" ? "Approved" : "Rejected"} &middot;{" "}
                      {formatDate(application.reviewedAt)}
                    </p>
                  </div>
                </div>
                {application.reviewRemarks && (
                  <div className="mt-3 rounded-lg bg-[#f6faf6] p-3">
                    <p className="text-xs font-medium text-gray-500">Review Remarks:</p>
                    <p className="mt-1 text-sm text-[#1b3a1f]">
                      &ldquo;{application.reviewRemarks}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </DetailSection>
          )}
        </div>
      )}
    </SidePanel>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#d7e8d0]/80">
      <div className="flex items-center gap-2 border-b border-[#d7e8d0]/60 bg-[#f6faf6]/40 px-4 py-2.5">
        <Icon className="h-4 w-4 text-[#2e7d32]" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[#1b3a1f]">{value}</p>
    </div>
  );
}