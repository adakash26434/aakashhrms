"use client";

import { Briefcase, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";
import {
  formatDesignationStatus,
  formatDesignationStatusDescription,
  formatEmployeeCount,
  type Designation,
} from "@/lib/types/designation";

interface DesignationDetailPanelProps {
  open: boolean;
  designation: Designation | null;
  departmentName: string;
  onClose: () => void;
  onEdit: (designation: Designation) => void;
}

/**
 * Right-side slide-in panel showing the full breakdown of a
 * single designation. Read-only — the "Edit" action is exposed
 * via a pencil button in the header and a full-width button
 * in the footer.
 */
export function DesignationDetailPanel({
  open,
  designation,
  departmentName,
  onClose,
  onEdit,
}: DesignationDetailPanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="md"
      header={
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Briefcase className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-[#1b3a1f]">
                {designation?.name ?? ""}
              </h2>
              <button
                type="button"
                onClick={() => designation && onEdit(designation)}
                disabled={!designation}
                className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-[#f6faf6] hover:text-[#2e7d32] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Edit designation"
                title="Edit designation"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            {designation && (
              <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                {designation.id}
              </p>
            )}
          </div>
        </div>
      }
      subtitle={
        designation ? (
          <span>
            {formatDesignationStatus(designation.status)} · {departmentName}
          </span>
        ) : undefined
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => designation && onEdit(designation)}
            disabled={!designation}
          >
            <Pencil className="h-4 w-4" />
            Edit Designation
          </Button>
        </>
      }
    >
      {designation && (
        <div className="space-y-6">
          {/* Overview */}
          <Section title="Overview">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow
                label="Department"
                value={departmentName}
                tone="amber"
              />
              <OverviewRow
                label="Status"
                value={formatDesignationStatus(designation.status)}
                tone={designation.status === "active" ? "emerald" : "gray"}
                description={formatDesignationStatusDescription(
                  designation.status,
                )}
              />
            </div>
          </Section>

          {/* Employees */}
          <Section title="Employees">
            <div className="rounded-lg border border-[#d7e8d0]/60 bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                  <Users className="h-4 w-4 text-violet-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Employees
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1b3a1f] tabular-nums">
                    {formatEmployeeCount(designation.employeeCount)}
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* Description */}
          <Section title="Description">
            {designation.description ? (
              <p className="rounded-lg border border-[#d7e8d0]/60 bg-white p-3 text-sm leading-relaxed text-[#1b3a1f]">
                {designation.description}
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-[#d7e8d0] bg-[#f6faf6]/50 p-3 text-sm italic text-gray-500">
                No description has been provided for this designation.
              </p>
            )}
          </Section>

          {/* Audit */}
          <Section title="Audit">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow
                label="Created"
                value={new Date(designation.createdAt).toLocaleString()}
                tone="gray"
              />
              <OverviewRow
                label="Updated"
                value={new Date(designation.updatedAt).toLocaleString()}
                tone="gray"
              />
            </div>
          </Section>
        </div>
      )}
    </SidePanel>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

type Tone = "amber" | "emerald" | "gray";

const toneClasses: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  gray: "bg-gray-100 text-gray-700",
};

function OverviewRow({
  label,
  value,
  tone,
  description,
}: {
  label: string;
  value: string;
  tone: Tone;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-[#d7e8d0]/60 bg-white p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <div className="mt-1">
        <span
          className={cn(
            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
            toneClasses[tone],
          )}
        >
          {value}
        </span>
      </div>
      {description && (
        <p className="mt-1 text-[11px] text-gray-500">{description}</p>
      )}
    </div>
  );
}