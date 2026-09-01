import { Info } from "lucide-react";

/**
 * Info card at the bottom of the Department Setup page.
 *
 * Explains how departments form the organisational hierarchy,
 * how codes and branch assignments work, and how the KPI
 * counters are derived. Pure presentational.
 */
export function HowDepartmentsWork() {
  return (
    <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50">
          <Info className="h-3.5 w-3.5 text-[#2e7d32]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1b3a1f]">
            How departments work
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Departments are the second tier in the organisation hierarchy —
            every department belongs to exactly one branch and groups the
            designations (positions) and employees under it. Each department
            has a short alphacode (e.g. ENG, HR-ADM) that is used in reports
            and system identifiers, a named head of department, and an
            optional description. The KPI cards at the top show the total
            number of active and inactive departments alongside the
            aggregated designation and employee counts — these numbers are
            computed from the live data so they always reflect the current
            state. Deleting a department requires reassigning its
            designations and employees first.
          </p>
        </div>
      </div>
    </div>
  );
}