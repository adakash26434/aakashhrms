import { StatusChip } from "@/components/kit/status-chip";
import type { DetailLine, DetailStatus } from "@/lib/engines/employee-detail.engine";
import type { DetailFormInfo } from "@/lib/types/employee-detail";
import { cn } from "@/lib/utils";

// Sensitive employee details (4.8 / F13): pieces shared by the employee form, the record page and
// the Detail changes screen.

/** Before → after, one row per changed field. */
export function DetailLinesTable({ lines, className }: { lines: readonly DetailLine[]; className?: string }) {
  return (
    <table className={cn("w-full text-xs", className)}>
      <thead>
        <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-ink-faint">
          <th className="py-1.5 pr-3 font-medium">Field</th>
          <th className="py-1.5 pr-3 font-medium">Now</th>
          <th className="py-1.5 font-medium">New</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.field} className="border-b border-line/70 last:border-0">
            <td className="py-1.5 pr-3 text-ink-muted">{l.label}</td>
            <td className={cn("py-1.5 pr-3 text-ink-muted line-through decoration-ink-faint/60", (l.field === "bankAccountNumber" || l.field === "panNumber") && "font-code")}>{l.from}</td>
            <td className={cn("py-1.5 font-medium text-ink", (l.field === "bankAccountNumber" || l.field === "panNumber") && "font-code")}>{l.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DetailStatusChip({ status, route }: { status: DetailStatus; route?: string | null }) {
  if (status === "pending") return <StatusChip status="pending" label="Waiting for approval" />;
  if (status === "approved") return <StatusChip status="approved" label={route === "not_required" ? "Applied (approvals off)" : route === "final_approve" ? "Approved (administrator)" : "Approved"} />;
  if (status === "rejected") return <StatusChip status="rejected" label="Rejected" />;
  return <StatusChip status="cancelled" label="Withdrawn" />;
}

/** What saving a change does for this user, in a sentence (the confirm window). */
export const ON_SAVE_TEXT: Record<DetailFormInfo["onSave"], string> = {
  wait: "Another person with Employees → Approve must approve it before payroll uses it. Until then the record keeps the current details; the rest of your changes save now.",
  wait_own: "This is your own record, so someone else must approve it before payroll uses it. The rest of your changes save now.",
  apply_admin: "As a company administrator you approve it as you save. It is recorded with your reason, and the next pay run's variance review shows a changed account.",
  apply_off: "Approvals for employee details are off (Payroll controls), so it applies as you save. It is recorded with your reason.",
};
