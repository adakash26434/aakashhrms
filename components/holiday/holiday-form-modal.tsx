"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BSDatePicker } from "@/components/ui/bs-date-picker";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  type DropdownOption,
} from "@/components/ui/dropdown-menu";
import { bsStringToAD } from "@/lib/utils/bs-calendar";
import {
  HOLIDAY_CATEGORIES,
  HOLIDAY_CATEGORY_META,
  formatCategory,
  type Holiday,
  type HolidayCategory,
  type HolidayFormData,
} from "@/lib/types/holiday";

interface HolidayFormModalProps {
  open: boolean;
  editingHoliday: Holiday | null;
  branches: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: HolidayFormData) => void;
}

type FormErrors = Partial<
  Record<
    "name" | "category" | "startDate" | "endDate" | "branchIds" | "dateOrder",
    string
  >
>;

interface FormState {
  name: string;
  category: HolidayCategory;
  startDate: string;
  endDate: string;
  branchIds: string[];
}

function buildInitialForm(editing: Holiday | null): FormState {
  if (editing) {
    return {
      name: editing.name,
      category: editing.category,
      startDate: editing.startDate,
      endDate: editing.endDate,
      branchIds: editing.branchIds.length > 0 ? editing.branchIds : [],
    };
  }
  return {
    name: "",
    category: "major-festival",
    startDate: "",
    endDate: "",
    branchIds: [],
  };
}

function toPayload(state: FormState): HolidayFormData {
  return {
    name: state.name.trim(),
    category: state.category,
    startDate: state.startDate.trim(),
    endDate: state.endDate.trim(),
    startDateAD: bsStringToAD(state.startDate.trim()) || new Date(),
    endDateAD: bsStringToAD(state.endDate.trim()) || new Date(),
    branchIds: state.branchIds,
  };
}

function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.name.trim()) {
    errors.name = "Holiday Name is required.";
  } else if (state.name.trim().length > 60) {
    errors.name = "Holiday Name must be 60 characters or less.";
  }
  if (!state.startDate.trim()) {
    errors.startDate = "Start date is required.";
  }
  if (!state.endDate.trim()) {
    errors.endDate = "End date is required.";
  }
  if (state.startDate && state.endDate && state.startDate > state.endDate) {
    errors.dateOrder = "End date cannot be before start date.";
  }
  return errors;
}

const CATEGORY_OPTIONS: DropdownOption<HolidayCategory>[] = HOLIDAY_CATEGORIES.map(
  (c) => ({ value: c, label: formatCategory(c) }),
);

/**
 * Form modal for creating and editing a single holiday.
 *
 * Sections:
 *   1. Basic Information — Name, Category
 *   2. Date Range — Start date, End date (BS picker with AD preview)
 *   3. Applicable Branches — checkbox grid (empty = "All Branches")
 */
