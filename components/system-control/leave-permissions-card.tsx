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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-payroll-primary-light-2">
            <Users className="h-5 w-5 text-payroll-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-payroll-navy">
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
                  "inline-flex cursor-pointer items-center gap-2.5 rounded-full border bg-white px-3 py-1.5 text-sm font-medium transition-all duration-150 ease-in-out hover:bg-payroll-cream",
                  enabled
                    ? "border-payroll-primary text-payroll-navy"
                    : "border-payroll-border text-payroll-navy",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative inline-block h-4 w-7 rounded-full transition-colors duration-150",
                    enabled ? "bg-payroll-primary" : "bg-gray-300",
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
