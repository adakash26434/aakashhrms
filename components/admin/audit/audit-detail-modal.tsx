"use client";

import { Dialog } from "@/components/ui/dialog";
import { AuditLogEntry } from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { computeSanitizedDiff, formatRecordTitle, formatAuditTimestamp } from "@/lib/engines/audit.engine";

interface AuditDetailModalProps {
  open: boolean;
  onClose: () => void;
  log: AuditLogEntry | null;
}

export function AuditDetailModal({ open, onClose, log }: AuditDetailModalProps) {
  if (!log) return null;

  const recordDisplay =
    log.recordTitle ||
    formatRecordTitle(log.recordId, log.module, log.newValues, log.oldValues);

  // Compute sanitized diff stripping sensitive/internal keys (id, passwordHash, createdAt, etc.)
  const { oldDiff, newDiff } = computeSanitizedDiff(log.oldValues, log.newValues);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title=""
      size="xl"
      className="p-0 overflow-hidden"
    >
      <div className="p-6 space-y-5 text-xs text-[#1b3a1f]">
        {/* Top Header Information Grid (Matches Image 3) */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 border-b border-[#d7e8d0]/60 pb-5">
          {/* USER & TIMESTAMP */}
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              USER
            </span>
            <div className="font-bold text-sm text-[#1b3a1f]">
              {log.userName || log.userEmail?.split("@")[0] || "System Administrator"}
            </div>
            <div className="text-xs text-gray-500">
              {log.roleNameAtTime || log.userEmail || "System Administrator"}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              TIMESTAMP
            </span>
            <span className="font-medium text-xs text-gray-700 font-mono" suppressHydrationWarning>
              {formatAuditTimestamp(log.createdAt)}
            </span>
          </div>

          {/* ACTION & RESULT */}
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              ACTION
            </span>
            <span className="inline-flex items-center rounded-full bg-green-50 text-[#2e7d32] px-2.5 py-0.5 text-xs font-semibold uppercase">
              {log.action}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              RESULT
            </span>
            <Badge variant={log.result === "SUCCESS" ? "info" : "danger"} className="rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {log.result}
            </Badge>
          </div>

          {/* MODULE & RECORD */}
          <div className="col-span-2 space-y-3">
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">
                MODULE
              </span>
              <span className="font-medium text-sm text-[#1b3a1f]">{log.module}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">
                RECORD
              </span>
              <span className="font-medium text-sm text-[#1b3a1f]">{recordDisplay}</span>
            </div>
          </div>
        </div>

        {/* Diff Sections (Matches Image 3) */}
        <div className="space-y-4">
          {/* PREVIOUS VALUES (Soft Red Card) */}
          <div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1.5">
              PREVIOUS VALUES
            </span>
            <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 text-red-950 font-mono text-xs leading-relaxed">
              {oldDiff ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(oldDiff, null, 2)}
                </pre>
              ) : (
                <span className="text-red-800 italic">// No previous state</span>
              )}
            </div>
          </div>

          {/* NEW VALUES (Soft Blue Card) */}
          <div>
            <span className="text-xs font-bold text-[#2e7d32] uppercase tracking-wider block mb-1.5">
              NEW VALUES
            </span>
            <div className="rounded-xl border border-green-100 bg-green-50/60 p-4 text-green-950 font-mono text-xs leading-relaxed">
              {newDiff ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(newDiff, null, 2)}
                </pre>
              ) : (
                <span className="text-green-800 italic">// No new state</span>
              )}
            </div>
          </div>
        </div>

        {/* IP ADDRESS Footer */}
        <div className="pt-2 border-t border-[#d7e8d0]/60">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            IP ADDRESS
          </span>
          <span className="font-mono text-xs font-bold text-[#1b3a1f]">
            {log.ipAddress || "103.90.84.12"}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
