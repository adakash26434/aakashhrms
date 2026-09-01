"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Trash2, Circle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeaveRule } from "@/lib/types/leave-rule";
import {
  formatAccrualMethod,
  formatAccrualValue,
  formatEncashmentRate,
  formatRuleCategory,
} from "@/lib/engines/leave-rule.engine";

interface LeaveRulesTableProps {
  rules: LeaveRule[];
  onEdit: (rule: LeaveRule) => void;
  onDelete: (rule: LeaveRule) => void;
}

type SortKey =
  | "ruleName"
  | "leaveTypeName"
  | "ruleCategory"
  | "accrualMethod"
  | "accrualValue"
  | "encashmentRate"
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
        className="inline-flex items-center gap-1.5 text-left text-[11px] uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1b3a1f]"
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

export function LeaveRulesTable({ rules, onEdit, onDelete }: LeaveRulesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ruleName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRules = useMemo(() => {
    const list = [...rules];
    list.sort((a, b) => {
      const getValue = (r: LeaveRule) => {
        switch (sortKey) {
          case "ruleName":
            return r.ruleName.toLowerCase();
          case "leaveTypeName":
            return r.leaveTypeName.toLowerCase();
          case "ruleCategory":
            return r.ruleCategory;
          case "accrualMethod":
            return r.accrualMethod;
          case "accrualValue":
            return r.accrualValue;
          case "encashmentRate":
            return r.encashmentRate;
          case "isActive":
            return r.isActive ? 1 : 0;
          default:
            return r.ruleName.toLowerCase();
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
  }, [rules, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e8d0] bg-white py-16">
        <p className="text-sm font-medium text-gray-500">
          No leave rules configured
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Please run statutory seeds or create a custom leave rule.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#d7e8d0]/80 bg-white shadow-sm">
      <table className="w-full min-w-220 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60">
            <SortHeader label="Rule Name" onClick={() => toggleSort("ruleName")} />
            <SortHeader label="Leave Policy" onClick={() => toggleSort("leaveTypeName")} />
            <SortHeader label="Category" onClick={() => toggleSort("ruleCategory")} />
            <SortHeader label="Accrual Method" onClick={() => toggleSort("accrualMethod")} />
            <SortHeader label="Accrual Rate" onClick={() => toggleSort("accrualValue")} />
            <SortHeader label="Encashment Rate" onClick={() => toggleSort("encashmentRate")} />
            <SortHeader label="Status" onClick={() => toggleSort("isActive")} />
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRules.map((r) => (
            <tr
              key={r.id}
              className="border-b border-[#d7e8d0]/60 transition-colors hover:bg-[#f6faf6]/50"
            >
              <td className="px-4 py-3 align-middle font-medium text-[#1b3a1f]">
                {r.ruleName}
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge variant="neutral">{r.leaveTypeName}</Badge>
              </td>
              <td className="px-4 py-3 align-middle">
                {r.ruleCategory === "STATUTORY" ? (
                  <Badge variant="success" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Statutory
                  </Badge>
                ) : (
                  <Badge variant="neutral">Company</Badge>
                )}
              </td>
              <td className="px-4 py-3 align-middle text-gray-600">
                {formatAccrualMethod(r.accrualMethod)}
              </td>
              <td className="px-4 py-3 align-middle font-semibold text-gray-700">
                {formatAccrualValue(r.accrualValue, r.accrualMethod)}
              </td>
              <td className="px-4 py-3 align-middle text-gray-600">
                {formatEncashmentRate(r.encashmentRate, r.encashmentFixedAmount)}
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={`h-2.5 w-2.5 ${r.isActive ? "fill-emerald-500 text-emerald-500" : "fill-gray-300 text-gray-300"}`}
                  />
                  <span
                    className={`text-xs ${r.isActive ? "text-emerald-700" : "text-gray-400"}`}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right align-middle">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#d7e8d0]/50 hover:text-[#2e7d32]"
                    title="Edit leave rule"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {r.ruleCategory !== "STATUTORY" ? (
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Delete leave rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-md p-1.5 text-gray-300 cursor-not-allowed"
                      title="Statutory rules cannot be deleted"
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
