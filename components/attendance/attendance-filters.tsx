"use client";

import { Search, Calendar } from "lucide-react";
import type { AttendanceFilter } from "@/lib/types/attendance";

interface AttendanceFiltersProps {
  filter: AttendanceFilter;
  setFilter: React.Dispatch<React.SetStateAction<AttendanceFilter>>;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}

export function AttendanceFilters({ filter, setFilter, departments, branches }: AttendanceFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, employee code, or attendance code..."
          className="h-9 w-full rounded-lg border border-[#d7e8d0] bg-white pl-9 pr-3 text-sm focus:border-[#2e7d32] focus:outline-none"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-[#d7e8d0] bg-white px-3 py-1.5 text-sm">
          <Calendar className="h-4 w-4 text-[#2e7d32]" />
          <input
            type="date"
            className="border-none bg-transparent text-sm focus:outline-none"
            value={filter.date}
            onChange={(e) => setFilter((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        <select
          className="h-9 rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm focus:border-[#2e7d32] focus:outline-none"
          value={filter.departmentId}
          onChange={(e) => setFilter((f) => ({ ...f, departmentId: e.target.value }))}
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </select>

        <select
          className="h-9 rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm focus:border-[#2e7d32] focus:outline-none"
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as AttendanceFilter["status"] }))}
        >
          <option value="all">All Statuses</option>
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Half Day">Half Day</option>
          <option value="On Leave">On Leave</option>
          <option value="LWOP">LWOP (Unpaid)</option>
          <option value="Holiday">Holiday</option>
        </select>

        <label className="flex items-center gap-2 rounded-lg border border-[#d7e8d0] bg-white px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={filter.isLateOnly}
            onChange={(e) => setFilter((f) => ({ ...f, isLateOnly: e.target.checked }))}
            className="rounded border-gray-300 text-[#2e7d32] focus:ring-[#2e7d32]"
          />
          <span>Late Only</span>
        </label>
      </div>
    </div>
  );
}