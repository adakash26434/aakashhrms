"use client";

import { Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LoanType } from "@/lib/types/loan";

interface LoanTypesTableProps {
  loanTypes: LoanType[];
  onEdit: (lt: LoanType) => void;
  onDelete: (lt: LoanType) => void;
}

export function LoanTypesTable({ loanTypes, onEdit, onDelete }: LoanTypesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Max Amount</th>
            <th className="px-4 py-3">Max Installments</th>
            <th className="px-4 py-3">Interest Rate</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {loanTypes.map((lt) => (
            <tr key={lt.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60">
              <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-900">{lt.name}</td>
              <td className="whitespace-nowrap px-4 py-4 tabular-nums text-zinc-700">Rs. {lt.maxAmount.toLocaleString()}</td>
              <td className="whitespace-nowrap px-4 py-4 tabular-nums text-zinc-700">{lt.maxInstallments}</td>
              <td className="whitespace-nowrap px-4 py-4 tabular-nums text-zinc-700">{lt.interestRate}%</td>
              <td className="whitespace-nowrap px-4 py-4">
                <Badge variant={lt.isActive ? "success" : "neutral"}>
                  {lt.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(lt)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(lt)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {loanTypes.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-xs text-zinc-400">
                No loan types configured yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
