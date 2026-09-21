"use client";

import { Plus } from "lucide-react";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";
import { TaxRateSlabsTable } from "./tax-rate-slabs-table";
import type { TaxCategory, TaxSlab } from "@/lib/types/tax-rate";

interface TaxRateSlabsCardProps {
  category: TaxCategory;
  fiscalYearLabel: string;
  slabs: TaxSlab[];
  /** True when the selected FY has payslips generated — disables new/edit/delete. */
  isLocked: boolean;
  onAdd: () => void;
  onEdit: (slab: TaxSlab) => void;
  onDelete: (slab: TaxSlab) => void;
}

const LOCKED_NEW_SLAB_TOOLTIP =
  "Payslips have been generated for this fiscal year — adding new slabs is disabled.";

export function TaxRateSlabsCard({
  category,
  fiscalYearLabel,
  slabs,
  isLocked,
  onAdd,
  onEdit,
  onDelete,
}: TaxRateSlabsCardProps) {
  return (
    <TableShell
      title={`${category} — Tax Slabs (${fiscalYearLabel})`}
      totalCount={slabs.length}
      actions={
        <Button
          type="button"
          onClick={onAdd}
          size="sm"
          disabled={isLocked}
          title={isLocked ? LOCKED_NEW_SLAB_TOOLTIP : undefined}
          className="bg-payroll-primary text-white hover:bg-payroll-navy font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>New Slab</span>
        </Button>
      }
      isEmpty={slabs.length === 0}
      emptyTitle={`No tax slabs for ${category}`}
      emptyDescription={`No slabs configured for ${fiscalYearLabel}. Click 'New Slab' to add the first progressive bracket.`}
    >
      <TaxRateSlabsTable
        slabs={slabs}
        isLocked={isLocked}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </TableShell>
  );
}
