"use client";

import { Eye, Pencil, Trash2, Lock } from "lucide-react";
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
 * Clean Devanagari / bracketed Nepali words like (महङ्गी भत्ता), (घरभाडा भत्ता), etc.
 * to keep table presentation crisp and professional.
 */
function cleanDisplayName(name: string): string {
  return name.replace(/\s*\([\u0900-\u097F\s\/]+\)/g, "").trim();
}

/**
 * Pay Heads Master Table.
 *
 * Implements the clean, high-density SaaS table layout (from the reference design)
 * while preserving all original data columns:
 *   CODE | NAME | TYPE | TAX | CALC BASIS | % | KEY FLAGS | DEPARTMENTS | ACTIONS
 *
 * Proportional column sizing and balanced padding eliminate horizontal scrollbars
 * even when the inner setup sidebar is expanded.
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
      <div className="px-5 py-12 text-center text-xs text-slate-500">
        No pay heads match the current filter. Adjust the search or type filter, or create a new pay head.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-2xs font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-2xs font-semibold uppercase tracking-wider text-zinc-500">
            <th scope="col" className="px-4 py-3 font-semibold">
              Code
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-center">
              Tax
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Calculation basis
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-center">
              %
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Flags
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Departments
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {heads.map((h) => {
            const flags = activeFlags(h.flags);
            const isStatutory = Boolean(
              h.flags?.isPfHead ||
              h.flags?.isSsfHead ||
              h.flags?.isCitHead ||
              h.flags?.isTdsHead
            );
            const cleanName = cleanDisplayName(h.name);

            return (
              <tr
                key={h.id}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
              >
                {/* Code */}
                <td className="px-4 py-4 align-middle font-mono text-xs font-medium text-zinc-900 tabular-nums">
                  {h.code}
                </td>

                {/* Name */}
                <td className="px-4 py-4 align-middle">
                  <span className="font-medium text-xs text-zinc-900">
                    {cleanName}
                  </span>
                </td>

                {/* Type Pill */}
                <td className="px-4 py-4 align-middle">
                  {h.type === "allowance" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-50/70 text-emerald-800 border border-emerald-200/50">
                      {formatPayHeadType(h.type)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-rose-50/70 text-rose-800 border border-rose-200/50">
                      {formatPayHeadType(h.type)}
                    </span>
                  )}
                </td>

                {/* Tax */}
                <td className="px-4 py-4 align-middle text-center">
                  {h.effectOnTax ? (
                    <span className="text-xs font-medium text-emerald-700">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400 font-medium">
                      No
                    </span>
                  )}
                </td>

                {/* Calc Basis */}
                <td className="px-4 py-4 align-middle">
                  <div className="leading-tight">
                    <div className="text-xs font-medium text-zinc-800">
                      {formatCalcBasis(h.calcBasis)}
                    </div>
                    {h.calcBasis !== "None" && (
                      <div className="text-2xs text-zinc-400">
                        {h.calcBasis === "BasicSalary"
                          ? "Basic Salary"
                          : "Basic + Grade"}
                      </div>
                    )}
                  </div>
                </td>

                {/* % */}
                <td className="px-4 py-4 align-middle text-center font-mono text-xs text-zinc-700 tabular-nums">
                  {formatCalcPercent(h.calcPercent)}
                </td>

                {/* Key Flags */}
                <td className="px-4 py-4 align-middle">
                  <div className="flex flex-wrap gap-1 items-center">
                    {flags.length === 0 ? (
                      <span className="text-xs text-zinc-300">—</span>
                    ) : (
                      flags.map((f) => {
                        const meta = STATUTORY_FLAG_META[f];
                        return (
                          <span
                            key={f}
                            title={`${meta.label} — ${meta.description}`}
                            className="inline-flex items-center justify-center rounded bg-zinc-100 px-1.5 py-0.5 text-2xs font-mono font-medium text-zinc-600 border border-zinc-200"
                          >
                            {meta.short}
                          </span>
                        );
                      })
                    )}
                  </div>
                </td>

                {/* Departments */}
                <td className="px-4 py-4 align-middle">
                  <DepartmentsCell
                    ids={h.applicableDepartmentIds}
                    departmentNameById={departmentNameById}
                    totalDepartmentCount={totalDepartmentCount}
                  />
                </td>

                {/* Actions */}
                <td className="px-4 py-4 align-middle text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(h)}
                      title={`Edit ${h.code}`}
                      className="rounded p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onView(h)}
                      title={`View ${h.code}`}
                      className="rounded p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {!isStatutory ? (
                      <button
                        type="button"
                        onClick={() => onDelete(h)}
                        title={`Delete ${h.code}`}
                        className="rounded p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span
                        title="Statutory head (Protected from deletion)"
                        className="text-zinc-300 cursor-not-allowed p-1"
                      >
                        <Lock className="h-3 w-3" />
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

function DepartmentsCell({
  ids,
  departmentNameById,
  totalDepartmentCount,
}: {
  ids: string[];
  departmentNameById: Map<string, string>;
  totalDepartmentCount: number;
}) {
  if (ids.length === 0 || ids.length === totalDepartmentCount) {
    return (
      <span className="text-xs font-medium text-zinc-600">
        All Depts
      </span>
    );
  }

  const visible = ids.slice(0, 1).map((id) => departmentNameById.get(id) ?? id);
  const overflow = ids.length - visible.length;

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-600">
      <span className="truncate max-w-25">{visible[0]}</span>
      {overflow > 0 && (
        <span className="rounded bg-zinc-100 px-1 py-0.2 text-2xs font-medium text-zinc-500 border border-zinc-200">
          +{overflow}
        </span>
      )}
    </div>
  );
}
