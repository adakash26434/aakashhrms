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
    "bg-payroll-primary text-white",
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
        <div className="relative min-w-65 max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee, code, loan type…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          />
        </div>

        {/* Loan count */}
        <p className="whitespace-nowrap text-xs tabular-nums text-zinc-400">
          <span className="font-semibold text-zinc-900">{filteredLoans.length}</span> of{" "}
          <span className="font-semibold text-zinc-900">{loans.length}</span> loans
        </p>
      </div>

      {/* Filter Pills Row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-2xs font-semibold uppercase tracking-wider text-zinc-400">
            Status:
          </span>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                statusFilter === opt.value
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="mr-1 text-2xs font-semibold uppercase tracking-wider text-zinc-400">
            Type:
          </span>
          <button
            onClick={() => setTypeFilter("ALL")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all ${
              typeFilter === "ALL"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
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
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-300 bg-zinc-200 text-2xs font-semibold uppercase tracking-wider text-zinc-900">
            <tr className="border-b border-zinc-300 bg-zinc-50 text-2xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="w-8 px-4 py-3 text-center">
                SN
              </th>
              <th className="px-4 py-3">
                Employee
              </th>
              <th className="px-4 py-3">
                Loan Details
              </th>
              <th className="px-4 py-3 text-right">
                Outstanding
              </th>
              <th className="px-4 py-3 text-right">
                EMI
              </th>
              <th className="px-4 py-3">
                Progress
              </th>
              <th className="px-4 py-3">
                Status
              </th>
              <th className="px-4 py-3 text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
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
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
                >
                  <td className="whitespace-nowrap px-4 py-4 text-center text-xs tabular-nums text-zinc-400">
                    {index + 1}
                  </td>

                  {/* Employee with avatar */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-payroll-border bg-payroll-cream font-semibold text-payroll-navy text-2xs">
                        {getInitial(loan.employeeName)}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-900">
                          {loan.employeeName}
                        </p>
                        <p className="text-2xs text-zinc-400 font-mono">
                          {loan.employeeCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Loan Details — type + subtitle */}
                  <td className="px-4 py-4">
                    <p className="text-xs font-medium text-zinc-900">
                      {loan.loanTypeName}
                    </p>
                    <p className="text-2xs text-zinc-400 font-mono">
                      Principal {loan.loanAmount.toLocaleString()} · {loan.noOfInstallments}mo
                    </p>
                  </td>

                  {/* Outstanding */}
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <p className="text-xs font-semibold tabular-nums text-zinc-900">
                      {loan.remainingAmount.toLocaleString()}
                    </p>
                  </td>

                  {/* EMI */}
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <p className="text-xs font-medium tabular-nums text-zinc-900">
                      {loan.installmentAmount.toLocaleString()}
                    </p>
                    <p className="text-2xs text-zinc-400">/month</p>
                  </td>

                  {/* Progress */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-payroll-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-medium tabular-nums text-zinc-900">
                          {paidInstallments}/{loan.noOfInstallments}
                        </span>
                        <p className="text-2xs text-zinc-400">
                          {remainingMonths > 0
                            ? `${remainingMonths}mo left`
                            : "Complete"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <Badge variant={loan.status === "ACTIVE" ? "success" : "neutral"}>
                      {loan.status === "ACTIVE" ? "Active" : "Closed"}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLoan(loan);
                        }}
                        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
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
                          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-payroll-primary-light hover:text-payroll-primary"
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
                <td colSpan={8} className="px-4 py-12 text-center text-xs text-zinc-400">
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
