"use client";

import { useMemo, useState } from "react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { voidAttendancePunchAction } from "@/app/actions/attendance.actions";
import { localClock, localDate } from "@/lib/engines/attendance-day.engine";
import { PUNCH_SOURCES, type AttendancePageData, type PunchSource, type PunchView } from "@/lib/types/attendance";
import { ReasonWindow } from "./attendance-windows";

const SOURCE_LABEL: Record<PunchSource, string> = { manual: "Entered by HR", web: "Web clock-in", device: "Device", import: "File import", adjustment: "Adjustment" };

/** Punch log: every punch of the month with its source, IP and location; wrong ones are voided (kept, with the reason). */
export function AttendancePunches({ data, onDone }: { data: AttendancePageData; onDone: (text: string) => void }) {
  const dateText = useDateText();
  const [filters, setFilters] = useState<FilterValues>({ state: "active" });
  const [search, setSearch] = useState("");
  const [voiding, setVoiding] = useState<PunchView | null>(null);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.punches.filter(
      (p) =>
        (!filters.source || p.source === filters.source) &&
        (filters.state !== "active" || !p.voidedAt) &&
        (filters.state !== "voided" || !!p.voidedAt) &&
        (!q || p.employeeName.toLowerCase().includes(q) || p.employeeCode.toLowerCase().includes(q))
    );
  }, [data.punches, filters, search]);

  const columns = useMemo<GridColumn<PunchView>[]>(
    () => [
      { id: "day", header: "Day", type: "date", value: (p) => localDate(p.punchedAt) },
      { id: "time", header: "Time", width: 70, value: (p) => p.punchedAt, cell: (p) => <span className="tabular-nums">{localClock(p.punchedAt)}</span> },
      { id: "name", header: "Employee", width: 160, value: (p) => p.employeeName, cell: (p) => <span className={p.voidedAt ? "text-ink-faint line-through" : "font-medium text-ink"}>{p.employeeName}</span> },
      { id: "kind", header: "In / out", width: 96, value: (p) => p.kind },
      { id: "source", header: "Source", width: 120, value: (p) => SOURCE_LABEL[p.source] },
      { id: "ip", header: "IP", width: 120, value: (p) => p.ip ?? "", defaultHidden: true },
      { id: "location", header: "Location", width: 160, value: (p) => (p.latitude !== null ? `${p.latitude}, ${p.longitude}` : ""), defaultHidden: true },
      { id: "note", header: "Note", width: 190, value: (p) => (p.voidedAt ? `Voided: ${p.voidReason ?? ""}` : p.note ?? "") },
      { id: "by", header: "Entered by", width: 120, value: (p) => p.createdByName ?? "" },
      {
        id: "actions",
        header: "Actions",
        width: 84,
        sortable: false,
        hideable: false,
        value: () => "",
        cell: (p) =>
          !p.voidedAt && data.permissions.edit && p.employeeId !== data.myEmployeeId ? (
            <button
              type="button"
              tabIndex={-1}
              className="cursor-pointer text-2xs font-medium text-danger hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setVoiding(p);
              }}
            >
              Void
            </button>
          ) : null,
      },
    ],
    [data.permissions.edit, data.myEmployeeId]
  );

  return (
    <div className="p-3">
      <FilterStrip
        id="attendance-punches"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[
          { id: "source", label: "Source", allLabel: "All sources", options: PUNCH_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] })) },
          {
            id: "state",
            label: "Show",
            allLabel: "All punches",
            options: [
              { value: "active", label: "In use" },
              { value: "voided", label: "Voided" },
            ],
          },
        ]}
      />
      <DataGrid
        id="attendance-punches"
        label={`Punch log, ${data.period.label}`}
        columns={columns}
        rows={visible}
        getRowId={(p) => p.id}
        defaultSort={{ columnId: "time", direction: "desc" }}
        pageSize={100}
        exportModule={data.permissions.export ? "ATTENDANCE" : undefined}
        exportName={`Punch log ${data.period.label}`}
        empty={{ title: "No punches", description: "Punches from HR entry, adjustments, web check-in, devices and imports appear here." }}
      />
      {voiding && (
        <ReasonWindow
          title={`Void the ${localClock(voiding.punchedAt)} punch of ${voiding.employeeName}?`}
          description={`${dateText(localDate(voiding.punchedAt), "long")}. The punch stays in the log, marked void, with your reason; the day is worked out again.`}
          action="Void punch"
          danger
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            const result = await voidAttendancePunchAction(voiding.id, reason);
            if (!result.success) return result.error;
            setVoiding(null);
            onDone("Punch voided.");
            return null;
          }}
        />
      )}
    </div>
  );
}
