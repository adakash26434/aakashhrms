"use client";

import { RotateCcw } from "lucide-react";
import { DateField } from "@/components/kit/date-field";
import { FieldRow, inputClass } from "@/components/kit/property-form";
import { codeConflicts, getNextAttendanceCode, getNextEmployeeCode } from "@/lib/engines/employee.engine";
import { CheckRow, FormSection, SelectRow, TextRow, label, type EmployeeFormApi } from "./employee-form-fields";

const GENDERS = ["Male", "Female", "Other"].map((g) => ({ value: g, label: g }));
const TAX_STATUSES = [
  { value: "Normal Single", label: "Single" },
  { value: "Married", label: "Married (couple slab)" },
  { value: "Widow", label: "Widow / widower" },
];

function NextCodeButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      data-enter-skip
      onClick={onClick}
      title={title}
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2 text-2xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      <RotateCcw aria-hidden className="h-3 w-3" /> Next free
    </button>
  );
}

/** Identification (codes, name) and Personal (birth date, gender, tax status). */
export function EmployeeFormIdentification({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set, ctx } = api;
  // Live duplicate hint against every code in the company (the save re-checks).
  const live = codeConflicts(ctx.codes, form, ctx.employeeId);

  return (
    <>
      <FormSection id="identification" title="Identification" description="Codes are unique across the company.">
        <FieldRow label={label("employeeCode")} required error={errors.employeeCode ?? live.employeeCode}>
          <CodeInput
            name="employeeCode"
            value={form.employeeCode}
            onChange={(v) => set("employeeCode", v)}
            onNext={() => set("employeeCode", getNextEmployeeCode(ctx.codes.map((c) => c.employeeCode)))}
          />
        </FieldRow>
        <FieldRow label={label("attendanceCode")} required error={errors.attendanceCode ?? live.attendanceCode} help="The code used on the attendance device.">
          <CodeInput
            name="attendanceCode"
            value={form.attendanceCode}
            onChange={(v) => set("attendanceCode", v)}
            onNext={() => set("attendanceCode", getNextAttendanceCode(ctx.codes.map((c) => c.attendanceCode), "ATD-"))}
          />
        </FieldRow>
        <TextRow api={api} field="fullName" required placeholder="As on the citizenship certificate" />
      </FormSection>

      <FormSection id="personal" title="Personal">
        <FieldRow label={label("dateOfBirth")} required error={errors.dateOfBirth} help="Must be 18 or older (Labour Act).">
          <DateField name="dateOfBirth" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
        </FieldRow>
        <SelectRow api={api} field="gender" options={GENDERS} required />
        <SelectRow api={api} field="taxStatus" options={TAX_STATUSES} required help="Decides the income tax slab. Married needs the spouse's name under Family." />
        <CheckRow api={api} field="isDisabled" text="Yes, apply the disability tax relief" />
      </FormSection>
    </>
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
    <div className="flex max-w-md gap-2">
      <input
        id={id}
        name={name}
        autoComplete="off"
        spellCheck={false}
        maxLength={30}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} font-code`}
        {...aria}
      />
      <NextCodeButton onClick={onNext} title="Use the next free code" />
    </div>
  );
}
