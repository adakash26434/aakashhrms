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
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isEdit ? `Editing: ${editingBranch!.code}` : "New branch location"}
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
              form="branch-form"
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="branch-form"
        onSubmit={handleSubmit}
        className="space-y-6"
        noValidate
      >
        <FormSection
          title="Basic Information"
          description="Branch operational code and primary branch name."
          isFirst
        >
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

        <FormSection
          title="Location & Contact"
          description="Physical operating address, primary phone, and official email."
        >
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

        <FormSection
          title="Operational Status"
          description="Set whether this branch is currently active or archived."
        >
          <div
            role="radiogroup"
            aria-label="Branch status"
            className="inline-flex rounded-md border border-zinc-200 bg-white p-1"
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
                    "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    isActive
                      ? s === "active"
                        ? "bg-emerald-700 text-white shadow-none"
                        : "bg-zinc-800 text-white shadow-none"
                      : "text-zinc-700 hover:bg-zinc-50",
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
