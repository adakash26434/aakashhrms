"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PhoneInput } from "@/components/ui/phone-input";
import { validatePhoneNumber } from "@/lib/utils/phone";
import { cn } from "@/lib/utils";
import {
  BRANCH_STATUSES,
  formatBranchStatus,
  type Branch,
  type BranchFormData,
  type BranchStatus,
} from "@/lib/types/branch";

interface BranchFormModalProps {
  open: boolean;
  editingBranch: Branch | null;
  onClose: () => void;
  onSubmit: (data: BranchFormData) => void;
}

type FormErrors = Partial<
  Record<"code" | "name" | "location" | "phone" | "email" | "status", string>
>;

interface FormState {
  code: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  status: BranchStatus;
}

function buildInitialForm(editing: Branch | null): FormState {
  if (editing) {
    return {
      code: editing.code,
      name: editing.name,
      location: editing.location,
      phone: editing.phone,
      email: editing.email,
      status: editing.status,
    };
  }
  return {
    code: "",
    name: "",
    location: "",
    phone: "",
    email: "",
    status: "active",
  };
}

function toPayload(state: FormState): BranchFormData {
  return {
    code: state.code.trim(),
    name: state.name.trim(),
    location: state.location.trim(),
    phone: state.phone.trim(),
    email: state.email.trim(),
    status: state.status,
  };
}

function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.code.trim()) errors.code = "Branch Code is required.";
  else if (state.code.trim().length < 2 || state.code.trim().length > 10)
    errors.code = "Branch Code must be 2–10 characters.";
  else if (!/^[A-Za-z0-9-]+$/.test(state.code.trim()))
    errors.code = "Use letters, digits, or hyphens only.";
  if (!state.name.trim()) errors.name = "Branch Name is required.";
  else if (state.name.trim().length > 80)
    errors.name = "Branch Name must be 80 characters or less.";
  if (!state.location.trim()) errors.location = "Location is required.";
  if (state.phone.trim()) {
    const phoneRes = validatePhoneNumber(state.phone.trim(), false);
    if (!phoneRes.isValid) {
      errors.phone = phoneRes.error || "Invalid branch phone format.";
    }
  }
  return errors;
}

export function BranchFormModal({
  open,
  editingBranch,
  onClose,
  onSubmit,
}: BranchFormModalProps) {
  const isEdit = Boolean(editingBranch);
  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(editingBranch),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const title = isEdit ? "Edit Branch" : "New Branch";
  const description = isEdit
    ? `Update details and contact information for ${editingBranch!.name}`
    : "Define a new office location";
  const submitLabel = isEdit ? "Update Branch" : "Create Branch";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateLocal(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(toPayload(form));
  }

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
            {isEdit ? `Branch Code: ${editingBranch!.code}` : "New branch"}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="branch-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="branch-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        <FormSection number={1} title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="branch-code" label="Branch Code *" error={errors.code}>
              <input
                id="branch-code"
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="e.g. KTM"
                className={inputClass(errors.code)}
              />
            </Field>
            <Field id="branch-name" label="Branch Name *" error={errors.name}>
              <input
                id="branch-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Kathmandu HQ"
                className={inputClass(errors.name)}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection number={2} title="Location & Contact">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="branch-location"
              label="Location *"
              error={errors.location}
            >
              <input
                id="branch-location"
                type="text"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                placeholder="e.g. Lalitpur, Kathmandu Valley"
                className={inputClass(errors.location)}
              />
            </Field>
            <Field id="branch-phone" label="Phone" error={errors.phone}>
              <PhoneInput
                id="branch-phone"
                value={form.phone}
                onChange={(val) =>
                  setForm((f) => ({ ...f, phone: val }))
                }
                hasError={Boolean(errors.phone)}
                placeholder="01-4XXXXXX / 9800000000"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id="branch-email" label="Email" error={errors.email}>
                <input
                  id="branch-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="e.g. branch@company.com"
                  className={inputClass(errors.email)}
                />
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection number={3} title="Status">
          <div
            role="radiogroup"
            aria-label="Branch status"
            className="inline-flex rounded-lg border border-payroll-light/80 bg-white p-1"
          >
            {BRANCH_STATUSES.map((s) => {
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
                      : "text-payroll-dark hover:bg-payroll-light",
                  )}
                >
                  {formatBranchStatus(s)}
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
    "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
    error
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
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
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-payroll-light/60 text-[10px] font-semibold text-payroll-dark">
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
