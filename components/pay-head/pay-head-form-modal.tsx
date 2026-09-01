"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DropdownMenu, type DropdownOption } from "@/components/ui/dropdown-menu";
import {
  STATUTORY_FLAGS,
  STATUTORY_FLAG_META,
  formatCalcBasis,
  formatCalcParameter,
  type CalcBasis,
  type CalcParameter,
  type PayHead,
  type PayHeadFormData,
  type PayHeadType,
  type StatutoryFlag,
} from "@/lib/types/pay-head";

interface PayHeadFormModalProps {
  open: boolean;
  editingHead: PayHead | null;
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: PayHeadFormData) => void;
}

type FormErrors = Partial<Record<"name" | "type" | "effectOnTax" | "calcBasis" | "calcParameter" | "calcPercent" | "applicableDepartmentIds" | "applicableDesignationIds" | "flagAlignment" | "taxEffect", string>>;

interface FormState {
  name: string;
  type: PayHeadType;
  effectOnTax: boolean;
  calcBasis: CalcBasis;
  calcParameter: CalcParameter;
  calcPercentText: string;
  applicableDepartmentIds: string[];
  applicableDesignationIds: string[];
  flags: Partial<Record<StatutoryFlag, boolean>>;
}

function buildInitialForm(editing: PayHead | null, allDepts: string[], allDesigs: string[]): FormState {
  if (editing) {
    return {
      name: editing.name,
      type: editing.type,
      effectOnTax: editing.effectOnTax,
      calcBasis: editing.calcBasis,
      calcParameter: editing.calcParameter,
      calcPercentText: editing.calcPercent === 0 ? "0" : String(editing.calcPercent),
      // If it's an old record with [] meaning "All", auto-expand it to all IDs
      applicableDepartmentIds: editing.applicableDepartmentIds.length > 0 ? editing.applicableDepartmentIds : allDepts,
      applicableDesignationIds: editing.applicableDesignationIds.length > 0 ? editing.applicableDesignationIds : allDesigs,
      flags: { ...editing.flags },
    };
  }
  // CREATE mode: Default to all explicit IDs
  return {
    name: "",
    type: "allowance",
    effectOnTax: true,
    calcBasis: "BasicSalary",
    calcParameter: "BasicSalary",
    calcPercentText: "100",
    applicableDepartmentIds: allDepts,
    applicableDesignationIds: allDesigs,
    flags: {},
  };
}

function toPayload(state: FormState): PayHeadFormData {
  return {
    name: state.name.trim(),
    type: state.type,
    effectOnTax: state.effectOnTax,
    calcBasis: state.calcBasis,
    calcParameter: state.calcParameter,
    calcPercent: state.calcBasis === "None" ? 0 : Number(state.calcPercentText || "0"),
    applicableDepartmentIds: state.applicableDepartmentIds,
    applicableDesignationIds: state.applicableDesignationIds,
    flags: state.flags,
  };
}

const DEDUCTION_FLAGS: StatutoryFlag[] = ["isTdsHead", "isPfHead", "isSsfHead", "isCitHead", "isAbsentDeduct"];
const ALLOWANCE_FLAGS: StatutoryFlag[] = ["isFestivalAllowance", "isOtHead", "isLeaveHead", "isRemoteAllowance"];

function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.name.trim()) {
    errors.name = "Pay Head Name is required.";
  } else if (state.name.trim().length > 60) {
    errors.name = "Pay Head Name must be 60 characters or less.";
  }

  if (state.calcBasis !== "None") {
    const p = Number(state.calcPercentText);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      errors.calcPercent = "Calculation % must be between 0 and 100.";
    }
  }

  const hasDeductionFlags = DEDUCTION_FLAGS.some((f) => state.flags[f] === true);
  const hasAllowanceFlags = ALLOWANCE_FLAGS.some((f) => state.flags[f] === true);
  if (hasDeductionFlags && hasAllowanceFlags) {
    errors.flagAlignment = "Cannot mix allowance and deduction flags on the same pay head.";
  } else if (state.type === "allowance" && hasDeductionFlags) {
    errors.flagAlignment = "Deduction flags (TDS / PF / SSF / CIT / Absent) require Type = Deduction.";
  } else if (state.type === "deduction" && hasAllowanceFlags) {
    errors.flagAlignment = "Allowance flags (Festival / OT / Leave / Remote) require Type = Allowance.";
  }

  if (state.type === "deduction" && state.flags.isCitHead === true) {
    if (state.effectOnTax !== true) {
      errors.taxEffect = "CIT reduces taxable income — set Effect on Tax to Yes.";
    }
  }

  return errors;
}

const TYPE_OPTIONS: DropdownOption<PayHeadType>[] = [
  { value: "allowance", label: "Allowance" },
  { value: "deduction", label: "Deduction" },
];

