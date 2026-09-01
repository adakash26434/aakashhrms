"use client";

import { Building2, MapPin, Phone, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";
import {
  formatBranchStatus,
  formatBranchStatusDescription,
  type Branch,
} from "@/lib/types/branch";

interface BranchDetailPanelProps {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
  onEdit: (branch: Branch) => void;
}

export function BranchDetailPanel({ open, branch, onClose, onEdit }: BranchDetailPanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="md"
      header={
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-[#2e7d32]">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-[#1b3a1f]">{branch?.name ?? ""}</h2>
              <button
                type="button"
                onClick={() => branch && onEdit(branch)}
                disabled={!branch}
                className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-[#f6faf6] hover:text-[#2e7d32] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Edit branch" title="Edit branch"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            {branch && <p className="mt-0.5 font-mono text-[11px] text-gray-500">{branch.id} · {branch.code}</p>}
          </div>
        </div>
      }
      subtitle={
        branch ? <span>{formatBranchStatus(branch.status)}</span> : undefined
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" onClick={() => branch && onEdit(branch)} disabled={!branch}>
            <Pencil className="h-4 w-4" />
            Edit Branch
          </Button>
        </>
      }
    >
      {branch && (
        <div className="space-y-6">
          <Section title="Overview">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow label="Branch Code" value={branch.code} tone="blue" />
              <OverviewRow
                label="Status"
                value={formatBranchStatus(branch.status)}
                tone={branch.status === "active" ? "emerald" : "gray"}
                description={formatBranchStatusDescription(branch.status)}
              />
            </div>
          </Section>

          <Section title="Location & Contact">
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-[#d7e8d0]/60 bg-white p-3">
                <MapPin className="h-4 w-4 text-[#2e7d32]" />
                <span className="text-sm text-[#1b3a1f]">{branch.location}</span>
              </div>
              {branch.phone && (
                <div className="flex items-center gap-2 rounded-lg border border-[#d7e8d0]/60 bg-white p-3">
                  <Phone className="h-4 w-4 text-[#2e7d32]" />
                  <span className="text-sm text-[#1b3a1f]">{branch.phone}</span>
                </div>
              )}
              {branch.email && (
                <div className="rounded-lg border border-[#d7e8d0]/60 bg-white p-3">
                  <p className="text-sm text-[#1b3a1f]">{branch.email}</p>
                </div>
              )}
            </div>
          </Section>

          <Section title="Audit">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow label="Created" value={new Date(branch.createdAt).toLocaleString()} tone="gray" />
              <OverviewRow label="Updated" value={new Date(branch.updatedAt).toLocaleString()} tone="gray" />
            </div>
          </Section>
        </div>
      )}
    </SidePanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

type Tone = "blue" | "emerald" | "gray";
const toneClasses: Record<Tone, string> = {
  blue: "bg-green-50 text-green-700",
  emerald: "bg-emerald-50 text-emerald-700",
  gray: "bg-gray-100 text-gray-700",
};

function OverviewRow({ label, value, tone, description }: { label: string; value: string; tone: Tone; description?: string }) {
  return (
    <div className="rounded-lg border border-[#d7e8d0]/60 bg-white p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <div className="mt-1">
        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", toneClasses[tone])}>{value}</span>
      </div>
      {description && <p className="mt-1 text-[11px] text-gray-500">{description}</p>}
    </div>
  );
}