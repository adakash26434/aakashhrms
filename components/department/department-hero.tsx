"use client";

import Link from "next/link";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepartmentHeroProps {
  onNew: () => void;
}

/**
 * Page hero for the Department Setup page.
 *
 * Renders the title + subtitle on the left ("Organization
 * Structure" / "Manage departments, designations, and branch
 * locations.") and primary action buttons on the right.
 */
export function DepartmentHero({ onNew }: DepartmentHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-payroll-navy">
          Organization Structure
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          Manage departments, designations, and branch locations. The
          organizational hierarchy drives payroll rules, reporting lines,
          and employee grouping across the system.
        </p>
      </div>

      <div className="flex flex-wrap shrink-0 items-center gap-2 pt-1">
        <Link href="/setup/company-setup">
          <Button type="button" variant="outline" size="md" className="gap-1.5 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50">
            <Layers className="h-4 w-4 text-emerald-600" />
            <span>Master Setup (Shreni &amp; Company)</span>
          </Button>
        </Link>
        <Button type="button" onClick={onNew} size="md">
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>
    </div>
  );
}
