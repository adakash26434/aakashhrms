"use client";

import { useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Lock,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityCategory, ActivityItem } from "@/lib/types/dashboard";

interface RecentActivityProps {
  items: ActivityItem[];
}

const iconMap = {
  check: CheckCircle2,
  calendar: Calendar,
  alert: AlertCircle,
  lock: Lock,
  mail: Mail,
  wallet: CreditCard,
} as const;

const iconStyles = {
  check: "bg-emerald-50 text-emerald-800 border border-emerald-200/60",
  calendar: "bg-blue-50 text-blue-800 border border-blue-200/60",
  alert: "bg-amber-50 text-amber-800 border border-amber-200/60",
  lock: "bg-zinc-100 text-zinc-700 border border-zinc-200/60",
  mail: "bg-purple-50 text-purple-800 border border-purple-200/60",
  wallet: "bg-emerald-50 text-emerald-800 border border-emerald-200/60",
} as const;

const filters: { id: ActivityCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "payroll", label: "Payroll" },
  { id: "leave", label: "Leave" },
  { id: "security", label: "Security" },
];

export function RecentActivity({ items }: RecentActivityProps) {
  const [activeFilter, setActiveFilter] = useState<ActivityCategory>("all");

  const filtered =
    activeFilter === "all"
      ? items
      : items.filter((item) => item.category === activeFilter);

  return (
    <Card className="h-full flex flex-col justify-start bg-white">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
              Recent Activity
            </h3>
            <p className="text-xs text-zinc-500">
              System operations and audit log
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  activeFilter === filter.id
                    ? "bg-payroll-primary text-white shadow-2xs font-medium"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {filtered.map((item, index) => {
            const Icon = iconMap[item.icon] || CheckCircle2;
            const isLast = index === filtered.length - 1;

            return (
              <div key={item.id} className="relative flex gap-3 pb-4">
                {!isLast && (
                  <div className="absolute left-3.5 top-7 h-[calc(100%-10px)] w-px bg-zinc-200" />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-2xs",
                    iconStyles[item.icon] || iconStyles.check,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                      <span>{item.actor}</span>
                      <span className="text-zinc-400 font-normal"> · {item.role}</span>
                    </p>
                    <span className="text-2xs text-zinc-400 font-mono shrink-0">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600 leading-relaxed">
                    {item.description}{" "}
                    {item.highlight && (
                      <span className="font-semibold text-emerald-800">
                        {item.highlight}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
