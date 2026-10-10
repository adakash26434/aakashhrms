"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, History, Loader2, Lock, Pencil, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { DiscardBar } from "@/components/kit/discard-bar";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs } from "@/components/kit/tabs";
import { useUnsavedGuard } from "@/components/kit/use-unsaved-guard";
import { WindowButton } from "@/components/kit/window";
import { deleteRoleAction, roleHistoryAction, rolesPageAction, saveRolePermissionsAction } from "@/app/actions/role.actions";
import { GRANTABLE, ROLE_PRESETS, SCOPE_LABEL, SELF_SERVICE_BASICS, grantDiff, grantSummary, presetGrants, sortGrants } from "@/lib/engines/role.engine";
import type { PermissionChange, RoleMember, RoleView, RolesPage } from "@/lib/types/role";
import { nepalClock } from "@/lib/utils/nepal-time";
import { cn } from "@/lib/utils";
import { RoleMatrix } from "./role-matrix";
import { AddPeopleWindow, RoleWindow } from "./role-windows";

// Admin → Roles & permissions (4.13b, templates A + B): the roles on the left; the chosen role's
// permission matrix, people and history on the right. The server's rules decide what can change
// (S59): the administrator role is fixed, nobody changes the role they hold, and nobody gives a
// permission they don't hold — cells beyond the viewer are locked with the reason.

const KIND_LABEL: Record<RoleView["kind"], string> = { administrator: "Administrator", "built-in": "Built-in", custom: "Company's own" };

type Open = { kind: "new" | "copy" | "edit" | "delete" | "people" } | null;

