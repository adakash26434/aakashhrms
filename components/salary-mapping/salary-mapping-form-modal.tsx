"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import type {
  SalaryMappingFormData,
  SalaryHeadFormItem,
  SalaryMapping,
} from "@/lib/types/salary-mapping";
import type { GradePolicySettings } from "@/lib/types/system-control";
import {
  DEFAULT_GRADE_POLICY,
  calculateTotalGradeAmount,
} from "@/lib/engines/grade-policy.engine";

interface SalaryMappingFormModalProps {
  open: boolean;
  editingMapping: SalaryMapping | null;
  employees: {
    id: string;
    employeeCode: string;
    fullName: string;
    departmentName: string;
    designationName: string;
    gradePercent: number;
    gradeCount?: number;
    gradeAmount: number;
  }[];
  allowanceHeads: {
    id: string;
    name: string;
    calcBasis: string;
    calcParameter: string;
  }[];
  deductionHeads: {
    id: string;
    name: string;
    calcBasis: string;
    calcParameter: string;
  }[];
  fiscalYears?: { id: string; fyNumber: string }[];
  gradePolicy?: GradePolicySettings;
  onClose: () => void;
  onSave: (data: SalaryMappingFormData) => void;
}

interface FormErrors {
  employeeId?: string;
  basicSalary?: string;
  gradePercent?: string;
  gradeAmount?: string;
  salaryHeads?: string;
  loan1Deduction?: string;
  loan2Deduction?: string;
}

interface FormState {
  employeeId: string;
  fiscalYearId: string;
  effectiveFrom: string;
  basicSalary: string;
  gradePercent: string;
  gradeAmount: string;
  allowanceHeadIds: string[];
  allowanceAmounts: string[];
  deductionHeadIds: string[];
  deductionAmounts: string[];
  loan1Deduction: string;
  loan2Deduction: string;
}

function buildInitialForm(defaultFyId?: string): FormState {
  const today = new Date().toISOString().split("T")[0];
  return {
    employeeId: "",
    fiscalYearId: defaultFyId || "",
    effectiveFrom: today,
    basicSalary: "",
    gradePercent: "100",
    gradeAmount: "",
    allowanceHeadIds: [],
    allowanceAmounts: [],
    deductionHeadIds: [],
    deductionAmounts: [],
    loan1Deduction: "0",
    loan2Deduction: "0",
  };
}

/** Build form state from an existing mapping record. */
function buildFormFromMapping(
  mapping: SalaryMapping,
  defaultFyId?: string,
): FormState {
  const allowances = mapping.salaryHeads.filter(
    (h) => h.payHeadType === "allowance",
  );
  const deductions = mapping.salaryHeads.filter(
    (h) => h.payHeadType === "deduction",
  );
  const fyId =
    mapping.fiscalYearId && mapping.fiscalYearId !== "fy-1"
      ? mapping.fiscalYearId
      : defaultFyId || "";

  return {
    employeeId: mapping.employeeId,
    fiscalYearId: fyId,
    effectiveFrom: mapping.effectiveFrom,
    basicSalary: String(mapping.basicSalary),
    gradePercent: String(mapping.gradePercent),
    gradeAmount: String(mapping.gradeAmount),
    allowanceHeadIds: allowances.map((a) => a.payHeadId),
    allowanceAmounts: allowances.map((a) => String(a.amount)),
    deductionHeadIds: deductions.map((d) => d.payHeadId),
    deductionAmounts: deductions.map((d) => String(d.amount)),
    loan1Deduction: String(mapping.loan1Deduction),
    loan2Deduction: String(mapping.loan2Deduction),
  };
}

function toPayload(state: FormState): SalaryMappingFormData {
  const allowanceHeads: SalaryHeadFormItem[] = state.allowanceHeadIds.map(
    (id, i) => ({
      payHeadId: id,
      amount: Number(state.allowanceAmounts[i] || 0),
    }),
  );
  const deductionHeads: SalaryHeadFormItem[] = state.deductionHeadIds.map(
    (id, i) => ({
      payHeadId: id,
      amount: Number(state.deductionAmounts[i] || 0),
    }),
  );

  return {
    employeeId: state.employeeId,
    fiscalYearId: state.fiscalYearId,
    effectiveFrom: state.effectiveFrom,
    basicSalary: Number(state.basicSalary),
    gradePercent: Number(state.gradePercent),
    gradeAmount: Number(state.gradeAmount),
    salaryHeads: [...allowanceHeads, ...deductionHeads],
    loan1Deduction: Number(state.loan1Deduction),
    loan2Deduction: Number(state.loan2Deduction),
  };
}

