"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Pencil,
  Trash2,
  Circle,
  Lock,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeaveTypeRecord } from "@/lib/types/leave-type";
import {
  formatGenderApplicable,
  getGenderBadgeVariant,
} from "@/lib/engines/leave-type.engine";

interface LeaveTypesTableProps {
  types: LeaveTypeRecord[];
  onEdit: (type: LeaveTypeRecord) => void;
  onDelete: (type: LeaveTypeRecord) => void;
}

type SortKey =
  | "name"
  | "code"
  | "noOfDays"
  | "leaveType"
  | "carryForward"
  | "accumulationCap"
  | "genderApplicable"
  | "isStatutory"
  | "isActive";

function SortHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-left text-[11px] uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-900"
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

export function LeaveTypesTable({
  types,
  onEdit,
  onDelete,
}: LeaveTypesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedTypes = useMemo(() => {
    const list = [...types];
    list.sort((a, b) => {
      const getValue = (t: LeaveTypeRecord) => {
        switch (sortKey) {
          case "name":
            return t.name.toLowerCase();
          case "code":
            return t.code.toLowerCase();
          case "noOfDays":
            return t.noOfDays;
          case "leaveType":
            return t.leaveType;
          case "carryForward":
            return t.carryForward ? 1 : 0;
          case "accumulationCap":
            return t.accumulationCap ?? 0;
          case "genderApplicable":
            return t.genderApplicable;
          case "isStatutory":
            return t.isStatutory ? 1 : 0;
          case "isActive":
            return t.isActive ? 1 : 0;
          default:
            return t.name.toLowerCase();
        }
      };
      const left = getValue(a);
      const right = getValue(b);
      if (typeof left === "number" && typeof right === "number") {
        return sortDir === "asc" ? left - right : right - left;
      }
      const cmp = String(left).localeCompare(String(right), undefined, {
        numeric: true,
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [types, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (types.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center">
        <p className="text-sm font-medium text-zinc-600">
          No leave types found
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Statutory leave types will be seeded upon script run.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-240 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <SortHeader label="Leave Name" onClick={() => toggleSort("name")} />
            <SortHeader label="Code" onClick={() => toggleSort("code")} />
            <SortHeader
              label="Days/Yr"
              onClick={() => toggleSort("noOfDays")}
            />
            <SortHeader label="Type" onClick={() => toggleSort("leaveType")} />
            <SortHeader
              label="Carry Forward"
              onClick={() => toggleSort("carryForward")}
            />
            <SortHeader
              label="Acc. Cap"
              onClick={() => toggleSort("accumulationCap")}
            />
            <SortHeader
              label="Gender Limit"
              onClick={() => toggleSort("genderApplicable")}
            />
            <SortHeader
              label="Statutory"
              onClick={() => toggleSort("isStatutory")}
            />
            <SortHeader label="Status" onClick={() => toggleSort("isActive")} />
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sortedTypes.map((t) => (
            <tr
              key={t.id}
              className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
            >
              <td className="px-4 py-4 align-middle font-medium text-zinc-900">
                {t.name}
              </td>
              <td className="px-4 py-4 align-middle font-mono text-xs text-zinc-600">
                {t.code}
              </td>
              <td className="px-4 py-4 align-middle font-medium text-zinc-900">
                {t.noOfDays}
              </td>
              <td className="px-4 py-4 align-middle">
                <Badge
                  variant={
                    t.leaveType === "Pay"
                      ? "success"
                      : t.leaveType === "Partial-Pay"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {t.leaveType}
                </Badge>
              </td>
              <td className="px-4 py-4 align-middle text-center">
                {t.carryForward ? (
                  <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                ) : (
                  <X className="h-4 w-4 text-zinc-400 mx-auto" />
                )}
              </td>
              <td className="px-4 py-4 align-middle text-zinc-600">
                {t.accumulationCap !== null ? `${t.accumulationCap} days` : "—"}
              </td>
              <td className="px-4 py-4 align-middle">
                <Badge variant={getGenderBadgeVariant(t.genderApplicable)}>
                  {formatGenderApplicable(t.genderApplicable)}
                </Badge>
              </td>
              <td className="px-4 py-4 align-middle">
                {t.isStatutory ? (
                  <Badge variant="success" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Statutory
                  </Badge>
                ) : (
                  <Badge variant="neutral">Custom</Badge>
                )}
              </td>
              <td className="px-4 py-4 align-middle">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${
                    t.isActive
                      ? "border-emerald-200/50 bg-emerald-50/70 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  <Circle
                    className={`h-1.5 w-1.5 ${
                      t.isActive ? "fill-emerald-600 text-emerald-600" : "fill-zinc-400 text-zinc-400"
                    }`}
                  />
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-4 text-right align-middle">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                    title="Edit leave type"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!t.isStatutory ? (
                    <button
                      type="button"
                      onClick={() => onDelete(t)}
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete leave type"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded p-1.5 text-zinc-300 cursor-not-allowed"
                      title="Statutory types cannot be deleted"
                    >
                      <Trash2 className="h-4 w-4 opacity-40" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
