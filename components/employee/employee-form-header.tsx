"use client";

import { StatusChip } from "@/components/kit/status-chip";
import { calculateAgeInYears, parseLocalDateParts, tenureLabel, type SectionProgress } from "@/lib/engines/employee.engine";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeFormContext, EmployeeFormData } from "@/lib/types/employee";
import { cn } from "@/lib/utils";
import { initials } from "./employee-quick-view";

/**
 * Record header of the editor: the card being filled in, updated as you type
 * (name, codes, placement), with an overall "required fields" meter, so the
 * form reads as one record rather than a list of boxes.
 */
export function EmployeeFormHeader({
  form,
  ctx,
  isNew,
  progress,
}: {
  form: EmployeeFormData;
  ctx: EmployeeFormContext;
  isNew: boolean;
  progress: SectionProgress[];
}) {
  const filled = progress.reduce((n, p) => n + p.filled, 0);
  const required = progress.reduce((n, p) => n + p.required, 0);
  const errors = progress.reduce((n, p) => n + p.errors, 0);
  const pct = required ? Math.round((filled / required) * 100) : 100;
  const name = form.fullName.trim();
  // Live facts worked out from what has been typed: age and length of service.
  const today = nepalToday();
  const dob = parseLocalDateParts(form.dateOfBirth);
  const age = dob ? calculateAgeInYears(dob, today) : null;
  const service = form.joiningDate ? tenureLabel(form.joiningDate, today) : "";
  const live = [age !== null && age >= 0 && age < 120 ? `Age ${age}` : null, service ? `Service ${service}` : null].filter(Boolean);
  const placement = [
    ctx.designations.find((d) => d.id === form.designationId)?.name,
    ctx.departments.find((d) => d.id === form.departmentId)?.name,
    ctx.branches.find((b) => b.id === form.branchId)?.name,
  ].filter(Boolean);

  return (
    <section aria-label="Record summary" className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line-card bg-surface px-4 py-3 shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
            name ? "bg-brand-subtle text-brand-strong" : "border border-dashed border-line-strong text-ink-faint"
          )}
        >
          {name ? initials(name) : "?"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
            <span className={cn("truncate", !name && "font-normal italic text-ink-faint")}>{name || (isNew ? "New employee" : "No name")}</span>
            <StatusChip status={isNew ? "draft" : ctx.initial.status} label={isNew ? "New" : undefined} />
          </p>
          <p className="truncate font-code text-2xs text-ink-muted">
            {form.employeeCode || "—"} · Att. {form.attendanceCode || "—"}
          </p>
          <p className="truncate text-2xs text-ink-muted">
            {placement.length ? placement.join(" · ") : "Department, designation and branch not chosen yet"}
            {live.length > 0 && <span className="ml-2 font-medium text-ink">· {live.join(" · ")}</span>}
          </p>
        </div>
      </div>

      <div className="w-full sm:w-64">
        <div className="mb-1 flex items-baseline justify-between text-2xs">
          <span className="text-ink-muted">Required fields</span>
          <span className={cn("font-medium tabular-nums", errors ? "text-danger" : pct === 100 ? "text-success" : "text-ink")}>
            {errors ? `${errors} to fix · ` : ""}
            {filled} of {required}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={required} aria-valuenow={filled} aria-label="Required fields filled">
          <div className={cn("h-full rounded-full transition-[width]", errors ? "bg-danger" : pct === 100 ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  );
}