function validateLocal(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.employeeId) errors.employeeId = "Employee is required.";
  if (!state.basicSalary || Number(state.basicSalary) <= 0)
    errors.basicSalary = "Basic salary must be greater than 0.";
  const gp = Number(state.gradePercent);
  if (!Number.isFinite(gp) || gp < 0 || gp > 200)
    errors.gradePercent = "Grade % must be between 0 and 200.";
  const ga = Number(state.gradeAmount);
  if (!Number.isFinite(ga) || ga < 0)
    errors.gradeAmount = "Grade amount must be 0 or greater.";
  return errors;
}

export function SalaryMappingFormModal({
  open,
  editingMapping,
  employees,
  allowanceHeads,
  deductionHeads,
  fiscalYears,
  gradePolicy,
  onClose,
  onSave,
}: SalaryMappingFormModalProps) {
  const isEdit = Boolean(editingMapping);
  const defaultFyId = fiscalYears?.[0]?.id;
  const activeGradePolicy = gradePolicy || DEFAULT_GRADE_POLICY;
  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(defaultFyId),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Pre-populate form when editing an existing mapping
  useEffect(() => {
    if (editingMapping) {
      setForm(buildFormFromMapping(editingMapping, defaultFyId));
    } else {
      setForm(buildInitialForm(defaultFyId));
    }
    setErrors({});
  }, [editingMapping, open, defaultFyId]);

  const selectedEmployee = employees.find((e) => e.id === form.employeeId);

  // Computed net salary preview
  const computedNet = useMemo(() => {
    const basic = Number(form.basicSalary) || 0;
    const gp = Number(form.gradePercent) || 0;
    const ga = Number(form.gradeAmount) || 0;
    const totalAllowances = form.allowanceAmounts.reduce(
      (s, a) => s + (Number(a) || 0),
      0,
    );
    const totalDeductions = form.deductionAmounts.reduce(
      (s, a) => s + (Number(a) || 0),
      0,
    );
    const l1 = Number(form.loan1Deduction) || 0;
    const l2 = Number(form.loan2Deduction) || 0;
    const gradeValue = basic * (gp / 100);
    return Math.max(
      0,
      Math.round(
        basic + gradeValue + ga + totalAllowances - totalDeductions - l1 - l2,
      ),
    );
  }, [form]);

  const ssfAllowanceHead = allowanceHeads.find(
    (h) => h.name.toLowerCase().includes("ssf") || (h as any).isSsfEmployerHead || h.id === "ph-015"
  );
  const ssfDeductionHead = deductionHeads.find(
    (h) => (h.name.toLowerCase().includes("ssf") && !h.name.toLowerCase().includes("employer")) || (h as any).isSsfHead || h.id === "ph-008"
  );

  const isSsfEnrolled = Boolean(
    (ssfAllowanceHead && form.allowanceHeadIds.includes(ssfAllowanceHead.id)) ||
    (ssfDeductionHead && form.deductionHeadIds.includes(ssfDeductionHead.id))
  );

  function handleToggleSsf(enrolled: boolean) {
    let newAllowanceIds = [...form.allowanceHeadIds];
    let newAllowanceAmounts = [...form.allowanceAmounts];
    let newDeductionIds = [...form.deductionHeadIds];
    let newDeductionAmounts = [...form.deductionAmounts];

    const basicNum = Number(form.basicSalary) || 0;
    const ssfErAmt = Math.round(basicNum * 0.20);
    const ssfTotalAmt = Math.round(basicNum * 0.31);

    if (enrolled) {
      if (ssfAllowanceHead && !newAllowanceIds.includes(ssfAllowanceHead.id)) {
        newAllowanceIds.push(ssfAllowanceHead.id);
        newAllowanceAmounts.push(String(ssfErAmt));
      }
      if (ssfDeductionHead && !newDeductionIds.includes(ssfDeductionHead.id)) {
        newDeductionIds.push(ssfDeductionHead.id);
        newDeductionAmounts.push(String(ssfTotalAmt));
      }
    } else {
      if (ssfAllowanceHead) {
        const idx = newAllowanceIds.indexOf(ssfAllowanceHead.id);
        if (idx >= 0) {
          newAllowanceIds.splice(idx, 1);
          newAllowanceAmounts.splice(idx, 1);
        }
      }
      if (ssfDeductionHead) {
        const idx = newDeductionIds.indexOf(ssfDeductionHead.id);
        if (idx >= 0) {
          newDeductionIds.splice(idx, 1);
          newDeductionAmounts.splice(idx, 1);
        }
      }
    }

    setForm((prev) => ({
      ...prev,
      allowanceHeadIds: newAllowanceIds,
      allowanceAmounts: newAllowanceAmounts,
      deductionHeadIds: newDeductionIds,
      deductionAmounts: newDeductionAmounts,
    }));
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "basicSalary") {
        const basicNum = Number(value) || 0;
        const currentEmp = employees.find((e) => e.id === next.employeeId);
        if (currentEmp && currentEmp.gradeCount !== undefined && currentEmp.gradeCount > 0 && activeGradePolicy.calculationMethod !== "MANUAL_INPUT") {
          const autoGrade = calculateTotalGradeAmount(basicNum, currentEmp.gradeCount, activeGradePolicy);
          next.gradeAmount = String(autoGrade);
        }

        if (isSsfEnrolled) {
          const ssfErAmt = Math.round(basicNum * 0.20);
          const ssfTotalAmt = Math.round(basicNum * 0.31);

          if (ssfAllowanceHead) {
            const idx = next.allowanceHeadIds.indexOf(ssfAllowanceHead.id);
            if (idx >= 0) {
              next.allowanceAmounts[idx] = String(ssfErAmt);
            }
          }
          if (ssfDeductionHead) {
            const idx = next.deductionHeadIds.indexOf(ssfDeductionHead.id);
            if (idx >= 0) {
              next.deductionAmounts[idx] = String(ssfTotalAmt);
            }
          }
        }
      }
      return next;
    });
  }

  function handleEmployeeSelect(id: string) {
    const emp = employees.find((e) => e.id === id);
    let gradeAmt = emp ? emp.gradeAmount : 0;
    const basicNum = Number(form.basicSalary) || 0;
    if (emp && emp.gradeCount !== undefined && emp.gradeCount > 0 && basicNum > 0 && activeGradePolicy.calculationMethod !== "MANUAL_INPUT") {
      gradeAmt = calculateTotalGradeAmount(basicNum, emp.gradeCount, activeGradePolicy);
    }
    setForm((f) => ({
      ...f,
      employeeId: id,
      gradePercent: emp ? String(emp.gradePercent) : "100",
      gradeAmount: String(gradeAmt),
    }));
  }

  function addAllowance() {
    const available = allowanceHeads.filter(
      (h) => !form.allowanceHeadIds.includes(h.id),
    );
    if (available.length === 0) return;
    setForm((f) => ({
      ...f,
      allowanceHeadIds: [...f.allowanceHeadIds, available[0].id],
      allowanceAmounts: [...f.allowanceAmounts, "0"],
    }));
  }

  function removeAllowance(index: number) {
    setForm((f) => ({
      ...f,
      allowanceHeadIds: f.allowanceHeadIds.filter((_, i) => i !== index),
      allowanceAmounts: f.allowanceAmounts.filter((_, i) => i !== index),
    }));
  }

  function addDeduction() {
    const available = deductionHeads.filter(
      (h) => !form.deductionHeadIds.includes(h.id),
    );
    if (available.length === 0) return;
    setForm((f) => ({
      ...f,
      deductionHeadIds: [...f.deductionHeadIds, available[0].id],
      deductionAmounts: [...f.deductionAmounts, "0"],
    }));
  }

  function removeDeduction(index: number) {
    setForm((f) => ({
      ...f,
      deductionHeadIds: f.deductionHeadIds.filter((_, i) => i !== index),
      deductionAmounts: f.deductionAmounts.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateLocal(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(toPayload(form));
  }

  const inputClass = (hasError: boolean) =>
    cn(
      "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
      hasError
        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
        : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Salary Mapping` : "New Salary Mapping"}
      description={
        isEdit && selectedEmployee
          ? `Editing ${selectedEmployee.fullName}`
          : "Define employee salary structure including allowances, deductions, and loan deductions."
      }
      size="2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="salary-mapping-form">
            {isEdit ? "Save Changes" : "Create Mapping"}
          </Button>
        </>
      }
    >
      <form
        id="salary-mapping-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        {/* Employee Selector */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Employee
          </h3>
          <div className="space-y-1">
            {isEdit && selectedEmployee ? (
              <div className="rounded-lg border border-payroll-light/80 bg-payroll-cream px-3 py-2.5">
                <p className="text-sm font-medium text-payroll-navy">
                  {selectedEmployee.fullName}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedEmployee.employeeCode} ·{" "}
                  {selectedEmployee.departmentName} ·{" "}
                  {selectedEmployee.designationName}
                </p>
              </div>
            ) : (
              <select
                value={form.employeeId}
                onChange={(e) => handleEmployeeSelect(e.target.value)}
                className={inputClass(Boolean(errors.employeeId))}
              >
                <option value="">-- Select Employee --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.employeeCode})
                  </option>
                ))}
              </select>
            )}
            {errors.employeeId && (
              <p className="text-xs text-red-600">{errors.employeeId}</p>
            )}
          </div>
        </section>

        {/* Salary Details */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Salary Details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Basic Salary *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={form.basicSalary}
                  onChange={(e) => update("basicSalary", e.target.value)}
                  className={inputClass(Boolean(errors.basicSalary))}
                  placeholder="e.g. 50000"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                  NPR
                </span>
              </div>
              {errors.basicSalary && (
                <p className="text-xs text-red-600">{errors.basicSalary}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Grade %
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={form.gradePercent}
                  onChange={(e) => update("gradePercent", e.target.value)}
                  className={inputClass(Boolean(errors.gradePercent))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                  %
                </span>
              </div>
              {errors.gradePercent && (
                <p className="text-xs text-red-600">{errors.gradePercent}</p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  Grade Amount
                </label>
                {selectedEmployee?.gradeCount !== undefined && selectedEmployee.gradeCount > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    {selectedEmployee.gradeCount} Grade(s) • Basic/30
                  </span>
                )}
              </div>
              <input
                type="number"
                min={0}
                value={form.gradeAmount}
                onChange={(e) => update("gradeAmount", e.target.value)}
                className={inputClass(Boolean(errors.gradeAmount))}
                placeholder="e.g. 72000"
              />
              {errors.gradeAmount && (
                <p className="text-xs text-red-600">{errors.gradeAmount}</p>
              )}
            </div>
          </div>
        </section>

        {/* Social Security Fund (SSF) Facility */}
        <section className="rounded-lg border border-payroll-primary/25 bg-payroll-cream/60 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-payroll-primary/10 text-payroll-primary">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-payroll-navy">
                  Social Security Fund (SSF) Facility
                </p>
                <p className="text-[11px] text-gray-500">
                  Adds 20% company contribution to earnings and deducts 31% total SSF (11% employee + 20% company).
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isSsfEnrolled}
              onClick={() => handleToggleSsf(!isSsfEnrolled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-payroll-primary/20",
                isSsfEnrolled ? "bg-payroll-primary" : "bg-gray-200"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs ring-0 transition-transform",
                  isSsfEnrolled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {isSsfEnrolled && (
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-payroll-light/60 pt-2.5 text-center">
              <div className="rounded bg-white p-2 border border-gray-100 shadow-xs">
                <span className="block text-[10px] text-gray-400 uppercase font-medium">Company Addition</span>
                <span className="text-xs font-semibold text-emerald-700">+20% (NPR {Math.round((Number(form.basicSalary) || 0) * 0.20).toLocaleString("en-IN")})</span>
              </div>
              <div className="rounded bg-white p-2 border border-gray-100 shadow-xs">
                <span className="block text-[10px] text-gray-400 uppercase font-medium">Total SSF Deduction</span>
                <span className="text-xs font-semibold text-rose-700">-31% (NPR {Math.round((Number(form.basicSalary) || 0) * 0.31).toLocaleString("en-IN")})</span>
              </div>
              <div className="rounded bg-white p-2 border border-gray-100 shadow-xs">
                <span className="block text-[10px] text-gray-400 uppercase font-medium">Net Take-Home Impact</span>
                <span className="text-xs font-semibold text-amber-700">-11% (NPR {Math.round((Number(form.basicSalary) || 0) * 0.11).toLocaleString("en-IN")})</span>
              </div>
            </div>
          )}
        </section>

        {/* Allowances */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Allowances
            </h3>
            <button
              type="button"
              onClick={addAllowance}
              className="text-xs font-medium text-payroll-primary hover:underline"
            >
              + Add Allowance
            </button>
          </div>
          {form.allowanceHeadIds.length === 0 ? (
            <p className="text-xs text-gray-400">No allowances added yet.</p>
          ) : (
            <div className="space-y-2">
              {form.allowanceHeadIds.map((headId, i) => {
                const head = allowanceHeads.find((h) => h.id === headId);
                return (
                  <div
                    key={headId}
                    className="flex items-center gap-2 rounded-md border border-payroll-light/60 bg-payroll-cream/30 p-2"
                  >
                    <select
                      value={headId}
                      onChange={(e) => {
                        const newIds = [...form.allowanceHeadIds];
                        newIds[i] = e.target.value;
                        update("allowanceHeadIds", newIds);
                      }}
                      className="h-8 flex-1 rounded border border-payroll-light bg-white px-2 text-xs"
                    >
                      {allowanceHeads.map((h) => (
                        <option
                          key={h.id}
                          value={h.id}
                          disabled={
                            form.allowanceHeadIds.includes(h.id) &&
                            h.id !== headId
                          }
                        >
                          {h.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={form.allowanceAmounts[i]}
                      onChange={(e) => {
                        const newAmounts = [...form.allowanceAmounts];
                        newAmounts[i] = e.target.value;
                        update("allowanceAmounts", newAmounts);
                      }}
                      className="h-8 w-28 rounded border border-payroll-light bg-white px-2 text-xs text-right"
                      placeholder="Amount"
                    />
                    <button
                      type="button"
                      onClick={() => removeAllowance(i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deductions */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Deductions
            </h3>
            <button
              type="button"
              onClick={addDeduction}
              className="text-xs font-medium text-payroll-primary hover:underline"
            >
              + Add Deduction
            </button>
          </div>
          {form.deductionHeadIds.length === 0 ? (
            <p className="text-xs text-gray-400">No deductions added yet.</p>
          ) : (
            <div className="space-y-2">
              {form.deductionHeadIds.map((headId, i) => {
                const head = deductionHeads.find((h) => h.id === headId);
                return (
                  <div
                    key={headId}
                    className="flex items-center gap-2 rounded-md border border-payroll-light/60 bg-payroll-cream/30 p-2"
                  >
                    <select
                      value={headId}
                      onChange={(e) => {
                        const newIds = [...form.deductionHeadIds];
                        newIds[i] = e.target.value;
                        update("deductionHeadIds", newIds);
                      }}
                      className="h-8 flex-1 rounded border border-payroll-light bg-white px-2 text-xs"
                    >
                      {deductionHeads.map((h) => (
                        <option
                          key={h.id}
                          value={h.id}
                          disabled={
                            form.deductionHeadIds.includes(h.id) &&
                            h.id !== headId
                          }
                        >
                          {h.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={form.deductionAmounts[i]}
                      onChange={(e) => {
                        const newAmounts = [...form.deductionAmounts];
                        newAmounts[i] = e.target.value;
                        update("deductionAmounts", newAmounts);
                      }}
                      className="h-8 w-28 rounded border border-payroll-light bg-white px-2 text-xs text-right"
                      placeholder="Amount"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeduction(i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Loan Deductions */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Loan Deductions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Loan 1 Deduction
              </label>
              <input
                type="number"
                min={0}
                value={form.loan1Deduction}
                onChange={(e) => update("loan1Deduction", e.target.value)}
                className={inputClass(false)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Loan 2 Deduction
              </label>
              <input
                type="number"
                min={0}
                value={form.loan2Deduction}
                onChange={(e) => update("loan2Deduction", e.target.value)}
                className={inputClass(false)}
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-gray-400 italic">
            Loan amounts are placeholders. Full loan integration is pending.
          </p>
        </section>

        {/* Net Summary */}
        <section className="rounded-lg border border-payroll-light/80 bg-payroll-cream p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Net Summary
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Basic Salary</span>
              <span className="tabular-nums">
                NPR {(Number(form.basicSalary) || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">
                Grade ({form.gradePercent || 0}%)
              </span>
              <span className="tabular-nums">
                NPR{" "}
                {Math.round(
                  ((Number(form.basicSalary) || 0) *
                    (Number(form.gradePercent) || 0)) /
                    100,
                ).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Grade Amount</span>
              <span className="tabular-nums">
                NPR {(Number(form.gradeAmount) || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Allowances</span>
              <span className="tabular-nums text-emerald-600">
                + NPR{" "}
                {form.allowanceAmounts
                  .reduce((s, a) => s + (Number(a) || 0), 0)
                  .toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Deductions</span>
              <span className="tabular-nums text-red-600">
                - NPR{" "}
                {form.deductionAmounts
                  .reduce((s, a) => s + (Number(a) || 0), 0)
                  .toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Loan Deductions</span>
              <span className="tabular-nums text-amber-600">
                - NPR{" "}
                {(
                  (Number(form.loan1Deduction) || 0) +
                  (Number(form.loan2Deduction) || 0)
                ).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-payroll-light pt-2 font-semibold">
              <span className="text-payroll-navy">Net Amount</span>
              <span className="tabular-nums text-payroll-navy">
                NPR {computedNet.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </section>
      </form>
    </Dialog>
  );
}
