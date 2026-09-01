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
        className="inline-flex items-center gap-1.5 text-left text-[11px] uppercase tracking-wider text-gray-500 transition-colors hover:text-payroll-navy"
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-payroll-light bg-white py-16">
        <p className="text-sm font-medium text-gray-500">
          No leave types found
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Statutory leave types will be seeded upon script run.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-payroll-light/80 bg-white shadow-sm">
      <table className="w-full min-w-240 text-left text-sm">
        <thead>
          <tr className="border-b border-payroll-light/80 bg-payroll-light/60">
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
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTypes.map((t) => (
            <tr
              key={t.id}
              className="border-b border-payroll-light/60 transition-colors hover:bg-payroll-light/50"
            >
              <td className="px-4 py-3 align-middle font-medium text-payroll-navy">
                {t.name}
              </td>
              <td className="px-4 py-3 align-middle font-mono text-xs text-gray-600">
                {t.code}
              </td>
              <td className="px-4 py-3 align-middle font-semibold text-payroll-navy">
                {t.noOfDays}
              </td>
              <td className="px-4 py-3 align-middle">
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
              <td className="px-4 py-3 align-middle text-center">
                {t.carryForward ? (
                  <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                ) : (
                  <X className="h-4 w-4 text-red-400 mx-auto" />
                )}
              </td>
              <td className="px-4 py-3 align-middle text-gray-600">
                {t.accumulationCap !== null ? `${t.accumulationCap} days` : "—"}
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge variant={getGenderBadgeVariant(t.genderApplicable)}>
                  {formatGenderApplicable(t.genderApplicable)}
                </Badge>
              </td>
              <td className="px-4 py-3 align-middle">
                {t.isStatutory ? (
                  <Badge variant="success" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Statutory
                  </Badge>
                ) : (
                  <Badge variant="neutral">Custom</Badge>
                )}
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={`h-2.5 w-2.5 ${t.isActive ? "fill-emerald-500 text-emerald-500" : "fill-gray-300 text-gray-300"}`}
                  />
                  <span
                    className={`text-xs ${t.isActive ? "text-emerald-700" : "text-gray-400"}`}
                  >
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right align-middle">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-payroll-light/50 hover:text-payroll-primary"
                    title="Edit leave type"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!t.isStatutory ? (
                    <button
                      type="button"
                      onClick={() => onDelete(t)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Delete leave type"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-md p-1.5 text-gray-300 cursor-not-allowed"
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
