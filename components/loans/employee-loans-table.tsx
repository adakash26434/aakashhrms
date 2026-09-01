"use client";

import { useState, useMemo } from "react";
import { Search, Eye, Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Loan } from "@/lib/types/loan";
import { calculateLoanProgress } from "@/lib/engines/loan.engine";

interface EmployeeLoansTableProps {
  loans: Loan[];
  onSelectLoan: (loan: Loan) => void;
  onRecordPayment?: (loan: Loan) => void;
}

/** Generate a deterministic color from a name string. */
function getAvatarColor(name: string): string {
  const colors = [
    "bg-[#2e7d32] text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-violet-600 text-white",
    "bg-cyan-600 text-white",
    "bg-green-600 text-white",
    "bg-teal-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Get first initial from a name. */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function EmployeeLoansTable({
  loans,
  onSelectLoan,
  onRecordPayment,
}: EmployeeLoansTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "CLOSED">("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Get unique loan type names for filter pills
  const loanTypeNames = useMemo(() => {
    const names = new Set(loans.map((l) => l.loanTypeName));
    return Array.from(names).sort();
  }, [loans]);

  // Filtered loans
  const filteredLoans = useMemo(() => {
    let result = loans;

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((l) => l.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "ALL") {
      result = result.filter((l) => l.loanTypeName === typeFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.employeeName.toLowerCase().includes(q) ||
          l.employeeCode.toLowerCase().includes(q) ||
          l.loanTypeName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [loans, statusFilter, typeFilter, search]);

  const statusOptions: { label: string; value: "ALL" | "ACTIVE" | "CLOSED" }[] = [
    { label: "All", value: "ALL" },
    { label: "Active", value: "ACTIVE" },
    { label: "Closed", value: "CLOSED" },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[260px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee, code, loan type…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-[#1b3a1f] placeholder:text-gray-400 focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
          />
        </div>

        {/* Loan count */}
        <p className="whitespace-nowrap text-xs tabular-nums text-gray-400">
          <span className="font-semibold text-[#1b3a1f]">{filteredLoans.length}</span> of{" "}
          <span className="font-semibold text-[#1b3a1f]">{loans.length}</span> loans
        </p>
      </div>

      {/* Filter Pills Row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Status:
          </span>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                statusFilter === opt.value
                  ? "bg-[#1b3a1f] text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Type:
          </span>
          <button
            onClick={() => setTypeFilter("ALL")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all ${
              typeFilter === "ALL"
                ? "bg-[#2e7d32] text-white shadow-sm"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }`}
          >
            All
          </button>
          {loanTypeNames.map((name) => (
            <button
              key={name}
              onClick={() => setTypeFilter(name)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all ${
                typeFilter === name
                  ? "bg-[#2e7d32] text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="w-8 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                SN
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Employee
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Loan Details
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Outstanding
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                EMI
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredLoans.map((loan, index) => {
              const progress = calculateLoanProgress(loan);
              const paidInstallments =
                loan.installmentAmount > 0
                  ? Math.floor(loan.totalReturned / loan.installmentAmount)
                  : 0;
              const remainingMonths = loan.noOfInstallments - paidInstallments;

              return (
                <tr
                  key={loan.id}
                  className="transition-colors hover:bg-gray-50/50"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 text-center text-xs tabular-nums text-gray-400">
                    {index + 1}
                  </td>

                  {/* Employee with avatar */}
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(loan.employeeName)}`}
                      >
                        {getInitial(loan.employeeName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1b3a1f]">
                          {loan.employeeName}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {loan.employeeCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Loan Details — type + subtitle */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[#1b3a1f]">
                      {loan.loanTypeName}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Principal {loan.loanAmount.toLocaleString()} · {loan.noOfInstallments}mo
                    </p>
                  </td>

                  {/* Outstanding */}
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <p className="text-sm font-semibold tabular-nums text-[#1b3a1f]">
                      {loan.remainingAmount.toLocaleString()}
                    </p>
                  </td>

                  {/* EMI */}
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <p className="text-sm font-semibold tabular-nums text-[#1b3a1f]">
                      {loan.installmentAmount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">/month</p>
                  </td>

                  {/* Progress */}
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progress >= 100
                              ? "bg-emerald-500"
                              : progress >= 50
                                ? "bg-[#2e7d32]"
                                : "bg-[#2e7d32]"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-medium tabular-nums text-[#1b3a1f]">
                          {paidInstallments}/{loan.noOfInstallments}
                        </span>
                        <p className="text-[10px] text-gray-400">
                          {remainingMonths > 0
                            ? `${remainingMonths} months remaining`
                            : "Complete"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <Badge variant={loan.status === "ACTIVE" ? "success" : "neutral"}>
                      {loan.status === "ACTIVE" ? "Active" : "Closed"}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLoan(loan);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-[#2e7d32]"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {loan.status === "ACTIVE" && onRecordPayment && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRecordPayment(loan);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                          title="Record Payment"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredLoans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400">
                  {loans.length === 0
                    ? "No loans have been disbursed yet."
                    : "No loans match your search or filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
