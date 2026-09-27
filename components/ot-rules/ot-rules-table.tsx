"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Trash2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OtRule } from "@/lib/types/ot-rule";
import { formatRuleType, formatOtRate } from "@/lib/engines/ot-rule.engine";

interface OtRulesTableProps {
  rules: OtRule[];
  onEdit: (rule: OtRule) => void;
  onDelete: (rule: OtRule) => void;
}

type SortKey =
  | "ruleName"
  | "ruleType"
  | "rateOfficeDay"
  | "rateOffDay"
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

export function OtRulesTable({ rules, onEdit, onDelete }: OtRulesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ruleName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRules = useMemo(() => {
    const list = [...rules];
    list.sort((a, b) => {
      const getValue = (rule: OtRule) => {
        switch (sortKey) {
          case "ruleName":
            return rule.ruleName.toLowerCase();
          case "ruleType":
            return rule.ruleType;
          case "rateOfficeDay":
            return rule.rateOfficeDay;
          case "rateOffDay":
            return rule.rateOffDay;
          case "isActive":
            return rule.isActive ? 1 : 0;
          default:
            return rule.ruleName.toLowerCase();
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
          No overtime rules yet
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Create your first OT rule to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <SortHeader
              label="Rule Name"
              onClick={() => toggleSort("ruleName")}
            />
            <SortHeader label="Type" onClick={() => toggleSort("ruleType")} />
            <SortHeader
              label="Office Day Rate"
              onClick={() => toggleSort("rateOfficeDay")}
            />
            <SortHeader
              label="Off Day Rate"
              onClick={() => toggleSort("rateOffDay")}
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
          {sortedRules.map((rule) => (
            <tr
              key={rule.id}
              className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
            >
              <td className="px-4 py-4 align-middle">
                <div className="font-medium text-zinc-900">
                  {rule.ruleName}
                </div>
              </td>
              <td className="px-4 py-4 align-middle">
                <Badge variant="neutral">{formatRuleType(rule.ruleType)}</Badge>
              </td>
              <td className="px-4 py-4 align-middle font-medium text-zinc-800">
                {formatOtRate(rule.rateOfficeDay, rule.ruleType)}
              </td>
              <td className="px-4 py-4 align-middle font-medium text-zinc-800">
                {formatOtRate(rule.rateOffDay, rule.ruleType)}
              </td>
              <td className="px-4 py-4 align-middle">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${
                    rule.isActive
                      ? "border-emerald-200/50 bg-emerald-50/70 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  <Circle
                    className={`h-1.5 w-1.5 ${
                      rule.isActive ? "fill-emerald-600 text-emerald-600" : "fill-zinc-400 text-zinc-400"
                    }`}
                  />
                  {rule.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-4 text-right align-middle">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(rule)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                    title="Edit rule"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(rule)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Delete rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
