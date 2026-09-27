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
        className="inline-flex items-center gap-1.5 text-left text-[11px] uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-900"
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center">
        <p className="text-sm font-medium text-zinc-600">
          No leave rules configured
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Please run statutory seeds or create a custom leave rule.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-220 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <SortHeader label="Rule Name" onClick={() => toggleSort("ruleName")} />
            <SortHeader label="Leave Policy" onClick={() => toggleSort("leaveTypeName")} />
            <SortHeader label="Category" onClick={() => toggleSort("ruleCategory")} />
            <SortHeader label="Accrual Method" onClick={() => toggleSort("accrualMethod")} />
            <SortHeader label="Accrual Rate" onClick={() => toggleSort("accrualValue")} />
            <SortHeader label="Encashment Rate" onClick={() => toggleSort("encashmentRate")} />
            <SortHeader label="Status" onClick={() => toggleSort("isActive")} />
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sortedRules.map((r) => (
            <tr
              key={r.id}
              className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
            >
              <td className="px-4 py-4 align-middle font-medium text-zinc-900">
                {r.ruleName}
              </td>
              <td className="px-4 py-4 align-middle">
                <Badge variant="neutral">{r.leaveTypeName}</Badge>
              </td>
              <td className="px-4 py-4 align-middle">
                {r.ruleCategory === "STATUTORY" ? (
                  <Badge variant="success" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Statutory
                  </Badge>
                ) : (
                  <Badge variant="neutral">Company</Badge>
                )}
              </td>
              <td className="px-4 py-4 align-middle text-zinc-600">
                {formatAccrualMethod(r.accrualMethod)}
              </td>
              <td className="px-4 py-4 align-middle font-medium text-zinc-800">
                {formatAccrualValue(r.accrualValue, r.accrualMethod)}
              </td>
              <td className="px-4 py-4 align-middle text-zinc-600">
                {formatEncashmentRate(r.encashmentRate, r.encashmentFixedAmount)}
              </td>
              <td className="px-4 py-4 align-middle">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${
                    r.isActive
                      ? "border-emerald-200/50 bg-emerald-50/70 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  <Circle
                    className={`h-1.5 w-1.5 ${
                      r.isActive ? "fill-emerald-600 text-emerald-600" : "fill-zinc-400 text-zinc-400"
                    }`}
                  />
                  {r.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-4 text-right align-middle">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                    title="Edit leave rule"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {r.ruleCategory !== "STATUTORY" ? (
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete leave rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded p-1.5 text-zinc-300 cursor-not-allowed"
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
