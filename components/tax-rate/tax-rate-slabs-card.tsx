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
      title={`${category} tax brackets (${fiscalYearLabel})`}
      totalCount={slabs.length}
      actions={
        <Button
          type="button"
          onClick={onAdd}
          size="sm"
          disabled={isLocked}
          title={isLocked ? LOCKED_NEW_SLAB_TOOLTIP : undefined}
          className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs h-9 px-3.5 rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add tax slab</span>
        </Button>
      }
      isEmpty={slabs.length === 0}
      emptyTitle={`No tax slabs for ${category}`}
      emptyDescription={`No slabs configured for ${fiscalYearLabel}. Click 'Add tax slab' to configure the first progressive rate bracket.`}
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
