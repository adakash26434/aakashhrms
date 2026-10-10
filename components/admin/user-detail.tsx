"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, Pencil, Power, UserCheck } from "lucide-react";
import { DateCell, useDateText } from "@/components/kit/date-cell";
import { CopyButton } from "@/components/kit/description-list";
import { PaneActions, PaneFields, PaneSection, type PaneField } from "@/components/kit/pane";
import { WindowButton } from "@/components/kit/window";
import { loginActivityAction } from "@/app/actions/user.actions";
import { SCOPE_HINT } from "@/lib/engines/role.engine";
import { loginState } from "@/lib/engines/user.engine";
import type { LoginActivity, LoginRow, UsersPage } from "@/lib/types/user";
import { nepalClock } from "@/lib/utils/nepal-time";
import { cn } from "@/lib/utils";

// The Users pane: the login's buttons, what it is, its delegation and what it did lately.

export function UserDetail({
  login,
  page,
  onEdit,
  onPassword,
  onStatus,
  onDelegation,
}: {
  login: LoginRow;
  page: UsersPage;
  onEdit: () => void;
  onPassword: () => void;
  onStatus: () => void;
  onDelegation: () => void;
}) {
  const can = page.can;
  const dateText = useDateText();
  const state = loginState(login);
  const changeable = !login.cannotChange;
  const statusAllowed = login.isActive ? can.deactivate : can.edit;

  const signIn: PaneField = login.lockedUntil
    ? { label: "Sign-in", value: `Locked until ${nepalClock(new Date(login.lockedUntil))} after failed attempts`, tone: "warning", note: "A new temporary password unlocks it at once." }
    : login.mustChangePassword
      ? { label: "Sign-in", value: "Waiting for the first sign-in", note: "They change the temporary password when they sign in." }
      : { label: "Last sign-in", value: login.lastLoginAt ? `${dateText(login.lastLoginAt)} ${nepalClock(new Date(login.lastLoginAt))}` : "Never" };

  const rows: PaneField[] = [
    {
      label: "Email",
      value: (
        <span className="inline-flex items-center gap-1">
          {login.email} <CopyButton text={login.email} label="Copy the email" />
        </span>
      ),
    },
    { label: "Role", value: login.roleName ?? "No role", tone: login.roleName ? "default" : "danger", note: login.isAdministrator ? "Company administrator: can do everything." : undefined },
    { label: "Covers", value: login.access, tone: login.access.startsWith("No ") ? "warning" : "default", note: login.roleScope ? SCOPE_HINT[login.roleScope] : undefined },
    login.employee
      ? {
          label: "Employee",
          value: `${login.employee.name} (${login.employee.code})`,
          href: `/workforce/employees/${login.employee.id}`,
          note: [login.employee.designation, login.employee.branch].filter(Boolean).join(" · ") || undefined,
        }
      : { label: "Employee", value: "Not linked", tone: "default", note: "A login for someone who isn't an employee (an IT administrator, an auditor)." },
    { label: "Status", value: state.label, tone: state.key === "active" ? "success" : state.key === "inactive" ? "default" : "warning" },
    signIn,
    { label: "Created", value: <DateCell value={login.createdAt} /> },
  ];

  return (
    <div>
      <PaneActions hint={login.cannotChange ?? undefined} hintTone={login.id === page.viewerId ? "muted" : "warning"}>
        {can.edit && changeable && (
          <WindowButton onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </WindowButton>
        )}
        {can.edit && changeable && login.isActive && (
          <WindowButton onClick={onPassword}>
            <KeyRound className="h-3.5 w-3.5" /> Reset password
          </WindowButton>
        )}
        {statusAllowed && changeable && (
          <WindowButton onClick={onStatus}>
            {login.isActive ? <Power className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />} {login.isActive ? "Make inactive" : "Make active"}
          </WindowButton>
        )}
      </PaneActions>
      {state.key === "left" && (
        <PaneSection tone="warning">
          <p className="text-warning">{login.employee?.name} is no longer an active employee, but this login can still sign in. Make it inactive unless they still need it.</p>
        </PaneSection>
      )}
      <PaneSection>
        <PaneFields rows={rows} />
      </PaneSection>
      <PaneSection
        title="Delegation"
        aside={
          can.edit && !login.cannotDelegate ? (
            <button type="button" onClick={onDelegation} className="text-2xs font-medium text-brand-strong hover:underline">
              {login.delegation ? "Change" : "Set up"}
            </button>
          ) : null
        }
      >
        {login.delegation ? (
          <p className={cn(login.delegation.active ? "text-ink" : "text-ink-faint")}>
            {login.delegation.active ? "While away, " : "Ended: "}
            <span className="font-medium">{login.delegation.toName}</span> approves in their place until{" "}
            {dateText(login.delegation.until)}.
          </p>
        ) : (
          <p className="text-ink-faint">Nobody approves in their place.</p>
        )}
      </PaneSection>
      {can.audit && <RecentActivity loginId={login.id} />}
    </div>
  );
}

function RecentActivity({ loginId }: { loginId: string }) {
  const [items, setItems] = useState<LoginActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateText = useDateText();

  useEffect(() => {
    let live = true;
    loginActivityAction(loginId).then((result) => {
      if (!live) return;
      if (result.success) setItems(result.data);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [loginId]);

  return (
    <PaneSection title="Recent activity">
      {error ? (
        <p className="text-danger">{error}</p>
      ) : !items ? (
        <p className="inline-flex items-center gap-1.5 text-ink-faint">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </p>
      ) : !items.length ? (
        <p className="text-ink-faint">Nothing recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-ink">
                  {a.action} · {a.module}
                </span>
                <span className="block truncate text-2xs text-ink-faint" title={a.record}>
                  {a.record}
                  {a.result !== "Done" && <span className="ml-1 font-medium text-danger">{a.result}</span>}
                </span>
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-ink-faint">
                {dateText(a.at)} {nepalClock(new Date(a.at))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/admin/audit-log?user=${loginId}`} className="mt-2 inline-block text-2xs font-medium text-brand-strong hover:underline">
        All of it in the audit log
      </Link>
    </PaneSection>
  );
}
