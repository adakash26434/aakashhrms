"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApprovalItem } from "@/lib/types/dashboard";

interface PendingApprovalsPanelProps {
  pendingCount: number;
  items?: ApprovalItem[];
}

type CategoryFilter = "all" | "leave" | "attendance" | "loans";

export function PendingApprovalsPanel({
  pendingCount,
  items = [],
}: PendingApprovalsPanelProps) {
  const [activeTab, setActiveTab] = useState<CategoryFilter>("all");

  const filtered =
    activeTab === "all"
      ? items
      : items.filter((item) => item.category === activeTab);

  const displayCount = pendingCount || items.length;

  return (
    <Card className="h-full flex flex-col justify-between p-4 sm:p-5 bg-white border-payroll-border shadow-payroll-xs">
      <div>
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-gray-950">
              Pending approvals
            </h3>
            <span className="inline-flex h-5 items-center justify-center rounded-full bg-payroll-primary-light px-2 text-[11px] font-semibold text-payroll-primary border border-payroll-primary-border">
              {displayCount}
            </span>
          </div>

          <Link
            href="/timeAndLeave/approvals"
            className="text-gray-400 hover:text-gray-900 transition-colors p-1"
            title="Open approvals workspace"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-1 text-xs text-gray-500">
          Current requests · payroll-impacting items first
        </p>

        {/* Filter Underline Tabs */}
        <div className="mt-3 flex items-center gap-4 border-b border-gray-100 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "pb-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "all"
                ? "border-payroll-primary text-payroll-primary font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-900",
            )}
          >
            All requests ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leave")}
            className={cn(
              "pb-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "leave"
                ? "border-payroll-primary text-payroll-primary font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-900",
            )}
          >
            Leave
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("loans")}
            className={cn(
              "pb-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "loans"
                ? "border-payroll-primary text-payroll-primary font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-900",
            )}
          >
            Loans
          </button>
        </div>

        {/* Request Items List */}
        {filtered.length > 0 ? (
          <div className="divide-y divide-gray-100 py-1">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href="/timeAndLeave/approvals"
                className="group flex items-center justify-between py-2.5 hover:bg-gray-50/80 -mx-1.5 px-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-payroll-primary-light text-payroll-primary text-xs font-semibold">
                    {item.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-[13px] font-semibold text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.type} · {item.durationOrAmount}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {item.dateTag}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-7 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-payroll-primary/70 mb-1.5" />
            <p className="text-xs font-semibold text-gray-800">
              No pending approvals
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              All leave and loan requests are up to date.
            </p>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-2 text-[11px] text-gray-400">
        <Clock className="h-3 w-3 text-gray-300 shrink-0" />
        <span>Every approval keeps your next payroll on track.</span>
      </div>
    </Card>
  );
}