export function HolidayFormModal({
  open,
  editingHoliday,
  branches,
  onClose,
  onSubmit,
}: HolidayFormModalProps) {
  const isEdit = Boolean(editingHoliday);

  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(editingHoliday),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const title = isEdit ? "Edit Holiday" : "New Holiday";
  const description = isEdit
    ? `Editing ${editingHoliday!.name}`
    : "Configure a new holiday — name, category, BS date range, and applicable branches.";
  const submitLabel = isEdit ? "Save Changes" : "Create Holiday";

  function toggleBranch(id: string) {
    setForm((f) => {
      const isAll = f.branchIds.length === 0;
      if (isAll) {
        return {
          ...f,
          branchIds: branches.map((b) => b.id).filter((b) => b !== id),
        };
      }
      const has = f.branchIds.includes(id);
      return {
        ...f,
        branchIds: has
          ? f.branchIds.filter((b) => b !== id)
          : [...f.branchIds, id],
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateLocal(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(toPayload(form));
  }

  // Derived
  const allBranchesChecked = form.branchIds.length === 0;
  const selectedBranchCount = allBranchesChecked
    ? branches.length
    : form.branchIds.length;

  // Sync start to end (and end to start) for single-day UX
  function handleStartChange(v: string) {
    setForm((f) => ({
      ...f,
      startDate: v,
      // If end is empty or before the new start, push end up to start
      // for the common single-day case.
      endDate: !f.endDate || f.endDate < v ? v : f.endDate,
    }));
  }

  function handleEndChange(v: string) {
    setForm((f) => ({ ...f, endDate: v }));
  }

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
            {isEdit ? `Editing: ${editingHoliday!.name}` : "New holiday"}
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
              form="holiday-form"
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="holiday-form"
        onSubmit={handleSubmit}
        className="space-y-6"
        noValidate
      >
        {/* === Basic Information ============================== */}
        <FormSection
          title="Basic Information"
          description="Holiday public name and legislative holiday category."
          isFirst
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="hol-name"
              label="Holiday Name *"
              error={errors.name}
            >
              <input
                id="hol-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Dashain"
                className={inputClass(errors.name)}
              />
            </Field>

            <Field id="hol-category" label="Category *">
              <DropdownMenu<HolidayCategory>
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                options={CATEGORY_OPTIONS}
                ariaLabel="Holiday category"
                minWidth={220}
                renderTrigger={({ open, selected, triggerRef, toggle }) => (
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={cn(
                      inputClass(),
                      "flex items-center justify-between cursor-pointer"
                    )}
                  >
                    <span className="flex-1 text-left">
                      {selected?.label ?? "Select category"}
                    </span>
                    <span className="text-zinc-400">▾</span>
                  </button>
                )}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {HOLIDAY_CATEGORY_META[form.category].description}
          </p>
        </FormSection>

        {/* === Date Range ======================================= */}
        <FormSection
          title="Date Range (BS)"
          description="Pick the start and end dates. The AD equivalent is shown live for verification."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="hol-start"
              label="Start Date *"
              error={errors.startDate}
            >
              <BSDatePicker
                value={form.startDate}
                onChange={handleStartChange}
                hasError={Boolean(errors.startDate)}
                ariaLabel="Holiday start date"
                idPrefix="hol-start"
              />
            </Field>

            <Field
              id="hol-end"
              label="End Date *"
              error={errors.endDate}
            >
              <BSDatePicker
                value={form.endDate}
                onChange={handleEndChange}
                hasError={Boolean(errors.endDate)}
                ariaLabel="Holiday end date"
                idPrefix="hol-end"
              />
            </Field>
          </div>
          {errors.dateOrder && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {errors.dateOrder}
            </p>
          )}
        </FormSection>

        {/* === Applicable Branches ============================== */}
        <FormSection
          title="Applicable Branches"
          description="Designate specific branches or leave all selected to apply organization-wide."
        >
          <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-300/60">
              <span className="text-xs font-semibold text-zinc-900">
                Apply For: Branch{" "}
                <span className="text-zinc-500 font-normal">
                  ({selectedBranchCount} of {branches.length} selected)
                </span>
              </span>
              <div className="flex items-center gap-2 text-2xs">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, branchIds: [] }))}
                  className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  All
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      branchIds: branches.map((b) => b.id).slice(0, 1),
                    }))
                  }
                  className="font-medium text-zinc-500 hover:text-zinc-700 hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-55 overflow-y-auto pr-1">
              {branches.map((b) => {
                const checked =
                  allBranchesChecked || form.branchIds.includes(b.id);
                return (
                  <CheckboxPill
                    key={b.id}
                    id={`hol-branch-${b.id}`}
                    label={b.name}
                    checked={checked}
                    onChange={() => toggleBranch(b.id)}
                  />
                );
              })}
            </div>
          </div>
        </FormSection>
      </form>
    </Dialog>
  );
}

function inputClass(error?: string): string {
  return cn(
    "h-9 w-full rounded-md border bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 transition-colors",
    error
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-zinc-200 focus:border-payroll-primary focus:ring-payroll-primary",
  );
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

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
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

function CheckboxPill({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors min-w-0 select-none",
        checked
          ? "border-payroll-primary/40 bg-payroll-primary-light text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked ? "border-payroll-primary bg-payroll-primary text-white" : "border-zinc-300 bg-white",
        )}
        aria-hidden
      >
        {checked && (
          <svg
            viewBox="0 0 16 16"
            className="h-2.5 w-2.5 text-white"
            fill="currentColor"
          >
            <path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" />
          </svg>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="truncate font-medium text-zinc-900">{label}</span>
    </label>
  );
}
