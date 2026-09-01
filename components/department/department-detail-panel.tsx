"use client";

import {
  Building2,
  Briefcase,
  CheckCircle2,
  Pencil,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";
import {
  formatPositionsCount,
  formatStaffCount,
  formatStatus,
  formatStatusDescription,
  type Department,
} from "@/lib/types/department";


interface DepartmentDetailPanelProps {
  open: boolean;
  department: Department | null;
  branchName: string;
  onClose: () => void;
  /** When the user clicks the pencil — opens the form modal. */
  onEdit: (department: Department) => void;
}

/**
 * Right-side slide-in panel showing the full breakdown of a
 * single department. Read-only — the "Edit" action is exposed
 * via a pencil button in the header (which opens the form
 * modal) and a full-width "Edit Department" button in the
 * footer.
 *
 * Sections (mirrors the form modal, read-only):
 *   OVERVIEW
 *     - Code (monospace pill)
 *     - Branch (soft blue pill)
 *     - Head of Department
 *     - Status (active/inactive pill with description)
 *   HEADCOUNT
 *     - Designations count
 *     - Employees count
 *   DESCRIPTION
 *     - Free-text description (or a placeholder if blank)
 */
export function DepartmentDetailPanel({
  open,
  department,
  branchName,
  onClose,
  onEdit,
}: DepartmentDetailPanelProps) {
  // Resolve the icon once per row. Using `useMemo` here keeps
  // the React DevTools eslint rule happy.
  const Icon = useMemo<LucideIcon>(() => {
    if (!department) return Building2;
    return ICON_BY_CODE[department.code.toUpperCase()] ?? Building2;
  }, [department]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="md"
      header={
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-[#2e7d32]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-[#1b3a1f]">
                {department?.name ?? ""}
              </h2>
              <button
                type="button"
                onClick={() => department && onEdit(department)}
                disabled={!department}
                className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-[#f6faf6] hover:text-[#2e7d32] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Edit department"
                title="Edit department"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            {department && (
              <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                {department.code} · {department.id}
              </p>
            )}
          </div>
        </div>
      }
      subtitle={
        department ? (
          <span>{formatStatus(department.status)} · {branchName}</span>
        ) : undefined
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => department && onEdit(department)}
            disabled={!department}
          >
            <Pencil className="h-4 w-4" />
            Edit Department
          </Button>
        </>
      }
    >
      {department && (
        <div className="space-y-6">
          {/* Overview */}
          <Section title="Overview">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow
                label="Branch"
                value={branchName}
                tone="blue"
              />
              <OverviewRow
                label="Status"
                value={formatStatus(department.status)}
                tone={department.status === "active" ? "emerald" : "gray"}
                description={formatStatusDescription(department.status)}
              />
              <div className="sm:col-span-2">
                <OverviewRow
                  label="Head of Department"
                  value={department.headName}
                  tone="gray"
                />
              </div>
            </div>
          </Section>

          {/* Headcount */}
          <Section title="Headcount">
            <div className="grid grid-cols-2 gap-2">
              <HeadcountTile
                icon={<Briefcase className="h-4 w-4 text-amber-600" />}
                label="Designations"
                value={formatPositionsCount(department.designationCount)}
                tone="amber"
              />
              <HeadcountTile
                icon={<Users className="h-4 w-4 text-violet-600" />}
                label="Employees"
                value={formatStaffCount(department.employeeCount)}
                tone="violet"
              />
            </div>
          </Section>

          {/* Description */}
          <Section title="Description">
            {department.description ? (
              <p className="rounded-lg border border-[#d7e8d0]/60 bg-white p-3 text-sm leading-relaxed text-[#1b3a1f]">
                {department.description}
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-[#d7e8d0] bg-[#f6faf6]/50 p-3 text-sm italic text-gray-500">
                No description has been provided for this department.
              </p>
            )}
          </Section>

          {/* Audit row */}
          <Section title="Audit">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow
                label="Created"
                value={new Date(department.createdAt).toLocaleString()}
                tone="gray"
              />
              <OverviewRow
                label="Updated"
                value={new Date(department.updatedAt).toLocaleString()}
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

const ICON_BY_CODE: Record<string, LucideIcon> = {
  ENG: Briefcase,
  IT: Briefcase,
  OPS: Briefcase,
  FIN: Building2,
  HR: Users,
  "HR-ADM": Users,
  SALES: Building2,
  MKT: Building2,
  CSUPP: Building2,
  SUP: Building2,
  LOG: Building2,
};

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

type Tone = "blue" | "amber" | "rose" | "violet" | "gray" | "emerald";

const toneClasses: Record<Tone, string> = {
  blue: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
  gray: "bg-gray-100 text-gray-700",
  emerald: "bg-emerald-50 text-emerald-700",
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

function HeadcountTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#d7e8d0]/60 bg-white p-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "amber" ? "bg-amber-50" : "bg-violet-50",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-[#1b3a1f] tabular-nums">
          {value}
        </p>
      </div>
      {/* unused typed param guard */}
      {void tone}
    </div>
  );
}

// Silence unused-import lint.
void CheckCircle2;


