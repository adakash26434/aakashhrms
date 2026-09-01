"use client";

import { Plus, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
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

/**
 * The "card" wrapper for one category's slabs. Matches the screenshot:
 * a single rounded card with a header row (icon + category name +
 * "Tax slabs for FY 2081/82" subtitle + New Slab button) and a table
 * of slabs beneath.
 *
 * Presentational: state/handlers come from the parent client component.
 */
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
    <Card className="overflow-hidden">
      {/* Header row: icon, category name + subtitle, New Slab button */}
      <div className="flex flex-col gap-3 border-b border-[#d7e8d0]/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7e8d0]/70">
            <Percent className="h-5 w-5 text-[#2e7d32]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1b3a1f]">
              {category}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Tax slabs for{" "}
              <span className="font-medium text-[#1b3a1f]">
                {fiscalYearLabel}
              </span>
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onAdd}
          size="md"
          disabled={isLocked}
          title={isLocked ? LOCKED_NEW_SLAB_TOOLTIP : undefined}
        >
          <Plus className="h-4 w-4" />
          New Slab
        </Button>
      </div>

      {/* Slab table */}
      <TaxRateSlabsTable
        slabs={slabs}
        isLocked={isLocked}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Card>
  );
}
