"use client";

import { Lock, LockOpen, Power, PowerOff, Pencil, Trash2 } from "lucide-react";
import { TableShell } from "@/components/ui/table-shell";
import { cn } from "@/lib/utils";
import { BSDateDisplay } from "@/components/ui/nepali-date";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import type { FiscalYear } from "@/lib/types/fiscal-year";

interface FiscalYearTableProps {
  fiscalYears: FiscalYear[];
  onEdit: (fy: FiscalYear) => void;
  onDelete: (fy: FiscalYear) => void;
  onToggleStatus?: (fy: FiscalYear, targetStatus: "Active" | "Inactive") => void;
  onUnlock?: (fy: FiscalYear) => void;
}

const LOCKED_TOOLTIP =
  "This fiscal year is locked. Click 'Unlock' to re-enable editing and deletion.";

/** BS month name for the from/to month columns (BS mode). */
function bsMonthName(monthNumber: number): string {
  return BS_MONTHS_EN[monthNumber] ?? `Month ${monthNumber}`;
}

/**
 * AD month name for the from/to month columns (AD mode).
 * Uses the actual AD month of the start/end date rather than trying
 * to map BS months to AD months.
 */
function adMonthName(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "long" });
}

/** Format-aware column header for the date range column. */
function dateRangeColumnHeader(
  isAD: boolean,
  isLong: boolean,
): string {
  if (isAD) return isLong ? "AD Date Range (Long)" : "AD Date Range";
  return isLong ? "BS Date Range (Long)" : "BS Date Range";
}

export function FiscalYearTable({
  fiscalYears,
  onEdit,
  onDelete,
  onToggleStatus,
  onUnlock,
}: FiscalYearTableProps) {
  const { format: activeFormat, isAD } = useDateFormat();
  // `activeFormat` is the full calendar-aware string (e.g. "bs-long" or
  // "ad-iso"). Pass it straight to <BSDateDisplay> so the component
  // can route to the correct formatter.
  const isLong = activeFormat === "bs-long" || activeFormat === "ad-long";

  return (
    <TableShell
      title="Fiscal Year Records"
      totalCount={fiscalYears.length}
      isEmpty={fiscalYears.length === 0}
      emptyTitle="No fiscal years configured yet"
      emptyDescription="Click 'New Fiscal Year' above to configure an accounting cycle."
    >
      <table className="w-full min-w-215 text-left text-sm">
        <thead>
          <tr className="border-b border-payroll-light/80 bg-payroll-cream/40 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            <th scope="col" className="px-5 py-3 font-semibold">
              FY
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              {isAD ? "From Month (A.D.)" : "From Month"}
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              {isAD ? "To Month (A.D.)" : "To Month"}
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              {dateRangeColumnHeader(isAD, isLong)}
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Status
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
          {fiscalYears.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-5 py-10 text-center text-sm text-gray-500"
              >
                No fiscal years configured yet. Click{" "}
                <span className="font-medium text-payroll-navy">
                  New Fiscal Year
                </span>{" "}
                to add one.
              </td>
            </tr>
          ) : (
            fiscalYears.map((fy) => {
              const isLocked = fy.status === "Locked" || fy.payslipsGenerated;
              const isActive = fy.status === "Active" && !isLocked;

              const fromName = isAD
                ? adMonthName(fy.startDateAD)
                : bsMonthName(fy.fromMonth);
              const toName = isAD
                ? adMonthName(fy.endDateAD)
                : bsMonthName(fy.toMonth);
              return (
                <tr
                  key={fy.id}
                  className="border-b border-payroll-light/60 last:border-b-0 transition-colors hover:bg-payroll-cream/40"
                >
                  {/* FY (label + slug) */}
                  <td className="px-5 py-4 align-middle">
                    <div className="font-semibold text-payroll-navy">
                      {fy.label}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {fy.slug}
                    </div>
                  </td>

                  {/* From month */}
                  <td className="px-5 py-4 align-middle text-payroll-navy">
                    {fromName}
                  </td>

                  {/* To month */}
                  <td className="px-5 py-4 align-middle text-payroll-navy">
                    {toName}
                  </td>

                  {/* Date Range — format-aware via BSDateDisplay.
                      Long variant: regular text, two lines if narrow.
                      Compact variants: tabular-nums mono on one line. */}
                  <td className="px-5 py-4 align-middle">
                    {isLong ? (
                      <div className="flex flex-col gap-0.5 text-[13px] text-payroll-navy">
                        <BSDateDisplay
                          date={fy.startDateAD}
                          format={activeFormat}
                        />
                        <span
                          className="text-[11px] text-gray-400"
                          aria-hidden="true"
                        >
                          ↓
                        </span>
                        <BSDateDisplay
                          date={fy.endDateAD}
                          format={activeFormat}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 font-mono text-[13px] tabular-nums text-payroll-navy">
                        <BSDateDisplay
                          date={fy.startDateAD}
                          format={activeFormat}
                        />
                        <span className="text-gray-400" aria-hidden="true">
                          →
                        </span>
                        <BSDateDisplay
                          date={fy.endDateAD}
                          format={activeFormat}
                        />
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 align-middle">
                    {isLocked ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock className="h-3 w-3 text-amber-600" />
                          Locked
                        </span>
                        {onUnlock && (
                          <button
                            type="button"
                            onClick={() => onUnlock(fy)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                          >
                            <LockOpen className="w-3 h-3" />
                            Unlock
                          </button>
                        )}
                      </div>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center justify-end gap-1.5">
                      {isLocked && onUnlock && (
                        <ActionButton
                          label={`Unlock ${fy.label}`}
                          tooltip="Unlock this fiscal year to enable edits"
                          onClick={() => onUnlock(fy)}
                        >
                          <LockOpen className="h-3.5 w-3.5 text-emerald-600 hover:text-emerald-700" />
                        </ActionButton>
                      )}

                      {!isLocked && onToggleStatus && (
                        isActive ? (
                          <ActionButton
                            label={`Deactivate ${fy.label}`}
                            tooltip="Set status as Inactive"
                            onClick={() => onToggleStatus(fy, "Inactive")}
                          >
                            <PowerOff className="h-3.5 w-3.5 text-gray-400 hover:text-amber-600" />
                          </ActionButton>
                        ) : (
                          <ActionButton
                            label={`Activate ${fy.label}`}
                            tooltip="Set as Active fiscal year"
                            onClick={() => onToggleStatus(fy, "Active")}
                          >
                            <Power className="h-3.5 w-3.5 text-emerald-600 hover:text-emerald-700" />
                          </ActionButton>
                        )
                      )}

                      <ActionButton
                        label={`Edit ${fy.label}`}
                        tooltip={isLocked ? LOCKED_TOOLTIP : undefined}
                        disabled={isLocked}
                        onClick={() => onEdit(fy)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </ActionButton>
                      <ActionButton
                        label={`Delete ${fy.label}`}
                        tooltip={isLocked ? LOCKED_TOOLTIP : undefined}
                        disabled={isLocked}
                        onClick={() => onDelete(fy)}
                        danger
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
    </TableShell>
  );
}

interface ActionButtonProps {
  label: string;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Renders a danger-tinted hover when true. */
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
            : "text-gray-500 hover:bg-payroll-primary/10 hover:text-payroll-primary",
      )}
    >
      {children}
    </button>
  );
}
