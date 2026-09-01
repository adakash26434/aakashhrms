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
  check: "bg-emerald-50 text-emerald-600",
  calendar: "bg-[#d7e8d0] text-[#2e7d32]",
  alert: "bg-amber-50 text-amber-600",
  lock: "bg-[#d7e8d0] text-[#1b3a1f]",
  mail: "bg-[#d7e8d0] text-[#2e7d32]",
  wallet: "bg-[#d7e8d0] text-[#2e7d32]",
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
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-payroll-navy">
              Recent activity
            </h3>
            <p className="text-xs text-gray-500">
              Audit-trail backed · forensic granularity
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeFilter === filter.id
                    ? "bg-payroll-primary text-white"
                    : "bg-payroll-light text-payroll-navy hover:bg-payroll-light/80",
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
            const Icon = iconMap[item.icon];
            const isLast = index === filtered.length - 1;

            return (
              <div key={item.id} className="relative flex gap-3 pb-5">
                {!isLast && (
                  <div className="absolute left-3.75 top-8 h-[calc(100%-12px)] w-px bg-payroll-light" />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    iconStyles[item.icon],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm text-payroll-navy">
                    <span className="font-semibold">{item.actor}</span>
                    <span className="text-gray-400"> · {item.role}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {item.description}{" "}
                    {item.highlight && (
                      <span className="font-medium text-payroll-primary">
                        {item.highlight}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{item.timestamp}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
