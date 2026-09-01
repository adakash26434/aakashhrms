"use client";

import { Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_CATEGORIES,
  type EmployeeCategory,
  type LeavePermissionsSettings,
} from "@/lib/types/system-control";

interface LeavePermissionsCardProps {
  value: LeavePermissionsSettings;
  onChange: (next: LeavePermissionsSettings) => void;
}

export function LeavePermissionsCard({
  value,
  onChange,
}: LeavePermissionsCardProps) {
  const handleToggle = (category: EmployeeCategory, enabled: boolean) => {
    onChange({
      enabledCategories: {
        ...value.enabledCategories,
        [category]: enabled,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7e8d0]/70">
            <Users className="h-5 w-5 text-[#2e7d32]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1b3a1f]">
              Leave Permissions by Employee Category
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Toggle which employee categories are allowed to apply for leave
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-3 mt-2">
          {EMPLOYEE_CATEGORIES.map((category) => {
            const enabled = value.enabledCategories[category];
            return (
              <button
                key={category}
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => handleToggle(category, !enabled)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2.5 rounded-full border bg-white px-3 py-1.5 text-sm font-medium transition-all duration-150 ease-in-out hover:bg-[#f6faf6]",
                  enabled
                    ? "border-[#2e7d32] text-[#1b3a1f]"
                    : "border-[#d7e8d0] text-[#1b3a1f]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative inline-block h-4 w-7 rounded-full transition-colors duration-150",
                    enabled ? "bg-[#2e7d32]" : "bg-gray-300",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-150",
                      enabled ? "left-3.5" : "left-0.5",
                    )}
                  />
                </span>
                <span>{category}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
