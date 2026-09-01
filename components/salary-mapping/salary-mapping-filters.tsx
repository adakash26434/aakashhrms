"use client";

import type { SalaryMappingFilter } from "@/lib/types/salary-mapping";

interface SalaryMappingFiltersProps {
  filter: SalaryMappingFilter;
  setFilter: (f: SalaryMappingFilter) => void;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}

const inputClass =
  "h-9 rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm text-[#1b3a1f] placeholder:text-gray-400 focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]";

export function SalaryMappingFilters({
  filter,
  setFilter,
  departments,
  branches,
}: SalaryMappingFiltersProps) {
  function update<K extends keyof SalaryMappingFilter>(
    key: K,
    value: SalaryMappingFilter[K],
  ) {
    setFilter({ ...filter, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <input
        type="search"
        placeholder="Search employee name or code..."
        value={filter.search}
        onChange={(e) => update("search", e.target.value)}
        className={`${inputClass} w-full min-w-0 sm:w-64`}
      />

      {/* Department filter */}
      <select
        value={filter.departmentId}
        onChange={(e) => update("departmentId", e.target.value)}
        className={`${inputClass} w-full sm:w-44`}
      >
        <option value="all">All Departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {/* Branch filter */}
      <select
        value={filter.branchId}
        onChange={(e) => update("branchId", e.target.value)}
        className={`${inputClass} w-full sm:w-44`}
      >
        <option value="all">All Branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}