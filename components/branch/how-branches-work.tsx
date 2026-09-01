import { Info } from "lucide-react";

/**
 * Info card at the bottom of the Branches tab.
 *
 * Explains how branches function within the organisation
 * hierarchy, how they relate to departments and employees,
 * and how the KPI counters are derived.
 */
export function HowBranchesWork() {
  return (
    <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50">
          <Info className="h-3.5 w-3.5 text-[#2e7d32]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1b3a1f]">
            How branches work
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Branches represent physical office locations of the organisation.
            Every department and employee belongs to exactly one branch,
            making branches a key dimension for payroll scoping and reporting.
            Active branches are available for new departments and employee
            assignments, while inactive branches preserve historical records
            for existing employees. The KPI cards at the top show the total
            number of active and inactive branches across the organisation.
          </p>
        </div>
      </div>
    </div>
  );
}