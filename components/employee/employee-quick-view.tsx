"use client";

import Link from "next/link";
import { ArrowRight, Pencil } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { PaneActions, PaneFields, PaneSection } from "@/components/kit/pane";
import { StatusChip } from "@/components/kit/status-chip";
import { RECORD_GAP_LABEL } from "@/lib/engines/employee.engine";
import type { EmployeeListRow } from "@/lib/types/employee";
import { formatPhoneNumber } from "@/lib/utils/phone";

/**
 * Quick view beside the register: enough to recognise and check a person
 * without leaving the list. Built from the list row (no extra request).
 */
export function EmployeeQuickView({ row, canEdit }: { row: EmployeeListRow; canEdit: boolean }) {
  const recordHref = `/workforce/employees/${row.id}`;
  return (
    <div className="text-xs">
      <PaneActions>
        <Link href={recordHref} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover">
          Open record <span className="text-white/70">↵</span>
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
        {canEdit && (
          <Link href={`${recordHref}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken">
            <Pencil aria-hidden className="h-3.5 w-3.5" /> Edit
          </Link>
        )}
      </PaneActions>

      <PaneSection>
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-strong">
            {initials(row.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{row.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{[row.designationName, row.departmentName].filter(Boolean).join(" · ") || "No designation"}</p>
          </div>
          <StatusChip status={row.status} />
        </div>
      </PaneSection>

      {row.gaps.length > 0 && (
        <PaneSection title="Records to fix" count={row.gaps.length} tone="warning">
          <PaneFields layout="figures" rows={row.gaps.map((g) => ({ label: RECORD_GAP_LABEL[g], value: "Fix", tone: "warning" as const, href: canEdit ? `${recordHref}/edit` : undefined }))} />
        </PaneSection>
      )}

      <PaneSection title="Job">
        <PaneFields
          rows={[
            { label: "Code", value: <span className="font-code">{row.employeeCode}</span> },
            { label: "Branch", value: row.branchName || "—" },
            { label: "Category", value: row.category || "—" },
            { label: "Shreni", value: row.shreni || "—" },
            { label: "Supervisor", value: row.supervisorName ?? "—" },
            { label: "Joined", value: row.joiningDate ? <DateCell value={row.joiningDate} /> : "—" },
          ]}
        />
      </PaneSection>

      <PaneSection title="Contact">
        <PaneFields
          rows={[
            { label: "Mobile", value: row.mobileNo ? <span className="font-code">{formatPhoneNumber(row.mobileNo)}</span> : "—" },
            { label: "Company email", value: row.companyEmail || "—" },
          ]}
        />
      </PaneSection>

      <PaneSection title="Pay">
        <PaneFields
          layout="figures"
          rows={[
            { label: "Basic salary", value: <Amount value={row.basicSalary} />, tone: row.basicSalary > 0 ? "default" : "warning" },
            { label: "Grade amount", value: <Amount value={row.gradeAmount} /> },
            { label: "Bank", value: row.bankAccountMasked ? `${row.bankName || "Bank"} ${row.bankAccountMasked}` : "Missing", tone: row.bankAccountMasked ? "default" : "warning" },
          ]}
        />
      </PaneSection>
    </div>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
