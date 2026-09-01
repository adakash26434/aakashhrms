"use client";

import { Eye, Pencil, Trash2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PayHead } from "@/lib/types/pay-head";
import {
  activeFlags,
  formatCalcBasis,
  formatCalcPercent,
  formatPayHeadType,
  STATUTORY_FLAG_META,
} from "@/lib/types/pay-head";

interface PayHeadsTableProps {
  /** The (filtered) pay heads to render. Already sorted by the parent. */
  heads: PayHead[];
  /** Resolved department names by id. */
  departmentNameById: Map<string, string>;
  /** Total department count — used to decide "All Depts" badge. */
  totalDepartmentCount: number;
  onView: (head: PayHead) => void;
  onEdit: (head: PayHead) => void;
  onDelete: (head: PayHead) => void;
}

/**
 * Read-only table of pay heads. Renders the columns exactly as
 * in the design screenshot:
 *
 *   CODE | NAME | TYPE | TAX | CALC BASIS | % | KEY FLAGS | DEPARTMENTS | ACTIONS
 *
 * - CODE: monospace "PH-001" style
 * - TYPE: blue (allowance) / red (deduction) pill
 * - TAX: Yes / No pill
 * - CALC BASIS: shows the basis + the parameter stacked
 * - %: "100%" / "50%" / "—"
 * - KEY FLAGS: row of small letter chips with tooltips
 * - DEPARTMENTS: "All Depts +N" or first 2 names + "+N" overflow
 * - ACTIONS: view / edit / delete icon buttons
 */
export function PayHeadsTable({
  heads,
  departmentNameById,
  totalDepartmentCount,
  onView,
  onEdit,
  onDelete,
}: PayHeadsTableProps) {
  if (heads.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-gray-500">
        No pay heads match the current filter. Adjust the search or
        type filter, or click{" "}
        <span className="font-medium text-[#1b3a1f]">New Pay Head</span>{" "}
        to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-300 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 text-[11px] uppercase tracking-wider text-gray-500">
            <th scope="col" className="px-5 py-3 font-semibold">
              Code
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Name
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Type
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Tax
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Calc Basis
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              %
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Key Flags
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Departments
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
          {heads.map((h) => {
            const flags = activeFlags(h.flags);
            const isStatutory = !!(
              h.flags?.isPfHead ||
              h.flags?.isSsfHead ||
              h.flags?.isCitHead ||
              h.flags?.isTdsHead
            );
            return (
              <tr
                key={h.id}
                className="border-b border-[#d7e8d0]/60 last:border-b-0 transition-colors hover:bg-[#f6faf6]/40"
              >
                {/* Code */}
                <td className="px-5 py-4 align-middle font-mono text-[12px] tabular-nums text-[#1b3a1f]">
                  {h.code}
                </td>

                {/* Name */}
                <td className="px-5 py-4 align-middle font-medium text-[#1b3a1f]">
                  {h.name}
                </td>

                {/* Type pill */}
                <td className="px-5 py-4 align-middle">
                  <TypePill type={h.type} />
                </td>

                {/* Tax pill */}
                <td className="px-5 py-4 align-middle">
                  <TaxPill value={h.effectOnTax} />
                </td>

                {/* Calc basis (with parameter) */}
                <td className="px-5 py-4 align-middle">
                  <div className="leading-tight">
                    <div className="text-[#1b3a1f]">
                      {formatCalcBasis(h.calcBasis)}
                    </div>
                    {h.calcBasis !== "None" && (
                      <div className="text-[11px] text-gray-500">
                        {h.calcBasis === "BasicSalary"
                          ? "Basic Salary"
                          : "Basic + Grade"}
                      </div>
                    )}
                  </div>
                </td>

                {/* % */}
                <td className="px-5 py-4 align-middle text-[#1b3a1f] tabular-nums">
                  {formatCalcPercent(h.calcPercent)}
                </td>

                {/* Key flags */}
                <td className="px-5 py-4 align-middle">
                  <div className="flex flex-wrap gap-1">
                    {flags.length === 0 ? (
                      <span className="text-[11px] text-gray-400">—</span>
                    ) : (
                      flags.map((f) => (
                        <FlagChip key={f} flag={f} />
                      ))
                    )}
                  </div>
                </td>

                {/* Departments */}
                <td className="px-5 py-4 align-middle">
                  <DepartmentsCell
                    ids={h.applicableDepartmentIds}
                    departmentNameById={departmentNameById}
                    totalDepartmentCount={totalDepartmentCount}
                  />
                </td>

                {/* Actions */}
                <td className="px-5 py-4 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <ActionButton
                      label={`View ${h.code}`}
                      onClick={() => onView(h)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </ActionButton>
                    <ActionButton
                      label={`Edit ${h.code}`}
                      onClick={() => onEdit(h)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </ActionButton>
                    {!isStatutory ? (
                      <ActionButton
                        label={`Delete ${h.code}`}
                        onClick={() => onDelete(h)}
                        danger
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ActionButton>
                    ) : (
                      <span
                        title="System statutory head (Protected from deletion)"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-300 cursor-not-allowed"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}
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

// ----- Internal helpers ----------------------------------------------------

function TypePill({ type }: { type: PayHead["type"] }) {
  if (type === "allowance") {
    return (
      <Badge
        variant="default"
        className="bg-green-50 text-green-700 hover:bg-green-50"
      >
        {formatPayHeadType(type)}
      </Badge>
    );
  }
  return (
    <Badge
      variant="default"
      className="bg-red-50 text-red-700 hover:bg-red-50"
    >
      {formatPayHeadType(type)}
    </Badge>
  );
}

function TaxPill({ value }: { value: boolean }) {
  return (
    <Badge
      variant="default"
      className={cn(
        value
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
          : "bg-gray-100 text-gray-600 hover:bg-gray-100",
      )}
    >
      {value ? "Yes" : "No"}
    </Badge>
  );
}

function FlagChip({ flag }: { flag: keyof typeof STATUTORY_FLAG_META }) {
  const meta = STATUTORY_FLAG_META[flag];
  return (
    <span
      title={`${meta.label} — ${meta.description}`}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#d7e8d0]/70 px-1.5 text-[10px] font-semibold text-[#1b3a1f] tabular-nums"
    >
      {meta.short}
    </span>
  );
}

function DepartmentsCell({
  ids,
  departmentNameById,
  totalDepartmentCount,
}: {
  ids: string[];
  departmentNameById: Map<string, string>;
  totalDepartmentCount: number;
}) {
  // Empty list = "All Depts" (per engine/model convention)
  if (ids.length === 0) {
    const extra = Math.max(totalDepartmentCount - 0, 0);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[#1b3a1f]">All Depts</span>
        {extra > 0 && (
          <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#1b3a1f] tabular-nums">
            +{extra}
          </span>
        )}
      </div>
    );
  }

  const visible = ids.slice(0, 2).map((id) => departmentNameById.get(id) ?? id);
  const overflow = ids.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#1b3a1f]">{visible.join(", ")}</span>
      {overflow > 0 && (
        <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#1b3a1f] tabular-nums">
          +{overflow}
        </span>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}

function ActionButton({ label, onClick, children, danger }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        danger
          ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
          : "text-gray-500 hover:bg-[#d7e8d0]/60 hover:text-[#2e7d32]",
      )}
    >
      {children}
    </button>
  );
}
