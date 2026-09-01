"use client";

import { ChevronDown, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownOption } from "@/components/ui/dropdown-menu";

export interface FiscalYearOption {
  id: string;
  label: string;
  isLocked: boolean;
}

interface HolidayHeroProps {
  fiscalYears: FiscalYearOption[];
  selectedFYId: string;
  onChangeFY: (id: string) => void;
  onNew: () => void;
}

/**
 * Page hero for the Holiday Setup page.
 *
 * Renders the title + subtitle on the left and a primary
 * "New Holiday" button on the right. Matches the design
 * screenshot.
 */
export function HolidayHero({ fiscalYears, selectedFYId, onChangeFY, onNew }: HolidayHeroProps) {
  const selectedFY = fiscalYears?.find((fy) => fy.id === selectedFYId);

  const options: DropdownOption<string>[] = (fiscalYears || []).map((fy) => ({
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
          Holiday Setup
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          Define festival holidays and date ranges for{" "}
          <span className="font-medium text-[#1b3a1f]">
            {selectedFY?.label ?? "the selected fiscal year"}
          </span>
          . All branches or specific branches can be assigned.
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
              <CalendarDays className="h-4 w-4 text-[#2e7d32]" />
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
        <Button type="button" onClick={onNew} size="md">
          <Plus className="h-4 w-4" />
          New Holiday
        </Button>
      </div>
    </div>
  );
}
