"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDateText } from "@/components/kit/date-cell";
import { PaneFields, PaneSection, type PaneField } from "@/components/kit/pane";
import { StatusChip } from "@/components/kit/status-chip";
import { auditEntryAction } from "@/app/actions/audit.actions";
import type { AuditEntryDetail } from "@/lib/types/audit";
import { formatADDate } from "@/lib/utils/bs-calendar";
import { nepalClock } from "@/lib/utils/nepal-time";

// One audit entry: who, as which role, when (both calendars, Kathmandu time), from where — the
// request's address or "Not recorded", never a made-up one (S59) — and what changed.

const REFUSAL_HELP: Record<string, string> = {
  DENIED_PERMISSION: "Their role doesn't allow this.",
  DENIED_SCOPE: "The record is outside the branches or departments their login covers.",
  DENIED_SELF: "It was about their own record: someone else has to do it.",
};

export function AuditDetail({ id }: { id: string }) {
  const [entry, setEntry] = useState<AuditEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateText = useDateText();

  useEffect(() => {
    let live = true;
    auditEntryAction(id).then((result) => {
      if (!live) return;
      if (result.success) setEntry(result.data);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [id]);

  if (error) return <p className="px-4 py-3 text-xs text-danger">{error}</p>;
  if (!entry) {
    return (
      <p className="inline-flex items-center gap-1.5 px-4 py-3 text-xs text-ink-faint">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading…
      </p>
    );
  }

  const at = new Date(entry.at);
  const rows: PaneField[] = [
    { label: "Who", value: entry.who, note: entry.email && entry.email !== entry.who ? entry.email : entry.userId ? undefined : "A scheduled job or the system" },
    { label: "Role at the time", value: entry.role ?? "Not recorded", tone: entry.role ? "default" : "warning" },
    { label: "When", value: `${dateText(entry.at, "long")}, ${nepalClock(at)}`, note: `${formatADDate(at, "iso")} (Kathmandu time)` },
    {
      label: "Address",
      value: entry.address ?? "Not recorded",
      tone: entry.address ? "default" : "warning",
      note: entry.address ? "The address the request came from." : "No address was recorded: older entries and scheduled jobs have none.",
    },
    { label: "Did", value: `${entry.actionLabel} · ${entry.moduleLabel}` },
    { label: "Record", value: entry.record },
  ];

  return (
    <div>
      <PaneSection>
        <div className="mb-2">
          <StatusChip status={entry.refused ? "rejected" : entry.result === "FAILURE" ? "error" : "approved"} label={entry.resultLabel} />
          {entry.refused && REFUSAL_HELP[entry.result] && <p className="mt-1.5 text-2xs text-ink-muted">{REFUSAL_HELP[entry.result]}</p>}
        </div>
        <PaneFields rows={rows} />
      </PaneSection>
      <PaneSection title={entry.refused ? "What was tried" : "What changed"} count={entry.changes.length || undefined}>
        {entry.changes.length ? (
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="text-left text-2xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="w-1/4 pb-1 font-semibold">Field</th>
                <th scope="col" className="pb-1 font-semibold">Before</th>
                <th scope="col" className="pb-1 font-semibold">After</th>
              </tr>
            </thead>
            <tbody>
              {entry.changes.map((c) => (
                <tr key={c.field} className="border-t border-line align-top">
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink-muted">
                    {c.label}
                  </th>
                  <td className="break-words py-1.5 pr-2 text-ink-muted">{c.before ?? <span className="text-ink-faint">–</span>}</td>
                  <td className="break-words py-1.5 font-medium text-ink">{c.after ?? <span className="font-normal text-ink-faint">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-faint">No details were recorded with this entry.</p>
        )}
      </PaneSection>
    </div>
  );
}
