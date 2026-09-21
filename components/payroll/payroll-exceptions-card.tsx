"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Info,
} from "lucide-react";
import type { PayrollSlip } from "@/lib/types/payroll";

interface PayrollExceptionsCardProps {
  slips: PayrollSlip[];
  onSelectSlip?: (slip: PayrollSlip) => void;
}

interface IssueItem {
  message: string;
  severity: "critical" | "warning";
}

interface SlipException {
  slip: PayrollSlip;
  issues: IssueItem[];
  hasCritical: boolean;
}

export function PayrollExceptionsCard({
  slips,
  onSelectSlip,
}: PayrollExceptionsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const exceptions: SlipException[] = slips.reduce<SlipException[]>((acc, slip) => {
    const issues: IssueItem[] = [];
    const net = Number(slip.netPayable) || 0;
    const basic = Number(slip.basicSalary) || 0;
    const gross = Number(slip.grossEarnings) || 0;
    const tds = Number(slip.tdsThisMonth) || 0;

    if (net < 0) {
      issues.push({
        message: `Negative net payable (Rs. ${net.toLocaleString("en-IN")})`,
        severity: "critical",
      });
    }
    if (basic <= 0) {
      issues.push({
        message: "Zero or unmapped basic salary",
        severity: "critical",
      });
    }
    if (!slip.bankAccountNumber?.trim() || slip.bankAccountNumber === "N/A") {
      issues.push({
        message: "Missing bank account number",
        severity: "critical",
      });
    }
    if (gross > 0 && tds / gross > 0.4) {
      issues.push({
        message: `High tax ratio (${Math.round((tds / gross) * 100)}% TDS of gross)`,
        severity: "warning",
      });
    }

    if (issues.length > 0) {
      acc.push({
        slip,
        issues,
        hasCritical: issues.some((i) => i.severity === "critical"),
      });
    }
    return acc;
  }, []);

  if (exceptions.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-2.5 text-xs text-emerald-800 shadow-payroll-xs">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="font-semibold">Audit Check Passed:</span>
        <span className="text-emerald-700">
          All {slips.length} payslips have valid bank accounts, positive net compensation, and standard tax proportions.
        </span>
      </div>
    );
  }

  const criticalCount = exceptions.filter((e) => e.hasCritical).length;
  const warningCount = exceptions.length - criticalCount;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-payroll-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Pre-Approval Audit Attention
              </h4>
              <div className="flex items-center gap-1.5">
                {criticalCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300/60">
                    {warningCount} warning
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Discrepancies identified in disbursement readiness or tax parameters. Resolve before final batch locking.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-payroll-xs hover:bg-amber-50 cursor-pointer"
        >
          <span>{expanded ? "Hide Details" : "View Flagged Slips"}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3.5 divide-y divide-amber-200/60 rounded-xl border border-amber-200/80 bg-white overflow-hidden text-xs">
          {exceptions.map(({ slip, issues, hasCritical }) => (
            <div
              key={slip.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-amber-50/30"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-payroll-navy">{slip.employeeName}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                    {slip.employeeCode}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 text-[11px]">{slip.departmentName}</span>
                  {hasCritical && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700 border border-red-200">
                      <AlertCircle className="h-2.5 w-2.5" />
                      Critical
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {issues.map((issue, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border ${
                        issue.severity === "critical"
                          ? "bg-rose-50 text-rose-700 border-rose-200/80 font-semibold"
                          : "bg-amber-50 text-amber-800 border-amber-200/80"
                      }`}
                    >
                      {issue.message.includes("bank") ? (
                        <CreditCard className="h-3 w-3" />
                      ) : issue.severity === "critical" ? (
                        <DollarSign className="h-3 w-3" />
                      ) : (
                        <Info className="h-3 w-3" />
                      )}
                      {issue.message}
                    </span>
                  ))}
                </div>
              </div>

              {onSelectSlip && (
                <button
                  type="button"
                  onClick={() => onSelectSlip(slip)}
                  className="rounded-lg border border-payroll-light/80 bg-payroll-cream/50 px-2.5 py-1 text-xs font-semibold text-payroll-primary hover:bg-payroll-primary hover:text-white transition-colors cursor-pointer"
                >
                  Inspect Payslip →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
