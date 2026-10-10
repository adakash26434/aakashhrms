"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Check, Contact, GraduationCap, IdCard, Landmark, Loader2, LogOut, Save, SaveAll, ShieldCheck, TriangleAlert, UserRound, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DiscardBar } from "@/components/kit/discard-bar";
import { Notice as NoticeBox } from "@/components/kit/notice";
import { PropertyForm } from "@/components/kit/property-form";
import { useFieldHelp } from "@/components/kit/form-grid";
import { StatusChip } from "@/components/kit/status-chip";
import { Kbd, StatusBar } from "@/components/kit/status-bar";
import { Tabs } from "@/components/kit/tabs";
import { useUnsavedGuard } from "@/components/kit/use-unsaved-guard";
import { scrollIntoContainer } from "@/components/kit/scroll-into-view";
import { Window, WindowButton } from "@/components/kit/window";
import { saveEmployeeAction } from "@/app/actions/employee.actions";
import { EMPLOYEE_FORM_SECTIONS, fieldLabel, sectionOfField, type EmployeeField } from "@/lib/constants/employee-form";
import { codeConflicts, getNextAttendanceCode, getNextEmployeeCode, sectionProgress, validateEmployee, validateEmployeeField } from "@/lib/engines/employee.engine";
import { DETAIL_FIELDS, detailDiff, detailLines, detailSummary, detailValues, inSentence, type DetailLine } from "@/lib/engines/employee-detail.engine";
import { parseStructuredAddress } from "@/lib/constants/nepal-locations";
import type { EmployeeAccessOptions } from "@/lib/services/employee.service";
import type { EmployeeFormContext, EmployeeFormData, EmployeeValidationErrors } from "@/lib/types/employee";
import { cn } from "@/lib/utils";
import { ActiveSectionContext, type EmployeeFormApi } from "./employee-form-fields";
import { EmployeeFormHeader } from "./employee-form-header";
import { EmployeeFormIdentification } from "./employee-form-identification";
import { EmployeeFormJob } from "./employee-form-job";
import { EmployeeFormDocuments } from "./employee-form-documents";
import { EmployeeFormDossier } from "./employee-form-dossier";
import { EmployeeFormContact } from "./employee-form-contact";
import { EmployeeFormFamily } from "./employee-form-family";
import { EmployeeFormBank } from "./employee-form-bank";
import { EmployeeFormAccess } from "./employee-form-access";
import { EmployeeFormSeparation } from "./employee-form-separation";
import { EmployeeDetailConfirm } from "./employee-detail-confirm";
import { DetailLinesTable } from "./employee-detail-bits";

/** Fields kept by "Save & add another", for entering several people in a row. */
const CARRY_OVER: EmployeeField[] = ["branchId", "departmentId", "category", "joiningDate"];

/** After a save: the new login (shown once), and anything to know — warnings, or what became of a change to bank, PAN or tax status. */
type Notice = { login: { name: string; email: string; tempPassword: string } | null; messages: { tone: "warning" | "info"; text: string }[]; next: () => void };

/** F13: a change to bank, PAN or tax status about to be saved (the confirm window). */
type DetailConfirm = { another: boolean; summary: string; lines: DetailLine[]; error: string | null };

const SECTION_ICON: Record<string, LucideIcon> = {
  general: UserRound,
  job: BriefcaseBusiness,
  pay: Wallet,
  documents: IdCard,
  dossier: GraduationCap,
  contact: Contact,
  family: Users,
  bank: Landmark,
  access: ShieldCheck,
  separation: LogOut,
};

/** Focus a field on the shown tab (after its tab has been opened). */
function focusShown(field: string) {
  const el =
    document.querySelector<HTMLElement>(`section:not([hidden]) [name="${field}"]`) ??
    document.querySelector<HTMLElement>(`section:not([hidden]) [name^="${field}."]`) ??
    // A list row's error (documents.0.number) goes to that row's own control (its Edit button).
    document.querySelector<HTMLElement>(`section:not([hidden]) [name^="${field.split(".").slice(0, 2).join(".")}."]`) ??
    document.querySelector<HTMLElement>(`section:not([hidden]) [data-field-anchor="${field.split(".")[0]}"]`);
  if (!el) return;
  scrollIntoContainer(el, { block: "center" });
  el.focus({ preventScroll: true });
}

