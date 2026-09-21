import { TableShell } from "@/components/ui/table-shell";
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

export function PayHeadsCard({
  heads,
  departmentNameById,
  totalDepartmentCount,
  onView,
  onEdit,
  onDelete,
}: PayHeadsCardProps) {
  return (
    <TableShell
      title="Salary & Pay Heads Registry"
      totalCount={heads.length}
      isEmpty={heads.length === 0}
      emptyTitle="No pay heads found"
      emptyDescription="Try adjusting your search query or type filter."
    >
      <PayHeadsTable
        heads={heads}
        departmentNameById={departmentNameById}
        totalDepartmentCount={totalDepartmentCount}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </TableShell>
  );
}