export function RolesClient({ initial, initialRoleId }: { initial: RolesPage; initialRoleId?: string | null }) {
  const [data, setData] = useState(initial);
  const [roleId, setRoleId] = useState<string | null>(initial.roles.some((r) => r.id === initialRoleId) ? initialRoleId! : initial.roles[0]?.id ?? null);
  const role = data.roles.find((r) => r.id === roleId) ?? null;
  const [tab, setTab] = useState("permissions");
  // Ticks belong to the role as it was loaded: another role, or the same one saved (new grants),
  // starts again from what is saved.
  const roleKey = role ? `${role.id}|${role.grants.join(",")}` : "";
  const [edits, setEdits] = useState<{ key: string; grants: Set<string> } | null>(null);
  const [search, setSearch] = useState("");
  const [onlyTicked, setOnlyTicked] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  const can = data.can;

  const baseline = useMemo(() => new Set(role?.grants ?? []), [role]);
  const selection = edits?.key === roleKey ? edits.grants : baseline;
  const setSelection = (grants: Set<string>) => setEdits({ key: roleKey, grants });
  const diff = useMemo(() => grantDiff([...baseline], sortGrants(selection)), [baseline, selection]);
  const dirty = diff.added.length + diff.removed.length > 0;
  const editable = !!role && can.edit && !role.cannotChange;
  const unsaved = useUnsavedGuard(dirty);

  const viewerHolds = useMemo(() => (data.viewerGrants === "all" ? null : new Set(data.viewerGrants)), [data.viewerGrants]);
  const blockedReason = (key: string): string | null => {
    if (!viewerHolds || viewerHolds.has(key) || key.endsWith(":SELF_SERVICE")) return null;
    if (role?.scopeType === "SELF" && SELF_SERVICE_BASICS.has(key)) return null;
    return "Your own role doesn't have this, so you can't give it.";
  };

  const reload = (message?: { tone: NoticeTone; text: string }, selectId?: string) =>
    start(async () => {
      const result = await rolesPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setData(result.data);
      if (selectId) setRoleId(selectId);
      else if (!result.data.roles.some((r) => r.id === roleId)) setRoleId(result.data.roles[0]?.id ?? null);
      if (message) setNotice(message);
    });

  const choose = (id: string) => unsaved.guard(() => {
    setRoleId(id);
    setTab("permissions");
    setNotice(null);
  });

  const savePermissions = () =>
    startSave(async () => {
      if (!role) return;
      const result = await saveRolePermissionsAction(role.id, { grants: sortGrants(selection), baseline: role.grants });
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      const { added, removed } = result.data;
      reload({ tone: "success", text: `${role.name}: ${added} permission${added === 1 ? "" : "s"} given, ${removed} taken away. Logins with it have them from their next page.` });
    });

  const applyPreset = (id: string) => {
    const grants = presetGrants(id);
    if (!grants) return;
    setSelection(new Set(grants.filter((k) => !blockedReason(k))));
  };

  const members = useMemo(() => data.logins.filter((l) => l.roleId === roleId), [data.logins, roleId]);
  const totalLogins = data.logins.length;

  const noRole = "Choose a role";
  return (
    <div>
      <PageBar
        title="Roles & permissions"
        description={`${data.roles.length} roles · ${totalLogins} logins · what each role can do, and where`}
        actions={[
          { id: "new", label: "New role", icon: Plus, group: "create", shortcut: "Ctrl+N", primary: !dirty, hidden: !can.add, onClick: () => unsaved.guard(() => setOpen({ kind: "new" })) },
          {
            id: "copy",
            label: "Copy",
            icon: Copy,
            group: "create",
            hidden: !can.add,
            disabled: !role || role.kind === "administrator" || !!role.cannotGive,
            disabledReason: !role ? noRole : role.kind === "administrator" ? "The administrator role can't be copied." : role.cannotGive ?? undefined,
            onClick: () => unsaved.guard(() => setOpen({ kind: "copy" })),
          },
          { id: "edit", label: "Edit details", icon: Pencil, group: "selection", shortcut: "F2", hidden: !can.edit, disabled: !role || !!role.cannotChange, disabledReason: !role ? noRole : role.cannotChange ?? undefined, onClick: () => setOpen({ kind: "edit" }) },
          { id: "delete", label: "Delete", icon: Trash2, group: "selection", hidden: !can.delete, disabled: !role || !!role.cannotDelete, disabledReason: !role ? noRole : role.cannotDelete ?? undefined, onClick: () => setOpen({ kind: "delete" }) },
          { id: "save", label: saving ? "Saving…" : "Save permissions", icon: Save, group: "output", shortcut: "Ctrl+S", primary: dirty, hidden: !editable, disabled: !dirty || saving, disabledReason: dirty ? undefined : "Nothing changed yet", onClick: savePermissions },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => unsaved.guard(() => reload()) },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Roles" className="xl:sticky xl:top-2 xl:self-start">
          <div className="xl:hidden">
            <SelectField name="role" options={data.roles.map((r) => ({ value: r.id, label: r.name, hint: `${r.logins}` }))} value={roleId ?? ""} onChange={choose} />
          </div>
          <ul className="hidden overflow-hidden rounded-lg border border-line bg-surface xl:block">
            {data.roles.map((r) => (
              <li key={r.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  aria-current={r.id === roleId ? "true" : undefined}
                  onClick={() => choose(r.id)}
                  className={cn("flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-xs hover:bg-surface-sunken", r.id === roleId && "bg-brand-subtle hover:bg-brand-subtle")}
                >
                  {r.kind === "administrator" ? <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" /> : <Users aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-medium", r.id === roleId ? "text-brand-strong" : "text-ink")}>
                      {r.name}
                      {r.id === data.viewerRoleId && <span className="ml-1.5 rounded bg-surface px-1 text-3xs font-semibold text-ink-muted">Yours</span>}
                    </span>
                    <span className="block truncate text-2xs text-ink-faint">
                      {SCOPE_LABEL[r.scopeType]} · {KIND_LABEL[r.kind]}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-2xs text-ink-muted" title={`${r.logins} login${r.logins === 1 ? "" : "s"}`}>
                    {r.logins}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!can.add && !can.edit && <p className="mt-2 text-2xs text-ink-muted">Changing roles needs Users & roles → Add, Edit or Delete with a company-wide role.</p>}
        </nav>

        {role ? (
          <section aria-label={role.name} className="min-w-0">
            <header className="mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-ink">{role.name}</h2>
                <StatusChip status={role.kind === "administrator" ? "locked" : role.kind === "built-in" ? "review" : "active"} label={KIND_LABEL[role.kind]} />
                <span className="text-xs text-ink-muted">
                  {SCOPE_LABEL[role.scopeType]} · {role.logins} login{role.logins === 1 ? "" : "s"}
                  {role.logins !== role.activeLogins && ` (${role.activeLogins} active)`} · {grantSummary(role.kind === "administrator" ? sortGrants(GRANTABLE) : role.grants)}
                </span>
              </div>
              {role.description && <p className="mt-1 text-xs text-ink-muted">{role.description}</p>}
            </header>
            {role.cannotChange && (
              <Notice tone={role.kind === "administrator" ? "info" : "warning"} className="mb-3">
                {role.cannotChange}
              </Notice>
            )}
            <Tabs
              label="Role"
              value={tab}
              onChange={setTab}
              items={[
                { id: "permissions", label: "Permissions", icon: Lock, badge: dirty ? `${diff.added.length + diff.removed.length} changed` : undefined },
                { id: "people", label: "People", icon: Users, badge: String(members.length) },
                { id: "history", label: "History", icon: History },
              ]}
            >
              {tab === "permissions" && (
                <div className="space-y-3 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className={cn(inputClass, "w-56")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a module" aria-label="Find a module" />
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
                      <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={onlyTicked} onChange={(e) => setOnlyTicked(e.target.checked)} /> Only what it has
                    </label>
                    {editable && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-2xs text-ink-muted">Start from</span>
                        <SelectField name="preset" options={ROLE_PRESETS.map((p) => ({ value: p.id, label: p.label, hint: p.description }))} value="" placeholder="A preset…" onChange={applyPreset} className="w-44" />
                      </div>
                    )}
                  </div>
                  {dirty && (
                    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-md border border-brand/30 bg-brand-subtle px-3 py-2 text-xs">
                      <span className="flex-1 text-ink">
                        Not saved: <span className="font-medium text-success">{diff.added.length} added</span>, <span className="font-medium text-danger">{diff.removed.length} taken away</span>.
                      </span>
                      <WindowButton onClick={() => setSelection(new Set(baseline))} disabled={saving}>
                        <RotateCcw className="h-3.5 w-3.5" /> Undo changes
                      </WindowButton>
                      <WindowButton variant="primary" onClick={savePermissions} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save permissions
                      </WindowButton>
                    </div>
                  )}
                  {unsaved.pending && <DiscardBar onKeep={unsaved.keep} onDiscard={unsaved.discard} className="rounded-md border" />}
                  <RoleMatrix value={selection} baseline={baseline} editable={editable} blockedReason={blockedReason} onChange={setSelection} search={search} onlyTicked={onlyTicked} />
                  {role.scopeType === "SELF" && <p className="text-2xs text-ink-muted">An own-records role reaches only the holder&apos;s own payslips, leave and loans, whatever is ticked.</p>}
                </div>
              )}
              {tab === "people" && <People role={role} members={members} can={can} onAdd={() => setOpen({ kind: "people" })} />}
              {tab === "history" && <RoleHistory key={role.id} roleId={role.id} />}
            </Tabs>
          </section>
        ) : (
          <p className="text-xs text-ink-faint">No roles yet.</p>
        )}
      </div>

      {(open?.kind === "new" || open?.kind === "copy" || open?.kind === "edit") && (
        <RoleWindow
          page={data}
          role={open.kind === "edit" ? role : null}
          copyOf={open.kind === "copy" ? role : null}
          onClose={() => setOpen(null)}
          onSaved={(id, text) => {
            setOpen(null);
            setTab("permissions");
            reload({ tone: "success", text }, id);
          }}
        />
      )}
      {open?.kind === "people" && role && (
        <AddPeopleWindow
          page={data}
          role={role}
          onClose={() => setOpen(null)}
          onSaved={(text) => {
            setOpen(null);
            reload({ tone: "success", text });
          }}
        />
      )}
      <Confirm
        open={open?.kind === "delete"}
        tone="danger"
        title={`Delete ${role?.name ?? ""}?`}
        message="No login has it. Its change history stays in the audit log under its name."
        confirmLabel="Delete"
        onConfirm={() =>
          start(async () => {
            if (!role) return;
            const result = await deleteRoleAction(role.id);
            setOpen(null);
            if (!result.success) return setNotice({ tone: "danger", text: result.error });
            const rest = await rolesPageAction();
            if (rest.success) {
              setData(rest.data);
              setRoleId(rest.data.roles[0]?.id ?? null);
            }
            setNotice({ tone: "success", text: `${role.name} deleted.` });
          })
        }
        onCancel={() => setOpen(null)}
      />
    </div>
  );
}

function People({ role, members, can, onAdd }: { role: RoleView; members: RoleMember[]; can: RolesPage["can"]; onAdd: () => void }) {
  const columns: GridColumn<RoleMember>[] = [
    {
      id: "login",
      header: "Login",
      width: 240,
      value: (l) => l.label,
      cell: (l) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">{l.label}</span>
          <span className="block truncate text-2xs text-ink-faint">{l.email}</span>
        </span>
      ),
    },
    { id: "employee", header: "Employee", width: 220, value: (l) => (l.employee ? `${l.employee.code} ${l.employee.name}` : ""), cell: (l) => (l.employee ? <span className="truncate">{l.employee.name} <span className="text-2xs text-ink-faint">{l.employee.code}</span></span> : <span className="text-ink-faint">Not linked</span>) },
    { id: "status", header: "Status", width: 120, value: (l) => (l.isActive ? "Active" : "Inactive"), cell: (l) => <StatusChip status={l.isActive ? "active" : "inactive"} /> },
  ];
  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-ink-muted">Each login has one role. To take someone out of this one, give them another role under <Link href="/admin/users" className="font-medium text-brand-strong hover:underline">Users</Link>.</p>
        {can.edit && (
          <WindowButton onClick={onAdd} disabled={!!role.cannotGive} title={role.cannotGive ?? undefined}>
            <UserPlus className="h-3.5 w-3.5" /> Give logins this role
          </WindowButton>
        )}
      </div>
      <DataGrid id="admin-role-people" label={`People with ${role.name}`} columns={columns} rows={members} getRowId={(l) => l.id} pageSize={50} maxHeight="calc(100vh - 360px)" empty={{ title: "Nobody has this role", description: can.edit ? "Give it to logins here or under Users." : undefined }} />
    </div>
  );
}