/** The first field of a tab. */
function focusFirstOf(section: string) {
  const el = document.getElementById(`section-${section}`)?.querySelector<HTMLElement>("input:not([readonly]):not([type=file]), button[data-enter-field], textarea, button[data-field-anchor]");
  el?.focus();
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
  const [sameAddress, setSameAddress] = useState(() => !ctx.initial.temporaryAddress || ctx.initial.temporaryAddress === ctx.initial.permanentAddress);
  const defaultRole = ctx.roles.find((r) => r.slug === "employee") ?? ctx.roles[0];
  const [access, setAccess] = useState<EmployeeAccessOptions>(() =>
    ctx.access
      ? { roleId: ctx.access.roleId ?? undefined, roleSlug: ctx.roles.find((r) => r.id === ctx.access?.roleId)?.slug }
      : { createLogin: true, roleId: defaultRole?.id, roleSlug: defaultRole?.slug ?? "employee" }
  );
  const saveRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState("general");
  const [confirm, setConfirm] = useState<DetailConfirm | null>(null);
  // F13: while a change to bank, PAN or tax status waits for approval, those fields stay as they are.
  const pendingDetail = ctx.details.pending;
  const locked = useMemo(() => new Set<string>(pendingDetail ? DETAIL_FIELDS : []), [pendingDetail]);

  // Arriving from a record card's "Edit" or a "Fix" link (…/edit#section-bank): open that tab, first field focused.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith("section-")) return;
    const section = id.slice("section-".length);
    if (!EMPLOYEE_FORM_SECTIONS.some((s) => s.id === section)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only readable after mount
    setTab(section);
    requestAnimationFrame(() => focusFirstOf(section));
  }, []);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const leave = useUnsavedGuard(dirty && saving === null);
  // Status is changed with the Active / Inactive switch (it also turns the login off), not in this form.
  const showSeparation = ctx.initial.status === "Inactive";
  const fieldHelp = useFieldHelp();
  const sections = EMPLOYEE_FORM_SECTIONS.filter((s) => s.id !== "separation" || showSeparation);
  const progress = sectionProgress(form, errors, sections);
  const order = sections.map((s) => s.id);

  /** Show a tab (kept in the address, so a refresh or a shared link opens it again). */
  const openTab = (id: string, focus?: "first" | string) => {
    setTab(id);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#section-${id}`);
    if (focus) requestAnimationFrame(() => (focus === "first" ? focusFirstOf(id) : focusShown(focus)));
  };
  /** Open the field's tab, then focus it (errors, the error summary). */
  const focusField = (field: string) => openTab(sectionOfField(field) ?? tab, field);

  // F6 / Shift+F6: next / previous tab (not while a window is open over the form).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F6" || document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      const i = order.indexOf(tab);
      const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
      setTab(next);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#section-${next}`);
      requestAnimationFrame(() => focusFirstOf(next));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, tab]);

  /** Enter past a tab's last field: the next tab's first field; after the last tab, Save. */
  const endOfTab = (): HTMLElement | null => {
    const i = order.indexOf(tab);
    if (i >= 0 && i < order.length - 1) {
      openTab(order[i + 1], "first");
      return null;
    }
    return saveRef.current;
  };
  const requiredLeft = progress.reduce((n, p) => n + (p.required - p.filled), 0);

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
    update: (fn) => setForm(fn),
    clear: clearError,
    locked,
  };

  /** The data that is saved: email mirrors the company email; "same address" copies it. */
  const payload = (): EmployeeFormData => ({
    ...form,
    email: form.companyEmail,
    temporaryAddress: sameAddress ? form.permanentAddress : form.temporaryAddress,
  });

  /** Every check the save makes, plus the form-only one (codes). */
  const checkAll = (data: EmployeeFormData): EmployeeValidationErrors => {
    const all: EmployeeValidationErrors = { ...validateEmployee(data), ...codeConflicts(codes, data, ctx.employeeId) };
    // validateEmployee also reports aliases of these fields under old names; keep one message each.
    delete all.email;
    delete all.address1;
    return all;
  };

  /** Enter on a field: check just that field (the rules the server uses). */
  const validate = (name: string): boolean => {
    let field = name;
    let message: string | null = null;
    if (name.startsWith("permanentAddress.")) {
      field = "permanentAddress";
      const part = name.split(".")[1];
      const a = parseStructuredAddress(form.permanentAddress);
      if (part === "district" && !a.district) message = "Choose the district";
      else if (part === "localLevel" && !a.localLevel) message = "Choose the local level (palika)";
    } else if (name.startsWith("documents.")) {
      // A document row's field (documents.0.number): the server's rule for that row.
      message = validateEmployeeField(payload(), name as `documents.${number}.${string}`);
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
      // Row errors (documents.0.number) belong to their list's tab.
      const hit = Object.keys(all).find((k) => all[k] && sectionOfField(k) === section.id);
      if (hit) return hit;
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
      setSameAddress(true);
      setSavedCount((n) => n + 1);
      openTab("general", "fullName");
      requestAnimationFrame(() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }));
    } else {
      router.push(isNew ? `/workforce/employees/${savedId}?joining=1` : `/workforce/employees/${savedId}`);
      router.refresh();
    }
  };

  /** Saves the form; a change to bank, PAN or tax status (F13) asks for its reason first. */
  const save = async (another = false, reason?: string) => {
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
    if (!isNew && reason === undefined) {
      const diff = detailDiff(detailValues(baseline), detailValues(data));
      if (diff) {
        setConfirm({ another, summary: detailSummary(diff.fields), lines: detailLines(diff.before, diff.after, true), error: null });
        return;
      }
    }
    setSaving(another ? "another" : "save");
    const result = await saveEmployeeAction(
      ctx.employeeId,
      data,
      isNew || !ctx.access ? access : { roleId: access.roleId, roleSlug: access.roleSlug },
      reason !== undefined ? { reason } : undefined
    );
    setSaving(null);
    if (!result.success) {
      const { detailReason, ...fieldErrors } = result.validationErrors ?? {};
      if (detailReason && reason !== undefined) {
        setConfirm((c) => (c ? { ...c, error: detailReason } : c));
        return;
      }
      setConfirm(null);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setAttempted(true);
        const first = firstError(fieldErrors);
        if (first) focusField(first);
      } else {
        setFormError(detailReason ?? result.error);
      }
      return;
    }
    setConfirm(null);
    setBaseline(data); // saved: leaving no longer asks
    const { employee, provisionedAccess, accessWarning, darbandiWarning, detailChange } = result.data;
    const next = () => finish(another, employee.id, data);
    const messages: Notice["messages"] = [accessWarning, darbandiWarning].filter((m): m is string => !!m).map((text) => ({ tone: "warning" as const, text }));
    if (detailChange) {
      const what = inSentence(detailChange.summary);
      const slips = detailChange.draftSlips ? ` ${detailChange.draftSlips} draft payslip${detailChange.draftSlips === 1 ? "" : "s"} now use the new bank account.` : "";
      messages.push({
        tone: "info",
        text:
          detailChange.status === "pending"
            ? `The ${what} change is waiting for approval by someone with Employees → Approve. Payroll keeps the current details until it is approved.`
            : detailChange.route === "final_approve"
              ? `The ${what} change is saved and recorded as approved by you as company administrator.${slips}`
              : `The ${what} change is saved (approvals for employee details are off).${slips}`,
      });
    }
    if (provisionedAccess || messages.length) {
      setNotice({ login: provisionedAccess ? { name: employee.fullName, email: provisionedAccess.email, tempPassword: provisionedAccess.tempPassword } : null, messages, next });
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
        status={isNew ? undefined : <StatusChip status={ctx.initial.status} />}
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
                    {fieldLabel(field)}: {message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pendingDetail && (
        <NoticeBox
          tone="warning"
          className="mb-4"
          title={`${pendingDetail.summary} change waiting for approval`}
          action={
            <Link href={`/workforce/employees/changes?id=${pendingDetail.id}`} className="text-2xs font-medium underline underline-offset-2">
              Open the change
            </Link>
          }
        >
          <p>
            Made by {pendingDetail.preparedBy} · {pendingDetail.reason}. Bank, PAN and tax status stay as they are until it is approved, rejected or withdrawn.
          </p>
          <DetailLinesTable lines={pendingDetail.lines} className="mt-2 max-w-xl" />
        </NoticeBox>
      )}

      <EmployeeFormHeader form={form} ctx={ctx} isNew={isNew} progress={progress} />

      {/* One tab per section (4.2b), like the other modules; every tab stays mounted (hidden when not shown). */}
      <Tabs
        variant="folder"
        label="Employee form"
        value={tab}
        onChange={(id) => openTab(id)}
        items={progress.map((p) => ({
          id: p.id,
          label: p.label,
          icon: SECTION_ICON[p.id],
          badge:
            p.errors > 0 ? (
              <span className="rounded-full bg-danger px-1.5 text-3xs font-semibold tabular-nums text-white" aria-label={`${p.errors} to fix`}>
                {p.errors}
              </span>
            ) : p.state === "complete" ? (
              <Check aria-label="Complete" className="h-3.5 w-3.5 text-success" />
            ) : p.required > 0 ? (
              <span className="text-3xs tabular-nums text-ink-faint" aria-label={`${p.filled} of ${p.required} required filled`}>
                {p.filled}/{p.required}
              </span>
            ) : null,
        }))}
      >
        <div className="-m-4 overflow-hidden rounded-lg rounded-tl-none">
          <ActiveSectionContext.Provider value={tab}>
            <PropertyForm onSubmit={() => save(false)} enterNavigation={{ validate, end: endOfTab }}>
              <EmployeeFormIdentification api={api} />
              <EmployeeFormJob api={api} />
              <EmployeeFormDocuments api={api} />
              <EmployeeFormDossier api={api} />
              <EmployeeFormContact api={api} sameAddress={sameAddress} onSameAddress={setSameAddress} />
              <EmployeeFormFamily api={api} />
              <EmployeeFormBank api={api} />
              <EmployeeFormAccess api={api} options={access} onOptions={setAccess} />
              {showSeparation && <EmployeeFormSeparation api={api} />}
            </PropertyForm>
          </ActiveSectionContext.Provider>
        </div>
      </Tabs>

      <div>
            {/* Sticky footer: Enter on the last tab's last field lands on Save. It reaches into the page padding so nothing shows beneath it. */}
            <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-6 bg-surface-sunken lg:-bottom-6 lg:-mx-6 lg:-mb-6">
              {leave.pending ? (
                <DiscardBar onKeep={leave.keep} onDiscard={leave.discard} />
              ) : (
                <div className="@container flex items-center justify-end gap-2 border-t border-line bg-surface-sunken/95 px-4 py-2 backdrop-blur lg:px-6">
                  {/* Status bar, as in desktop accounting software: the focused field's hint, what is left, save state, keys. */}
                  <StatusBar
                    className="mr-auto hidden min-w-0 flex-1 @min-[40rem]:flex"
                    segments={[
                      { id: "hint", grow: true, content: fieldHelp || "Fill in the record; Enter moves to the next field." },
                      {
                        id: "left",
                        tone: requiredLeft === 0 ? "success" : "default",
                        content: requiredLeft === 0 ? "All required fields filled" : `${requiredLeft} required left`,
                      },
                      { id: "dirty", tone: dirty ? "warning" : "default", content: dirty ? "Unsaved changes" : savedCount ? `${savedCount} saved` : "No changes" },
                      {
                        id: "keys",
                        content: (
                          <span className="hidden items-center gap-1 @min-[66rem]:inline-flex">
                            <Kbd>Enter</Kbd> next <Kbd>F6</Kbd> next tab <Kbd>Ctrl S</Kbd> save
                          </span>
                        ),
                      },
                    ]}
                  />
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

      <Window
        open={!!notice}
        onClose={() => {
          const next = notice?.next;
          setNotice(null);
          next?.();
        }}
        title={notice?.login ? "Employee saved, login created" : "Employee saved"}
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
        {notice && (
          <div className="space-y-3 text-sm text-ink-muted">
            {notice.login && (
              <>
                <p>
                  A self-service login was created for <span className="font-medium text-ink">{notice.login.name}</span> and the sign-in details were emailed to{" "}
                  <span className="font-medium text-ink">{notice.login.email}</span>.
                </p>
                <p className="rounded-md border border-line bg-surface-sunken px-3 py-2">
                  Temporary password (shown once): <span className="font-code text-ink">{notice.login.tempPassword}</span>
                </p>
                <p className="text-2xs">They must choose their own password at first sign-in.</p>
              </>
            )}
            {notice.messages.map((m) => (
              <p key={m.text} className={m.tone === "warning" ? "text-warning" : "text-ink"}>
                {m.text}
              </p>
            ))}
          </div>
        )}
      </Window>

      {confirm && (
        <EmployeeDetailConfirm
          summary={confirm.summary}
          lines={confirm.lines}
          onSave={ctx.details.onSave}
          saving={!!saving}
          error={confirm.error}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => save(confirm.another, reason)}
        />
      )}
    </div>
  );
}
