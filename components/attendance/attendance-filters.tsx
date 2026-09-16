"use client";

import { Search, Calendar, RotateCcw, X, Loader2 } from "lucide-react";
import type { AttendanceFilter } from "@/lib/types/attendance";

interface AttendanceFiltersProps {
  filter: AttendanceFilter;
  setFilter: React.Dispatch<React.SetStateAction<AttendanceFilter>>;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  onDateChange?: (date: string) => void;
  onStatusChange?: (status: AttendanceFilter["status"]) => void;
  onLateOnlyChange?: (isLateOnly: boolean) => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  isLoading?: boolean;
}

export function AttendanceFilters({
  filter,
  setFilter,
  departments,
  branches,
  onDateChange,
  onStatusChange,
  onLateOnlyChange,
  onResetFilters,
  hasActiveFilters,
  isLoading = false,
}: AttendanceFiltersProps) {
  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (onDateChange) {
      onDateChange(val);
    } else {
      setFilter((f) => ({ ...f, date: val }));
    }
  }

  function handleStatusSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as AttendanceFilter["status"];
    if (onStatusChange) {
      onStatusChange(val);
    } else {
      setFilter((f) => ({ ...f, status: val }));
    }
  }

  function handleLateToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    if (onLateOnlyChange) {
      onLateOnlyChange(checked);
    } else {
      setFilter((f) => ({ ...f, isLateOnly: checked }));
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Search Input */}
      <div className="relative flex-1 min-w-65">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, employee code, or attendance code..."
          className="h-9 w-full rounded-lg border border-payroll-light bg-white pl-9 pr-8 text-sm focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none transition-colors"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
        />
        {filter.search && (
          <button
            type="button"
            onClick={() => setFilter((f) => ({ ...f, search: "" }))}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Date Selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-3 py-1.5 text-sm shadow-xs">
          <Calendar className="h-4 w-4 text-payroll-primary" />
          <input
            type="date"
            className="border-none bg-transparent text-sm focus:outline-none text-gray-700 cursor-pointer"
            value={filter.date}
            onChange={handleDateInput}
          />
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-payroll-primary" />}
        </div>

        {/* Department Filter */}
        <select
          className="h-9 rounded-lg border border-payroll-light bg-white px-3 text-sm focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none cursor-pointer"
          value={filter.departmentId}
          onChange={(e) => setFilter((f) => ({ ...f, departmentId: e.target.value }))}
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Branch Filter */}
        <select
          className="h-9 rounded-lg border border-payroll-light bg-white px-3 text-sm focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none cursor-pointer"
          value={filter.branchId}
          onChange={(e) => setFilter((f) => ({ ...f, branchId: e.target.value }))}
        >
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="h-9 rounded-lg border border-payroll-light bg-white px-3 text-sm focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary focus:outline-none cursor-pointer"
          value={filter.status}
          onChange={handleStatusSelect}
        >
          <option value="all">All Statuses</option>
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Half Day">Half Day</option>
          <option value="On Leave">On Leave</option>
          <option value="LWOP">LWOP (Unpaid)</option>
          <option value="Holiday">Holiday</option>
          <option value="Weekly Off">Weekly Off</option>
        </select>

        {/* Late Only Checkbox */}
        <label className="flex items-center gap-2 rounded-lg border border-payroll-light bg-white px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-gray-50 transition-colors select-none">
          <input
            type="checkbox"
            checked={filter.isLateOnly}
            onChange={handleLateToggle}
            className="rounded border-gray-300 text-payroll-primary focus:ring-payroll-primary"
          />
          <span>Late Only</span>
        </label>

        {/* Reset Filters button */}
        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-xs"
            title="Reset active search and filters"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}