"use client";

import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Building2,
  Briefcase,
  Award,
  Users,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PayrollScopeFilterPopover, type ScopeFilterItem } from "./payroll-scope-filter-popover";
import { cn } from "@/lib/utils";

interface PayrollScopeToolbarProps {
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  categories: string[];
  selectedBranches: string[];
  setSelectedBranches: (ids: string[]) => void;
  selectedDepartments: string[];
  setSelectedDepartments: (ids: string[]) => void;
  selectedDesignations: string[];
  setSelectedDesignations: (ids: string[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (cats: string[]) => void;
  onReset: () => void;
  matchedEmployeesCount: number;
}

export function PayrollScopeToolbar({
  branches,
  departments,
  designations,
  categories,
  selectedBranches,
  setSelectedBranches,
  selectedDepartments,
  setSelectedDepartments,
  selectedDesignations,
  setSelectedDesignations,
  selectedCategories,
  setSelectedCategories,
  onReset,
  matchedEmployeesCount,
}: PayrollScopeToolbarProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Convert to ScopeFilterItem format for popovers
  const branchFilterItems: ScopeFilterItem[] = useMemo(
    () => branches.map((b) => ({ id: b.id, label: b.name })),
    [branches]
  );
  const deptFilterItems: ScopeFilterItem[] = useMemo(
    () => departments.map((d) => ({ id: d.id, label: d.name })),
    [departments]
  );
  const desigFilterItems: ScopeFilterItem[] = useMemo(
    () => designations.map((d) => ({ id: d.id, label: d.name })),
    [designations]
  );
  const categoryFilterItems: ScopeFilterItem[] = useMemo(
    () => categories.map((c) => ({ id: c, label: c })),
    [categories]
  );

  const areFiltersCustomized =
    selectedBranches.length !== branches.length ||
    selectedDepartments.length !== departments.length ||
    selectedDesignations.length !== designations.length ||
    selectedCategories.length > 0;

  // Formulate concise summary text for the collapsed bar
  const branchText =
    selectedBranches.length === branches.length
      ? `All ${branches.length} branches`
      : `${selectedBranches.length} of ${branches.length} branches`;

  const deptText =
    selectedDepartments.length === departments.length
      ? `All ${departments.length} depts`
      : `${selectedDepartments.length} of ${departments.length} depts`;

  const desigText =
    selectedDesignations.length === designations.length
      ? `All ${designations.length} desigs`
      : `${selectedDesignations.length} of ${designations.length} desigs`;

  const catText =
    selectedCategories.length === 0 || selectedCategories.length === categories.length
      ? "All categories"
      : `${selectedCategories.length} categories`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-xs transition-all",
        isConfiguring
          ? "border-payroll-primary ring-2 ring-payroll-primary/10 shadow-sm"
          : "border-payroll-light/90 hover:border-payroll-primary/40"
      )}
    >
      {/* 1-Line Compact Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-payroll-navy">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-payroll-primary/10 text-payroll-primary">
            <SlidersHorizontal className="h-4 w-4" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-payroll-navy text-[13px]">
              Active Scope
            </span>
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1 text-gray-600">
              <Building2 className="h-3 w-3 text-gray-400" />
              <span>{branchText}</span>
            </div>
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1 text-gray-600">
              <Briefcase className="h-3 w-3 text-gray-400" />
              <span>{deptText}</span>
            </div>
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1 text-gray-600">
              <Award className="h-3 w-3 text-gray-400" />
              <span>{desigText}</span>
            </div>
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1 text-gray-600">
              <Users className="h-3 w-3 text-gray-400" />
              <span>{catText}</span>
            </div>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-payroll-cream px-2 py-0.5 font-bold font-mono text-payroll-primary text-[11px] border border-payroll-light/80">
              {matchedEmployeesCount} staff in scope
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {areFiltersCustomized && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-payroll-primary hover:underline cursor-pointer px-2 py-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Scope
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsConfiguring(!isConfiguring)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none",
              isConfiguring
                ? "bg-payroll-primary text-white shadow-xs"
                : "border border-payroll-light/80 bg-payroll-cream/50 text-payroll-navy hover:bg-payroll-primary hover:text-white hover:border-payroll-primary"
            )}
          >
            {isConfiguring ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Done</span>
                <ChevronUp className="h-3 w-3 ml-0.5" />
              </>
            ) : (
              <>
                <SlidersHorizontal className="h-3 w-3 text-payroll-primary" />
                <span>Configure Scope</span>
                <ChevronDown className="h-3 w-3 ml-0.5 text-gray-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Filter Popover Toolbar */}
      {isConfiguring && (
        <div className="border-t border-payroll-light/70 bg-payroll-cream/30 p-4 animate-[fadeIn_150ms_ease-out]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PayrollScopeFilterPopover
              label="Branches"
              icon={Building2}
              items={branchFilterItems}
              selectedIds={selectedBranches}
              onSelectionChange={setSelectedBranches}
              placeholder="Search branches..."
              required={true}
            />

            <PayrollScopeFilterPopover
              label="Departments"
              icon={Briefcase}
              items={deptFilterItems}
              selectedIds={selectedDepartments}
              onSelectionChange={setSelectedDepartments}
              placeholder="Search departments..."
              required={true}
            />

            <PayrollScopeFilterPopover
              label="Designations"
              icon={Award}
              items={desigFilterItems}
              selectedIds={selectedDesignations}
              onSelectionChange={setSelectedDesignations}
              placeholder="Search designations..."
              required={true}
            />

            <PayrollScopeFilterPopover
              label="Category"
              icon={Users}
              items={categoryFilterItems}
              selectedIds={selectedCategories}
              onSelectionChange={setSelectedCategories}
              placeholder="Search categories..."
              allowEmptyAsAll={true}
              emptyLabel="All Categories"
            />
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-payroll-light/50 pt-2.5 text-[11px] text-gray-500">
            <span>
              Matches <strong>{matchedEmployeesCount}</strong> employee(s) across selected branches, departments, and designations.
            </span>
            <button
              type="button"
              onClick={() => setIsConfiguring(false)}
              className="text-xs font-bold text-payroll-primary hover:underline cursor-pointer"
            >
              Apply & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
