"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NepaliDatePicker } from "@/components/ui/nepali-date";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { cn, slugify } from "@/lib/utils";
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
  status: "Active" | "Inactive";
}

const EMPTY_FORM: FormState = {
  label: "",
  slug: "",
  slugTouched: false,
  fromMonth: 4, // Shrawan — sensible default for the Nepali fiscal cycle
  toMonth: 3, // Asar
  startDateAD: null as unknown as Date,
  endDateAD: null as unknown as Date,
  status: "Active",
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
    status: fy.status === "Inactive" ? "Inactive" : "Active",
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
    ? "Update the fiscal year details and operational status."
    : "Define a new Bikram Sambat fiscal year. Choose whether it should be Active or Inactive.";
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
      status: form.status,
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
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isEdit ? `Editing: ${form.label || "Fiscal Year"}` : "New fiscal year"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="fiscal-year-form"
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="fiscal-year-form"
        onSubmit={handleSubmit}
        className="space-y-6"
        noValidate
      >
        {/* Section 1: Fiscal Identity */}
        <FormSection
          title="Fiscal Identity"
          description="Official display title and system URL identifier."
          isFirst
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id={fieldId.label}
              label="Fiscal Year Label *"
              placeholder="e.g. FY 2082/83"
              value={form.label}
              onChange={updateLabel}
              error={errors.label}
            />
            <TextField
              id={fieldId.slug}
              label="System Slug *"
              placeholder="fy-2082-83"
              value={form.slug}
              onChange={updateSlug}
              error={errors.slug}
            />
          </div>
        </FormSection>

        {/* Section 2: Month Span */}
        <FormSection
          title="Cycle Span"
          description="Starting and concluding Bikram Sambat months."
        >
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
        </FormSection>

        {/* Section 3: Dates */}
        <FormSection
          title="Calendar Boundaries"
          description={calendarNote}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </FormSection>

        {/* Section 4: Status */}
        <FormSection
          title="Operational Status"
          description="Designate whether this fiscal year is currently active."
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, status: "Active" }))}
              className={cn(
                "p-3 rounded-md border text-left transition-all cursor-pointer",
                form.status === "Active"
                  ? "border-emerald-700/60 bg-emerald-50/50 ring-1 ring-emerald-700/20"
                  : "border-zinc-200 hover:bg-zinc-50 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900">Active</p>
                  <p className="text-[11px] text-zinc-500">Current operating cycle</p>
                </div>
                {form.status === "Active" && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 shrink-0" />
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, status: "Inactive" }))}
              className={cn(
                "p-3 rounded-md border text-left transition-all cursor-pointer",
                form.status === "Inactive"
                  ? "border-zinc-800 bg-zinc-50 ring-1 ring-zinc-800/20"
                  : "border-zinc-200 hover:bg-zinc-50 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900">Inactive</p>
                  <p className="text-[11px] text-zinc-500">Archived or upcoming</p>
                </div>
                {form.status === "Inactive" && (
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 shrink-0" />
                )}
              </div>
            </button>
          </div>
        </FormSection>
      </form>
    </Dialog>
  );
}

function inputClass(hasError: boolean) {
  return [
    "h-9 w-full rounded-md border bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 transition-colors",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-zinc-200 focus:border-emerald-700 focus:ring-emerald-700",
  ].join(" ");
}

function FormSection({
  title,
  description,
  children,
  isFirst = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-3", !isFirst && "pt-5 border-t border-zinc-200")}>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h4>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
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
        className="mb-1.5 block text-xs font-semibold text-zinc-700"
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
