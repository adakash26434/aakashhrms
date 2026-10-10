"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Copy, Loader2, Save, ShieldAlert } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { useDateText } from "@/components/kit/date-cell";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { saveDelegationAction, saveLoginAction } from "@/app/actions/user.actions";
import { SCOPE_HINT, SCOPE_LABEL } from "@/lib/engines/role.engine";
import { LOGIN_EMAIL_MAX, LOGIN_NAME_MAX, normalizeLoginForm, validateLoginForm } from "@/lib/engines/user.engine";
import type { IssuedPassword, LoginForm, LoginFormErrors, LoginRow, UsersPage } from "@/lib/types/user";
import { nepalDateIso } from "@/lib/utils/nepal-time";

const loginLabel = (l: Pick<LoginRow, "name" | "email">) => l.name?.trim() || l.email;

/** A list of tick boxes (branches or departments a login covers). */
function TickList({ items, value, onChange, kept }: { items: { id: string; name: string; code: string }[]; value: string[]; onChange: (next: string[]) => void; kept: string[] }) {
  const ticked = new Set(value);
  const extra = kept.filter((id) => !items.some((i) => i.id === id));
  return (
    <div className="max-h-44 max-w-md overflow-y-auto rounded-md border border-line bg-surface px-2 py-1">
      {items.map((i) => (
        <label key={i.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-ink">
          <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={ticked.has(i.id)} onChange={(e) => onChange(e.target.checked ? [...value, i.id] : value.filter((x) => x !== i.id))} />
          <span className="truncate">{i.name}</span>
          <span className="ml-auto shrink-0 font-code text-3xs text-ink-faint">{i.code}</span>
        </label>
      ))}
      {extra.map((id) => (
        <label key={id} className="flex cursor-pointer items-center gap-2 py-1 text-xs italic text-ink-faint">
          <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={ticked.has(id)} onChange={(e) => onChange(e.target.checked ? [...value, id] : value.filter((x) => x !== id))} />
          <span className="truncate">An inactive or deleted one</span>
        </label>
      ))}
      {!items.length && !extra.length && <p className="py-1 text-xs text-ink-faint">None set up yet (Organization).</p>}
    </div>
  );
}

/** New login, or the login's name, email, employee, role and what it covers. */
export function LoginWindow({
  page,
  login,
  onClose,
  onSaved,
}: {
  page: UsersPage;
  login: LoginRow | null;
  onClose: () => void;
  onSaved: (result: { id: string; issued: IssuedPassword | null }, text: string) => void;
}) {
  const roles = page.roles.filter((r) => !r.cannotGive || r.id === login?.roleId);
  const defaultRole = roles.find((r) => r.scopeType === "SELF") ?? roles[0];
  const initial: LoginForm = login
    ? { name: login.name ?? "", email: login.email, roleId: login.roleId ?? "", employeeId: login.employee?.id ?? null, branchIds: login.branchIds, departmentIds: login.departmentIds }
    : { name: "", email: "", roleId: defaultRole?.id ?? "", employeeId: null, branchIds: [], departmentIds: [] };
  const [form, setForm] = useState<LoginForm>(initial);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<LoginFormErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const saveRef = useRef<HTMLButtonElement>(null);

  const role = page.roles.find((r) => r.id === form.roleId) ?? null;
  const scope = role?.scopeType ?? null;
  const branchIds = useMemo(() => new Set([...page.branches.map((b) => b.id), ...(login?.branchIds ?? [])]), [page.branches, login]);
  const departmentIds = useMemo(() => new Set([...page.departments.map((d) => d.id), ...(login?.departmentIds ?? [])]), [page.departments, login]);
  const checkErrors = (f: LoginForm) => validateLoginForm(normalizeLoginForm(f), { scopeType: scope, branchIds, departmentIds, employee: null }) ?? {};
  const errors: LoginFormErrors = serverErrors ?? (tried ? checkErrors(form) : {});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const adminEmail = !!login?.isAdministrator;

  const employees = useMemo(() => {
    const list = page.linkable.map((e) => ({ value: e.id, label: e.name, hint: e.code }));
    if (login?.employee && !list.some((e) => e.value === login.employee!.id)) list.unshift({ value: login.employee.id, label: login.employee.name, hint: login.employee.code });
    return list;
  }, [page.linkable, login]);

  const set = <K extends keyof LoginForm>(key: K, value: LoginForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
    setFailure(null);
  };

  const pickEmployee = (id: string) => {
    const emp = page.linkable.find((e) => e.id === id);
    setForm((f) => ({ ...f, employeeId: id || null, name: f.name.trim() || !emp ? f.name : emp.name }));
    setServerErrors(null);
    setFailure(null);
  };

  const save = () =>
    start(async () => {
      setTried(true);
      if (Object.keys(checkErrors(form)).length) return setFailure("Check the highlighted fields.");
      const result = await saveLoginAction(login?.id ?? null, form);
      if (result.success) {
        const name = form.name.trim() || form.email;
        return onSaved(result.data, login ? `${name}'s login saved.` : `Login added for ${name}.`);
      }
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
    });

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="md"
      title={login ? loginLabel(login) : "New login"}
      description={login ? "Who signs in, the employee it belongs to, and what they can do." : "Someone who signs in: a temporary password is shown once when you add it."}
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || (!!login && !dirty)}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {login ? "Save" : "Add login"}
          </WindowButton>
        </>
      }
    >
      <PropertyForm enterNavigation={{ end: () => saveRef.current }} onSubmit={save}>
        <FieldGroup title="Who signs in">
          <FieldRow label="Employee" help="The record this login belongs to: their self-service pages, and the rule that nobody acts on their own pay. Leave empty for someone who isn't an employee." error={errors.employeeId ?? null}>
            <Combobox name="employeeId" options={employees} value={form.employeeId ?? ""} onChange={pickEmployee} allowClear placeholder="Not linked" emptyText="No active employee without a login" />
          </FieldRow>
          <FieldRow label="Name" required error={errors.name ?? null}>
            <input name="name" className={inputClass} value={form.name} maxLength={LOGIN_NAME_MAX} placeholder="e.g. Gita Rai" onChange={(e) => set("name", e.target.value)} />
          </FieldRow>
          <FieldRow
            label="Email"
            required
            readOnly={adminEmail}
            help={adminEmail ? "An administrator's sign-in email is changed by AakashHRMS support." : "They sign in with it; the temporary password is not emailed from here."}
            error={errors.email ?? null}
          >
            <input name="email" type="email" className={inputClass} value={form.email} maxLength={LOGIN_EMAIL_MAX} readOnly={adminEmail} autoComplete="off" placeholder="name@company.com" onChange={(e) => set("email", e.target.value)} />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="What they can do">
          <FieldRow label="Role" required help={role ? `${SCOPE_LABEL[role.scopeType]}: ${SCOPE_HINT[role.scopeType]}` : "Roles are set up under Roles & permissions."} error={errors.roleId ?? null}>
            <SelectField
              name="roleId"
              options={roles.map((r) => ({ value: r.id, label: r.name, hint: r.isAdministrator ? "Administrator" : SCOPE_LABEL[r.scopeType] }))}
              value={form.roleId}
              onChange={(v) => set("roleId", v)}
            />
          </FieldRow>
          {scope === "BRANCH" && (
            <FieldRow label="Branches" required help="The branches whose people and records this login sees." error={errors.branchIds ?? null}>
              <TickList items={page.branches} value={form.branchIds} kept={login?.branchIds ?? []} onChange={(v) => set("branchIds", v)} />
            </FieldRow>
          )}
          {scope === "DEPARTMENT" && (
            <FieldRow label="Departments" required help="The departments whose people and records this login sees." error={errors.departmentIds ?? null}>
              <TickList items={page.departments} value={form.departmentIds} kept={login?.departmentIds ?? []} onChange={(v) => set("departmentIds", v)} />
            </FieldRow>
          )}
          {page.roles.length > roles.length && (
            <FieldRow label="Other roles">
              <p className="pt-1.5 text-2xs text-ink-muted">
                {page.roles.length - roles.length} role{page.roles.length - roles.length === 1 ? " isn't" : "s aren't"} offered: they can do more than your own role (or are the administrator role), so only someone who holds those permissions gives them.
              </p>
            </FieldRow>
          )}
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}

