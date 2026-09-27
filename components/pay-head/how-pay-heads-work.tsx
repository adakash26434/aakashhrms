import { Info } from "lucide-react";

/**
 * Explains how salary pay heads interact with the payroll computation engine.
 */
export function HowPayHeadsWork() {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60">
          <Info className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-slate-900">
            How salary pay heads interact with payroll calculations
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Each pay head carries specific calculation basis and compliance rules. Festival allowance (Dashain bonus) is computed during festival payroll runs. TDS, PF, CIT, and SSF heads are dynamically resolved according to progressive tax slabs and statutory limits configured in Statutory rules. When the SSF redirection toggle is active, 1% PF employee deduction redirects to Social Security Fund.
          </p>
        </div>
      </div>
    </div>
  );
}
