"use client";

import { RotateCcw } from "lucide-react";
import { DateField } from "@/components/kit/date-field";
import { GridField } from "@/components/kit/form-grid";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/kit/property-form";
import { codeConflicts, getNextAttendanceCode, getNextEmployeeCode } from "@/lib/engines/employee.engine";
import { ChoiceField, FormSection, TextField, YesNo, label, type EmployeeFormApi } from "./employee-form-fields";
import { EmployeePhotoField } from "./employee-form-photo";

const GENDERS = ["Male", "Female", "Other"].map((g) => ({ value: g, label: g }));
const TAX_STATUSES = [
  { value: "Normal Single", label: "Single" },
  { value: "Married", label: "Married (couple slab)" },
  { value: "Widow", label: "Widow / widower" },
];

/** General: name, codes and the personal details that decide tax. */
export function EmployeeFormIdentification({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set, ctx, isNew } = api;
  // Live duplicate hint against every code in the company (the save re-checks).
  const live = codeConflicts(ctx.codes, form, ctx.employeeId);

  return (
    <FormSection id="general" title="General" description="Codes are filled with the next free ones and are unique across the company.">
      {/* Photo and full name share the first row; the two codes always share the next one. */}
      <EmployeePhotoField api={api} />
      <TextField api={api} field="fullName" required size="lg" span={2} placeholder="As on the citizenship certificate" autoFocus={isNew} />

      <GridField label={label("employeeCode")} required error={errors.employeeCode ?? live.employeeCode} size="lg">
        <CodeInput
          name="employeeCode"
          value={form.employeeCode}
          onChange={(v) => set("employeeCode", v)}
          onNext={() => set("employeeCode", getNextEmployeeCode(ctx.codes.map((c) => c.employeeCode)))}
        />
      </GridField>
      <GridField
        label={label("attendanceCode")}
        required
        error={errors.attendanceCode ?? live.attendanceCode}
        help="The code used on the attendance device."
        size="lg"
      >
        <CodeInput
          name="attendanceCode"
          value={form.attendanceCode}
          onChange={(v) => set("attendanceCode", v)}
          onNext={() => set("attendanceCode", getNextAttendanceCode(ctx.codes.map((c) => c.attendanceCode), "ATD-"))}
        />
      </GridField>
      <ChoiceField api={api} field="gender" options={GENDERS} required size="sm" />
      <GridField label={label("dateOfBirth")} required error={errors.dateOfBirth} help="Must be 18 or older (Labour Act). Type YYYY/MM/DD or press Alt+↓." size="date">
        <DateField name="dateOfBirth" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
      </GridField>

      <ChoiceField api={api} field="taxStatus" options={TAX_STATUSES} required help="Decides the income tax slab. Married needs the spouse's name under Family." />
      <YesNo api={api} field="isDisabled" help="Yes applies the disability tax relief." />
    </FormSection>
  );
}

function CodeInput({
  name,
  value,
  onChange,
  onNext,
  id,
  ...aria
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <input
        id={id}
        name={name}
        autoComplete="off"
        spellCheck={false}
        maxLength={30}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, "w-36 max-w-none shrink-0 font-code")}
        {...aria}
      />
      <button
        type="button"
        data-enter-skip
        onClick={onNext}
        title="Use the next free code"
        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2 text-2xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
      >
        <RotateCcw aria-hidden className="h-3 w-3" /> Next free
      </button>
    </div>
  );
}
