"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatNPRAmount,
  formatRateLabel,
  type TaxCategory,
  type TaxSlab,
} from "@/lib/types/tax-rate";

interface TaxRateSlabsTableProps {
  /** The slabs to render — already filtered to the active category + FY. */
  slabs: TaxSlab[];
  /** Locked = no edit/delete (FY has payslips generated). */
  isLocked: boolean;
  onEdit: (slab: TaxSlab) => void;
  onDelete: (slab: TaxSlab) => void;
  /** Optional: callback used by the parent to recompute the row number. */
  getRowNumber?: (index: number) => number;
}

const LOCKED_TOOLTIP =
  "Payslips have been generated for this fiscal year — edit and delete are disabled.";

/**
 * Read-only table of slabs for a single (fiscal year, category) pair.
 *
 * Renders the columns exactly as in the screenshot:
 *   S.N. | AMOUNT FROM (NPR) | AMOUNT TO (NPR) | TAX RATE | FIXED DEDUCTION | ACTIONS
 *
 * The "AMOUNT TO" column renders the literal string "Above" when the
 * `amountTo` is `null` (open-ended top bracket).
 */
export function TaxRateSlabsTable({
  slabs,
  isLocked,
  onEdit,
  onDelete,
  getRowNumber,
}: TaxRateSlabsTableProps) {
  if (slabs.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-gray-500">
        No slabs configured for this category. Click{" "}
        <span className="font-medium text-[#1b3a1f]">New Slab</span> to add one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 text-[11px] uppercase tracking-wider text-gray-500">
            <th scope="col" className="px-5 py-3 font-semibold">
              S.N.
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Amount From (NPR)
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Amount To (NPR)
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Tax Rate
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Fixed Deduction
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-right font-semibold"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {slabs.map((slab, i) => {
            const rowNumber = getRowNumber ? getRowNumber(i) : i + 1;
            return (
              <tr
                key={slab.id}
                className="border-b border-[#d7e8d0]/60 last:border-b-0 transition-colors hover:bg-[#f6faf6]/40"
              >
                {/* S.N. */}
                <td className="px-5 py-4 align-middle text-[#1b3a1f] tabular-nums">
                  {rowNumber}
                </td>

                {/* Amount From */}
                <td className="px-5 py-4 align-middle font-mono text-[13px] tabular-nums text-[#1b3a1f]">
                  {formatNPRAmount(slab.amountFrom)}
                </td>

                {/* Amount To — renders "Above" for the open-ended bracket */}
                <td className="px-5 py-4 align-middle font-mono text-[13px] tabular-nums text-[#1b3a1f]">
                  {slab.amountTo === null ? (
                    <span className="italic text-gray-500">Above</span>
                  ) : (
                    formatNPRAmount(slab.amountTo)
                  )}
                </td>

                {/* Tax Rate (badge pill) */}
                <td className="px-5 py-4 align-middle">
                  <RatePill rate={slab.ratePercent} />
                </td>

                {/* Fixed Deduction */}
                <td className="px-5 py-4 align-middle font-mono text-[13px] tabular-nums text-[#1b3a1f]">
                  NPR {formatNPRAmount(slab.fixedDeduction)}
                </td>

                {/* Actions */}
                <td className="px-5 py-4 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <ActionButton
                      label={`Edit slab ${rowNumber}`}
                      tooltip={isLocked ? LOCKED_TOOLTIP : undefined}
                      disabled={isLocked}
                      onClick={() => onEdit(slab)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </ActionButton>
                    <ActionButton
                      label={`Delete slab ${rowNumber}`}
                      tooltip={isLocked ? LOCKED_TOOLTIP : undefined}
                      disabled={isLocked}
                      onClick={() => onDelete(slab)}
                      danger
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ActionButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Small blue pill that renders a tax rate as a percent string.
 * Reuses the project's `Badge` primitive for consistent styling.
 */
function RatePill({ rate }: { rate: number }) {
  return (
    <Badge
      variant="default"
      className="bg-green-50 text-green-700 hover:bg-green-50"
    >
      {formatRateLabel(rate)}
    </Badge>
  );
}

interface ActionButtonProps {
  label: string;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}

function ActionButton({
  label,
  tooltip,
  disabled,
  onClick,
  children,
  danger,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        disabled
          ? "cursor-not-allowed text-gray-300"
          : danger
            ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
            : "text-gray-500 hover:bg-[#d7e8d0]/60 hover:text-[#2e7d32]",
      )}
    >
      {children}
    </button>
  );
}

// Re-export the type so the parent file can `import { TaxRateSlabsTable }` plus
// the `TaxCategory` type from this module's barrel if needed.
export type { TaxCategory };