const CALC_BASIS_OPTIONS: DropdownOption<CalcBasis>[] = [
  { value: "BasicSalary", label: formatCalcBasis("BasicSalary") },
  { value: "BasicPlusGrade", label: formatCalcBasis("BasicPlusGrade") },
  { value: "None", label: formatCalcBasis("None") },
];

const CALC_PARAMETER_OPTIONS: DropdownOption<CalcParameter>[] = [
  { value: "BasicSalary", label: formatCalcParameter("BasicSalary") },
  { value: "BasicPlusGrade", label: formatCalcParameter("BasicPlusGrade") },
  { value: "FixedAmount", label: formatCalcParameter("FixedAmount") },
];

export function PayHeadFormModal({
  open,
  editingHead,
  departments,
  designations,
  onClose,
  onSubmit,
}: PayHeadFormModalProps) {
  const isEdit = Boolean(editingHead);

  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(editingHead, departments.map(d => d.id), designations.map(d => d.id))
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const title = isEdit ? "Edit Pay Head" : "New Pay Head";
  const description = isEdit
    ? `Editing ${editingHead!.name} (${editingHead!.code})`
    : "Configure a new pay head — name, calculation rules, applicability, and statutory flags.";
  const submitLabel = isEdit ? "Save Changes" : "Create Pay Head";

  // -- Helpers --
  function toggleDepartment(id: string) {
    setForm((f) => {
      const has = f.applicableDepartmentIds.includes(id);
      return {
        ...f,
        applicableDepartmentIds: has
          ? f.applicableDepartmentIds.filter((d) => d !== id)
          : [...f.applicableDepartmentIds, id],
      };
    });
  }

  function toggleDesignation(id: string) {
    setForm((f) => {
      const has = f.applicableDesignationIds.includes(id);
      return {
        ...f,
        applicableDesignationIds: has
          ? f.applicableDesignationIds.filter((d) => d !== id)
          : [...f.applicableDesignationIds, id],
      };
    });
  }

  function toggleFlag(flag: StatutoryFlag) {
    setForm((f) => ({
      ...f,
      flags: { ...f.flags, [flag]: !f.flags[flag] },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateLocal(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(toPayload(form));
  }

  const fieldId = useMemo(() => {
    const prefix = isEdit ? "edit" : "new";
    return {
      name: `${prefix}-ph-name`,
      type: `${prefix}-ph-type`,
      effectOnTax: `${prefix}-ph-effect-on-tax`,
      calcBasis: `${prefix}-ph-calc-basis`,
      calcParameter: `${prefix}-ph-calc-parameter`,
      calcPercent: `${prefix}-ph-calc-percent`,
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
        <>
          <span className="mr-auto text-xs text-gray-500">
            {isEdit ? `Editing: ${editingHead!.code}` : "New pay head"}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pay-head-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="pay-head-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* === Basic Information === */}
        <FormSection title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={fieldId.name} label="Pay Head Name *" error={errors.name}>
              <input
                id={fieldId.name}
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Basic Salary"
                className={inputClass(Boolean(errors.name), false)}
              />
            </Field>

            <Field id={fieldId.type} label="Head Type *">
              <DropdownMenu<PayHeadType>
                value={form.type}
                onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                options={TYPE_OPTIONS}
                ariaLabel="Head type"
                minWidth={220}
                renderTrigger={({ open, selected, triggerRef, toggle }) => (
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={inputClass(false, false)}
                  >
                    <span className="flex-1 text-left">{selected?.label ?? "Select type"}</span>
                    <span className="text-gray-400">▾</span>
                  </button>
                )}
              />
            </Field>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-gray-600">Effect on Tax *</p>
            <div className="flex gap-2">
              <YesNoPill label="Yes" active={form.effectOnTax === true} onClick={() => setForm((f) => ({ ...f, effectOnTax: true }))} />
              <YesNoPill label="No" active={form.effectOnTax === false} onClick={() => setForm((f) => ({ ...f, effectOnTax: false }))} />
            </div>
          </div>
        </FormSection>

        {/* === Calculation Rules === */}
        <FormSection title="Calculation Rules">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id={fieldId.calcBasis} label="Calculate On">
              <DropdownMenu<CalcBasis>
                value={form.calcBasis}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    calcBasis: v,
                    calcPercentText: v === "None" ? "0" : f.calcPercentText,
                    calcParameter: v === "None" ? "FixedAmount" : v === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade",
                  }))
                }
                options={CALC_BASIS_OPTIONS}
                ariaLabel="Calculate on"
                minWidth={180}
                renderTrigger={({ open, selected, triggerRef, toggle }) => (
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={inputClass(false, false)}
                  >
                    <span className="flex-1 text-left">{selected?.label ?? "Select basis"}</span>
                    <span className="text-gray-400">▾</span>
                  </button>
                )}
              />
            </Field>

            <Field id={fieldId.calcParameter} label="Parameter">
              <DropdownMenu<CalcParameter>
                value={form.calcParameter}
                onChange={(v) => setForm((f) => ({ ...f, calcParameter: v }))}
                options={CALC_PARAMETER_OPTIONS}
                ariaLabel="Parameter"
                minWidth={180}
                renderTrigger={({ open, selected, triggerRef, toggle }) => (
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={inputClass(false, false)}
                  >
                    <span className="flex-1 text-left">{selected?.label ?? "Select parameter"}</span>
                    <span className="text-gray-400">▾</span>
                  </button>
                )}
              />
            </Field>

            <Field id={fieldId.calcPercent} label="Calculation %" error={errors.calcPercent}>
              <div className="relative">
                <input
                  id={fieldId.calcPercent}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.calcPercentText}
                  onChange={(e) => setForm((f) => ({ ...f, calcPercentText: e.target.value }))}
                  disabled={form.calcBasis === "None"}
                  placeholder="e.g. 10"
                  className={inputClass(Boolean(errors.calcPercent), form.calcBasis === "None")}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">%</span>
              </div>
            </Field>
          </div>
        </FormSection>

        {/* === Applicability === */}
        <FormSection title="Applicability">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">
                Apply For: Department <span className="text-gray-500">({form.applicableDepartmentIds.length} selected)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {departments.map((d) => (
                  <CheckboxPill
                    key={d.id}
                    id={`${fieldId.name}-dept-${d.id}`}
                    label={d.name}
                    checked={form.applicableDepartmentIds.includes(d.id)}
                    onChange={() => toggleDepartment(d.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">
                Apply For: Position <span className="text-gray-500">({form.applicableDesignationIds.length} selected)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {designations.map((d) => (
                  <CheckboxPill
                    key={d.id}
                    id={`${fieldId.name}-desig-${d.id}`}
                    label={d.name}
                    checked={form.applicableDesignationIds.includes(d.id)}
                    onChange={() => toggleDesignation(d.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        {/* === Statutory & Calculation Flags === */}
        <FormSection title="Statutory & Calculation Flags" description="Toggle flags that define how this pay head behaves during payroll">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STATUTORY_FLAGS.map((flag) => {
              const meta = STATUTORY_FLAG_META[flag];
              const Icon = meta.icon;
              const active = form.flags[flag] === true;
              return (
                <button
                  key={flag}
                  type="button"
                  onClick={() => toggleFlag(flag)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                    active ? "border-[#2e7d32]/40 bg-green-50/40" : "border-[#d7e8d0]/60 bg-white hover:bg-[#f6faf6]/60"
                  )}
                >
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", active ? "bg-[#2e7d32] text-white" : "bg-[#d7e8d0]/60 text-[#1b3a1f]")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#1b3a1f]">{meta.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{meta.description}</p>
                  </div>
                  <span className={cn("mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors", active ? "border-[#2e7d32] bg-[#2e7d32] text-white" : "border-gray-300 bg-white")} aria-hidden>
                    {active && <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor"><path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" /></svg>}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.flagAlignment && <p className="mt-2 text-xs text-red-600" role="alert">{errors.flagAlignment}</p>}
          {errors.taxEffect && <p className="mt-2 text-xs text-red-600" role="alert">{errors.taxEffect}</p>}
        </FormSection>
      </form>
    </Dialog>
  );
}

// ----- Internal helpers -----

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
        {description && <p className="mt-0.5 text-[11px] text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean, isDisabled: boolean) {
  return [
    "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1 flex items-center justify-between",
    isDisabled ? "cursor-not-allowed border-[#d7e8d0]/60 bg-[#f6faf6] text-gray-500" : hasError ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
  ].join(" ");
}

function YesNoPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("h-9 min-w-20 rounded-lg px-4 text-sm font-medium transition-colors", active ? "bg-[#2e7d32] text-white shadow-sm" : "border border-[#d7e8d0] bg-white text-[#1b3a1f] hover:bg-[#f6faf6]")}
    >
      {label}
    </button>
  );
}

function CheckboxPill({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      htmlFor={id}
      className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors min-w-0", checked ? "border-[#2e7d32]/40 bg-green-50/60 text-[#1b3a1f]" : "border-[#d7e8d0] bg-white text-[#1b3a1f] hover:bg-[#f6faf6]")}
    >
      <span className={cn("relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2 transition-colors", checked ? "border-[#2e7d32] bg-[#2e7d32]" : "border-gray-300 bg-white")} aria-hidden>
        {checked && <svg viewBox="0 0 16 16" className="h-2 w-2 text-white" fill="currentColor"><path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" /></svg>}
      </span>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className="whitespace-nowrap">{label}</span>
    </label>
  );
}