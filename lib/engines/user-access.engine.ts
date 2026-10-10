// Administration (4.13, S59): who may give which role, and change which login or role. Pure: the
// services load the facts (the actor's own permissions, the role's, the login's) and every write
// asks these rules first; tests in tests/user-access.engine.test.ts.
//
// The rules:
//   1. Company administrator roles are given and taken, and administrators' logins changed, only
//      by a company administrator; their permissions and scope never change.
//   2. Nobody gives more than they hold: a role (or a login holding it) is within reach only when
//      the actor's own role grants every permission it does. The self-service basics on an
//      "own records" role (the Employee role) reach only the holder's own records, so anyone who
//      manages logins may give them.
//   3. Nobody changes their own login (role, access, status, password) or the role they hold
//      (S21: never your own record). Setting up one's own delegation is the exception: it hands
//      one's approvals to someone else while away.
//   4. The company always keeps one active administrator.

import { SELF_SERVICE_BASICS, grantDiff, grantLabel, isAdminRole, sortGrants } from "./role.engine";
import type { ScopeType } from "@/lib/types/role";

/** Who acts: their own permissions (from `permissionSetFor`) and the role they hold. */
export interface AccessActor {
  userId: string;
  isAdmin: boolean;
  /** "ACTION:MODULE" keys the actor's role grants. */
  grants: ReadonlySet<string>;
  roleId: string | null;
}

export interface RoleFacts {
  id: string;
  name: string;
  slug: string;
  scopeType: ScopeType;
  isSystemRole: boolean;
  isProtected: boolean;
  /** "ACTION:MODULE" keys the role grants (an administrator role: everything, whatever is stored). */
  grants: readonly string[];
}

export interface LoginFacts {
  id: string;
  /** Name, or the email when there is none. */
  label: string;
  isActive: boolean;
  role: RoleFacts | null;
}

function words(items: readonly string[], max = 3): string {
  if (items.length <= 1) return items.join("");
  if (items.length <= max) return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, max).join(", ")} and ${items.length - max} more`;
}

const them = (n: number) => (n === 1 ? "it" : "them");

/** Permissions among `grants` the actor does not hold (in matrix order): what puts a role out of their reach. */
export function grantsBeyond(actor: AccessActor, grants: readonly string[], scopeType: ScopeType): string[] {
  if (actor.isAdmin) return [];
  return sortGrants(grants.filter((g) => !actor.grants.has(g) && !g.endsWith(":SELF_SERVICE") && !(scopeType === "SELF" && SELF_SERVICE_BASICS.has(g))));
}

/** Why the actor may not give this role to a login (null: they may). */
export function roleReachProblem(actor: AccessActor, role: RoleFacts): string | null {
  if (isAdminRole(role.slug)) return actor.isAdmin ? null : `Only a company administrator can give the ${role.name} role.`;
  const beyond = grantsBeyond(actor, role.grants, role.scopeType);
  if (!beyond.length) return null;
  return `${role.name} allows ${words(beyond.map(grantLabel))}, which your own role doesn't: only someone who holds ${them(beyond.length)} can give it.`;
}

export type LoginChange = "edit" | "role" | "status" | "password" | "delegation";

/** Why the actor may not change this login (null: they may). */
export function loginChangeProblem(actor: AccessActor, login: LoginFacts, change: LoginChange): string | null {
  if (login.id === actor.userId) {
    if (change === "delegation") return null;
    return change === "password" ? "This is your own login: use Change password in your user menu." : "This is your own login: another administrator changes it.";
  }
  const role = login.role;
  if (!role) return actor.isAdmin ? null : "This login has no role: a company administrator sets it up.";
  if (isAdminRole(role.slug)) return actor.isAdmin ? null : `${login.label} is a company administrator: only another administrator changes this login.`;
  const beyond = grantsBeyond(actor, role.grants, role.scopeType);
  if (!beyond.length) return null;
  return `${login.label}'s role (${role.name}) allows ${words(beyond.map(grantLabel))}, which your own role doesn't, so only someone who holds ${them(beyond.length)} changes this login.`;
}

/** The company keeps one active administrator: `activeAdminIds` are the logins that are one now. */
export function lastAdministratorProblem(login: LoginFacts, next: { isActive: boolean; roleSlug: string | null | undefined }, activeAdminIds: readonly string[]): string | null {
  const adminNow = login.isActive && isAdminRole(login.role?.slug);
  if (!adminNow || (next.isActive && isAdminRole(next.roleSlug))) return null;
  return activeAdminIds.some((id) => id !== login.id) ? null : "The company needs at least one active administrator: make someone else an administrator first.";
}