function RoleHistory({ roleId }: { roleId: string }) {
  const [rows, setRows] = useState<PermissionChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    roleHistoryAction(roleId).then((result) => {
      if (!live) return;
      if (result.success) setRows(result.data);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [roleId]);

  const columns: GridColumn<PermissionChange>[] = [
    { id: "at", header: "When", width: 150, type: "date", value: (r) => r.at, cell: (r) => <span className="tabular-nums"><DateCell value={r.at} /> <span className="text-ink-faint">{nepalClock(new Date(r.at))}</span></span> },
    { id: "by", header: "By", width: 170, value: (r) => r.by },
    { id: "change", header: "Change", width: 110, value: (r) => (r.change === "GRANTED" ? "Given" : "Taken away"), cell: (r) => <span className={r.change === "GRANTED" ? "font-medium text-success" : "font-medium text-danger"}>{r.change === "GRANTED" ? "Given" : "Taken away"}</span> },
    { id: "permission", header: "Permission", width: 320, value: (r) => r.permission },
  ];
  if (error) return <Notice tone="danger" className="mt-3">{error}</Notice>;
  return (
    <div className="pt-3">
      <DataGrid id="admin-role-history" label="Permission changes" columns={columns} rows={rows ?? []} loading={!rows} getRowId={(r) => r.id} pageSize={50} maxHeight="calc(100vh - 360px)" empty={{ title: "No permission changes recorded", description: "Changes made from now on are listed here; name and scope changes are in the audit log." }} />
    </div>
  );
}
