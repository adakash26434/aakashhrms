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
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
      <PayHeadsTable
        heads={heads}
        departmentNameById={departmentNameById}
        totalDepartmentCount={totalDepartmentCount}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
