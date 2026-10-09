"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, Plus, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { DescriptionList } from "@/components/kit/description-list";
import { inputClass } from "@/components/kit/property-form";
import { NewEventWindow } from "./new-event-window";
import { EVENT_KINDS } from "@/lib/engines/employee-event.engine";
import { cancelEmployeeEventAction } from "@/app/actions/employee-event.actions";
import type { EventListRow, EventsPageData } from "@/lib/types/employee-event";

// Lifecycle events (G2): the register of promotions (बढुवा), transfers
// (सरुवा) and confirmations (स्थायी). Open a row for details, its letter and
// — for scheduled events — Cancel.

const statusChip = (status: EventListRow["status"]) =>
  status === "scheduled" ? (
    <StatusChip status="pending" label="Scheduled" />
  ) : status === "cancelled" ? (
    <StatusChip status="cancelled" label="Cancelled" />
  ) : (
    <StatusChip status="approved" label="Applied" />
  );

export function LifecycleClient({ data, preset = null }: { data: EventsPageData; preset?: { kind: string; employeeId: string } | null }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [creating, setCreating] = useState(!!preset);
  const [openEvent, setOpenEvent] = useState<EventListRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.events.filter((e) => {
      if (filters.kind && e.kind !== filters.kind) return false;
      if (filters.status && e.status !== filters.status) return false;
      if (q && ![e.employeeName, e.employeeCode, e.change].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.events, filters, search]);

  const columns: GridColumn<EventListRow>[] = [
    { id: "effective", header: "Effective", value: (e) => e.effectiveDateAd, cell: (e) => <DateCell value={e.effectiveDateAd} />, type: "date", sticky: true, width: 130 },
    { id: "employee", header: "Employee", value: (e) => e.employeeName, cell: (e) => (
        <span>
          {e.employeeName} <span className="text-ink-faint">· {e.employeeCode}</span>
        </span>
      ) },
    { id: "kind", header: "Event", value: (e) => e.kindName, cell: (e) => (
        <span>
          {e.kindName} {e.kindNameNp && <span className="text-ink-faint">· {e.kindNameNp}</span>}
        </span>
      ), width: 170 },
    { id: "change", header: "Change", value: (e) => e.change },
    { id: "status", header: "Status", value: (e) => e.status, cell: (e) => statusChip(e.status), width: 110 },
    { id: "letter", header: "Letter", value: (e) => (e.letterId ? "Yes" : ""), width: 80, cell: (e) =>
        e.letterId ? (
          <button type="button" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline cursor-pointer" onClick={(ev) => { ev.stopPropagation(); router.push(`/workforce/letters/${e.letterId}`); }}>
            <FileText className="h-3.5 w-3.5" /> Open
          </button>
        ) : null },
    { id: "by", header: "Recorded by", value: (e) => e.createdByName, width: 140, defaultHidden: true },
  ];

  const canCancel = openEvent?.status === "scheduled" && data.permissions.cancel;

  const cancel = () =>
    startTransition(async () => {
      if (!openEvent) return;
      setCancelError(null);
      const result = await cancelEmployeeEventAction(openEvent.id, cancelReason);
      if (result.success) {
        setOpenEvent(null);
        setCancelReason("");
        setNotice({ tone: "success", text: "Scheduled event cancelled." });
        startRefresh(() => router.refresh());
      } else {
        const fieldError = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
        setCancelError(fieldError ?? result.error);
      }
    });

  return (
    <div>
      <PageBar
        title="Lifecycle events"
        description={data.scheduled > 0 ? `${data.scheduled} scheduled event${data.scheduled === 1 ? "" : "s"} waiting for their date` : "Promotions, transfers and confirmations as dated records"}
        actions={[
          { id: "new-event", label: "New event", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.add, onClick: () => setCreating(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <FilterStrip
        id="lifecycle"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Employee, code or change" }}
        filters={[
          { id: "kind", label: "Event", options: EVENT_KINDS.map((k) => ({ value: k.code, label: `${k.name} · ${k.nameNp}` })), allLabel: "All events" },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "applied", label: "Applied" },
              { value: "scheduled", label: "Scheduled" },
              { value: "cancelled", label: "Cancelled" },
            ],
            allLabel: "All statuses",
          },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="lifecycle-events"
        label="Lifecycle events"
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        onOpen={(e) => {
          setOpenEvent(e);
          setCancelReason("");
          setCancelError(null);
        }}
        rowTone={(e) => (e.status === "cancelled" ? "danger" : e.status === "scheduled" ? "info" : undefined)}
        exportModule="EMPLOYEES"
        exportName="lifecycle-events"
        defaultSort={{ columnId: "effective", direction: "desc" }}
        empty={{ title: "No events yet", description: data.permissions.add ? "Record the first promotion, transfer or confirmation with the toolbar." : "Events for employees in your scope appear here." }}
      />

      <Window
        open={!!openEvent}
        onClose={() => setOpenEvent(null)}
        title={openEvent ? `${openEvent.kindName} — ${openEvent.employeeName}` : ""}
        size="sm"
        footer={
          <>
            <WindowButton onClick={() => setOpenEvent(null)}>Close</WindowButton>
            {openEvent?.letterId && (
              <WindowButton onClick={() => router.push(`/workforce/letters/${openEvent.letterId}`)}>
                <FileText className="h-3.5 w-3.5" /> Open letter
              </WindowButton>
            )}
            {canCancel && (
              <WindowButton variant="danger" onClick={cancel} disabled={pending || cancelReason.trim().length < 5}>
                <CalendarClock className="h-3.5 w-3.5" /> {pending ? "Cancelling…" : "Cancel event"}
              </WindowButton>
            )}
          </>
        }
      >
        {openEvent && (
          <div className="space-y-3">
            <DescriptionList
              items={[
                { label: "Employee", value: `${openEvent.employeeName} · ${openEvent.employeeCode}` },
                { label: "Event", value: `${openEvent.kindName}${openEvent.kindNameNp ? ` · ${openEvent.kindNameNp}` : ""}` },
                { label: "Change", value: openEvent.change },
                { label: "Effective", value: `${openEvent.effectiveDateBs} (${openEvent.effectiveDateAd})` },
                { label: "Status", value: statusChip(openEvent.status) },
                ...(openEvent.reason ? [{ label: "Reason", value: openEvent.reason }] : []),
                ...(openEvent.cancelReason ? [{ label: "Cancelled", value: openEvent.cancelReason }] : []),
                { label: "Recorded by", value: openEvent.createdByName },
              ]}
            />
            {canCancel && (
              <div>
                {cancelError && (
                  <Notice tone="danger" className="mb-2">
                    {cancelError}
                  </Notice>
                )}
                <label className="block text-sm text-ink">
                  Cancel reason
                  <textarea className={`${inputClass} mt-1 h-auto min-h-16 max-w-none py-2`} value={cancelReason} maxLength={500} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Scheduled by mistake" />
                </label>
              </div>
            )}
          </div>
        )}
      </Window>

      <NewEventWindow
        open={creating}
        preset={preset}
        onClose={() => setCreating(false)}
        data={data}
        onSaved={(message, letterId, warning) => {
          setCreating(false);
          setNotice(warning ? { tone: "warning", text: warning } : { tone: "success", text: message });
          if (letterId) router.push(`/workforce/letters/${letterId}`);
          else startRefresh(() => router.refresh());
        }}
      />
    </div>
  );
}
