"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PayHead, StatutoryFlag } from "@/lib/types/pay-head";
import {
  activeFlags,
  formatCalcBasis,
  formatCalcParameter,
  formatCalcPercent,
  formatPayHeadType,
  STATUTORY_FLAGS,
  STATUTORY_FLAG_META,
} from "@/lib/types/pay-head";

interface PayHeadDetailPanelProps {
  open: boolean;
  head: PayHead | null;
  departmentNameById: Map<string, string>;
  designationNameById: Map<string, string>;
  totalDepartmentCount: number;
  totalDesignationCount: number;
  onClose: () => void;
  onEdit: (head: PayHead) => void;
}

export function PayHeadDetailPanel({
  open,
  head,
  departmentNameById,
  designationNameById,
  totalDepartmentCount,
  totalDesignationCount,
  onClose,
  onEdit,
}: PayHeadDetailPanelProps) {
  const flagsActive = head ? activeFlags(head.flags) : [];
  const flagActiveCount = flagsActive.length;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="md"
      header={
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-[#1b3a1f]">{head?.name ?? ""}</h2>
            <button
              type="button"
              onClick={() => head && onEdit(head)}
              disabled={!head}
              className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-[#f6faf6] hover:text-[#2e7d32] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Edit pay head"
              title="Edit pay head"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          {head && <p className="mt-0.5 font-mono text-[11px] text-gray-500">{head.code}</p>}
        </div>
      }
      subtitle={head ? <span>{head.type === "allowance" ? "Allowance" : "Deduction"} pay head</span> : undefined}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" onClick={() => head && onEdit(head)} disabled={!head}>
            <Pencil className="h-4 w-4" /> Edit Pay Head
          </Button>
        </>
      }
    >
      {head && (
        <div className="space-y-6">
          <Section title="Overview">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow label="Head Type" value={formatPayHeadType(head.type)} tone={head.type === "allowance" ? "blue" : "red"} />
              <OverviewRow label="Effect on Tax" value={head.effectOnTax ? "Yes" : "No"} tone={head.effectOnTax ? "emerald" : "gray"} />
              <OverviewRow label="Calculate On" value={formatCalcBasis(head.calcBasis)} tone="blue" />
              <OverviewRow label="Parameter" value={formatCalcParameter(head.calcParameter)} tone="blue" />
              <OverviewRow label="Calculation %" value={formatCalcPercent(head.calcPercent)} tone="violet" className="sm:col-span-2" />
            </div>
          </Section>

          <Section title="Applicability">
            <div className="space-y-4">
              <ApplicabilityGroup
                label="Applicable Departments"
                ids={head.applicableDepartmentIds}
                nameById={departmentNameById}
                totalCount={totalDepartmentCount}
                emptyLabel="All Departments"
              />
              <ApplicabilityGroup
                label="Applicable Designations"
                ids={head.applicableDesignationIds}
                nameById={designationNameById}
                totalCount={totalDesignationCount}
                emptyLabel="All Positions"
              />
            </div>
          </Section>

          <Section title="Statutory & Calculation Flags" rightMeta={<span className="text-[11px] font-medium text-gray-500">{flagActiveCount} active</span>}>
            <div className="space-y-1.5">
              {STATUTORY_FLAGS.map((f) => (
                <FlagRow key={f} flag={f} active={head.flags[f] === true} />
              ))}
            </div>
          </Section>
        </div>
      )}
    </SidePanel>
  );
}

// ----- Internal helpers -----

function Section({ title, rightMeta, children }: { title: string; rightMeta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
        {rightMeta}
      </div>
      {children}
    </div>
  );
}

type Tone = "blue" | "emerald" | "red" | "gray" | "violet";

const toneClasses: Record<Tone, string> = {
  blue: "bg-green-50 text-green-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-700",
  violet: "bg-violet-50 text-violet-700",
};

function OverviewRow({ label, value, tone, className }: { label: string; value: string; tone: Tone; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-[#d7e8d0]/60 bg-white p-2.5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <div className="mt-1">
        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", toneClasses[tone])}>{value}</span>
      </div>
    </div>
  );
}

function ApplicabilityGroup({
  label,
  ids,
  nameById,
  totalCount,
  emptyLabel,
}: {
  label: string;
  ids: string[];
  nameById: Map<string, string>;
  totalCount: number;
  emptyLabel: string;
}) {
  // We ONLY show the generic "All" label if the array is genuinely empty (legacy fallback).
  // If there are specific IDs (even if it's all of them), we will list them out!
  const isLegacyAll = ids.length === 0;
  const visibleNames = isLegacyAll ? [] : ids.map((id) => nameById.get(id) ?? id);

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      {isLegacyAll ? (
        <div className="flex items-center gap-1.5">
          <span className="rounded-md border border-[#2e7d32]/20 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            {emptyLabel}
          </span>
          <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#1b3a1f] tabular-nums">
            +{totalCount}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visibleNames.map((name, idx) => (
            <span
              key={`${name}-${idx}`}
              className="rounded-md border border-[#d7e8d0] bg-[#f6faf6] px-2 py-0.5 text-xs text-[#1b3a1f]"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FlagRow({ flag, active }: { flag: StatutoryFlag; active: boolean }) {
  const meta = STATUTORY_FLAG_META[flag];
  const Icon = meta.icon;
  return (
    <label className={cn("flex items-start gap-2.5 rounded-lg border p-2.5", active ? "border-[#2e7d32]/30 bg-green-50/40" : "border-[#d7e8d0]/60 bg-white opacity-60")}>
      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", active ? "bg-[#2e7d32]/15 text-[#2e7d32]" : "bg-gray-100 text-gray-500")}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#1b3a1f]">{meta.label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{meta.description}</p>
      </div>
      <Badge variant="default" className={cn("shrink-0 text-[10px]", active ? "bg-[#2e7d32] text-white hover:bg-[#2e7d32]" : "bg-gray-100 text-gray-500 hover:bg-gray-100")}>
        {active ? "Active" : "Inactive"}
      </Badge>
    </label>
  );
}