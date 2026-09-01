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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50/80">
          <tr>
            <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Name</th>
            <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Max Amount</th>
            <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Max Installments</th>
            <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Interest Rate</th>
            <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
            <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loanTypes.map((lt) => (
            <tr key={lt.id} className="transition-colors hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[#1b3a1f]">{lt.name}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-gray-700">Rs. {lt.maxAmount.toLocaleString()}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-gray-700">{lt.maxInstallments}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-gray-700">{lt.interestRate}%</td>
              <td className="whitespace-nowrap px-6 py-4">
                <Badge variant={lt.isActive ? "success" : "neutral"}>
                  {lt.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(lt)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-[#2e7d32]"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(lt)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {loanTypes.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                No loan types configured yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
