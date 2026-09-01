"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NepaliDatePicker } from "@/components/ui/nepali-date";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { slugify } from "@/lib/utils";
import {
  BS_MONTHS_EN,
  type BSMonthNumber,
} from "@/lib/utils/bs-calendar";
import type {
  FiscalYear,
  FiscalYearFormData,
} from "@/lib/types/fiscal-year";

interface FiscalYearFormModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * When provided, the modal opens in **edit mode** and pre-fills its
   * fields with this row's values. When `null`/`undefined`, it opens
   * in **create mode** with empty fields.
   *
   * Note: the parent should pass a `key` (e.g. `editingFY?.id ?? "new"`)
   * so the form is fully reset when switching between rows.
   */
  initialValue?: FiscalYear | null;
  /** Called with the validated form payload on submit. */
  onSubmit: (data: FiscalYearFormData) => void;
}

type FormErrors = Partial<
  Record<
    | keyof FiscalYearFormData
    | "startYear"
    | "endYear"
    | "endAfterStart"
    | "monthRange",
    string
  >
>;

interface FormState extends Omit<FiscalYearFormData, "fromMonth" | "toMonth"> {
  slugTouched: boolean;
  fromMonth: BSMonthNumber | "";
  toMonth: BSMonthNumber | "";
}

const EMPTY_FORM: FormState = {
  label: "",
  slug: "",
  slugTouched: false,
  fromMonth: 4, // Shrawan — sensible default for the Nepali fiscal cycle
  toMonth: 3, // Asar
  startDateAD: null as unknown as Date,
  endDateAD: null as unknown as Date,
};

function fromFiscalYear(fy: FiscalYear): FormState {
  return {
    label: fy.label,
    slug: fy.slug,
    slugTouched: true, // pre-filled slugs are treated as already "touched"
    fromMonth: fy.fromMonth,
    toMonth: fy.toMonth,
    startDateAD: fy.startDateAD,
    endDateAD: fy.endDateAD,
  };
}

/**
 * Form modal for both creating and editing a fiscal year.
 *
 * In edit mode (when `initialValue` is provided) the title and submit
 * button label switch accordingly, and the form is pre-filled.
 */
