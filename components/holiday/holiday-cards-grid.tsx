"use client";

import type { Holiday } from "@/lib/types/holiday";
import { HolidayCard } from "./holiday-card";

interface HolidayCardsGridProps {
  holidays: Holiday[];
  /** Resolved branch names by id. */
  branchNameById: Map<string, string>;
  /** Total branch count — used to decide "All Branches" badge. */
  totalBranchCount: number;
  onView: (holiday: Holiday) => void;
  onEdit: (holiday: Holiday) => void;
  onDelete: (holiday: Holiday) => void;
}

/**
 * 3-column responsive grid of holiday cards. Mirrors the design
 * screenshot's layout (1 col on mobile, 2 on tablet, 3 on
 * desktop). When the list is empty, shows a single empty-state
 * row encouraging the user to create their first holiday.
 */
export function HolidayCardsGrid({
  holidays,
  branchNameById,
  totalBranchCount,
  onView,
  onEdit,
  onDelete,
}: HolidayCardsGridProps) {
  if (holidays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#d7e8d0] bg-white p-10 text-center">
        <p className="text-sm text-gray-500">
          No holidays match the current search. Adjust the search or
          click{" "}
          <span className="font-medium text-[#1b3a1f]">New Holiday</span>{" "}
          to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {holidays.map((h) => (
        <HolidayCard
          key={h.id}
          holiday={h}
          branchNameById={branchNameById}
          totalBranchCount={totalBranchCount}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
