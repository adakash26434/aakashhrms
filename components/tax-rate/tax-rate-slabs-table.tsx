"use client";

import { Pencil, Trash2 } from "lucide-react";
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
      <div className="px-5 py-10 text-center text-xs text-slate-500">
        No slabs configured for this category. Click{" "}
        <span className="font-medium text-emerald-800">Add tax slab</span> to add one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
            <th scope="col" className="px-4 py-3 font-semibold">
              S.N.
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Amount from (NPR)
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Amount to (NPR)
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Tax rate
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Fixed deduction (NPR)
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-semibold"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {slabs.map((slab, i) => {
            const rowNumber = getRowNumber ? getRowNumber(i) : i + 1;
            return (
              <tr
                key={slab.id}
                className="border-b border-zinc-100 last:border-b-0 transition-colors hover:bg-zinc-50/60"
              >
                {/* S.N. */}
                <td className="px-4 py-4 align-middle text-zinc-400 tabular-nums text-xs">
                  {rowNumber}
                </td>

                {/* Amount From */}
                <td className="px-4 py-4 align-middle font-mono text-xs tabular-nums text-zinc-900 font-medium">
                  {formatNPRAmount(slab.amountFrom)}
                </td>

                {/* Amount To — renders "Above" for the open-ended bracket */}
                <td className="px-4 py-4 align-middle font-mono text-xs tabular-nums text-zinc-900 font-medium">
                  {slab.amountTo === null ? (
                    <span className="italic text-zinc-400 font-sans">Above</span>
                  ) : (
                    formatNPRAmount(slab.amountTo)
                  )}
                </td>

                {/* Tax Rate */}
                <td className="px-4 py-4 align-middle">
                  <RatePill rate={slab.ratePercent} />
                </td>

                {/* Fixed Deduction */}
                <td className="px-4 py-4 align-middle font-mono text-xs tabular-nums text-zinc-600">
                  {formatNPRAmount(slab.fixedDeduction)}
                </td>

                {/* Actions */}
                <td className="px-4 py-4 align-middle">
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
 * Small pill that renders a tax rate as a percent string.
 */
function RatePill({ rate }: { rate: number }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50/70 text-emerald-800 border border-emerald-200/50">
      {formatRateLabel(rate)}
    </span>
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
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer",
        disabled
          ? "cursor-not-allowed text-zinc-300"
          : danger
            ? "text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900",
      )}
    >
      {children}
    </button>
  );
}

export type { TaxCategory };
