"use client";

import { Card } from "@/components/ui/card";
import type { PayHead } from "@/lib/types/pay-head";
import { PayHeadsTable } from "./pay-heads-table";

interface PayHeadsCardProps {
  heads: PayHead[];
  departmentNameById: Map<string, string>;
  totalDepartmentCount: number;
  onView: (head: PayHead) => void;
  onEdit: (head: PayHead) => void;
  onDelete: (head: PayHead) => void;
}

/**
 * Card wrapper for the pay-heads table. The card is intentionally
 * minimal here (no header row) — the page's own search + tabs
 * row sits above the card and provides the "title" affordance.
 *
 * The screenshot's design uses an unadorned bordered card for
 * the table, so we mirror that.
 */
export function PayHeadsCard({
  heads,
  departmentNameById,
  totalDepartmentCount,
  onView,
  onEdit,
  onDelete,
}: PayHeadsCardProps) {
  return (
    <Card className="overflow-hidden">
      <PayHeadsTable
        heads={heads}
        departmentNameById={departmentNameById}
        totalDepartmentCount={totalDepartmentCount}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Card>
  );
}
