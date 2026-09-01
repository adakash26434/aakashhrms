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
  DEPARTMENT_STATUSES,
  formatStatus,
  type Department,
  type DepartmentFormData,
  type DepartmentStatus,
} from "@/lib/types/department";

interface DepartmentFormModalProps {
  open: boolean;
  /** When set, the modal edits this department; otherwise creates a new one. */
  editingDepartment: Department | null;
  branches: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: DepartmentFormData) => void;
}

type FormErrors = Partial<
  Record<"code" | "name" | "branchId" | "headName" | "description" | "status", string>
>;

interface FormState {
  code: string;
  name: string;
  branchId: string;
  headName: string;
  description: string;
  status: DepartmentStatus;
}

function buildInitialForm(editing: Department | null): FormState {
  if (editing) {
    return {
      code: editing.code,
      name: editing.name,
      branchId: editing.branchId,
      headName: editing.headName,
      description: editing.description,
      status: editing.status,
    };
  }
  return {
    code: "",
    name: "",
    branchId: "",
    headName: "",
    description: "",
    status: "active",
  };
}

function toPayload(state: FormState): DepartmentFormData {
  return {
    code: state.code.trim(),
    name: state.name.trim(),
    branchId: state.branchId,
    headName: state.headName.trim(),
    description: state.description.trim(),
    status: state.status,
  };
}

/**
 * Local-only validation. Mirrors the engine's rules for the
 * fields the engine also checks, so the user gets instant
 * feedback as they type. Cross-field checks (e.g. uniqueness
 * against the existing list) are deferred to the service
 * layer so the engine stays the single source of truth.
 */
function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.code.trim()) {
    errors.code = "Department Code is required.";
  } else if (state.code.trim().length < 2 || state.code.trim().length > 10) {
    errors.code = "Department Code must be 2–10 characters.";
  } else if (!/^[A-Za-z0-9-]+$/.test(state.code.trim())) {
    errors.code = "Use letters, digits, or hyphens only.";
  }
  if (!state.name.trim()) {
    errors.name = "Department Name is required.";
  } else if (state.name.trim().length > 60) {
    errors.name = "Department Name must be 60 characters or less.";
  }
  if (!state.branchId.trim()) {
    errors.branchId = "Branch is required.";
  }
  if (!state.headName.trim()) {
    errors.headName = "Head of Department is required.";
  } else if (state.headName.trim().length < 2) {
    errors.headName = "Head of Department must be at least 2 characters.";
  } else if (state.headName.trim().length > 80) {
    errors.headName = "Head of Department must be 80 characters or less.";
  }
  if (state.description.length > 500) {
    errors.description = "Description must be 500 characters or less.";
  }
  return errors;
}

/**
 * Form modal for creating and editing a single department.
 *
 * Sections (numbered 1-4, mirroring the design screenshot):
 *   1. Basic Information — Code, Name
 *   2. Organizational Placement — Branch, Head of Department
 *   3. Description (multi-line)
 *   4. Status — segmented Active / Inactive
 */
export function DepartmentFormModal({
  open,
  editingDepartment,
  branches,
  onClose,
  onSubmit,
}: DepartmentFormModalProps) {
  const isEdit = Boolean(editingDepartment);

  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(editingDepartment),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const title = isEdit ? "Edit Department" : "New Department";
  const description = isEdit
    ? `Update details and configuration for ${editingDepartment!.name}`
    : "Define a new organizational department";
  const submitLabel = isEdit ? "Update Department" : "Create Department";

  // Reset the form when the modal opens for a new target.
  // We use the `key` prop on the Dialog from the parent to
  // force a remount, so this effect is a safety net.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateLocal(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(toPayload(form));
  }

  // Branch options for the picker — always include a
  // disabled "Select a branch" sentinel at the top so the
  // field doesn't open with an empty selection.
  const branchOptions: DropdownOption<string>[] = branches.map((b) => ({
    value: b.id,
    label: b.name,
  }));
  const selectedBranch = branchOptions.find((b) => b.value === form.branchId);

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
            {isEdit ? `Department Code: ${editingDepartment!.code}` : "New department"}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="department-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="department-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        {/* === 1. Basic Information ============================== */}
        <FormSection
          number={1}
          title="Basic Information"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="dept-code"
              label="Department Code *"
              error={errors.code}
            >
              <input
                id="dept-code"
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="e.g. ENG"
                className={cn(
                  "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
                  errors.code
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
                )}
              />
            </Field>

            <Field
              id="dept-name"
              label="Department Name *"
              error={errors.name}
            >
              <input
                id="dept-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Engineering"
                className={cn(
                  "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
                  errors.name
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
                )}
              />
            </Field>
          </div>
        </FormSection>

        {/* === 2. Organizational Placement ====================== */}
        <FormSection number={2} title="Organizational Placement">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="dept-branch"
              label="Branch"
              error={errors.branchId}
            >
              <DropdownMenu<string>
                value={form.branchId}
                onChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
                options={branchOptions}
                ariaLabel="Department branch"
                minWidth={220}
                renderTrigger={({
                  open,
                  selected,
                  triggerRef,
                  toggle,
                }) => (
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={cn(
                      "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1 flex items-center justify-between",
                      errors.branchId
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                        : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
                    )}
                  >
                    <span className="flex-1 truncate text-left">
                      {selectedBranch?.label ?? "Select branch"}
                    </span>
                    <span className="ml-2 inline-flex items-center gap-1.5 text-gray-500">
                      {selectedBranch && (
                        <Building2 className="h-3.5 w-3.5 text-[#2e7d32]" />
                      )}
                      <span aria-hidden>▾</span>
                    </span>
                    {/* unused but typed: keep selected in scope for clarity */}
                    {void selected}
                  </button>
                )}
              />
            </Field>

            <Field
              id="dept-head"
              label="Head of Department *"
              error={errors.headName}
            >
              <input
                id="dept-head"
                type="text"
                value={form.headName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, headName: e.target.value }))
                }
                placeholder="e.g. Pratima Shrestha"
                className={cn(
                  "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
                  errors.headName
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
                )}
              />
            </Field>
          </div>
        </FormSection>

        {/* === 3. Description ==================================== */}
        <FormSection number={3} title="Description">
          <textarea
            id="dept-description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Brief description of the department's function and responsibilities..."
            rows={4}
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
              errors.description
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
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
            aria-label="Department status"
            className="inline-flex rounded-lg border border-[#d7e8d0]/80 bg-white p-1"
          >
            {DEPARTMENT_STATUSES.map((s) => {
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
                        ? "bg-[#2e7d32] text-white shadow-sm"
                        : "bg-gray-700 text-white shadow-sm"
                      : "text-[#1b3a1f] hover:bg-[#f6faf6]",
                  )}
                >
                  {formatStatus(s)}
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
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d7e8d0]/60 text-[10px] font-semibold text-[#1b3a1f]">
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
