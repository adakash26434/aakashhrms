"use client";

import { Card } from "@/components/ui/card";
import type { Department } from "@/lib/types/department";
import { DepartmentsTable } from "./departments-table";

interface DepartmentsCardProps {
  departments: Department[];
  branchNameById: Map<string, string>;
  onView: (department: Department) => void;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
}

/**
 * Card wrapper for the departments table. The card is
 * intentionally minimal here (no header row) — the page's own
 * search + tabs row sits above the card and provides the
 * "title" affordance.
 *
 * Mirrors the design's unadorned bordered card for the table.
 */
export function DepartmentsCard({
  departments,
  branchNameById,
  onView,
  onEdit,
  onDelete,
}: DepartmentsCardProps) {
  return (
    <Card className="overflow-hidden">
      <DepartmentsTable
        departments={departments}
        branchNameById={branchNameById}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Card>
  );
}