/** The temporary password, once: it is never stored (S2) and can't be shown again. */
export function PasswordIssuedWindow({ issued, onClose }: { issued: IssuedPassword; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Window
      open
      onClose={onClose}
      size="sm"
      title="Temporary password"
      description={`For ${issued.name} (${issued.email})`}
      footer={
        <WindowButton variant="primary" onClick={onClose}>
          Done
        </WindowButton>
      }
    >
      <div className="space-y-3 text-xs text-ink">
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2.5">
          <code className="flex-1 select-all font-code text-base font-semibold tracking-wide text-ink">{issued.tempPassword}</code>
          <WindowButton onClick={copy} aria-label="Copy the password">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </WindowButton>
        </div>
        <p className="flex items-start gap-1.5 text-ink-muted">
          <ShieldAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
          Give it to them in person or by a private message. It works once: they choose their own password when they sign in. It isn&apos;t stored anywhere and won&apos;t be shown again.
        </p>
      </div>
    </Window>
  );
}

/** Who approves in this login's place while they are away, through a last day. */
export function DelegationWindow({ page, login, onClose, onSaved }: { page: UsersPage; login: LoginRow; onClose: () => void; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const initialDelegate = login.delegation?.toId ?? "";
  const initialUntil = login.delegation?.until ?? "";
  const [delegateId, setDelegateId] = useState(initialDelegate);
  const [until, setUntil] = useState(initialUntil);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const today = nepalDateIso();
  const name = loginLabel(login);

  // Another active office login; never the person setting it up for someone else (S21).
  const choices = page.logins
    .filter((l) => l.isActive && l.roleId && l.roleScope !== "SELF" && l.id !== login.id && l.id !== page.viewerId)
    .map((l) => ({ value: l.id, label: loginLabel(l), hint: l.roleName ?? undefined }));
  const delegate = page.logins.find((l) => l.id === delegateId) ?? null;
  const dirty = delegateId !== initialDelegate || until !== initialUntil;

  const send = (input: { delegateId: string | null; until: string | null }, text: string) =>
    start(async () => {
      const result = await saveDelegationAction(login.id, input);
      if (result.success) return onSaved(text);
      setFailure(result.error);
    });

  const save = () => {
    if (!delegateId) return setFailure("Choose who approves in their place, or clear the delegation.");
    if (!until) return setFailure("Choose the last day.");
    if (until < today) return setFailure("That day has passed: choose today or a later day.");
    send({ delegateId, until }, `${delegate ? loginLabel(delegate) : "The delegate"} approves in ${name}'s place until ${dateText(until)}.`);
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="md"
      title={`Delegation: ${name}`}
      description="While they are away, someone else approves in their place at the approval levels they hold (salary changes, pay runs, loans …)."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          {login.delegation && (
            <WindowButton disabled={saving} onClick={() => send({ delegateId: null, until: null }, `${name}'s delegation cleared.`)}>
              Clear delegation
            </WindowButton>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save}>
        <FieldGroup title="In their place">
          <FieldRow label="Approves instead" required help="Another active login with an office role. Nobody makes themselves someone's delegate.">
            <SelectField name="delegateId" options={choices} value={delegateId} onChange={(v) => { setDelegateId(v); setFailure(null); }} placeholder="Choose a login" allowEmpty />
          </FieldRow>
          <FieldRow label="Last day" required help="Included; at most a year from today. It ends by itself.">
            <DateField name="until" value={until} onChange={(v) => { setUntil(v); setFailure(null); }} />
          </FieldRow>
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}