export function FiscalYearFormModal({
  open,
  onClose,
  initialValue,
  onSubmit,
}: FiscalYearFormModalProps) {
  const isEdit = Boolean(initialValue);

  const [form, setForm] = useState<FormState>(
    initialValue ? fromFiscalYear(initialValue) : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // When the label changes, auto-derive the slug unless the user has
  // already manually edited the slug field.
  function updateLabel(label: string) {
    setForm((f) => ({
      ...f,
      label,
      slug: f.slugTouched ? f.slug : slugify(label),
    }));
  }

  function updateSlug(slug: string) {
    setForm((f) => ({ ...f, slug, slugTouched: true }));
  }

  const { isAD } = useDateFormat();
  const title = isEdit ? "Edit Fiscal Year" : "New Fiscal Year";
  const description = isEdit
    ? "Update the fiscal year details. Payslip status cannot be changed here."
    : "Define a new Bikram Sambat fiscal year. The new year will start as Active.";
  const submitLabel = isEdit ? "Save Changes" : "Create Fiscal Year";
  const startDateLabel = isAD ? "Start Date" : "Start Date (B.S.)";
  const endDateLabel = isAD ? "End Date" : "End Date (B.S.)";
  const calendarNote = isAD
    ? "Dates are entered in A.D. but stored as AD in the database — the system displays them as AD."
    : "Dates are entered in the Bikram Sambat (B.S.) calendar but stored as AD in the database — the system displays them in BS.";

  function validate(values: FiscalYearFormData): FormErrors {
    const next: FormErrors = {};
    if (!values.label.trim()) next.label = "Label is required.";
    if (!values.slug.trim()) {
      next.slug = "Slug is required.";
    } else if (!/^[a-z0-9-]+$/.test(values.slug)) {
      next.slug = "Slug must be lowercase letters, numbers, and hyphens only.";
    }
    if (!(values.startDateAD instanceof Date) || isNaN(values.startDateAD.getTime())) {
      next.startDateAD = "Start date is required.";
    }
    if (!(values.endDateAD instanceof Date) || isNaN(values.endDateAD.getTime())) {
      next.endDateAD = "End date is required.";
    }
    if (
      values.startDateAD instanceof Date &&
      values.endDateAD instanceof Date &&
      !isNaN(values.startDateAD.getTime()) &&
      !isNaN(values.endDateAD.getTime()) &&
      values.endDateAD.getTime() <= values.startDateAD.getTime()
    ) {
      next.endDateAD = "End date must be after the start date.";
    }
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: FiscalYearFormData = {
      label: form.label.trim(),
      slug: form.slug.trim(),
      fromMonth:
        typeof form.fromMonth === "number" ? form.fromMonth : (4 as BSMonthNumber),
      toMonth:
        typeof form.toMonth === "number" ? form.toMonth : (3 as BSMonthNumber),
      startDateAD: form.startDateAD,
      endDateAD: form.endDateAD,
    };
    const nextErrors = validate(payload);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(payload);
  }

  const fieldId = useMemo(() => {
    const prefix = isEdit ? "edit" : "new";
    return {
      label: `${prefix}-fy-label`,
      slug: `${prefix}-fy-slug`,
      fromMonth: `${prefix}-fy-from-month`,
      toMonth: `${prefix}-fy-to-month`,
      startDate: `${prefix}-fy-start-date`,
      endDate: `${prefix}-fy-end-date`,
    };
  }, [isEdit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="fiscal-year-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="fiscal-year-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        {/* Label + Slug */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id={fieldId.label}
            label="Fiscal Year Label"
            placeholder="e.g., FY 2082/83"
            value={form.label}
            onChange={updateLabel}
            error={errors.label}
          />
          <TextField
            id={fieldId.slug}
            label="Slug"
            placeholder="fy-2082-83"
            value={form.slug}
            onChange={updateSlug}
            error={errors.slug}
          />
        </div>

        {/* From / To month */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id={fieldId.fromMonth} label="From Month">
            <select
              id={fieldId.fromMonth}
              value={form.fromMonth === "" ? "" : String(form.fromMonth)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fromMonth:
                    e.target.value === ""
                      ? ""
                      : (Number(e.target.value) as BSMonthNumber),
                }))
              }
              className={inputClass(false)}
            >
              {BS_MONTHS_EN.slice(1).map((name, i) => {
                const m = (i + 1) as BSMonthNumber;
                return (
                  <option key={m} value={m}>
                    {name}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field id={fieldId.toMonth} label="To Month">
            <select
              id={fieldId.toMonth}
              value={form.toMonth === "" ? "" : String(form.toMonth)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  toMonth:
                    e.target.value === ""
                      ? ""
                      : (Number(e.target.value) as BSMonthNumber),
                }))
              }
              className={inputClass(false)}
            >
              {BS_MONTHS_EN.slice(1).map((name, i) => {
                const m = (i + 1) as BSMonthNumber;
                return (
                  <option key={m} value={m}>
                    {name}
                  </option>
                );
              })}
            </select>
          </Field>
        </div>

        {/* Dates — picker auto-switches between BS dropdowns and AD
            native input based on the active DateFormat. Stacked
            (single-column) so the BS picker's 3 dropdowns have full
            width and never overflow the modal. */}
        <div className="grid grid-cols-1 gap-4">
          <Field id={fieldId.startDate} label={startDateLabel}>
            <NepaliDatePicker
              value={
                form.startDateAD instanceof Date && !isNaN(form.startDateAD.getTime())
                  ? form.startDateAD
                  : null
              }
              onChange={(d) =>
                setForm((f) => ({ ...f, startDateAD: d }))
              }
              required
              error={errors.startDateAD}
              minBSYear={1976}
              maxBSYear={2100}
            />
          </Field>
          <Field id={fieldId.endDate} label={endDateLabel}>
            <NepaliDatePicker
              value={
                form.endDateAD instanceof Date && !isNaN(form.endDateAD.getTime())
                  ? form.endDateAD
                  : null
              }
              onChange={(d) =>
                setForm((f) => ({ ...f, endDateAD: d }))
              }
              required
              error={errors.endDateAD}
              minBSYear={1976}
              maxBSYear={2100}
            />
          </Field>
        </div>

        <p className="text-xs text-gray-500">{calendarNote}</p>
      </form>
    </Dialog>
  );
}

function inputClass(hasError: boolean) {
  return [
    "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f]",
    "focus:outline-none focus:ring-1",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
  ].join(" ");
}

interface TextFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}

function TextField({ id, label, placeholder, value, onChange, error }: TextFieldProps) {
  return (
    <Field id={id} label={label} error={error}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass(Boolean(error))}
      />
    </Field>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-gray-600"
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
