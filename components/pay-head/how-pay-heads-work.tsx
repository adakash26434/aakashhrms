import { Info } from "lucide-react";

/**
 * Info card at the bottom of the Pay Head Setup page.
 *
 * Explains how pay heads interact with payroll processing —
 * which flags trigger which computations and the SSF/PF
 * redirect rule from System Control. Pure presentational.
 */
export function HowPayHeadsWork() {
  return (
    <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50">
          <Info className="h-3.5 w-3.5 text-[#2e7d32]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1b3a1f]">
            How pay heads work
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Each pay head can carry multiple flags that determine its
            behavior during payroll processing. Festival allowance is
            triggered from the payslip generation screen. TDS, PF, and
            SSF heads are automatically computed based on the tax rate
            setup and statutory limits configured in System Control. When
            the SSF toggle is ON in System Control, the 1% PF employee
            contribution is redirected to SSF.
          </p>
        </div>
      </div>
    </div>
  );
}
