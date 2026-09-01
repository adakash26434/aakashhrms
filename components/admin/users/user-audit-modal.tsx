"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserWithRole, UserAuditLogEntry } from "@/lib/types/user";
import { getUserAuditLogsAction } from "@/app/actions/user.actions";
import { Badge } from "@/components/ui/badge";
import { computeSanitizedDiff, formatRecordTitle, formatAuditTimestamp } from "@/lib/engines/audit.engine";
import { ScrollText, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert } from "lucide-react";

interface UserAuditModalProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRole | null;
}

const ACTION_VARIANTS: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
  VIEW: "info",
  ADD: "success",
  EDIT: "warning",
  DELETE: "danger",
  APPROVE: "success",
  LOCK: "danger",
};

export function UserAuditModal({
  open,
  onClose,
  user,
}: UserAuditModalProps) {
  const [logs, setLogs] = useState<UserAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      setExpandedId(null);
      getUserAuditLogsAction(user.id)
        .then((res) => {
          if (res.success && res.data) {
            setLogs(res.data);
          } else {
            setLogs([]);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, user]);

  if (!user) return null;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="User Activity Audit Log"
      description={`Recent audit events recorded for user ${user.name || user.email}`}
      size="2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3 pt-1">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500 animate-pulse">
            Loading activity log for {user.email}...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p className="text-gray-600 text-sm font-semibold">No audit logs recorded</p>
            <p className="text-gray-400 text-xs mt-0.5">This user has not performed any recorded data mutations yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const actionVariant = ACTION_VARIANTS[log.action] || "default";
              const isSuccess = log.result === "SUCCESS";
              const recordDisplay = formatRecordTitle(log.recordId, log.module, log.newValues, log.oldValues);

              const { oldDiff, newDiff } = computeSanitizedDiff(log.oldValues, log.newValues);

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-[#d7e8d0]/80 bg-white p-3 text-xs shadow-2xs hover:border-[#2e7d32]/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={actionVariant} className="font-bold text-[10px] uppercase">
                        {log.action}
                      </Badge>
                      <Badge variant="neutral" className="font-medium text-[10px]">
                        {log.module}
                      </Badge>
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <ShieldCheck className="h-3 w-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                          <ShieldAlert className="h-3 w-3" /> {log.result}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono" suppressHydrationWarning>
                      {formatAuditTimestamp(log.createdAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-gray-600">
                    <div>
                      <span>Record: <strong className="text-[#1b3a1f]">{recordDisplay}</strong></span>
                      {log.ipAddress && <span className="ml-3 text-gray-400">IP: {log.ipAddress}</span>}
                    </div>

                    {(oldDiff || newDiff) && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="inline-flex items-center gap-1 text-[#2e7d32] font-medium hover:underline cursor-pointer"
                      >
                        <span>{isExpanded ? "Hide Details" : "View Values Diff"}</span>
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {isExpanded && (oldDiff || newDiff) && (
                    <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-[#d7e8d0]/60 pt-2 bg-[#f6faf6] p-2.5 rounded">
                      <div>
                        <p className="font-semibold text-red-600 mb-1 text-[10px] uppercase">Previous Values</p>
                        <div className="font-mono text-[10px] bg-red-50/60 p-2 rounded border border-red-100 overflow-x-auto text-red-950">
                          {oldDiff ? JSON.stringify(oldDiff, null, 2) : "(None)"}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-[#2e7d32] mb-1 text-[10px] uppercase">New Values</p>
                        <div className="font-mono text-[10px] bg-green-50/60 p-2 rounded border border-green-100 overflow-x-auto text-green-950">
                          {newDiff ? JSON.stringify(newDiff, null, 2) : "(None)"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
