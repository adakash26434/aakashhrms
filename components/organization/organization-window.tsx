"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { FormGrid, GridField, type GridFieldSize } from "@/components/kit/form-grid";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { Window, WindowButton } from "@/components/kit/window";
import { saveOrgRecordAction } from "@/app/actions/organization.actions";
import {
  ORG_KIND_LABEL,
  validateBranchInput,
  validateDepartmentInput,
  validateDesignationInput,
  validateLevelInput,
  validateTypeInput,
} from "@/lib/engines/organization.engine";
import type { OrgErrors, OrgKind, OrganizationData } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { BranchFields, branchForm, type BranchForm } from "./organization-branch-window";
import { DepartmentFields, departmentForm, type DepartmentForm } from "./organization-department-window";
import { DesignationFields, designationForm, type DesignationForm } from "./organization-designation-window";
import { LevelFields, levelForm, type LevelForm } from "./organization-level-window";
import { TypeFields, typeForm, type TypeForm } from "./organization-type-window";

export interface EditTarget {
  kind: OrgKind;
  /** null = new record */
  id: string | null;
}

/** What each per-kind field set receives. */
export interface FieldsProps<T> {
  form: T;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  errors: OrgErrors;
  data: OrganizationData;
  id: string | null;
  /** Called after an action outside the form changed the data (e.g. a level preset). */
  onDone: () => void;
}

/** A plain text box bound to a form field (the name is what Enter validation checks). */
export function TextInput({
  name,
  value,
  onChange,
  placeholder,
  code,
  maxLength = 120,
  upper,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  code?: boolean;
  maxLength?: number;
  upper?: boolean;
}) {
  return (
    <input
      name={name}
      value={value}
      maxLength={maxLength}
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      onChange={(e) => onChange(upper ? e.target.value.toUpperCase().replace(/\s/g, "") : e.target.value)}
      className={cn(inputClass, code && "font-code")}
    />
  );
}

/** Label + field row in the Window's grid. */
export function Row({
  label,
  required,
  error,
  help,
  size = "md",
  span,
  suffix,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  size?: GridFieldSize;
  span?: 1 | 2 | 3;
  suffix?: ReactNode;
  children: ReactNode;
}) {
  return (
    <GridField label={label} required={required} error={error} help={help} size={size} span={span} suffix={suffix}>
      {children}
    </GridField>
  );
}

type AnyForm = BranchForm | DepartmentForm | DesignationForm | LevelForm | TypeForm;

function initialForm(kind: OrgKind, id: string | null, data: OrganizationData): AnyForm {
  switch (kind) {
    case "branch":
      return branchForm(data.branches.find((b) => b.id === id));
    case "department":
      return departmentForm(data.departments.find((d) => d.id === id), data);
    case "designation":
      return designationForm(data.designations.find((d) => d.id === id));
    case "level":
      return levelForm(data.levels.find((l) => l.id === id), data);
    case "type":
      return typeForm(data.types.find((t) => t.id === id), data);
  }
}

/** The same rules the server runs (lib/engines/organization.engine.ts). */
function validateAll(kind: OrgKind, form: AnyForm, id: string | null, data: OrganizationData): OrgErrors {
  switch (kind) {
    case "branch":
      return validateBranchInput(form as BranchForm, data.branches, id);
    case "department": {
      const f = form as DepartmentForm;
      const errors = validateDepartmentInput({ ...f, branchIds: f.allBranches ? [] : f.branchIds }, data.departments, data.branches.map((b) => b.id), id);
      if (!f.allBranches && !f.branchIds.length) errors.branchIds = "Choose at least one branch, or answer Yes to All branches";
      return errors;
    }
    case "designation":
      return validateDesignationInput(form as DesignationForm, data.designations, data.departments.map((d) => d.id), id);
    case "level":
      return validateLevelInput(form as LevelForm, data.levels, id);
    case "type":
      return validateTypeInput(form as TypeForm, data.types, id);
  }
}

/** The data sent to the server (the department's "all branches" becomes an empty list). */
function payload(kind: OrgKind, form: AnyForm): unknown {
  if (kind === "department") {
    const { allBranches, ...rest } = form as DepartmentForm;
    return { ...rest, branchIds: allBranches ? [] : rest.branchIds };
  }
  return form;
}

/**
 * Editor Window for one master (template B, short record): a FormGrid with
 * right-aligned labels on the grey panel, Enter moves to the next field after
 * checking it, Save at the end; closing with changes asks first.
 */
export function OrganizationWindow({ target, data, onClose, onSaved }: { target: EditTarget | null; data: OrganizationData; onClose: () => void; onSaved: () => void }) {
  if (!target) return null;
  return <EditorBody key={`${target.kind}:${target.id ?? "new"}`} target={target} data={data} onClose={onClose} onSaved={onSaved} />;
}

function EditorBody({ target, data, onClose, onSaved }: { target: EditTarget; data: OrganizationData; onClose: () => void; onSaved: () => void }) {
  const { kind, id } = target;
  const initial = useMemo(() => initialForm(kind, id, data), [kind, id, data]);
  const [form, setForm] = useState<AnyForm>(initial);
  const [errors, setErrors] = useState<OrgErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const noun = ORG_KIND_LABEL[kind];

  const set = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }) as AnyForm);
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  /** Enter on a field: check just that field. Parts of a field ("location.district") check the field. */
  const validate = (name: string) => {
    const field = name.split(".")[0];
    const message = validateAll(kind, form, id, data)[field];
    setErrors((e) => ({ ...e, [field]: message ?? "" }));
    return !message;
  };

  const save = async () => {
    if (saving) return;
    const all = validateAll(kind, form, id, data);
    setErrors(all);
    if (Object.keys(all).length) {
      setFailure("Some fields need attention.");
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await saveOrgRecordAction(kind, id, payload(kind, form));
    setSaving(false);
    if (!result.success) {
      if (result.validationErrors) setErrors(result.validationErrors);
      setFailure(result.error);
      return;
    }
    onSaved();
  };

  const props = { errors, data, id, onDone: onSaved };
  const fields = (() => {
    switch (kind) {
      case "branch":
        return <BranchFields {...props} form={form as BranchForm} set={set as FieldsProps<BranchForm>["set"]} />;
      case "department":
        return <DepartmentFields {...props} form={form as DepartmentForm} set={set as FieldsProps<DepartmentForm>["set"]} />;
      case "designation":
        return <DesignationFields {...props} form={form as DesignationForm} set={set as FieldsProps<DesignationForm>["set"]} />;
      case "level":
        return <LevelFields {...props} form={form as LevelForm} set={set as FieldsProps<LevelForm>["set"]} />;
      case "type":
        return <TypeFields {...props} form={form as TypeForm} set={set as FieldsProps<TypeForm>["set"]} />;
    }
  })();

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      title={id ? `Edit ${noun}` : `New ${noun}`}
      description={id ? (form as { name?: string }).name || undefined : "Enter moves to the next field; Save is at the end."}
      size={kind === "designation" ? "md" : "xl"}
      footer={
        <>
          <WindowButton onClick={onClose} disabled={saving}>
            Cancel
          </WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {id ? "Save changes" : `Add ${noun}`}
          </WindowButton>
        </>
      }
    >
      {failure && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
          {failure}
        </p>
      )}
      <PropertyForm onSubmit={save} enterNavigation={{ validate, end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0">
        <div className="bg-surface-panel">
          <FormGrid columns={2}>{fields}</FormGrid>
        </div>
      </PropertyForm>
    </Window>
  );
}
