"use client";

import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Panel } from "@/components/kit/panel";
import type { EmployeeAttendanceDay, EmployeeAttendanceTabData } from "@/lib/types/employee";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLUMNS: GridColumn<EmployeeAttendanceDay>[] = [
  { id: "day", header: "Day", type: "number", width: 64, value: (r) => r.bsDay },
  { id: "weekday", header: "Weekday", width: 90, value: (r) => r.weekday, cell: (r) => WEEKDAYS[r.weekday] },
  { id: "date", header: "Date", type: "date", value: (r) => r.date },
  {
    id: "status",
    header: "Status",
    width: 140,
    value: (r) => r.status ?? "",
    cell: (r) => (r.status ? <span className="text-ink">{r.status}</span> : <span className="text-ink-faint">Not recorded</span>),
  },
  { id: "in", header: "In", type: "code", width: 90, value: (r) => r.inTime ?? "" },
  { id: "out", header: "Out", type: "code", width: 90, value: (r) => r.outTime ?? "" },
  { id: "hours", header: "Hours", type: "number", align: "right", value: (r) => r.workHours, cell: (r) => (r.workHours ? r.workHours.toFixed(2) : "") },
  { id: "late", header: "Late", width: 70, value: (r) => (r.isLate ? "Late" : ""), cell: (r) => (r.isLate ? <span className="font-medium text-warning">Late</span> : "") },
];

function Total({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-24 rounded-md border border-line bg-surface px-3 py-2">
      <p className="text-3xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

/** Attendance tab: this BS month so far, one row per day. */
export function EmployeeRecordAttendance({ data }: { data: EmployeeAttendanceTabData }) {
  const t = data.totals;
  return (
    <Panel level={3} title={`Attendance · ${data.monthLabel}`} meta="Month to date" href="/timeAndLeave/attendance" hrefLabel="Attendance register" padded={false}>
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <Total label="Present" value={t.present} tone="text-success" />
        <Total label="Half day" value={t.halfDay} />
        <Total label="On leave" value={t.leave} tone="text-info" />
        <Total label="Absent" value={t.absent} tone={t.absent ? "text-danger" : undefined} />
        <Total label="Holiday / off" value={t.other} />
        <Total label="Not recorded" value={t.notRecorded} tone="text-ink-faint" />
      </div>
      <DataGrid
        id="employee-attendance-month"
        label="Attendance this month"
        columns={COLUMNS}
        rows={data.days}
        getRowId={(r) => r.date}
        pageSize={0}
        defaultSort={{ columnId: "day", direction: "asc" }}
        rowTone={(r) => (r.status?.toLowerCase() === "absent" ? "danger" : undefined)}
        empty={{ title: "Nothing recorded yet", description: "Attendance for this month appears here once it is entered." }}
      />
    </Panel>
  );
}