export type RoleChange = "details" | "permissions" | "delete";

/** Why the actor may not change this role (null: they may). */
export function roleChangeProblem(actor: AccessActor, role: RoleFacts, change: RoleChange): string | null {
  if (isAdminRole(role.slug)) {
    return change === "delete" ? "The administrator role stays: a company always needs one." : "Administrators can do everything: this role's permissions and scope are fixed.";
  }
  if (actor.roleId === role.id) return "This is your own role: another administrator changes it.";
  const beyond = grantsBeyond(actor, role.grants, role.scopeType);
  if (!beyond.length) return null;
  return `${role.name} allows ${words(beyond.map(grantLabel))}, which your own role doesn't, so only someone who holds ${them(beyond.length)} changes it.`;
}

/**
 * A change to a role's name or scope. Built-in roles keep both (copy one to make a variant); a
 * new scope must keep the role within reach — the self-service basics given freely on an "own
 * records" role would become company-wide powers on another scope.
 */
export function roleDetailsProblem(actor: AccessActor, role: RoleFacts, next: { name: string; scopeType: ScopeType }): string | null {
  const blocked = roleChangeProblem(actor, role, "details");
  if (blocked) return blocked;
  if ((role.isSystemRole || role.isProtected) && (next.name !== role.name || next.scopeType !== role.scopeType)) {
    return "A built-in role keeps its name and scope: copy it to make a variant.";
  }
  return newRoleProblem(actor, role.grants, next.scopeType);
}

/** A new role (empty, from a preset or a copy) with these permissions and this scope. */
export function newRoleProblem(actor: AccessActor, grants: readonly string[], scopeType: ScopeType): string | null {
  const beyond = grantsBeyond(actor, grants, scopeType);
  return beyond.length ? `You can only give permissions you hold yourself: ${words(beyond.map(grantLabel))}.` : null;
}

/** A change to a role's permissions: the role within reach, and nothing added beyond the actor's own. */
export function permissionChangeProblem(actor: AccessActor, role: RoleFacts, next: readonly string[]): string | null {
  const blocked = roleChangeProblem(actor, role, "permissions");
  if (blocked) return blocked;
  return newRoleProblem(actor, grantDiff(role.grants, next).added, role.scopeType);
}

/** Deleting a role: never a built-in one, never while a login has it. */
export function roleDeleteProblem(actor: AccessActor, role: RoleFacts, logins: number): string | null {
  const blocked = roleChangeProblem(actor, role, "delete");
  if (blocked) return blocked;
  if (role.isSystemRole || role.isProtected) return "Built-in roles stay. Make one you don't use hold no permissions instead.";
  if (logins > 0) return `${logins} login${logins === 1 ? " has" : "s have"} this role: give ${logins === 1 ? "it" : "them"} another role first.`;
  return null;
}

// ---------------------------------------------------------------------------
// Delegation (the approval engine lets a delegate act for an approver until the last day)
// ---------------------------------------------------------------------------

export const DELEGATION_MAX_DAYS = 366;

const addIsoDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Why this delegation can't be set (null: it can). `delegate` null clears it; dates are YYYY-MM-DD. */
export function delegationProblem(p: { actor: AccessActor; owner: LoginFacts; delegate: LoginFacts | null; until: string | null; today: string }): string | null {
  const change = loginChangeProblem(p.actor, p.owner, "delegation");
  if (change) return change;
  const d = p.delegate;
  if (!d) return null;
  if (d.id === p.owner.id) return `Choose someone other than ${p.owner.label}.`;
  if (d.id === p.actor.userId) return `You can't make yourself ${p.owner.label}'s delegate: another administrator has to.`;
  if (!d.isActive) return `${d.label}'s login is inactive.`;
  if (!d.role || d.role.scopeType === "SELF") return `${d.label} has a self-service login: a delegate needs an office role.`;
  if (!p.until || !/^\d{4}-\d{2}-\d{2}$/.test(p.until)) return "Choose the last day of the delegation.";
  if (p.until < p.today) return "That day has passed: choose today or a later day.";
  if (p.until > addIsoDays(p.today, DELEGATION_MAX_DAYS)) return "A delegation lasts at most a year.";
  return null;
}

/** Whether a stored delegation is in force today (the approval engine's own test: last day included). */
export const delegationActive = (until: string | null | undefined, today: string): boolean => !!until && until.slice(0, 10) >= today;
