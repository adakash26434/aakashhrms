"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { TaxCategory, TaxSlab, TaxSlabFormData } from "@/lib/types/tax-rate";

/**
 * The two modes the form can be opened in. (The name is exported for
 * downstream code that wants to introspect.)
 */
export type SlabFormMode = "create" | "edit";

interface TaxSlabFormModalProps {
  open: boolean;
  editingSlab: TaxSlab | null;
  fiscalYearLabel: string;
  category: TaxCategory;
  newDefaults: { amountFrom: number; amountTo: number | null; ratePercent: number; fixedDeduction: number; } | null;
  onClose: () => void;
  onSubmit: (data: TaxSlabFormData) => void;
}

type FormErrors = Partial<
  Record<
    | "amountFrom"
    | "amountTo"
    | "ratePercent"
    | "fixedDeduction"
    | "deductionRule",
    string
  >
>;

/**
 * Local form state — uses strings while the user is typing so we
 * don't fight their input (e.g. "0." while typing "0.5"). We
 * convert to number on submit/validate.
 */
interface FormState {
  amountFromText: string;
  amountToText: string;
  /** "on" → store null in payload (open-ended), "off" → use amountToText */
  openEnded: boolean;
  ratePercentText: string;
  fixedDeductionText: string;
}

function buildInitialForm(
  editing: TaxSlab | null,
  defaults: TaxSlabFormModalProps["newDefaults"]
): FormState {
  if (editing) {
    return {
      amountFromText: String(editing.amountFrom),
      amountToText: editing.amountTo ? String(editing.amountTo) : "",
      openEnded: editing.amountTo === null,
      ratePercentText: String(editing.ratePercent),
      fixedDeductionText: String(editing.fixedDeduction),
    };
  }
  
  // IF DEFAULTS WERE PASSED IN, USE THEM INSTANTLY!
  if (defaults) {
    return {
      amountFromText: String(defaults.amountFrom),
      // Default to empty and non-open-ended when creating a new slab
      amountToText: "",
      openEnded: false,
      ratePercentText: String(defaults.ratePercent),
      fixedDeductionText: String(defaults.fixedDeduction),
    };
  }

  // Absolute fallback
  return {
    amountFromText: "0",
    amountToText: "",
    openEnded: false,
    ratePercentText: "0",
    fixedDeductionText: "0",
  };
}

function toPayload(state: FormState): TaxSlabFormData {
  return {
    amountFrom: Number(state.amountFromText),
    amountTo: state.openEnded
      ? null
      : state.amountToText.trim() === ""
        ? NaN
        : Number(state.amountToText),
    ratePercent: Number(state.ratePercentText),
    fixedDeduction: Number(state.fixedDeductionText),
  };
}

/**
 * Form modal for creating and editing a single tax slab.
 *
 * The form enforces the ladder rules from the architecture doc:
 *   1. Slab 1 has fixed deduction = 0 (read-only in form).
 *   2. Slab 1 has amountFrom = 0 (pre-filled, not editable when first).
 *   3. Each non-final slab's amountFrom = previous.amountTo + 1.
 *   4. The final (top) slab is open-ended ("Above") by default.
 *   5. Rate must be in [0, 100] (allow 0% for tax-free brackets).
 */

