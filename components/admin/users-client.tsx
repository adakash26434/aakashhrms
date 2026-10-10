"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound, Lock, Pencil, Plus, Power, RefreshCw, UserCheck } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { issuePasswordAction, setLoginActiveAction, usersPageAction } from "@/app/actions/user.actions";
import { loginState } from "@/lib/engines/user.engine";
import type { IssuedPassword, LoginRow, UsersPage } from "@/lib/types/user";
import { cn } from "@/lib/utils";
import { UserDetail } from "./user-detail";
import { DelegationWindow, LoginWindow, PasswordIssuedWindow } from "./user-windows";

// Admin → Users (4.13, template A + Window): every login, the employee it belongs to, its role and
// what it covers. The buttons follow the server's rules (S59): nobody changes their own login,
// administrators are changed only by administrators, and nobody gives a role beyond their own
// permissions — the server checks everything again.

type Open = { kind: "new" } | { kind: "edit" | "status" | "password" | "delegation"; login: LoginRow } | null;

const loginLabel = (l: Pick<LoginRow, "name" | "email">) => l.name?.trim() || l.email;

export function UsersClient({ initial }: { initial: UsersPage }) {
  const [data, setData] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({ status: "active" });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [acting, startAct] = useTransition();
  const can = data.can;
  const active = data.logins.find((l) => l.id === activeId) ?? null;

  const reload = (message?: { tone: NoticeTone; text: string }) =>
    start(async () => {
      const result = await usersPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setData(result.data);
      if (message) setNotice(message);
    });

  const counts = useMemo(() => {
    const live = data.logins.filter((l) => l.isActive);
    return { all: data.logins.length, active: live.length, linked: data.logins.filter((l) => l.employee).length, left: live.filter((l) => l.employee && l.employee.status !== "Active").length };
  }, [data.logins]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.logins.filter((l) => {
      const state = loginState(l).key;
      if (filters.status === "active" && !l.isActive) return false;
      if (filters.status === "inactive" && l.isActive) return false;
      if (filters.status === "pending" && state !== "pending") return false;
      if (filters.status === "attention" && !(state === "left" || state === "locked")) return false;
      if (filters.role && l.roleId !== filters.role) return false;
      if (filters.link === "linked" && !l.employee) return false;
      if (filters.link === "unlinked" && l.employee) return false;
      return !q || `${l.name ?? ""} ${l.email} ${l.employee?.code ?? ""} ${l.employee?.name ?? ""} ${l.roleName ?? ""}`.toLowerCase().includes(q);
    });
  }, [data.logins, filters, search]);

  const columns: GridColumn<LoginRow>[] = useMemo(
    () => [
      {
        id: "login",
        header: "Login",
        width: 220,
        sticky: true,
        value: (l) => loginLabel(l),
        cell: (l) => (
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{loginLabel(l)}</span>
              {l.id === data.viewerId && <span className="shrink-0 rounded bg-brand-subtle px-1 text-3xs font-semibold text-brand-strong">You</span>}
            </span>
            <span className="block truncate text-2xs text-ink-faint">{l.email}</span>
          </span>
        ),
      },
      {
        id: "employee",
        header: "Employee",
        width: 190,
        value: (l) => (l.employee ? `${l.employee.code} ${l.employee.name}` : ""),
        cell: (l) =>
          l.employee ? (
            <span className="min-w-0">
              <Link href={`/workforce/employees/${l.employee.id}`} className="block truncate text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                {l.employee.name}
              </Link>
              <span className={cn("block truncate text-2xs", l.employee.status === "Active" ? "text-ink-faint" : "font-medium text-warning")}>
                {l.employee.code}
                {l.employee.status !== "Active" && ` · ${l.employee.status}`}
              </span>
            </span>
          ) : (
            <span className="text-ink-faint">Not linked</span>
          ),
      },
      {
        id: "role",
        header: "Role",
        width: 170,
        value: (l) => l.roleName ?? "",
        cell: (l) => (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {l.isAdministrator && <Lock aria-label="Company administrator" className="h-3 w-3 shrink-0 text-brand-strong" />}
            <span className={cn("truncate", !l.roleName && "text-danger")}>{l.roleName ?? "No role"}</span>
          </span>
        ),
      },
      { id: "access", header: "Covers", width: 150, value: (l) => l.access, cell: (l) => <span className={cn("block truncate", l.access.startsWith("No ") ? "text-warning" : "text-ink-muted")} title={l.access}>{l.access}</span> },
      {
        id: "status",
        header: "Status",
        width: 180,
        value: (l) => loginState(l).label,
        cell: (l) => {
          const s = loginState(l);
          return <StatusChip status={s.key === "active" ? "active" : s.key === "inactive" ? "inactive" : s.key === "pending" ? "pending" : "onHold"} label={s.label} />;
        },
      },
      {
        id: "lastLogin",
        header: "Last sign-in",
        width: 120,
        type: "date",
        value: (l) => l.lastLoginAt ?? "",
        cell: (l) => (l.lastLoginAt ? <DateCell value={l.lastLoginAt} /> : <span className="text-ink-faint">Never</span>),
      },
      {
        id: "delegation",
        header: "Delegation",
        width: 160,
        defaultHidden: true,
        value: (l) => (l.delegation ? `${l.delegation.toName} ${l.delegation.until}` : ""),
        cell: (l) =>
          l.delegation ? (
            <span className={cn("block truncate", l.delegation.active ? "text-ink" : "text-ink-faint")} title={l.delegation.active ? "In force" : "Ended"}>
              → {l.delegation.toName}
            </span>
          ) : (
            <span className="text-ink-faint">–</span>
          ),
      },
    ],
    [data.viewerId]
  );

  const noActive = "Choose a login";
  const reasonFor = (l: LoginRow | null, extra?: string | null) => (!l ? noActive : l.cannotChange ?? extra ?? undefined);
  const deactivating = active?.isActive ?? true;

  const runStatus = (login: LoginRow) =>
    startAct(async () => {
      const result = await setLoginActiveAction(login.id, !login.isActive);
      setOpen(null);
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      reload({ tone: "success", text: `${loginLabel(login)} is now ${login.isActive ? "inactive: they can no longer sign in" : "active"}.` });
    });

  const runPassword = (login: LoginRow) =>
    startAct(async () => {
      const result = await issuePasswordAction(login.id);
      setOpen(null);
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setIssued(result.data);
      reload();
    });

  return (
    <div>
      <PageBar
        title="Users"
        description={`${counts.all} login${counts.all === 1 ? "" : "s"} · ${counts.active} active · ${counts.linked} linked to employees${counts.left ? ` · ${counts.left} of people who left` : ""}`}
        actions={[
          { id: "new", label: "New login", icon: Plus, group: "create", shortcut: "Ctrl+N", primary: true, hidden: !can.add, onClick: () => setOpen({ kind: "new" }) },
          { id: "edit", label: "Edit", icon: Pencil, group: "selection", shortcut: "F2", hidden: !can.edit, disabled: !active || !!active.cannotChange, disabledReason: reasonFor(active), onClick: () => active && setOpen({ kind: "edit", login: active }) },
          {
            id: "password",
            label: "Reset password",
            icon: KeyRound,
            group: "selection",
            hidden: !can.edit,
            disabled: !active || !!active.cannotChange || !active.isActive,
            disabledReason: reasonFor(active, active && !active.isActive ? "The login is inactive: make it active first." : null),
            onClick: () => active && setOpen({ kind: "password", login: active }),
          },
          {
            id: "status",
            label: deactivating ? "Make inactive" : "Make active",
            icon: deactivating ? Power : UserCheck,
            group: "selection",
            hidden: deactivating ? !can.deactivate : !can.edit,
            disabled: !active || !!active.cannotChange,
            disabledReason: reasonFor(active),
            onClick: () => active && setOpen({ kind: "status", login: active }),
          },
          {
            id: "delegation",
            label: "Delegation",
            group: "selection",
            hidden: !can.edit,
            disabled: !active || !!active.cannotDelegate,
            disabledReason: !active ? noActive : active.cannotDelegate ?? undefined,
            onClick: () => active && setOpen({ kind: "delegation", login: active }),
          },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => reload() },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <Guide
        id="admin-users"
        title="How logins work"
        className="mb-3"
        steps={[
          { title: "Role", text: "What the person can do. Roles and their permissions are set under Roles & permissions." },
          { title: "Covers", text: "For branch and department roles, which branches or departments the login sees and acts on." },
          { title: "Employee", text: "The record the login belongs to: their self-service pages, and the rule that nobody approves or changes their own pay." },
          { title: "Who changes what", text: "Nobody changes their own login, only an administrator changes an administrator, and nobody gives a role that can do more than their own." },
        ]}
      />
      <FilterStrip
        id="admin-users"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Search name, email or employee" }}
        filters={[
          {
            id: "status",
            label: "Status",
            allLabel: "Every login",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "pending", label: "Waiting for first sign-in" },
              { value: "attention", label: "Needs attention" },
            ],
          },
          { id: "role", label: "Role", allLabel: "All roles", options: data.roles.map((r) => ({ value: r.id, label: r.name })) },
          { id: "link", label: "Employee", allLabel: "Linked or not", options: [{ value: "linked", label: "Linked to an employee" }, { value: "unlinked", label: "Not linked" }] },
        ]}
      />
      <SplitView
        id="admin-users"
        detailTitle={active ? loginLabel(active) : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <UserDetail
              key={active.id}
              login={active}
              page={data}
              onEdit={() => setOpen({ kind: "edit", login: active })}
              onPassword={() => setOpen({ kind: "password", login: active })}
              onStatus={() => setOpen({ kind: "status", login: active })}
              onDelegation={() => setOpen({ kind: "delegation", login: active })}
            />
          ) : null
        }
        master={
          <DataGrid
            id="admin-users"
            label="Logins"
            columns={columns}
            rows={rows}
            getRowId={(l) => l.id}
            activeRowId={activeId}
            onActiveRowChange={(l) => setActiveId(l.id)}
            onOpen={can.edit ? (l) => (l.cannotChange ? setActiveId(l.id) : setOpen({ kind: "edit", login: l })) : undefined}
            rowTone={(l) => (l.isActive && l.employee && l.employee.status !== "Active" ? "warning" : undefined)}
            pageSize={100}
            maxHeight="calc(100vh - 300px)"
            empty={{
              title: search || Object.values(filters).some(Boolean) ? "No login matches" : "No logins yet",
              description: search || Object.values(filters).some(Boolean) ? "Clear the search or the filters to see every login." : can.add ? "Add a login for each person who signs in." : undefined,
            }}
          />
        }
      />
      {!can.add && !can.edit && !can.deactivate && (
        <p className="mt-3 text-xs text-ink-muted">Changing logins needs Users & roles → Add, Edit or Delete with a company-wide role.</p>
      )}

      {(open?.kind === "new" || open?.kind === "edit") && (
        <LoginWindow
          key={open.kind === "edit" ? open.login.id : "new"}
          page={data}
          login={open.kind === "edit" ? open.login : null}
          onClose={() => setOpen(null)}
          onSaved={(result, text) => {
            setOpen(null);
            setActiveId(result.id);
            if (result.issued) setIssued(result.issued);
            reload({ tone: "success", text });
          }}
        />
      )}
      {open?.kind === "delegation" && (
        <DelegationWindow
          page={data}
          login={open.login}
          onClose={() => setOpen(null)}
          onSaved={(text) => {
            setOpen(null);
            reload({ tone: "success", text });
          }}
        />
      )}
      {issued && <PasswordIssuedWindow issued={issued} onClose={() => setIssued(null)} />}
      <Confirm
        open={open?.kind === "status"}
        tone={open?.kind === "status" && open.login.isActive ? "danger" : "default"}
        title={open?.kind === "status" ? `Make ${loginLabel(open.login)}'s login ${open.login.isActive ? "inactive" : "active"}?` : ""}
        message={
          open?.kind === "status" && open.login.isActive
            ? "They can no longer sign in, from the next page they open. Their records and history stay, and the login can be made active again."
            : "They can sign in again with their current password."
        }
        confirmLabel={open?.kind === "status" && open.login.isActive ? "Make inactive" : "Make active"}
        onConfirm={() => {
          if (open?.kind === "status") runStatus(open.login);
        }}
        onCancel={() => !acting && setOpen(null)}
      />
      <Confirm
        open={open?.kind === "password"}
        title={open?.kind === "password" ? `Reset ${loginLabel(open.login)}'s password?` : ""}
        message="A new temporary password is shown once, here. Their current password stops working; they choose their own at the next sign-in."
        confirmLabel="Reset password"
        onConfirm={() => {
          if (open?.kind === "password") runPassword(open.login);
        }}
        onCancel={() => !acting && setOpen(null)}
      />
    </div>
  );
}
