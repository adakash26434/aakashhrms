"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, SaveAll, TriangleAlert, X } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DiscardBar } from "@/components/kit/discard-bar";
import { PropertyForm } from "@/components/kit/property-form";
import { SectionIndex } from "@/components/kit/section-index";
import { useUnsavedGuard } from "@/components/kit/use-unsaved-guard";
import { scrollIntoContainer } from "@/components/kit/scroll-into-view";
import { Window, WindowButton } from "@/components/kit/window";
import { saveEmployeeAction } from "@/app/actions/employee.actions";
import { EMPLOYEE_FORM_SECTIONS, fieldLabel, type EmployeeField } from "@/lib/constants/employee-form";
import { codeConflicts, getNextAttendanceCode, getNextEmployeeCode, sectionProgress, validateEmployee, validateEmployeeField } from "@/lib/engines/employee.engine";
import { parseStructuredAddress } from "@/lib/constants/nepal-locations";
import type { EmployeeAccessOptions } from "@/lib/services/employee.service";
import type { EmployeeFormContext, EmployeeFormData, EmployeeValidationErrors } from "@/lib/types/employee";
import { cn } from "@/lib/utils";
import type { EmployeeFormApi } from "./employee-form-fields";
import { EmployeeFormIdentification } from "./employee-form-identification";
import { EmployeeFormJob } from "./employee-form-job";
import { EmployeeFormDocuments } from "./employee-form-documents";
import { EmployeeFormContact } from "./employee-form-contact";
import { EmployeeFormFamily } from "./employee-form-family";
import { EmployeeFormBank } from "./employee-form-bank";
import { EmployeeFormAccess } from "./employee-form-access";
import { EmployeeFormSeparation } from "./employee-form-separation";

/** Fields kept by "Save & add another", for entering several people in a row. */
const CARRY_OVER: EmployeeField[] = ["branchId", "departmentId", "category", "joiningDate"];

type Notice = { kind: "login"; name: string; email: string; tempPassword: string; next: () => void } | { kind: "warning"; message: string; next: () => void };

function focusField(field: string) {
  const el =
    document.querySelector<HTMLElement>(`[name="${field}"]`) ??
    document.querySelector<HTMLElement>(`[name^="${field}."]`) ??
    document.getElementById(`section-${field}`);
  if (!el) return;
  scrollIntoContainer(el, { block: "center" });
  el.focus({ preventScroll: true });
}

/**
 * Full-page employee form (4.2): one scrolling form with a section index.
 * Enter checks each field and moves on (Shift+Enter goes back), Ctrl+S saves,
 * and leaving with unsaved changes asks first. The server re-validates
 * everything and checks scope (S18).
 */
