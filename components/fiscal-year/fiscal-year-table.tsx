"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BSDateDisplay } from "@/components/ui/nepali-date";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import type { FiscalYear } from "@/lib/types/fiscal-year";

interface FiscalYearTableProps {
  fiscalYears: FiscalYear[];
  onEdit: (fy: FiscalYear) => void;
  onDelete: (fy: FiscalYear) => void;
  onLock?: (fy: FiscalYear) => void;
}

const LOCKED_TOOLTIP =
  "Payslips have been generated for this period — edit and delete are disabled.";

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
  onLock,
}: FiscalYearTableProps) {
  const { format: activeFormat, isAD } = useDateFormat();
  // `activeFormat` is the full calendar-aware string (e.g. "bs-long" or
  // "ad-iso"). Pass it straight to <BSDateDisplay> so the component
  // can route to the correct formatter.
  const isLong = activeFormat === "bs-long" || activeFormat === "ad-long";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-215 text-left text-sm">
            <thead>
              <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 text-[11px] uppercase tracking-wider text-gray-500">
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
                    <span className="font-medium text-[#1b3a1f]">
                      New Fiscal Year
                    </span>{" "}
                    to add one.
                  </td>
                </tr>
              ) : (
                fiscalYears.map((fy) => {
                  const isLocked = fy.payslipsGenerated;
                  const fromName = isAD
                    ? adMonthName(fy.startDateAD)
                    : bsMonthName(fy.fromMonth);
                  const toName = isAD
                    ? adMonthName(fy.endDateAD)
                    : bsMonthName(fy.toMonth);
                  return (
                    <tr
                      key={fy.id}
                      className="border-b border-[#d7e8d0]/60 last:border-b-0 transition-colors hover:bg-[#f6faf6]/40"
                    >
                      {/* FY (label + slug) */}
                      <td className="px-5 py-4 align-middle">
                        <div className="font-semibold text-[#1b3a1f]">
                          {fy.label}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {fy.slug}
                        </div>
                      </td>

                      {/* From month */}
                      <td className="px-5 py-4 align-middle text-[#1b3a1f]">
                        {fromName}
                      </td>

                      {/* To month */}
                      <td className="px-5 py-4 align-middle text-[#1b3a1f]">
                        {toName}
                      </td>

                      {/* Date Range — format-aware via BSDateDisplay.
                          Long variant: regular text, two lines if narrow.
                          Compact variants: tabular-nums mono on one line. */}
                      <td className="px-5 py-4 align-middle">
                        {isLong ? (
                          <div className="flex flex-col gap-0.5 text-[13px] text-[#1b3a1f]">
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
                          <div className="flex items-center gap-2 font-mono text-[13px] tabular-nums text-[#1b3a1f]">
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
                          <span className="inline-flex items-center gap-1.5">
                            <Lock className="h-3 w-3 text-gray-500" />
                            <Badge variant="default">Locked</Badge>
                          </span>
                        ) : (
                          <Badge variant="info">Active</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {!isLocked && onLock && (
                            <ActionButton
                              label={`Lock ${fy.label}`}
                              onClick={() => onLock(fy)}
                            >
                              <Lock className="h-3.5 w-3.5 text-[#2e7d32] hover:text-amber-600" />
                            </ActionButton>
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
        </div>
      </CardContent>
    </Card>
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
            : "text-gray-500 hover:bg-[#d7e8d0]/60 hover:text-[#2e7d32]",
      )}
    >
      {children}
    </button>
  );
}
