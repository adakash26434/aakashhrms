import { Info } from "lucide-react";

/**
 * Info card at the bottom of the Designation Setup page.
 *
 * Explains how designations relate to departments, how they
 * are used in pay-head applicability, and how the KPI
 * counters are derived. Pure presentational.
 */
export function HowDesignationsWork() {
  return (
    <div className="rounded-xl border border-payroll-border bg-white p-5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-payroll-primary-light-2">
          <Info className="h-3.5 w-3.5 text-payroll-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-payroll-navy">
            How designations work
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Designations (also called positions) are the roles employees
            hold within a department &mdash; for example, Senior Engineer
            belongs to the Engineering department. Each designation can
            have multiple employees assigned to it. Designations are the
            primary axis for pay-head applicability: when configuring a
            pay head (e.g. Manager Allowance), you select which
            designations it applies to. The employee count shown in the
            table and KPI cards reflects how many people currently hold
            each designation. Deleting a designation requires reassigning
            its employees first.
          </p>
        </div>
      </div>
    </div>
  );
}