export function EmployeeForm({ ctx }: { ctx: EmployeeFormContext }) {
  const router = useRouter();
  const isNew = !ctx.employeeId;
  const [baseline, setBaseline] = useState<EmployeeFormData>(ctx.initial);
  const [form, setForm] = useState<EmployeeFormData>(ctx.initial);
  const [errors, setErrors] = useState<EmployeeValidationErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState<null | "save" | "another">(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [codes, setCodes] = useState(ctx.codes);
  const [accountConfirm, setAccountConfirm] = useState("");
  const [sameAddress, setSameAddress] = useState(() => !ctx.initial.temporaryAddress || ctx.initial.temporaryAddress === ctx.initial.permanentAddress);
  const defaultRole = ctx.roles.find((r) => r.slug === "employee") ?? ctx.roles[0];
  const [access, setAccess] = useState<EmployeeAccessOptions>(() =>
    ctx.access
      ? { roleId: ctx.access.roleId ?? undefined, roleSlug: ctx.roles.find((r) => r.id === ctx.access?.roleId)?.slug }
      : { createLogin: true, roleId: defaultRole?.id, roleSlug: defaultRole?.slug ?? "employee" }
  );
  const saveRef = useRef<HTMLButtonElement>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const leave = useUnsavedGuard(dirty && saving === null);
  const needsConfirm = !!form.bankAccountNumber && form.bankAccountNumber !== baseline.bankAccountNumber;
  const showSeparation = form.status === "Inactive" || !!baseline.terminationDate || !!form.terminationDate;
  const sections = EMPLOYEE_FORM_SECTIONS.filter((s) => s.id !== "separation" || showSeparation);
  const progress = sectionProgress(form, errors, sections);

  const clearError = (field: string) =>
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });

  const api: EmployeeFormApi = {
    form,
    errors,
    ctx: { ...ctx, codes },
    isNew,
    set: (field, value) => {
      setForm((f) => ({ ...f, [field]: value }));
      clearError(field);
    },
    patch: (values) => {
      setForm((f) => ({ ...f, ...values }));
      Object.keys(values).forEach(clearError);
    },
  };

  /** The data that is saved: email mirrors the company email; "same address" copies it. */
  const payload = (): EmployeeFormData => ({
    ...form,
    email: form.companyEmail,
    temporaryAddress: sameAddress ? form.permanentAddress : form.temporaryAddress,
  });

  /** Every check the save makes, plus the form-only ones (codes, re-typed account). */
  const checkAll = (data: EmployeeFormData): EmployeeValidationErrors => {
    const all: EmployeeValidationErrors = { ...validateEmployee(data), ...codeConflicts(codes, data, ctx.employeeId) };
    if (needsConfirm && accountConfirm !== data.bankAccountNumber) all.bankAccountConfirm = "The account numbers do not match";
    // validateEmployee also reports aliases of these fields under old names; keep one message each.
    delete all.email;
    delete all.address1;
    return all;
  };

  /** Enter on a field: check just that field (the rules the server uses). */
  const validate = (name: string): boolean => {
    let field = name;
    let message: string | null = null;
    if (name === "bankAccountConfirm") {
      message = accountConfirm === form.bankAccountNumber ? null : "The account numbers do not match";
    } else if (name.startsWith("permanentAddress.")) {
      field = "permanentAddress";
      const part = name.split(".")[1];
      const a = parseStructuredAddress(form.permanentAddress);
      if (part === "district" && !a.district) message = "Choose the district";
      else if (part === "localLevel" && !a.localLevel) message = "Choose the local level (palika)";
    } else if (name.includes(".") || name.startsWith("access")) {
      return true;
    } else {
      const data = payload();
      message = validateEmployeeField(data, name as EmployeeField) ?? codeConflicts(codes, data, ctx.employeeId)[name] ?? null;
    }
    setErrors((e) => ({ ...e, [field]: message ?? undefined }));
    return !message;
  };

  const firstError = (all: EmployeeValidationErrors): string | undefined => {
    for (const section of sections) {
      const hit = section.fields.find((f) => all[f]);
      if (hit) return hit;
      if (section.id === "bank" && all.bankAccountConfirm) return "bankAccountConfirm";
    }
    return Object.keys(all).find((k) => all[k]);
  };

  const finish = (another: boolean, savedId: string, saved: EmployeeFormData) => {
    if (another) {
      const nextCodes = [...codes, { id: savedId, employeeCode: saved.employeeCode, attendanceCode: saved.attendanceCode }];
      const fresh: EmployeeFormData = {
        ...ctx.initial,
        employeeCode: getNextEmployeeCode(nextCodes.map((c) => c.employeeCode)),
        attendanceCode: getNextAttendanceCode(nextCodes.map((c) => c.attendanceCode), "ATD-"),
      };
      for (const f of CARRY_OVER) (fresh as unknown as Record<string, unknown>)[f] = saved[f];
      setCodes(nextCodes);
      setBaseline(fresh);
      setForm(fresh);
      setErrors({});
      setAttempted(false);
      setAccountConfirm("");
      setSameAddress(true);
      setSavedCount((n) => n + 1);
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
        focusField("fullName");
      });
    } else {
      router.push(`/workforce/employees/${savedId}`);
      router.refresh();
    }
  };

  const save = async (another = false) => {
    if (saving) return;
    setFormError(null);
    const data = payload();
    const all = checkAll(data);
    if (Object.keys(all).length > 0) {
      setErrors(all);
      setAttempted(true);
      const first = firstError(all);
      if (first) focusField(first);
      return;
    }
    setSaving(another ? "another" : "save");
    const result = await saveEmployeeAction(ctx.employeeId, data, isNew || !ctx.access ? access : { roleId: access.roleId, roleSlug: access.roleSlug });
    setSaving(null);
    if (!result.success) {
      if (result.validationErrors && Object.keys(result.validationErrors).length > 0) {
        setErrors(result.validationErrors);
        setAttempted(true);
        const first = firstError(result.validationErrors);
        if (first) focusField(first);
      } else {
        setFormError(result.error);
      }
      return;
    }
    setBaseline(data); // saved: leaving no longer asks
    const { employee, provisionedAccess, accessWarning } = result.data;
    const next = () => finish(another, employee.id, data);
    if (provisionedAccess) {
      setNotice({ kind: "login", name: employee.fullName, email: provisionedAccess.email, tempPassword: provisionedAccess.tempPassword, next });
    } else if (accessWarning) {
      setNotice({ kind: "warning", message: accessWarning, next });
    } else {
      next();
    }
  };

  const errorList = attempted ? Object.entries(errors).filter(([, m]) => m) : [];
  const cancel = () => leave.guard(() => (ctx.employeeId ? router.push(`/workforce/employees/${ctx.employeeId}`) : router.push("/workforce/employees")));
  const title = isNew ? "New employee" : `Edit ${ctx.initial.fullName}`;

  return (
    <div>
      <PageBar
        title={title}
        description={isNew ? "Press Enter to move from field to field. Ctrl+S saves." : `${ctx.initial.employeeCode} · Enter moves on, Ctrl+S saves.`}
        status={
          dirty ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-3xs font-medium text-warning">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
            </span>
          ) : savedCount > 0 ? (
            <span className="text-2xs text-success">{savedCount} saved this session</span>
          ) : undefined
        }
        crumbs={isNew ? [{ label: "New" }] : [{ label: ctx.initial.fullName, href: `/workforce/employees/${ctx.employeeId}` }, { label: "Edit" }]}
        actions={[
          { id: "save", label: saving === "save" ? "Saving…" : "Save", icon: Save, group: "create", primary: true, shortcut: "Ctrl+S", disabled: !!saving, onClick: () => save(false) },
          ...(isNew
            ? [{ id: "another", label: "Save & add another", icon: SaveAll, group: "create" as const, shortcut: "Ctrl+Shift+S", disabled: !!saving, onClick: () => save(true) }]
            : []),
          { id: "cancel", label: "Cancel", icon: X, group: "refresh", onClick: cancel },
        ]}
      />

      {(errorList.length > 0 || formError) && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-subtle px-4 py-3 text-xs text-danger">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert aria-hidden className="h-4 w-4" />
            {formError ?? `${errorList.length} ${errorList.length === 1 ? "field needs" : "fields need"} attention before saving`}
          </p>
          {errorList.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-6">
              {errorList.slice(0, 12).map(([field, message]) => (
                <li key={field}>
                  <button type="button" onClick={() => focusField(field)} className="cursor-pointer text-left underline underline-offset-2 hover:no-underline">
                    {field === "bankAccountConfirm" ? "Re-enter account number" : fieldLabel(field)}: {message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SectionIndex
          className="sticky top-0 self-start"
          items={progress.map((p) => ({ id: `section-${p.id}`, label: p.label, state: p.state, errors: p.errors }))}
        />
        <div className="min-w-0">
          <PropertyForm onSubmit={() => save(false)} enterNavigation={{ validate, end: () => saveRef.current }}>
            <EmployeeFormIdentification api={api} />
            <EmployeeFormJob api={api} />
            <EmployeeFormDocuments api={api} />
            <EmployeeFormContact api={api} sameAddress={sameAddress} onSameAddress={setSameAddress} />
            <EmployeeFormFamily api={api} />
            <EmployeeFormBank
              api={api}
              confirm={accountConfirm}
              needsConfirm={needsConfirm}
              onConfirm={(v) => {
                setAccountConfirm(v);
                clearError("bankAccountConfirm");
              }}
            />
            <EmployeeFormAccess api={api} options={access} onOptions={setAccess} />
            {showSeparation && <EmployeeFormSeparation api={api} />}
          </PropertyForm>

          {/* Sticky footer: Enter on the last field lands on Save. It reaches into the page padding so nothing shows beneath it. */}
          <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-6 pb-4 lg:-bottom-6 lg:-mx-6 lg:-mb-6 lg:pb-6 bg-surface-sunken">
            {leave.pending ? (
              <DiscardBar onKeep={leave.keep} onDiscard={leave.discard} />
            ) : (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-sunken/95 px-4 py-2.5 backdrop-blur lg:px-6">
                <p className="mr-auto hidden text-2xs text-ink-faint sm:block">Enter: next field · Shift+Enter: back · Ctrl+S: save</p>
                <WindowButton onClick={cancel} disabled={!!saving}>
                  Cancel
                </WindowButton>
                {isNew && (
                  <WindowButton onClick={() => save(true)} disabled={!!saving}>
                    {saving === "another" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save & add another
                  </WindowButton>
                )}
                <WindowButton ref={saveRef} variant="primary" onClick={() => save(false)} disabled={!!saving} className={cn(saving === "save" && "cursor-wait")}>
                  {saving === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isNew ? "Save employee" : "Save changes"}
                </WindowButton>
              </div>
            )}
          </div>
        </div>
      </div>

      <Window
        open={!!notice}
        onClose={() => {
          const next = notice?.next;
          setNotice(null);
          next?.();
        }}
        title={notice?.kind === "login" ? "Employee saved, login created" : "Employee saved"}
        size="sm"
        footer={
          <WindowButton
            variant="primary"
            onClick={() => {
              const next = notice?.next;
              setNotice(null);
              next?.();
            }}
          >
            Continue
          </WindowButton>
        }
      >
        {notice?.kind === "login" ? (
          <div className="space-y-3 text-sm text-ink-muted">
            <p>
              A self-service login was created for <span className="font-medium text-ink">{notice.name}</span> and the sign-in details were emailed to{" "}
              <span className="font-medium text-ink">{notice.email}</span>.
            </p>
            <p className="rounded-md border border-line bg-surface-sunken px-3 py-2">
              Temporary password (shown once): <span className="font-code text-ink">{notice.tempPassword}</span>
            </p>
            <p className="text-2xs">They must choose their own password at first sign-in.</p>
          </div>
        ) : notice?.kind === "warning" ? (
          <p className="text-sm text-warning">{notice.message}</p>
        ) : null}
      </Window>
    </div>
  );
}
