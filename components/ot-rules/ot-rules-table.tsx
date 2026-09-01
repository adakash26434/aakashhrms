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
        className="inline-flex items-center gap-1.5 text-left text-[11px] uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1b3a1f]"
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e8d0] bg-white py-16">
        <p className="text-sm font-medium text-gray-500">
          No overtime rules yet
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Create your first OT rule to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#d7e8d0]/80 bg-white shadow-sm my-8">
      <table className="w-full min-w-150 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60">
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
          </tr>
        </thead>
        <tbody>
          {sortedRules.map((rule) => (
            <tr
              key={rule.id}
              className="border-b border-[#d7e8d0]/60 transition-colors hover:bg-[#f6faf6]/50"
            >
              <td className="px-4 py-3 align-middle">
                <div className="font-medium text-[#1b3a1f]">
                  {rule.ruleName}
                </div>
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge variant="neutral">{formatRuleType(rule.ruleType)}</Badge>
              </td>
              <td className="px-4 py-3 align-middle font-medium text-gray-700">
                {formatOtRate(rule.rateOfficeDay, rule.ruleType)}
              </td>
              <td className="px-4 py-3 align-middle font-medium text-gray-700">
                {formatOtRate(rule.rateOffDay, rule.ruleType)}
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={`h-2.5 w-2.5 ${rule.isActive ? "fill-emerald-500 text-emerald-500" : "fill-gray-300 text-gray-300"}`}
                  />
                  <span
                    className={`text-xs ${rule.isActive ? "text-emerald-700" : "text-gray-400"}`}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
