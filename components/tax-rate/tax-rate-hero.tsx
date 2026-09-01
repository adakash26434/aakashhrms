"use client";

import { ChevronDown, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  type DropdownOption,
} from "@/components/ui/dropdown-menu";

export interface FiscalYearOption {
  id: string;
  label: string;
  isLocked: boolean;
}

interface TaxRateHeroProps {
  /** Options for the fiscal-year dropdown, newest-first. */
  fiscalYears: FiscalYearOption[];
  /** ID of the currently selected fiscal year. */
  selectedFYId: string;
  onChangeFY: (id: string) => void;
}

/**
 * Page hero for the Tax Rate Setup page.
 *
 * Renders the title + subtitle on the left and a custom **dropdown
 * menu** on the right for picking the active fiscal year. The
 * dropdown is rendered through the shared `DropdownMenu` primitive
 * so it gets all the standard accessibility + positioning
 * behaviour (portal, outside-click, escape, reposition on scroll).
 *
 * Each option in the menu shows:
 *   - the FY label (e.g. "FY 2081/82")
 *   - a description (e.g. "Active — 4 categories configured")
 *   - a "Locked" badge for read-only years
 *   - a checkmark on the currently selected option
 */
export function TaxRateHero({
  fiscalYears,
  selectedFYId,
  onChangeFY,
}: TaxRateHeroProps) {
  const selectedFY = fiscalYears.find((fy) => fy.id === selectedFYId);
  const categoriesList = "Normal Single, Married, Widow, and Handicapped";

  const options: DropdownOption<string>[] = fiscalYears.map((fy) => ({
    value: fy.id,
    label: fy.label,
    description: fy.isLocked
      ? "Locked — payslips have been generated"
      : "Active — editable",
    adornment: fy.isLocked ? (
      <Badge variant="default" className="text-[10px]">
        Locked
      </Badge>
    ) : (
      <Badge variant="success" className="text-[10px]">
        Active
      </Badge>
    ),
  }));

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[#1b3a1f]">
          Tax Rate Setup
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          {selectedFY?.isLocked ? (
            <>
              Configure slab-based TDS rates for{" "}
              <span className="font-medium text-[#1b3a1f]">
                {selectedFY.label}
              </span>{" "}
              (locked — payslips have been generated; read-only).
              Categories: {categoriesList}.
            </>
          ) : (
            <>
              Configure slab-based TDS rates for{" "}
              <span className="font-medium text-[#1b3a1f]">
                {selectedFY?.label ?? "the selected fiscal year"}
              </span>
              . Categories: {categoriesList}.
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-1">
        <DropdownMenu<string>
          value={selectedFYId}
          onChange={onChangeFY}
          options={options}
          ariaLabel="Select fiscal year"
          minWidth={260}
          renderTrigger={({ open, selected, triggerRef, toggle }) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={toggle}
              aria-haspopup="listbox"
              aria-expanded={open}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm font-medium text-[#1b3a1f] shadow-sm transition-colors hover:bg-[#f6faf6] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
            >
              <Percent className="h-4 w-4 text-[#2e7d32]" />
              <span className="text-gray-500">FY</span>
              <span className="text-sm font-semibold text-[#1b3a1f]">
                {selected?.label ?? "Select year"}
              </span>
              {selected?.adornment}
              <ChevronDown
                className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        />
      </div>
    </div>
  );
}
