"use client";

import { Paperclip } from "lucide-react";
import { StatusChip } from "@/components/kit/status-chip";
import { fileSizeText } from "@/lib/engines/employee-document.engine";
import type { TargetStatus } from "@/lib/engines/target.engine";
import type { TargetAttachmentRef } from "@/lib/types/target";

// Targets (G15): small pieces shared by the office screen and the portal.

export const STATUS_LABEL: Record<TargetStatus, string> = {
  set: "Awaiting report",
  submitted: "With supervisor",
  returned: "Returned",
  forwarded: "With HR",
  closed: "Closed",
};

export function targetStatusChip(status: TargetStatus) {
  const kind = status === "closed" ? "approved" : status === "returned" ? "rejected" : status === "set" ? "draft" : "pending";
  return <StatusChip status={kind} label={STATUS_LABEL[status]} />;
}

export const fmt = (n: number | null, unit = "") => (n === null ? "—" : `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`);

export const pctText = (pct: number | null) => (pct === null ? "—" : `${pct.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`);

/** Evidence files as download links (the server decides who may open them). */
export function EvidenceList({ files, onRemove }: { files: readonly TargetAttachmentRef[]; onRemove?: (file: TargetAttachmentRef) => void }) {
  if (!files.length) return <span className="text-ink-faint">No files attached</span>;
  return (
    <ul className="space-y-1">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-2 text-sm">
          <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <a className="truncate text-brand hover:underline" href={`/api/targets/evidence/${f.id}`} download>
            {f.name}
          </a>
          <span className="shrink-0 text-xs text-ink-faint">{fileSizeText(f.size)}</span>
          {onRemove && (
            <button type="button" className="shrink-0 cursor-pointer text-xs text-ink-muted hover:text-danger" onClick={() => onRemove(f)}>
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
