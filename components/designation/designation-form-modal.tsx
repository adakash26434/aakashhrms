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
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isEdit
              ? `Editing: ${editingDesignation!.name}`
              : "New designation"}
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
              form="designation-form"
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="designation-form"
        onSubmit={handleSubmit}
        className="space-y-6"
        noValidate
      >
        {/* === 1. Basic Information ============================== */}
        <FormSection
          title="Basic Information"
          description="Official job title and designation title."
          isFirst
        >
          <Field id="desig-name" label="Designation Name *" error={errors.name}>
            <input
              id="desig-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Senior Engineer"
              className={inputClass(errors.name)}
            />
          </Field>
        </FormSection>

        {/* === 2. Organisational Placement ====================== */}
        <FormSection
          title="Organizational Placement"
          description="Designate the operational department this role belongs to."
        >
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
                    inputClass(errors.departmentId),
                    "flex items-center justify-between cursor-pointer"
                  )}
                >
                  <span className="flex-1 truncate text-left">
                    {selectedDepartment?.label ?? "Select department"}
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1.5 text-zinc-400">
                    {selectedDepartment && (
                      <Building2 className="h-3.5 w-3.5 text-emerald-700" />
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
        <FormSection
          title="Role Overview"
          description="Key duties, reporting line, and core responsibilities."
        >
          <textarea
            id="desig-description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Brief description of the role's responsibilities and reporting line..."
            rows={4}
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 transition-colors",
              errors.description
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-zinc-200 focus:border-emerald-700 focus:ring-emerald-700",
            )}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.description}
            </p>
          )}
        </FormSection>

        {/* === 4. Status ========================================= */}
        <FormSection
          title="Operational Status"
          description="Designate whether this designation is active or archived."
        >
          <div
            role="radiogroup"
            aria-label="Designation status"
            className="inline-flex rounded-md border border-zinc-200 bg-white p-1"
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
                    "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    isActive
                      ? s === "active"
                        ? "bg-emerald-700 text-white shadow-none"
                        : "bg-zinc-800 text-white shadow-none"
                      : "text-zinc-700 hover:bg-zinc-50",
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

function inputClass(error?: string): string {
  return cn(
    "h-9 w-full rounded-md border bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 transition-colors",
    error
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-zinc-200 focus:border-emerald-700 focus:ring-emerald-700",
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
