"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepartmentHeroProps {
  onNew: () => void;
}

/**
 * Page hero for the Department Setup page.
 *
 * Renders the title + subtitle on the left ("Organization
 * Structure" / "Manage departments, designations, and branch
 * locations.") and a primary "Add Department" button on the
 * right. Matches the design screenshot.
 */
export function DepartmentHero({ onNew }: DepartmentHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[#1b3a1f]">
          Organization Structure
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          Manage departments, designations, and branch locations. The
          organizational hierarchy drives payroll rules, reporting lines,
          and employee grouping across the system.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-1">
        <Button type="button" onClick={onNew} size="md">
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>
    </div>
  );
}