export function TaxSlabFormModal({
  open,
  onClose,
  editingSlab,
  category,
  fiscalYearLabel,
  newDefaults,
  onSubmit,
}: TaxSlabFormModalProps) {
  const isEdit = Boolean(editingSlab);
  
  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(editingSlab, newDefaults),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Fix: A slab is the "first slab" if it is not an edit AND its amountFrom is explicitly 0
  const firstSlab = !isEdit && (newDefaults ? newDefaults.amountFrom === 0 : form.amountFromText === "0");

  const title = isEdit
    ? `Edit Slab — ${category}`
    : `New Slab — ${category}`;
  const description = isEdit
    ? `Update the slab for ${category} in ${fiscalYearLabel}.`
    : `Add a new slab to the ${category} ladder for ${fiscalYearLabel}.`;
  const submitLabel = isEdit ? "Save Changes" : "Add Slab";

  // -- Validation ------------------------------------------------------------

  function validate(values: TaxSlabFormData): FormErrors {
    const next: FormErrors = {};

    if (!Number.isFinite(values.amountFrom) || values.amountFrom < 0) {
      next.amountFrom = "Amount From must be 0 or greater.";
    } else if (!Number.isInteger(values.amountFrom)) {
      next.amountFrom = "Amount From must be a whole number (no decimals).";
    }

    if (values.amountTo !== null) {
      if (!Number.isFinite(values.amountTo)) {
        next.amountTo = "Amount To is required, or tick ‘Open-ended (Above)’.";
      } else if (!Number.isInteger(values.amountTo)) {
        next.amountTo = "Amount To must be a whole number (no decimals).";
      } else if (values.amountTo <= values.amountFrom) {
        next.amountTo = "Amount To must be greater than Amount From.";
      }
    }

    if (!Number.isFinite(values.ratePercent)) {
      next.ratePercent = "Tax rate is required.";
    } else if (values.ratePercent < 0 || values.ratePercent > 100) {
      next.ratePercent = "Tax rate must be between 0 and 100.";
    }

    if (!Number.isFinite(values.fixedDeduction) || values.fixedDeduction < 0) {
      next.fixedDeduction = "Fixed deduction must be 0 or greater.";
    } else if (firstSlab && values.fixedDeduction !== 0) {
      next.deductionRule = "The first slab's fixed deduction is always 0 (set by the tax ladder).";
    }

    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = toPayload(form);
    const nextErrors = validate(payload);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(payload);
  }

  const fieldId = useMemo(() => {
    const prefix = isEdit ? "edit" : "new";
    return {
      amountFrom: `${prefix}-slab-amount-from`,
      amountTo: `${prefix}-slab-amount-to`,
      openEnded: `${prefix}-slab-open-ended`,
      rate: `${prefix}-slab-rate`,
      fixed: `${prefix}-slab-fixed`,
    };
  }, [isEdit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="tax-slab-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="tax-slab-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        {/* Category + FY */}
        <div className="rounded-lg border border-[#d7e8d0] bg-[#f6faf6] px-3 py-2 text-xs text-gray-600">
          <span className="font-medium text-[#1b3a1f]">{category}</span> · FY{" "}
          <span className="font-medium text-[#1b3a1f]">{fiscalYearLabel}</span> ·{" "}
          {firstSlab
            ? "Adding first slab of ladder"
            : isEdit
              ? "Editing existing slab"
              : "Appending to end of ladder"}
        </div>

        {/* Amount From + Amount To */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id={fieldId.amountFrom} label="Amount From (NPR)" error={errors.amountFrom}>
            <input
              id={fieldId.amountFrom}
              type="number"
              min={0}
              step={1}
              value={form.amountFromText}
              onChange={(e) => setForm((f) => ({ ...f, amountFromText: e.target.value }))}
              disabled={firstSlab || (!isEdit && newDefaults !== null)} // Always disable AmountFrom on create, it's auto-calculated!
              className={inputClass(Boolean(errors.amountFrom), firstSlab || (!isEdit && newDefaults !== null))}
            />
            {firstSlab && <p className="mt-1 text-[11px] text-gray-500">The first slab always starts at 0.</p>}
            {!firstSlab && !isEdit && newDefaults && (
              <p className="mt-1 text-[11px] text-gray-500">Pre-filled from the previous slabs Amount To + 1.</p>
            )}
          </Field>

          <Field id={fieldId.amountTo} label="Amount To (NPR)" error={errors.amountTo}>
            <input
              id={fieldId.amountTo}
              type="number"
              min={0}
              step={1}
              value={form.amountToText}
              onChange={(e) => setForm((f) => ({ ...f, amountToText: e.target.value }))}
              disabled={form.openEnded}
              placeholder={form.openEnded ? "Above (no upper limit)" : ""}
              className={inputClass(Boolean(errors.amountTo), form.openEnded)}
            />
            <label htmlFor={fieldId.openEnded} className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <input
                id={fieldId.openEnded}
                type="checkbox"
                checked={form.openEnded}
                onChange={(e) => setForm((f) => ({ ...f, openEnded: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-[#d7e8d0] text-[#2e7d32] focus:ring-[#2e7d32]"
              />
              Open-ended (Above) — this slab has no upper limit
            </label>
          </Field>
        </div>

        {/* Tax Rate + Fixed Deduction */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id={fieldId.rate} label="Tax Rate (%)" error={errors.ratePercent}>
            <input
              id={fieldId.rate}
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.ratePercentText}
              onChange={(e) => setForm((f) => ({ ...f, ratePercentText: e.target.value }))}
              placeholder="e.g., 10"
              className={inputClass(Boolean(errors.ratePercent), false)}
            />
          </Field>

          <Field id={fieldId.fixed} label="Fixed Deduction (NPR)" error={errors.fixedDeduction || errors.deductionRule}>
            <input
              id={fieldId.fixed}
              type="number"
              min={0}
              step={1}
              value={form.fixedDeductionText}
              onChange={(e) => setForm((f) => ({ ...f, fixedDeductionText: e.target.value }))}
              disabled={firstSlab}
              className={inputClass(Boolean(errors.fixedDeduction || errors.deductionRule), firstSlab)}
            />
            {firstSlab && (
              <p className="mt-1 text-[11px] text-gray-500">Slab 1 always has a fixed deduction of 0.</p>
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

// -- Internal helpers --------------------------------------------------------

function inputClass(hasError: boolean, isDisabled: boolean) {
  return [
    "h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1",
    isDisabled
      ? "cursor-not-allowed border-[#d7e8d0]/60 bg-[#f6faf6] text-gray-500"
      : hasError
        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
        : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
  ].join(" ");
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
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
