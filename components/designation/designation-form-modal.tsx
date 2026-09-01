"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  type DropdownOption,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DESIGNATION_STATUSES,
  formatDesignationStatus,
  type Designation,
  type DesignationFormData,
  type DesignationStatus,
} from "@/lib/types/designation";

interface DesignationFormModalProps {
  open: boolean;
  editingDesignation: Designation | null;
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: DesignationFormData) => void;
}

type FormErrors = Partial<
  Record<"name" | "departmentId" | "description" | "status", string>
>;

interface FormState {
  name: string;
  departmentId: string;
  description: string;
  status: DesignationStatus;
}

function buildInitialForm(editing: Designation | null): FormState {
  if (editing) {
    return {
      name: editing.name,
      departmentId: editing.departmentId,
      description: editing.description,
      status: editing.status,
    };
  }
  return {
    name: "",
    departmentId: "",
    description: "",
    status: "active",
  };
}

function toPayload(state: FormState): DesignationFormData {
  return {
    name: state.name.trim(),
    departmentId: state.departmentId,
    description: state.description.trim(),
    status: state.status,
  };
}

function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.name.trim()) {
    errors.name = "Designation Name is required.";
  } else if (state.name.trim().length > 60) {
    errors.name = "Designation Name must be 60 characters or less.";
  }
  if (!state.departmentId.trim()) {
    errors.departmentId = "Department is required.";
  }
  if (state.description.length > 500) {
    errors.description = "Description must be 500 characters or less.";
  }
  return errors;
}

/**
 * Form modal for creating and editing a designation.
 *
 * Sections:
 *   1. Basic Information — Name
 *   2. Organisational Placement — Department
 *   3. Description (multi-line)
 *   4. Status — segmented Active / Inactive
 */
export function DesignationFormModal({
  open,
  editingDesignation,
  departments,
  onClose,
  onSubmit,
}: DesignationFormModalProps) {
  const isEdit = Boolean(editingDesignation);

  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(editingDesignation),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const title = isEdit ? "Edit Designation" : "New Designation";
  const description = isEdit
    ? `Update job position details for ${editingDesignation!.name}`
    : "Define a new job position within a department";
  const submitLabel = isEdit ? "Update Designation" : "Create Designation";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateLocal(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(toPayload(form));
  }

  const departmentOptions: DropdownOption<string>[] = departments.map((d) => ({
    value: d.id,
    label: d.name,
  }));
  const selectedDepartment = departmentOptions.find(
    (d) => d.value === form.departmentId,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="2xl"
      footer={
        <>
          <span className="mr-auto text-xs text-gray-500">
            {isEdit
              ? `Designation: ${editingDesignation!.name}`
              : "New designation"}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="designation-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="designation-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        {/* === 1. Basic Information ============================== */}
        <FormSection number={1} title="Basic Information">
          <Field id="desig-name" label="Designation Name *" error={errors.name}>
            <input
              id="desig-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Senior Engineer"
              className={cn(
                "h-9 w-full rounded-lg border bg-white px-3 text-sm text-payroll-navy focus:outline-none focus:ring-1",
                errors.name
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-payroll-light focus:border-payroll-primary focus:ring-payroll-primary",
              )}
            />
          </Field>
        </FormSection>

        {/* === 2. Organisational Placement ====================== */}
        <FormSection number={2} title="Organisational Placement">
          <Field
            id="desig-department"
            label="Department *"
            error={errors.departmentId}
          >
            <DropdownMenu<string>
              value={form.departmentId}
              onChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
              options={departmentOptions}
              ariaLabel="Designation department"
              minWidth={220}
              renderTrigger={({ open, selected, triggerRef, toggle }) => (
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={toggle}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  className={cn(
                    "h-9 w-full rounded-lg border bg-white px-3 text-sm text-payroll-navy focus:outline-none focus:ring-1 flex items-center justify-between",
                    errors.departmentId
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-payroll-light focus:border-payroll-primary focus:ring-payroll-primary",
                  )}
                >
                  <span className="flex-1 truncate text-left">
                    {selectedDepartment?.label ?? "Select department"}
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1.5 text-gray-500">
                    {selectedDepartment && (
                      <Building2 className="h-3.5 w-3.5 text-payroll-primary" />
                    )}
                    <span aria-hidden>▾</span>
                  </span>
                  {void selected}
                </button>
              )}
            />
          </Field>
        </FormSection>

        {/* === 3. Description ==================================== */}
        <FormSection number={3} title="Description">
          <textarea
            id="desig-description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Brief description of the role's responsibilities and reporting line..."
            rows={4}
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm text-payroll-navy focus:outline-none focus:ring-1",
              errors.description
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-payroll-light focus:border-payroll-primary focus:ring-payroll-primary",
            )}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.description}
            </p>
          )}
        </FormSection>

        {/* === 4. Status ========================================= */}
        <FormSection number={4} title="Status">
          <div
            role="radiogroup"
            aria-label="Designation status"
            className="inline-flex rounded-lg border border-payroll-light/80 bg-white p-1"
          >
            {DESIGNATION_STATUSES.map((s) => {
              const isActive = s === form.status;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? s === "active"
                        ? "bg-payroll-primary text-white shadow-sm"
                        : "bg-gray-700 text-white shadow-sm"
                      : "text-payroll-navy hover:bg-payroll-light",
                  )}
                >
                  {formatDesignationStatus(s)}
                </button>
              );
            })}
          </div>
        </FormSection>
      </form>
    </Dialog>
  );
}

function FormSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-payroll-light/60 text-[10px] font-semibold text-payroll-navy">
          {number}
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
      </div>
      {children}
    </section>
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
