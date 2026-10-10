"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Save, Search, UserPlus } from "lucide-react";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { addRoleMembersAction, saveRoleAction } from "@/app/actions/role.actions";
import { ROLE_DESCRIPTION_MAX, ROLE_NAME_MAX, ROLE_PRESETS, SCOPES, SCOPE_HINT, SCOPE_LABEL, normalizeRoleForm, validateRoleForm, type RoleForm, type RoleFormErrors } from "@/lib/engines/role.engine";
import type { RoleView, RolesPage, RoleStart } from "@/lib/types/role";
import { cn } from "@/lib/utils";

/** New role (empty, from a preset or a copy of another), or a role's name, description and scope. */
export function RoleWindow({
  page,
  role,
  copyOf,
  onClose,
  onSaved,
}: {
  page: RolesPage;
  /** The role being edited (null: a new one). */
  role: RoleView | null;
  /** A new role starting as a copy of this one. */
  copyOf?: RoleView | null;
  onClose: () => void;
  onSaved: (id: string, text: string) => void;
}) {
  const builtIn = !!role && role.kind !== "custom";
  const initial: RoleForm = role
    ? { name: role.name, description: role.description ?? "", scopeType: role.scopeType }
    : copyOf
      ? { name: `${copyOf.name} (copy)`, description: copyOf.description ?? "", scopeType: copyOf.scopeType }
      : { name: "", description: "", scopeType: "BRANCH" };
  const initialStart = copyOf ? `copy:${copyOf.id}` : "empty";
  const [form, setForm] = useState<RoleForm>(initial);
  const [start, setStart] = useState(initialStart);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<RoleFormErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, run] = useTransition();
  const saveRef = useRef<HTMLButtonElement>(null);
  const otherNames = page.roles.filter((r) => r.id !== role?.id).map((r) => r.name);
  const errors: RoleFormErrors = serverErrors ?? (tried ? validateRoleForm(normalizeRoleForm(form), otherNames) ?? {} : {});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || start !== initialStart;

  const startChoices = [
    { value: "empty", label: "No permissions", hint: "Tick them afterwards" },
    ...ROLE_PRESETS.map((p) => ({ value: `preset:${p.id}`, label: `Preset: ${p.label}`, hint: p.description })),
    ...page.roles.filter((r) => r.kind !== "administrator" && !r.cannotGive).map((r) => ({ value: `copy:${r.id}`, label: `Copy of ${r.name}`, hint: SCOPE_LABEL[r.scopeType] })),
  ];

  const set = <K extends keyof RoleForm>(key: K, value: RoleForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
    setFailure(null);
  };

  const save = () =>
    run(async () => {
      setTried(true);
      if (validateRoleForm(normalizeRoleForm(form), otherNames)) return setFailure("Check the highlighted fields.");
      const [kind, id] = start.split(":") as [RoleStart["kind"], string | undefined];
      const result = await saveRoleAction(role?.id ?? null, { ...form, start: role ? undefined : { kind, id } });
      if (result.success) return onSaved(result.data.id, role ? `${result.data.name} saved.` : `${result.data.name} added: tick what it can do.`);
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
    });

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="md"
      title={role ? role.name : copyOf ? `Copy ${copyOf.name}` : "New role"}
      description={role ? "The role's name, what it is for and what it covers. Its permissions are ticked in the matrix." : "A set of permissions to give logins: start empty, from a preset or as a copy."}
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || (!!role && !dirty)}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {role ? "Save" : "Add role"}
          </WindowButton>
        </>
      }
    >
      <PropertyForm enterNavigation={{ end: () => saveRef.current }} onSubmit={save}>
        <FieldGroup title="The role">
          <FieldRow label="Name" required readOnly={builtIn} help={builtIn ? "A built-in role keeps its name and scope: copy it to make a variant." : undefined} error={errors.name ?? null}>
            <input name="name" className={inputClass} value={form.name} maxLength={ROLE_NAME_MAX} readOnly={builtIn} placeholder="e.g. Branch HR" onChange={(e) => set("name", e.target.value)} />
          </FieldRow>
          <FieldRow label="What it is for" error={errors.description ?? null}>
            <textarea
              name="description"
              rows={2}
              className={cn(inputClass, "h-auto py-1.5")}
              value={form.description}
              maxLength={ROLE_DESCRIPTION_MAX}
              placeholder="e.g. HR staff at a branch: their branch's employees, attendance and leave"
              onChange={(e) => set("description", e.target.value)}
            />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="What it covers">
          <FieldRow label="Covers" required error={errors.scopeType ?? null} help={SCOPE_HINT[form.scopeType]}>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5 text-xs text-ink">
              {SCOPES.map((s) => (
                <label key={s} className={cn("flex items-center gap-2", builtIn ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                  <input type="radio" name="scopeType" className="h-3.5 w-3.5 accent-brand" checked={form.scopeType === s} disabled={builtIn} onChange={() => set("scopeType", s)} /> {SCOPE_LABEL[s]}
                </label>
              ))}
            </div>
          </FieldRow>
          {!role && (
            <FieldRow label="Start from" help="Only permissions you hold yourself can be given; roles you couldn't give aren't offered to copy.">
              <SelectField name="start" options={startChoices} value={start} onChange={(v) => { setStart(v); setFailure(null); }} />
            </FieldRow>
          )}
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}

/** Gives this role to logins that have another one (each shows its current role). */
export function AddPeopleWindow({ page, role, onClose, onSaved }: { page: RolesPage; role: RoleView; onClose: () => void; onSaved: (text: string) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, run] = useTransition();
  const roleName = useMemo(() => new Map(page.roles.map((r) => [r.id, r.name])), [page.roles]);
  const q = search.trim().toLowerCase();
  const candidates = page.logins
    .filter((l) => l.roleId !== role.id)
    .filter((l) => !q || `${l.label} ${l.email} ${l.employee?.code ?? ""} ${l.employee?.name ?? ""}`.toLowerCase().includes(q));
  const scoped = role.scopeType === "BRANCH" || role.scopeType === "DEPARTMENT";

  const save = () =>
    run(async () => {
      if (!picked.size) return setFailure("Tick the logins to give this role.");
      const result = await addRoleMembersAction(role.id, [...picked]);
      if (result.success) return onSaved(`${result.data.moved} login${result.data.moved === 1 ? " now has" : "s now have"} the ${role.name} role.`);
      setFailure(result.error);
    });

  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={picked.size > 0}
      size="md"
      title={`Give logins the ${role.name} role`}
      description="Each login has one role: the ticked ones leave the role they have now."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={save} disabled={saving || !picked.size}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Give the role{picked.size ? ` (${picked.size})` : ""}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {scoped && (
          <p className="rounded-md border border-info/20 bg-info-subtle px-3 py-2 text-xs text-info">
            {role.name} covers chosen {role.scopeType === "BRANCH" ? "branches" : "departments"}: logins without any chosen get it under Users, where you choose them.
          </p>
        )}
        <label className="relative block">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-ink-faint" />
          <input className={cn(inputClass, "max-w-none pl-8")} value={search} placeholder="Search logins" onChange={(e) => setSearch(e.target.value)} aria-label="Search logins" />
        </label>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-md border border-line">
          {candidates.map((l) => {
            const blocked = l.cannotMove;
            return (
              <li key={l.id}>
                <label className={cn("flex items-start gap-2.5 px-3 py-2 text-xs", blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-sunken")} title={blocked ?? undefined}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-brand"
                    disabled={!!blocked}
                    checked={picked.has(l.id)}
                    onChange={(e) =>
                      setPicked((p) => {
                        const next = new Set(p);
                        if (e.target.checked) next.add(l.id);
                        else next.delete(l.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">
                      {l.label}
                      {!l.isActive && <span className="ml-1.5 font-normal text-ink-faint">(inactive)</span>}
                    </span>
                    <span className="block truncate text-2xs text-ink-faint">
                      Now: {l.roleId ? roleName.get(l.roleId) ?? "Unknown role" : "No role"}
                      {l.employee && ` · ${l.employee.name} (${l.employee.code})`}
                    </span>
                    {blocked && <span className="block text-2xs text-warning">{blocked}</span>}
                  </span>
                </label>
              </li>
            );
          })}
          {!candidates.length && <li className="px-3 py-6 text-center text-xs text-ink-faint">{q ? "No login matches." : "Every login already has this role."}</li>}
        </ul>
      </div>
    </Window>
  );
}
