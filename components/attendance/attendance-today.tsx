"use client";

import { useMemo, useState } from "react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { hoursText, localClock } from "@/lib/engines/attendance-day.engine";
import { DAY_CODE, type AttendancePageData, type DayType } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";
import { DayCode } from "./attendance-shared";

type Row = AttendancePageData["todayRows"][number];

const GROUPS: { id: string; label: string; types: DayType[] }[] = [
  { id: "in", label: "In", types: ["present", "half_day", "on_duty"] },
  { id: "missing", label: "Missing punch", types: ["missing_punch"] },
  { id: "absent", label: "Not in", types: ["absent"] },
  { id: "leave", label: "On leave", types: ["paid_leave", "unpaid_leave"] },
  { id: "off", label: "Off / holiday", types: ["weekly_off", "holiday"] },
];

/** Today: who is in, late, missing a punch, on leave or off (Nepal date), by branch. */
export function AttendanceToday({ data }: { data: AttendancePageData }) {
  const dateText = useDateText();
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const rows = data.todayRows;
  // Before the office start, "Not in" just means "not yet".
  const counts = GROUPS.map((g) => ({ ...g, n: rows.filter((r) => g.types.includes(r.day.dayType)).length }));
  const late = rows.filter((r) => r.day.lateMinutes > 0).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const group = GROUPS.find((g) => g.id === filters.group);
    return rows.filter(
      (r) =>
        (!group || group.types.includes(r.day.dayType)) &&
        (!filters.department || r.employee.departmentId === filters.department) &&
        (filters.late !== "yes" || r.day.lateMinutes > 0) &&
        (!q || r.employee.fullName.toLowerCase().includes(q) || r.employee.employeeCode.toLowerCase().includes(q))
    );
  }, [rows, filters, search]);

  const columns = useMemo<GridColumn<Row>[]>(
    () => [
      { id: "code", header: "Code", type: "code", sticky: true, width: 92, value: (r) => r.employee.employeeCode },
      { id: "name", header: "Employee", sticky: true, width: 180, value: (r) => r.employee.fullName, cell: (r) => <span className="font-medium text-ink">{r.employee.fullName}</span> },
      { id: "dept", header: "Department", width: 150, value: (r) => r.employee.departmentName },
      { id: "branch", header: "Branch", width: 130, value: (r) => r.employee.branchName, defaultHidden: true },
      { id: "status", header: "Today", width: 150, value: (r) => DAY_CODE[r.day.dayType].name, cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <DayCode day={r.day} />
          <span className="text-xs text-ink-muted">{DAY_CODE[r.day.dayType].name}</span>
        </span>
      ) },
      { id: "in", header: "In", width: 70, value: (r) => localClock(r.day.firstIn), cell: (r) => <span className="tabular-nums">{localClock(r.day.firstIn) || "—"}</span> },
      { id: "out", header: "Out", width: 70, value: (r) => localClock(r.day.lastOut), cell: (r) => <span className="tabular-nums">{localClock(r.day.lastOut) || "—"}</span> },
      { id: "worked", header: "Worked", width: 84, value: (r) => r.day.workMinutes, cell: (r) => <span className="tabular-nums">{r.day.workMinutes ? hoursText(r.day.workMinutes) : "—"}</span> },
      { id: "late", header: "Late", width: 76, type: "number", value: (r) => r.day.lateMinutes, cell: (r) => (r.day.lateMinutes ? <span className="font-medium text-warning">{r.day.lateMinutes} min</span> : <span className="text-ink-faint">—</span>) },
      { id: "rule", header: "Why", width: 280, value: (r) => r.day.rule, cell: (r) => <span className="truncate text-2xs text-ink-muted">{r.day.rule}</span> },
    ],
    []
  );

  return (
    <div className="p-3 @container">
      <div className="mb-3 grid grid-cols-2 gap-2 @min-[40rem]:grid-cols-6">
        {counts.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilters((f) => ({ ...f, group: f.group === c.id ? "" : c.id }))}
            className={cn("cursor-pointer rounded-md border px-3 py-2 text-left", filters.group === c.id ? "border-brand bg-brand-subtle" : "border-line bg-surface hover:bg-surface-sunken")}
          >
            <span className="block text-2xs text-ink-muted">{c.label}</span>
            <span className="text-lg font-semibold tabular-nums text-ink">{c.n}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, late: f.late === "yes" ? "" : "yes" }))}
          className={cn("cursor-pointer rounded-md border px-3 py-2 text-left", filters.late === "yes" ? "border-warning bg-warning-subtle" : "border-line bg-surface hover:bg-surface-sunken")}
        >
          <span className="block text-2xs text-ink-muted">Late</span>
          <span className="text-lg font-semibold tabular-nums text-ink">{late}</span>
        </button>
      </div>
      <p className="mb-2 text-2xs text-ink-muted">
        {dateText(data.today, "long")} · before office time ({data.rules.shift.start}) people not yet in show as Not in; a single punch shows as Missing punch until they check out.
      </p>
      <FilterStrip
        id="attendance-today"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[{ id: "department", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) }]}
      />
      <DataGrid
        id="attendance-today"
        label="Today's attendance"
        columns={columns}
        rows={visible}
        getRowId={(r) => r.employee.id}
        defaultSort={{ columnId: "name", direction: "asc" }}
        pageSize={100}
        rowTone={(r) => (r.day.dayType === "missing_punch" ? "warning" : undefined)}
        empty={{ title: "Nobody to show", description: "Clear the filters, or check the branch filter above." }}
      />
    </div>
  );
}
