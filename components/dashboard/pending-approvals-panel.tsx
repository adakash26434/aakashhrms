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
    <Card className="h-full flex flex-col justify-between p-4 sm:p-5 bg-white">
      <div>
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
              Pending Approvals
            </h3>
            <span className="inline-flex h-5 items-center justify-center rounded-md bg-zinc-100 px-2 text-[11px] font-medium text-zinc-900 border border-zinc-200">
              {displayCount}
            </span>
          </div>

          <Link
            href="/timeAndLeave/approvals"
            className="text-zinc-400 hover:text-zinc-900 transition-colors p-1"
            title="Open approvals workspace"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-1 text-xs text-zinc-500">
          Current requests requiring administrative action
        </p>

        {/* Filter Underline Tabs */}
        <div className="mt-3 flex items-center gap-4 border-b border-zinc-100 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "pb-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "all"
                ? "border-zinc-950 text-zinc-950 font-medium"
                : "border-transparent text-zinc-500 hover:text-zinc-900",
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
                ? "border-zinc-950 text-zinc-950 font-medium"
                : "border-transparent text-zinc-500 hover:text-zinc-900",
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
                ? "border-zinc-950 text-zinc-950 font-medium"
                : "border-transparent text-zinc-500 hover:text-zinc-900",
            )}
          >
            Loans
          </button>
        </div>

        {/* Request Items List */}
        {filtered.length > 0 ? (
          <div className="divide-y divide-zinc-200 py-1">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href="/timeAndLeave/approvals"
                className="group flex items-center justify-between py-2.5 hover:bg-zinc-50 -mx-1.5 px-1.5 rounded-md transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-800 text-xs font-medium border border-zinc-200/80">
                    {item.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-[13px] font-semibold text-zinc-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {item.type} · {item.durationOrAmount}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {item.dateTag}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-7 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-800 mb-1.5" />
            <p className="text-xs font-semibold text-zinc-800">
              No pending approvals
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              All leave and loan requests are up to date.
            </p>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="mt-3 pt-2.5 border-t border-zinc-200 flex items-center gap-2 text-[11px] text-zinc-400">
        <Clock className="h-3 w-3 text-zinc-400 shrink-0" />
        <span>All approved items flow automatically into the next payroll cycle.</span>
      </div>
    </Card>
  );
}
