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
import { getActiveLoansByEmployeeAction } from "@/app/actions/loan.actions";

interface SalaryMappingFormModalProps {
  open: boolean;
  editingMapping: SalaryMapping | null;
  employees: {
    id: string;
    employeeCode: string;
    fullName: string;
    departmentName: string;
    designationName: string;
    basicSalary?: number;
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
    gradePercent: "0",
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
    gradePercent: "0",
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
    gradePercent: 0,
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

  const [activeEmployeeLoans, setActiveEmployeeLoans] = useState<
    Array<{ id: string; loanTypeName: string; installmentAmount: number; remainingAmount: number }>
  >([]);

  useEffect(() => {
    const targetEmpId = form.employeeId || editingMapping?.employeeId;
    if (targetEmpId && open) {
      getActiveLoansByEmployeeAction(targetEmpId).then((res) => {
        if (res.success && res.data) {
          setActiveEmployeeLoans(
            res.data.map((l) => ({
              id: l.id,
              loanTypeName: l.loanTypeName,
              installmentAmount: l.installmentAmount,
              remainingAmount: l.remainingAmount,
            }))
          );
        } else {
          setActiveEmployeeLoans([]);
        }
      });
    } else {
      setActiveEmployeeLoans([]);
    }
  }, [form.employeeId, editingMapping?.employeeId, open]);

  const selectedEmployee = employees.find((e) => e.id === form.employeeId);

  // Computed net salary preview
  const computedNet = useMemo(() => {
    const basic = Number(form.basicSalary) || 0;
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
    return Math.max(
      0,
      Math.round(
        basic + ga + totalAllowances - totalDeductions - l1 - l2,
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
    const empBasic = emp?.basicSalary ? Number(emp.basicSalary) : 0;
    const basicToUse = empBasic > 0 ? empBasic : (Number(form.basicSalary) || 0);
    const gradeCountToUse = emp?.gradeCount ?? 0;

    let gradeAmt = emp ? emp.gradeAmount : 0;
    if (gradeCountToUse > 0 && basicToUse > 0 && activeGradePolicy.calculationMethod !== "MANUAL_INPUT") {
      gradeAmt = calculateTotalGradeAmount(basicToUse, gradeCountToUse, activeGradePolicy);
    }

    setForm((f) => {
      const next = {
        ...f,
        employeeId: id,
        basicSalary: empBasic > 0 ? String(empBasic) : f.basicSalary,
        gradePercent: "0",
        gradeAmount: String(gradeAmt),
      };

      if (isSsfEnrolled && basicToUse > 0) {
        const ssfErAmt = Math.round(basicToUse * 0.20);
        const ssfTotalAmt = Math.round(basicToUse * 0.31);
        if (ssfAllowanceHead) {
          const idx = next.allowanceHeadIds.indexOf(ssfAllowanceHead.id);
          if (idx >= 0) next.allowanceAmounts[idx] = String(ssfErAmt);
        }
        if (ssfDeductionHead) {
          const idx = next.deductionHeadIds.indexOf(ssfDeductionHead.id);
          if (idx >= 0) next.deductionAmounts[idx] = String(ssfTotalAmt);
        }
      }

      return next;
    });

    if (!isEdit) {
      getActiveLoansByEmployeeAction(id).then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          const l1 = res.data[0];
          const l2 = res.data[1];
          const l1Deduct = l1 ? Math.min(l1.installmentAmount, l1.remainingAmount) : 0;
          const l2Deduct = l2 ? Math.min(l2.installmentAmount, l2.remainingAmount) : 0;
          setForm((prev) => ({
            ...prev,
            loan1Deduction: String(l1Deduct),
            loan2Deduction: String(l2Deduct),
          }));
        }
      });
    }
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
      "h-9.5 w-full rounded-md border bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-colors",
      hasError
        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500"
        : "border-zinc-200 focus:border-payroll-primary focus:ring-payroll-primary",
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Salary Mapping` : "New Salary Mapping"}
      description={
        isEdit && selectedEmployee
          ? `Editing official payroll mapping for ${selectedEmployee.fullName}`
          : "Define employee salary structure including allowances, deductions, and statutory funds."
      }
      size="3xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium px-4 py-2 text-sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="salary-mapping-form"
            className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium px-5 py-2 text-sm transition-colors cursor-pointer"
          >
            {isEdit ? "Save Changes" : "Create Mapping"}
          </Button>
        </div>
      }
    >
      <form
        id="salary-mapping-form"
        onSubmit={handleSubmit}
        className="divide-y divide-zinc-200/60"
        noValidate
      >
        {/* 1. Employee Target */}
        <div className="space-y-3 pb-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Employee Target
            </h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Select the registered personnel profile to define or update recurring salary heads.
            </p>
          </div>
          <div className="space-y-2">
            {isEdit && selectedEmployee ? (
              <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3.5">
                <p className="text-sm font-semibold text-zinc-900">
                  {selectedEmployee.fullName}
                </p>
                <p className="text-xs text-zinc-600 font-medium mt-0.5">
                  {selectedEmployee.employeeCode} · {selectedEmployee.departmentName} · {selectedEmployee.designationName}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Select Employee *
                </label>
                <select
                  value={form.employeeId}
                  onChange={(e) => handleEmployeeSelect(e.target.value)}
                  className={inputClass(Boolean(errors.employeeId))}
                >
                  <option value="">-- Choose employee --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.employeeCode}) — {e.designationName}
                    </option>
                  ))}
                </select>
                {errors.employeeId && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{errors.employeeId}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Base Compensation & Progression */}
        <div className="space-y-3 py-6 border-t border-zinc-200">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Base Compensation
            </h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Core monthly basic salary and Nepal Labour Act grade progression adjustments.
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Basic Salary (NPR) *
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
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-zinc-400">
                    NPR
                  </span>
                </div>
                {errors.basicSalary && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{errors.basicSalary}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Grade Amount (NPR)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={form.gradeAmount}
                    onChange={(e) => update("gradeAmount", e.target.value)}
                    className={inputClass(Boolean(errors.gradeAmount))}
                    placeholder="e.g. 2500"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-zinc-400">
                    NPR
                  </span>
                </div>
                {errors.gradeAmount && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{errors.gradeAmount}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Grade Progression Status
              </label>
              <div className="flex h-9.5 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700">
                {selectedEmployee?.gradeCount !== undefined && selectedEmployee.gradeCount > 0 ? (
                  <span className="text-emerald-800 font-semibold">
                    {selectedEmployee.gradeCount} Grade Step(s) active · Basic / 30 rule
                  </span>
                ) : (
                  <span className="text-zinc-500">0 Steps (Initial baseline scale)</span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium mt-1">Automatically linked to employee master career record</p>
            </div>
          </div>
        </div>

        {/* 3. Social Security Fund (SSF) Facility */}
        <div className="space-y-3 py-6 border-t border-zinc-200">
          <div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                Social Security Fund
              </h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-0.5">
              Government statutory facility. Adds 20% employer addition and deducts 31% total contribution.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/60 p-3.5">
              <div>
                <p className="text-xs font-semibold text-zinc-900">
                  Enroll in Government SSF
                </p>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                  Automatic computation of 11% employee deduction + 20% employer contribution.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isSsfEnrolled}
                onClick={() => handleToggleSsf(!isSsfEnrolled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-payroll-primary/20",
                  isSsfEnrolled ? "bg-payroll-primary" : "bg-zinc-300"
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
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-md bg-white p-2.5 border border-zinc-200">
                  <span className="block text-[10px] text-zinc-500 uppercase font-semibold">Employer Addition</span>
                  <span className="text-xs font-semibold text-emerald-800 font-mono mt-0.5 block">+20% (NPR {Math.round((Number(form.basicSalary) || 0) * 0.20).toLocaleString("en-IN")})</span>
                </div>
                <div className="rounded-md bg-white p-2.5 border border-zinc-200">
                  <span className="block text-[10px] text-zinc-500 uppercase font-semibold">Total SSF Deduction</span>
                  <span className="text-xs font-semibold text-rose-700 font-mono mt-0.5 block">-31% (NPR {Math.round((Number(form.basicSalary) || 0) * 0.31).toLocaleString("en-IN")})</span>
                </div>
                <div className="rounded-md bg-white p-2.5 border border-zinc-200">
                  <span className="block text-[10px] text-zinc-500 uppercase font-semibold">Net Employee Impact</span>
                  <span className="text-xs font-semibold text-amber-700 font-mono mt-0.5 block">-11% (NPR {Math.round((Number(form.basicSalary) || 0) * 0.11).toLocaleString("en-IN")})</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Recurring Allowances */}
        <div className="space-y-3 py-6 border-t border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                Recurring Allowances
              </h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-0.5">
                Fixed monthly earnings added directly to gross compensation.
              </p>
            </div>
            <button
              type="button"
              onClick={addAllowance}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              + Add Allowance Head
            </button>
          </div>
          <div className="space-y-2.5">
            {form.allowanceHeadIds.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center text-xs text-zinc-500 font-medium">
                No recurring allowances configured. Click &ldquo;+ Add Allowance Head&rdquo; to add.
              </div>
            ) : (
              <div className="space-y-2">
                {form.allowanceHeadIds.map((headId, i) => (
                  <div
                    key={headId}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-2"
                  >
                    <select
                      value={headId}
                      onChange={(e) => {
                        const newIds = [...form.allowanceHeadIds];
                        newIds[i] = e.target.value;
                        update("allowanceHeadIds", newIds);
                      }}
                      className="h-8.5 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 font-medium focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
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
                    <div className="relative w-32">
                      <input
                        type="number"
                        min={0}
                        value={form.allowanceAmounts[i]}
                        onChange={(e) => {
                          const newAmounts = [...form.allowanceAmounts];
                          newAmounts[i] = e.target.value;
                          update("allowanceAmounts", newAmounts);
                        }}
                        className="h-8.5 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 font-mono text-right focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                        placeholder="Amount"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAllowance(i)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. Deductions */}
        <div className="space-y-3 py-6 border-t border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                Salary Deductions
              </h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-0.5">
                Operational or voluntary monthly withholdings (CIT, Provident Fund, Welfare).
              </p>
            </div>
            <button
              type="button"
              onClick={addDeduction}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              + Add Deduction Head
            </button>
          </div>
          <div className="space-y-2.5">
            {form.deductionHeadIds.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center text-xs text-zinc-500 font-medium">
                No custom deductions configured. Click &ldquo;+ Add Deduction Head&rdquo; to add.
              </div>
            ) : (
              <div className="space-y-2">
                {form.deductionHeadIds.map((headId, i) => (
                  <div
                    key={headId}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-2"
                  >
                    <select
                      value={headId}
                      onChange={(e) => {
                        const newIds = [...form.deductionHeadIds];
                        newIds[i] = e.target.value;
                        update("deductionHeadIds", newIds);
                      }}
                      className="h-8.5 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 font-medium focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
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
                    <div className="relative w-32">
                      <input
                        type="number"
                        min={0}
                        value={form.deductionAmounts[i]}
                        onChange={(e) => {
                          const newAmounts = [...form.deductionAmounts];
                          newAmounts[i] = e.target.value;
                          update("deductionAmounts", newAmounts);
                        }}
                        className="h-8.5 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 font-mono text-right focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                        placeholder="Amount"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDeduction(i)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. Loan Recoveries */}
        <div className="space-y-3 py-6 border-t border-zinc-200">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Loan Recoveries
            </h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-0.5">
              Monthly installment deductions applied towards active company advance facilities.
            </p>
          </div>

          {activeEmployeeLoans.length > 0 && (
            <div className="rounded-md border border-emerald-200/70 bg-emerald-50/50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-950 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 inline-block" />
                  Active Staff Loans ({activeEmployeeLoans.length} active)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const l1 = activeEmployeeLoans[0];
                    const l2 = activeEmployeeLoans[1];
                    setForm((f) => ({
                      ...f,
                      loan1Deduction: String(l1 ? Math.min(l1.installmentAmount, l1.remainingAmount) : 0),
                      loan2Deduction: String(l2 ? Math.min(l2.installmentAmount, l2.remainingAmount) : 0),
                    }));
                  }}
                  className="text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
                >
                  Auto-fill Contract EMIs
                </button>
              </div>
              <div className="text-[10px] text-emerald-800 space-y-0.5">
                {activeEmployeeLoans.map((l, idx) => (
                  <div key={l.id} className="flex justify-between font-mono">
                    <span>Loan {idx + 1}: {l.loanTypeName} (EMI: NPR {l.installmentAmount.toLocaleString()})</span>
                    <span>Remaining Balance: NPR {l.remainingAmount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Loan 1 Deduction (NPR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.loan1Deduction}
                  onChange={(e) => update("loan1Deduction", e.target.value)}
                  className={inputClass(false)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Loan 2 Deduction (NPR)
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
            <p className="text-[11px] text-zinc-500 font-medium">
              Standard recurring amortizations synced from employee loan contracts.
            </p>
          </div>
        </div>

        {/* 7. Net Compensation Summary */}
        <div className="space-y-3 pt-6 border-t border-zinc-200">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Compensation Summary
            </h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-0.5">
              Real-time calculation of gross compensation, deductions, and projected net payable.
            </p>
          </div>
          <div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Basic Salary</span>
                <span className="tabular-nums font-mono text-zinc-900 font-semibold">
                  NPR {(Number(form.basicSalary) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Grade Amount</span>
                <span className="tabular-nums font-mono text-zinc-900 font-semibold">
                  NPR {(Number(form.gradeAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Total Allowances</span>
                <span className="tabular-nums font-mono text-emerald-800 font-semibold">
                  + NPR{" "}
                  {form.allowanceAmounts
                    .reduce((s, a) => s + (Number(a) || 0), 0)
                    .toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Total Deductions</span>
                <span className="tabular-nums font-mono text-rose-700 font-semibold">
                  - NPR{" "}
                  {form.deductionAmounts
                    .reduce((s, a) => s + (Number(a) || 0), 0)
                    .toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Loan Deductions</span>
                <span className="tabular-nums font-mono text-amber-700 font-semibold">
                  - NPR{" "}
                  {(
                    (Number(form.loan1Deduction) || 0) +
                    (Number(form.loan2Deduction) || 0)
                  ).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3 text-sm font-semibold">
                <span className="text-zinc-900">Projected Net Monthly</span>
                <span className="tabular-nums font-mono text-emerald-800 font-bold text-base">
                  NPR {computedNet.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
