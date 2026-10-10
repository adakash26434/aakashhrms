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
  designations: { id: string; name: string; departmentId?: string }[];
  onClose: () => void;
  onSubmit: (data: PayHeadFormData) => void;
}

type FormErrors = Partial<Record<"name" | "nameNp" | "type" | "effectOnTax" | "calcBasis" | "calcParameter" | "calcPercent" | "applicableDepartmentIds" | "applicableDesignationIds" | "flagAlignment" | "taxEffect", string>>;

interface FormState {
  name: string;
  /** F11: Nepali name for the payslip (optional). */
  nameNp: string;
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
      nameNp: editing.nameNp ?? "",
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
    nameNp: "",
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
    nameNp: state.nameNp.trim(),
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
const ALLOWANCE_FLAGS: StatutoryFlag[] = ["isFestivalAllowance", "isOtHead", "isLeaveHead", "isRemoteAllowance", "isSsfEmployerHead"];

function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.name.trim()) {
    errors.name = "Pay Head Name is required.";
  } else if (state.name.trim().length > 60) {
    errors.name = "Pay Head Name must be 60 characters or less.";
  }
  if (state.nameNp.trim().length > 60) {
    errors.nameNp = "Nepali name must be 60 characters or less.";
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

  // -- Department / Designation Relationship Helpers --
  function getDeptIdForDesig(desig: { id: string; name: string; departmentId?: string }): string | undefined {
    if (desig.departmentId && departments.some((d) => d.id === desig.departmentId)) {
      return desig.departmentId;
    }
    const dName = desig.name.toLowerCase();
    if (
      dName.includes("software") ||
      dName.includes("engineer") ||
      dName.includes("developer") ||
      dName.includes("it ") ||
      dName.includes("technology")
    ) {
      const dept = departments.find((d) => {
        const n = d.name.toLowerCase();
        return n.includes("technology") || n.includes("it") || n.includes("engineering");
      });
      if (dept) return dept.id;
    }
    if (
      dName.includes("hr") ||
      dName.includes("human resources") ||
      dName.includes("people") ||
      dName.includes("talent")
    ) {
      const dept = departments.find((d) => {
        const n = d.name.toLowerCase();
        return n.includes("human resources") || n.includes("hr");
      });
      if (dept) return dept.id;
    }
    if (
      dName.includes("accountant") ||
      dName.includes("finance") ||
      dName.includes("accounts") ||
      dName.includes("audit") ||
      dName.includes("billing")
    ) {
      const dept = departments.find((d) => {
        const n = d.name.toLowerCase();
        return n.includes("finance") || n.includes("account");
      });
      if (dept) return dept.id;
    }
    if (
      dName.includes("marketing") ||
      dName.includes("sales") ||
      dName.includes("growth") ||
      dName.includes("business dev")
    ) {
      const dept = departments.find((d) => {
        const n = d.name.toLowerCase();
        return n.includes("marketing") || n.includes("sales");
      });
      if (dept) return dept.id;
    }
    if (
      dName.includes("admin") ||
      dName.includes("operations") ||
      dName.includes("officer") ||
      dName.includes("assistant") ||
      dName.includes("executive") ||
      dName.includes("director") ||
      dName.includes("ceo") ||
      dName.includes("manager")
    ) {
      const dept = departments.find((d) => {
        const n = d.name.toLowerCase();
        return n.includes("administration") || n.includes("operations") || n.includes("admin");
      });
      if (dept) return dept.id;
    }
    return undefined;
  }

  // When a department is unselected, automatically unselect its related designations!
  function toggleDepartment(id: string) {
    setForm((f) => {
      const isCurrentlySelected = f.applicableDepartmentIds.includes(id);
      const nextDeptIds = isCurrentlySelected
        ? f.applicableDepartmentIds.filter((d) => d !== id)
        : [...f.applicableDepartmentIds, id];

      // Find all designations that belong to this department
      const relatedDesigIds = designations
        .filter((desig) => getDeptIdForDesig(desig) === id)
        .map((desig) => desig.id);

      let nextDesigIds = f.applicableDesignationIds;
      if (isCurrentlySelected) {
        // Department UNCHECKED: remove all its designations automatically
        nextDesigIds = nextDesigIds.filter((dId) => !relatedDesigIds.includes(dId));
      } else {
        // Department CHECKED: auto-select all its designations
        nextDesigIds = Array.from(new Set([...nextDesigIds, ...relatedDesigIds]));
      }

      return {
        ...f,
        applicableDepartmentIds: nextDeptIds,
        applicableDesignationIds: nextDesigIds,
      };
    });
  }

  function selectAllDepartments() {
    setForm((f) => ({
      ...f,
      applicableDepartmentIds: departments.map((d) => d.id),
      applicableDesignationIds: designations.map((d) => d.id),
    }));
  }

  function deselectAllDepartments() {
    setForm((f) => ({
      ...f,
      applicableDepartmentIds: [],
      applicableDesignationIds: [],
    }));
  }

  function selectAllDesignations() {
    setForm((f) => ({
      ...f,
      applicableDesignationIds: designations.map((d) => d.id),
    }));
  }

  function deselectAllDesignations() {
    setForm((f) => ({
      ...f,
      applicableDesignationIds: [],
    }));
  }

  function toggleDesignation(id: string) {
    setForm((f) => {
      const isCurrentlySelected = f.applicableDesignationIds.includes(id);
      const nextDesigIds = isCurrentlySelected
        ? f.applicableDesignationIds.filter((d) => d !== id)
        : [...f.applicableDesignationIds, id];

      // If user checks a designation whose parent department is unselected,
      // auto-select that parent department so applicability is consistent
      let nextDeptIds = f.applicableDepartmentIds;
      if (!isCurrentlySelected) {
        const desig = designations.find((d) => d.id === id);
        if (desig) {
          const deptId = getDeptIdForDesig(desig);
          if (deptId && !nextDeptIds.includes(deptId)) {
            nextDeptIds = [...nextDeptIds, deptId];
          }
        }
      }

      return {
        ...f,
        applicableDesignationIds: nextDesigIds,
        applicableDepartmentIds: nextDeptIds,
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
      nameNp: `${prefix}-ph-name-np`,
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
      size="3xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isEdit ? `Editing: ${editingHead!.code}` : "New pay head"}
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
              form="pay-head-form"
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form id="pay-head-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* === Basic Information === */}
        <FormSection
          title="Basic Information"
          description="Configure pay head name, type classification, and income tax applicability."
          isFirst
        >
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

            <Field id={fieldId.nameNp} label="Name in Nepali (payslip)" error={errors.nameNp}>
              <input
                id={fieldId.nameNp}
                type="text"
                lang="ne"
                value={form.nameNp}
                onChange={(e) => setForm((f) => ({ ...f, nameNp: e.target.value }))}
                placeholder="e.g. आधारभूत तलब"
                className={inputClass(Boolean(errors.nameNp), false)}
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
            <p className="mb-1.5 text-xs font-semibold text-zinc-700">Effect on Tax *</p>
            <div className="flex gap-2">
              <YesNoPill label="Yes" active={form.effectOnTax === true} onClick={() => setForm((f) => ({ ...f, effectOnTax: true }))} />
              <YesNoPill label="No" active={form.effectOnTax === false} onClick={() => setForm((f) => ({ ...f, effectOnTax: false }))} />
            </div>
          </div>
        </FormSection>

        {/* === Calculation Rules === */}
        <FormSection
          title="Calculation Rules"
          description="Specify whether this pay head computes as a percentage of salary or a fixed rate."
        >
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
        <FormSection
          title="Applicability Matrix"
          description="Target specific organizational departments and job designations."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
            {/* Departments Column */}
            <div className="space-y-2.5 min-w-0">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-300/60">
                <span className="text-xs font-semibold text-zinc-900">
                  Apply For: Department{" "}
                  <span className="text-zinc-500 font-normal">
                    ({form.applicableDepartmentIds.length} of {departments.length} selected)
                  </span>
                </span>
                <div className="flex items-center gap-2 text-2xs">
                  <button
                    type="button"
                    onClick={selectAllDepartments}
                    className="font-medium text-payroll-primary hover:text-payroll-primary-hover hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllDepartments}
                    className="font-medium text-zinc-500 hover:text-zinc-700 hover:underline cursor-pointer"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 max-h-75 overflow-y-auto pr-1">
                {departments.map((d) => {
                  const isChecked = form.applicableDepartmentIds.includes(d.id);
                  const desigCount = designations.filter(
                    (desig) => getDeptIdForDesig(desig) === d.id
                  ).length;
                  return (
                    <CheckboxPill
                      key={d.id}
                      id={`${fieldId.name}-dept-${d.id}`}
                      label={d.name}
                      badge={desigCount > 0 ? `${desigCount} roles` : undefined}
                      checked={isChecked}
                      onChange={() => toggleDepartment(d.id)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Positions Column */}
            <div className="space-y-2.5 min-w-0">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-300/60">
                <span className="text-xs font-semibold text-zinc-900">
                  Apply For: Position{" "}
                  <span className="text-zinc-500 font-normal">
                    ({form.applicableDesignationIds.length} of {designations.length} selected)
                  </span>
                </span>
                <div className="flex items-center gap-2 text-2xs">
                  <button
                    type="button"
                    onClick={selectAllDesignations}
                    className="font-medium text-payroll-primary hover:text-payroll-primary-hover hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllDesignations}
                    className="font-medium text-zinc-500 hover:text-zinc-700 hover:underline cursor-pointer"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 max-h-75 overflow-y-auto pr-1">
                {designations.map((d) => {
                  const isChecked = form.applicableDesignationIds.includes(d.id);
                  const deptId = getDeptIdForDesig(d);
                  const dept = departments.find((dept) => dept.id === deptId);
                  const isDeptActive = deptId ? form.applicableDepartmentIds.includes(deptId) : true;
                  return (
                    <CheckboxPill
                      key={d.id}
                      id={`${fieldId.name}-desig-${d.id}`}
                      label={d.name}
                      badge={dept?.name}
                      dimmed={!isDeptActive}
                      checked={isChecked}
                      onChange={() => toggleDesignation(d.id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </FormSection>

        {/* === Statutory & Calculation Flags === */}
        <FormSection
          title="Statutory Flags"
          description="Tag this head for statutory social security, tax deductions, or legal allowances."
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
                    "flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors cursor-pointer",
                    active
                      ? "border-emerald-700/60 bg-emerald-50/50 ring-1 ring-emerald-700/20"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                      active ? "bg-payroll-primary text-white" : "bg-zinc-100 text-zinc-600"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-900">{meta.label}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-zinc-500">{meta.description}</p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      active ? "border-payroll-primary bg-payroll-primary text-white" : "border-zinc-300 bg-white"
                    )}
                    aria-hidden
                  >
                    {active && (
                      <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor">
                        <path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" />
                      </svg>
                    )}
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
    <div className={cn("space-y-3.5", !isFirst && "pt-5 border-t border-zinc-200")}>
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

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-zinc-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean, isDisabled: boolean) {
  return [
    "h-9 w-full rounded-md border bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 flex items-center justify-between transition-colors",
    isDisabled
      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
      : hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-zinc-200 focus:border-payroll-primary focus:ring-payroll-primary",
  ].join(" ");
}

function YesNoPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 min-w-20 rounded-md px-4 text-xs font-semibold transition-colors cursor-pointer",
        active
          ? "bg-payroll-primary text-white shadow-none"
          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      )}
    >
      {label}
    </button>
  );
}

function CheckboxPill({
  id,
  label,
  badge,
  checked,
  dimmed,
  onChange,
}: {
  id: string;
  label: string;
  badge?: string;
  checked: boolean;
  dimmed?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      title={badge ? `${label} (${badge})` : label}
      className={cn(
        "flex items-center justify-between gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors cursor-pointer select-none min-w-0 w-full",
        checked
          ? "border-payroll-primary/40 bg-payroll-primary-light text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300",
        dimmed && !checked && "opacity-60 bg-zinc-50/50"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className={cn(
            "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
            checked
              ? "border-payroll-primary bg-payroll-primary text-white"
              : "border-zinc-300 bg-white"
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
        <span className="truncate font-medium text-zinc-900 text-xs">
          {label}
        </span>
      </div>
      {badge && (
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-2xs font-medium shrink-0 max-w-32.5 truncate border",
            checked
              ? "bg-emerald-100/70 text-emerald-800 border-emerald-200/80"
              : "bg-zinc-100 text-zinc-600 border-zinc-200"
          )}
        >
          {badge}
        </span>
      )}
    </label>
  );
}