import { Info } from "lucide-react";

/**
 * Info card at the bottom of the Holiday Setup page.
 *
 * Explains how holidays interact with payroll processing —
 * which categories affect which computations, how branch-
 * specific holidays work, and the BS/AD date convention.
 * Pure presentational.
 */
export function HowHolidaysWork() {
  return (
    <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50">
          <Info className="h-3.5 w-3.5 text-[#2e7d32]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1b3a1f]">
            How holidays work
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Each holiday has a Bikram Sambat (B.S.) date range and an
            optional set of applicable branches. Leave the branch
            picker empty to apply the holiday to every branch. Branch-
            specific holidays are useful for regional festivals like
            Chhath (observed in the Terai) or Indra Jatra (Kathmandu
            Valley). The total day count is used during payroll
            processing to compute working days and overtime. All
            stored dates are B.S.; the form and detail panel show
            their A.D. equivalent inline so you can verify against the
            Gregorian calendar.
          </p>
        </div>
      </div>
    </div>
  );
}
