import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { getDb } from "@/lib/db";
import * as repository from "@/lib/repositories/user.repository";
import * as roleRepository from "@/lib/repositories/role.repository";
import * as auditRepository from "@/lib/repositories/audit.repository";
import type { RoleRecord } from "@/lib/repositories/role.repository";
import type { LoginRecord, Tx } from "@/lib/repositories/user.repository";
import { permissionSetFor } from "@/lib/auth/get-user-permissions";
import { DENIED_SELF } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { recordAuditLog } from "@/lib/services/audit.service";
import { accessListsFor, emailChangeProblem, generateTemporaryPassword, normalizeLoginForm, validateLoginForm } from "@/lib/engines/user.engine";
import {
  delegationActive,
  delegationProblem,
  lastAdministratorProblem,
  loginChangeProblem,
  roleReachProblem,
  type AccessActor,
  type LoginChange,
  type LoginFacts,
  type RoleFacts,
} from "@/lib/engines/user-access.engine";
import { SCOPE_LABEL, isAdminRole } from "@/lib/engines/role.engine";
import { auditActionLabel, auditModuleLabel, auditResultLabel } from "@/lib/engines/audit.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { formatBSDate } from "@/lib/utils/bs-calendar";
import type { DelegationForm, IssuedPassword, LoginActivity, LoginFormErrors, LoginRow, RoleChoice, UsersPage } from "@/lib/types/user";
import {
  ensureEmployeeSelfServiceRole,
  EMPLOYEE_ROLE_SLUG,
  EMPLOYEE_ROLE_SLUG_FALLBACK,
} from "@/lib/auth/employee-self-service-role";

// Admin → Users (4.13, S59). Every change is checked against the access rules
// (lib/engines/user-access.engine.ts) inside one company-wide lock with the facts read again
// there, and audited with what changed in words; refusals are audited too (DENIED_SELF for one's
// own login, DENIED_PERMISSION otherwise). The actions require a company-wide role first.

const MODULE = "USERS_ROLES" as const;

export class UserExistsError extends Error {
  constructor(public email: string) {
    super(`User with email '${email}' already exists.`);
    this.name = "UserExistsError";
  }
}

export class LoginValidationError extends Error {
  constructor(public errors: LoginFormErrors) {
    super("Some fields need attention.");
    this.name = "LoginValidationError";
  }
}

/** A refusal by the access rules: shown to the user and audited. */
export class AccessRefusedError extends UserFacingError {
  constructor(message: string, public readonly result: typeof DENIED_SELF | "DENIED_PERMISSION", public readonly recordId: string | null, public readonly attempted: Record<string, unknown>) {
    super(message);
    this.name = "AccessRefusedError";
  }
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/** Who acts (S59): the permissions their own role grants and the role they hold. */
export async function accessActor(userId: string): Promise<AccessActor> {
  const [set, roleId] = await Promise.all([permissionSetFor(userId), repository.findRoleIdOfUser(userId)]);
  return { userId, isAdmin: set.isAdmin, grants: set.grants, roleId };
}

/** Platform support (impersonation) views only: nothing is within its reach. */
const SUPPORT_ACTOR: AccessActor = { userId: "", isAdmin: false, grants: new Set(), roleId: null };

export function roleFacts(r: RoleRecord): RoleFacts {
  return { id: r.id, name: r.name, slug: r.slug, scopeType: r.scopeType, isSystemRole: r.isSystemRole, isProtected: r.isProtected, grants: r.grants };
}

const loginLabel = (r: { name: string | null; email: string }) => r.name?.trim() || r.email;

function loginFacts(r: LoginRecord, roles: ReadonlyMap<string, RoleRecord>): LoginFacts {
  const role = r.roleId ? roles.get(r.roleId) : undefined;
  return { id: r.id, label: loginLabel(r), isActive: r.isActive, role: role ? roleFacts(role) : null };
}

const byId = <T extends { id: string }>(rows: readonly T[]) => new Map(rows.map((r) => [r.id, r]));

/** One lock for every change to logins and roles, the facts read again inside it. */
async function administrationTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(async (tx) => {
    await repository.lockAdministration(tx);
    return fn(tx);
  });
}

/** Writes the audit line for a refusal by the rules, then lets it go on to the user. */
async function auditRefusals<T>(actorId: string, action: "ADD" | "EDIT" | "DELETE", work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AccessRefusedError) {
      await recordAuditLog({ userId: actorId, action, module: MODULE, recordId: error.recordId, result: error.result, newValues: error.attempted });
    }
    throw error;
  }
}

function refuse(problem: string | null, login: { id: string } | null, actor: AccessActor, attempted: Record<string, unknown>): void {
  if (!problem) return;
  throw new AccessRefusedError(problem, login && login.id === actor.userId ? DENIED_SELF : "DENIED_PERMISSION", login?.id ?? null, attempted);
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

type OrgNames = { branches: Map<string, string>; departments: Map<string, string> };

const orgNames = (org: { branches: { id: string; name: string }[]; departments: { id: string; name: string }[] }): OrgNames => ({
  branches: new Map(org.branches.map((b) => [b.id, b.name])),
  departments: new Map(org.departments.map((d) => [d.id, d.name])),
});

/** What a login covers, in words: "Company-wide", "Lekhnath, Pokhara", "Own records". */
function accessText(lists: { assignedBranchIds: string[]; assignedDepartmentIds: string[] }, role: RoleRecord | undefined, names: OrgNames): string {
  if (!role) return "No role";
  if (isAdminRole(role.slug) || role.scopeType === "GLOBAL") return SCOPE_LABEL.GLOBAL;
  if (role.scopeType === "SELF") return SCOPE_LABEL.SELF;
  const ids = role.scopeType === "BRANCH" ? lists.assignedBranchIds : lists.assignedDepartmentIds;
  const map = role.scopeType === "BRANCH" ? names.branches : names.departments;
  const list = ids.map((id) => map.get(id) ?? "Deleted");
  return list.length ? list.join(", ") : role.scopeType === "BRANCH" ? "No branch chosen" : "No department chosen";
}

export async function usersPage(viewer: { userId: string; isImpersonation?: boolean }, can: UsersPage["can"]): Promise<UsersPage> {
  const [records, roleRecords, org, actor] = await Promise.all([
    repository.findLoginRecords(),
    roleRepository.findRoleRecords(),
    repository.findOrgChoices(),
    viewer.isImpersonation ? Promise.resolve(SUPPORT_ACTOR) : accessActor(viewer.userId),
  ]);
  const editable = can.add || can.edit;
  const linkable = editable ? await repository.findLinkableEmployees() : [];
  const roles = byId(roleRecords);
  const logins = byId(records);
  const names = orgNames(org);
  const today = nepalDateIso();
  const support = viewer.isImpersonation ? "Platform support views logins only." : null;

  const rows: LoginRow[] = records.map((r) => {
    const role = r.roleId ? roles.get(r.roleId) : undefined;
    const facts = loginFacts(r, roles);
    const delegate = r.delegatedToUserId ? logins.get(r.delegatedToUserId) : undefined;
    const until = r.delegatedUntil ? r.delegatedUntil.toISOString().slice(0, 10) : null;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      isActive: r.isActive,
      mustChangePassword: r.mustChangePassword,
      lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
      lockedUntil: r.lockedUntil && r.lockedUntil > new Date() ? r.lockedUntil.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      roleId: role?.id ?? null,
      roleName: role?.name ?? null,
      roleScope: role ? (isAdminRole(role.slug) ? "GLOBAL" : role.scopeType) : null,
      isAdministrator: isAdminRole(role?.slug),
      branchIds: r.assignedBranchIds,
      departmentIds: r.assignedDepartmentIds,
      access: accessText(r, role, names),
      employee: r.employeeId
        ? { id: r.employeeId, code: r.employeeCode ?? "", name: r.employeeName ?? "", status: r.employeeStatus ?? "", branch: r.employeeBranch, designation: r.employeeDesignation }
        : null,
      delegation:
        r.delegatedToUserId && until
          ? { toId: r.delegatedToUserId, toName: delegate ? loginLabel(delegate) : "Deleted login", until, active: delegationActive(until, today) }
          : null,
      cannotChange: support ?? (can.edit || can.deactivate ? loginChangeProblem(actor, facts, "edit") : "Changing logins needs Users & roles → Edit."),
      cannotDelegate: support ?? (can.edit ? loginChangeProblem(actor, facts, "delegation") : "Delegation needs Users & roles → Edit."),
    };
  });

  const choices: RoleChoice[] = roleRecords.map((r) => ({
    id: r.id,
    name: r.name,
    scopeType: isAdminRole(r.slug) ? "GLOBAL" : r.scopeType,
    isAdministrator: isAdminRole(r.slug),
    cannotGive: support ?? roleReachProblem(actor, roleFacts(r)),
  }));

  return {
    logins: rows,
    roles: choices,
    branches: org.branches.filter((b) => b.active).map(({ id, name, code }) => ({ id, name, code })),
    departments: org.departments.filter((d) => d.active).map(({ id, name, code }) => ({ id, name, code })),
    linkable,
    viewerId: viewer.userId,
    can,
  };
}

/** What a login did lately (the Users pane; the action checks Audit log → View). */
export async function loginActivity(loginId: string, limit = 8): Promise<LoginActivity[]> {
  const rows = await auditRepository.findAuditEntries({ userId: loginId, limit });
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    action: auditActionLabel(r.action),
    module: auditModuleLabel(r.module),
    record: r.recordTitle,
    result: auditResultLabel(r.result),
  }));
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

/** What an audit line says about a login: words, never ids. */
function described(r: { name: string | null; email: string; employeeName?: string | null; employeeCode?: string | null }, role: RoleRecord | undefined, access: string) {
  return {
    name: loginLabel(r),
    email: r.email,
    role: role?.name ?? "No role",
    access,
    employee: r.employeeName ? `${r.employeeCode ?? ""} ${r.employeeName}`.trim() : "Not linked",
  };
}

/**
 * The fields that changed, before → after. Both sides carry the name (it titles the entry and
 * drops out of the diff unless it changed itself).
 */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const oldValues: Record<string, unknown> = { name: before.name };
  const newValues: Record<string, unknown> = { name: after.name };
  let changed = 0;
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      oldValues[key] = before[key];
      newValues[key] = after[key];
      changed++;
    }
  }
  return { oldValues, newValues, changed };
}

/** Adds a login (id null) or saves one. A new login's temporary password is handed back once (S2). */
export async function saveLogin(id: string | null, raw: unknown, ctx: { userId: string }): Promise<{ id: string; issued: IssuedPassword | null }> {
  const form = normalizeLoginForm(raw);
  const actor = await accessActor(ctx.userId);
  const tempPassword = id ? null : generateTemporaryPassword(randomInt);
  const passwordHash = tempPassword ? await bcrypt.hash(tempPassword, 12) : undefined;

  const saved = await auditRefusals(ctx.userId, id ? "EDIT" : "ADD", () =>
    administrationTx(async (tx) => {
      const roleRecords = await roleRepository.findRoleRecords(tx);
      const roles = byId(roleRecords);
      const [current] = id ? await repository.findLoginRecords(tx, [id]) : [];
      if (id && !current) throw new UserFacingError("Not found: this login no longer exists.");
      const role = roles.get(form.roleId);
      const org = await repository.findOrgChoices();

      // The employee it belongs to: one login per employee, an active one for a new link.
      let employeeProblem: string | null = null;
      let employeeName: string | null = null;
      let employeeCode: string | null = null;
      if (form.employeeId) {
        const emp = await repository.findEmployeeForLink(form.employeeId, tx);
        if (!emp) employeeProblem = "That employee no longer exists.";
        else if (emp.linkedLoginId && emp.linkedLoginId !== id) employeeProblem = `${emp.fullName} already has a login.`;
        else if (emp.status !== "Active" && emp.id !== current?.employeeId) employeeProblem = `${emp.fullName} is not an active employee.`;
        employeeName = emp?.fullName ?? null;
        employeeCode = emp?.code ?? null;
      }
      const errors = validateLoginForm(form, {
        scopeType: role ? (isAdminRole(role.slug) ? "GLOBAL" : role.scopeType) : null,
        branchIds: new Set(org.branches.map((b) => b.id)),
        departmentIds: new Set(org.departments.map((d) => d.id)),
        employee: employeeProblem,
      }) ?? {};
      if (!errors.email && (await repository.emailTaken(form.email, id, tx))) errors.email = "Another login already signs in with this email.";
      if (current && !errors.email) {
        const emailProblem = emailChangeProblem({ email: current.email, isAdministrator: isAdminRole(roles.get(current.roleId ?? "")?.slug) }, form.email);
        if (emailProblem) errors.email = emailProblem;
      }
      if (Object.keys(errors).length) throw new LoginValidationError(errors);
      const chosen = role!;

      // The rules (S59): within reach, never one's own login, one administrator stays.
      const attempted = { role: chosen.name };
      if (current) {
        const facts = loginFacts(current, roles);
        refuse(loginChangeProblem(actor, facts, current.roleId === chosen.id ? "edit" : "role"), current, actor, attempted);
        if (current.roleId !== chosen.id) {
          refuse(roleReachProblem(actor, roleFacts(chosen)), current, actor, attempted);
          const last = lastAdministratorProblem(facts, { isActive: current.isActive, roleSlug: chosen.slug }, await repository.findActiveAdminIds(tx));
          if (last) throw new UserFacingError(last);
        }
      } else {
        refuse(roleReachProblem(actor, roleFacts(chosen)), null, actor, attempted);
      }

      const lists = accessListsFor(isAdminRole(chosen.slug) ? "GLOBAL" : chosen.scopeType, form);
      const values = { name: form.name, email: form.email, employeeId: form.employeeId, assignedBranchIds: lists.branchIds, assignedDepartmentIds: lists.departmentIds, roleId: chosen.id };
      const loginId = await repository.saveLoginTx(tx, id, values, passwordHash);
      const names = orgNames(org);
      const was = current ? roles.get(current.roleId ?? "") : undefined;
      return {
        loginId,
        before: current ? described(current, was, accessText(current, was, names)) : null,
        after: described({ name: form.name, email: form.email, employeeName, employeeCode }, chosen, accessText(values, chosen, names)),
      };
    })
  );

  if (saved.before) {
    const { oldValues, newValues, changed } = changedFields(saved.before, saved.after);
    if (changed) await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: MODULE, recordId: saved.loginId, oldValues, newValues });
  } else {
    await recordAuditLog({ userId: ctx.userId, action: "ADD", module: MODULE, recordId: saved.loginId, newValues: { ...saved.after, password: "Temporary password issued" } });
  }
  return { id: saved.loginId, issued: tempPassword ? { loginId: saved.loginId, email: form.email, name: form.name, tempPassword } : null };
}

/** Makes a login active or inactive (claim-first). */
export async function setLoginActive(id: string, active: boolean, ctx: { userId: string }): Promise<void> {
  const actor = await accessActor(ctx.userId);
  const done = await auditRefusals(ctx.userId, "EDIT", () =>
    administrationTx(async (tx) => {
      const roles = byId(await roleRepository.findRoleRecords(tx));
      const [login] = await repository.findLoginRecords(tx, [id]);
      if (!login) throw new UserFacingError("Not found: this login no longer exists.");
      if (login.isActive === active) throw new UserFacingError(`This login is already ${active ? "active" : "inactive"}.`);
      const facts = loginFacts(login, roles);
      refuse(loginChangeProblem(actor, facts, "status"), login, actor, { status: active ? "Active" : "Inactive" });
      if (!active) {
        const last = lastAdministratorProblem(facts, { isActive: false, roleSlug: facts.role?.slug }, await repository.findActiveAdminIds(tx));
        if (last) throw new UserFacingError(last);
      } else if (login.employeeId && login.employeeStatus && login.employeeStatus !== "Active") {
        throw new UserFacingError(`${login.employeeName ?? "The employee"} is no longer active: make the employee active first (Employees).`);
      }
      if (!(await repository.setLoginActiveTx(tx, id, active))) throw new UserFacingError("Someone else changed this login just now: refresh.");
      return { name: facts.label };
    })
  );
  await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: MODULE, recordId: id, oldValues: { name: done.name, status: active ? "Inactive" : "Active" }, newValues: { name: done.name, status: active ? "Active" : "Inactive" } });
}

/** A new temporary password for someone else's active login, handed back once (S2). */
export async function issueTemporaryPassword(id: string, ctx: { userId: string }): Promise<IssuedPassword> {
  const actor = await accessActor(ctx.userId);
  const tempPassword = generateTemporaryPassword(randomInt);
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const login = await auditRefusals(ctx.userId, "EDIT", () =>
    administrationTx(async (tx) => {
      const roles = byId(await roleRepository.findRoleRecords(tx));
      const [record] = await repository.findLoginRecords(tx, [id]);
      if (!record) throw new UserFacingError("Not found: this login no longer exists.");
      refuse(loginChangeProblem(actor, loginFacts(record, roles), "password"), record, actor, { password: "reset" });
      if (!record.isActive) throw new UserFacingError("This login is inactive: make it active first.");
      await repository.setTemporaryPasswordTx(tx, id, passwordHash);
      return record;
    })
  );
  await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: MODULE, recordId: id, newValues: { name: loginLabel(login), password: "Temporary password issued" } });
  return { loginId: id, email: login.email, name: loginLabel(login), tempPassword };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDelegation(raw: unknown): DelegationForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const delegateId = typeof r.delegateId === "string" && UUID.test(r.delegateId) ? r.delegateId : null;
  const until = typeof r.until === "string" && ISO_DATE.test(r.until) ? r.until : null;
  return { delegateId, until: delegateId ? until : null };
}

const delegationText = (name: string | null, until: string | null) => (name && until ? `${name} until ${formatBSDate(new Date(`${until}T00:00:00`))} (${until})` : "None");

/** Who approves in this login's place while they are away (null delegate: nobody). */
export async function saveDelegation(id: string, raw: unknown, ctx: { userId: string }): Promise<void> {
  const form = normalizeDelegation(raw);
  const actor = await accessActor(ctx.userId);
  const change = await auditRefusals(ctx.userId, "EDIT", () =>
    administrationTx(async (tx) => {
      const roles = byId(await roleRepository.findRoleRecords(tx));
      const records = byId(await repository.findLoginRecords(tx, [id, ...(form.delegateId ? [form.delegateId] : [])]));
      const owner = records.get(id);
      if (!owner) throw new UserFacingError("Not found: this login no longer exists.");
      const delegate = form.delegateId ? records.get(form.delegateId) : null;
      if (form.delegateId && !delegate) throw new UserFacingError("That login no longer exists.");
      const problem = delegationProblem({ actor, owner: loginFacts(owner, roles), delegate: delegate ? loginFacts(delegate, roles) : null, until: form.until, today: nepalDateIso() });
      if (problem) {
        // Making oneself someone's delegate is the self-dealing case (S21).
        const own = owner.id === actor.userId || delegate?.id === actor.userId;
        throw new AccessRefusedError(problem, own ? DENIED_SELF : "DENIED_PERMISSION", id, { delegate: delegate ? loginLabel(delegate) : "None" });
      }
      const beforeName = owner.delegatedToUserId ? (await repository.findLoginRecords(tx, [owner.delegatedToUserId]))[0] : undefined;
      await repository.setDelegationTx(tx, id, delegate?.id ?? null, form.until ? new Date(`${form.until}T00:00:00.000Z`) : null);
      return {
        name: loginLabel(owner),
        before: delegationText(beforeName ? loginLabel(beforeName) : null, owner.delegatedUntil ? owner.delegatedUntil.toISOString().slice(0, 10) : null),
        after: delegationText(delegate ? loginLabel(delegate) : null, form.until),
      };
    })
  );
  if (change.before !== change.after) {
    await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: MODULE, recordId: id, oldValues: { name: change.name, delegation: change.before }, newValues: { name: change.name, delegation: change.after } });
  }
}

// ---------------------------------------------------------------------------
// The employee record (S44) uses the same rules
// ---------------------------------------------------------------------------

/** Why the actor may not change this login in this way (null: they may). */
export async function loginChangeProblemFor(actorUserId: string, loginId: string, change: LoginChange): Promise<string | null> {
  const [actor, roleRecords, [login]] = await Promise.all([accessActor(actorUserId), roleRepository.findRoleRecords(), repository.findLoginRecords(undefined, [loginId])]);
  if (!login) return "This login no longer exists.";
  return loginChangeProblem(actor, loginFacts(login, byId(roleRecords)), change);
}

/** Why the actor may not give this role (null: they may). */
export async function roleGiveProblemFor(actorUserId: string, roleId: string): Promise<string | null> {
  const [actor, role] = await Promise.all([accessActor(actorUserId), roleRepository.findRoleRecord(roleId)]);
  if (!role) return "That role no longer exists.";
  return roleReachProblem(actor, roleFacts(role));
}

/** The roles this user may give (the employee form's choices), plus `keepId` (the login's current role). */
export async function rolesWithinReach(actorUserId: string, keepId?: string | null): Promise<{ id: string; name: string; slug: string }[]> {
  const [actor, roles] = await Promise.all([accessActor(actorUserId), roleRepository.findRoleRecords()]);
  return roles.filter((r) => r.id === keepId || !roleReachProblem(actor, roleFacts(r))).map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
}

/**
 * Gives a linked login another role from the employee record (Users & roles → Edit was checked
 * by the caller): the same rules as Admin → Users, under the same lock. Returns why not, or null.
 */
export async function changeLinkedLoginRole(actorUserId: string, loginId: string, roleId: string): Promise<string | null> {
  const actor = await accessActor(actorUserId);
  try {
    const result = await auditRefusals(actorUserId, "EDIT", () =>
      administrationTx(async (tx) => {
        const roles = byId(await roleRepository.findRoleRecords(tx));
        const [login] = await repository.findLoginRecords(tx, [loginId]);
        const role = roles.get(roleId);
        if (!login || !role) throw new UserFacingError("That login or role no longer exists.");
        const facts = loginFacts(login, roles);
        refuse(loginChangeProblem(actor, facts, "role"), login, actor, { role: role.name });
        refuse(roleReachProblem(actor, roleFacts(role)), login, actor, { role: role.name });
        const last = lastAdministratorProblem(facts, { isActive: login.isActive, roleSlug: role.slug }, await repository.findActiveAdminIds(tx));
        if (last) throw new UserFacingError(last);
        await repository.setRoleOfLoginsTx(tx, [loginId], roleId);
        return { name: facts.label, before: facts.role?.name ?? "No role", after: role.name };
      })
    );
    await recordAuditLog({ userId: actorUserId, action: "EDIT", module: MODULE, recordId: loginId, oldValues: { name: result.name, role: result.before }, newValues: { name: result.name, role: result.after } });
    return null;
  } catch (error) {
    if (error instanceof UserFacingError) return error.message;
    throw error;
  }
}

/**
 * Making an employee inactive (or completing their exit) switches their login off. An
 * administrator's login is switched off only by another administrator, and never the last one.
 */
export async function leavingLoginProblem(actorUserId: string, employeeId: string): Promise<string | null> {
  const login = await repository.findUserByEmployeeId(employeeId);
  if (!login || !login.isActive) return null;
  const [actor, roleRecords, [record], admins] = await Promise.all([
    accessActor(actorUserId),
    roleRepository.findRoleRecords(),
    repository.findLoginRecords(undefined, [login.id]),
    repository.findActiveAdminIds(),
  ]);
  const facts = loginFacts(record, byId(roleRecords));
  if (!isAdminRole(facts.role?.slug)) return null;
  if (!actor.isAdmin) return `${facts.label} has a company administrator login: a company administrator records their leaving.`;
  return lastAdministratorProblem(facts, { isActive: false, roleSlug: facts.role?.slug }, admins);
}

/**
 * Returns the self-service login (user) linked to an employee, along with the
 * role assigned to that user. Returns null when the employee has no linked user.
 */
export async function getEmployeeAccess(employeeId: string) {
  const user = await repository.findUserByEmployeeId(employeeId);
  if (!user) return null;
  const fullUser = await repository.findUserWithRoleById(user.id);
  if (!fullUser) return null;
  return {
    userId: fullUser.id,
    email: fullUser.email,
    name: fullUser.name,
    isActive: fullUser.isActive,
    roleId: fullUser.roleId,
    roleName: fullUser.roleName,
    roleSlug: fullUser.roleSlug,
    roleScopeType: fullUser.roleScopeType,
    mustChangePassword: fullUser.mustChangePassword ?? false,
    lastLoginAt: fullUser.lastLoginAt,
    updatedAt: fullUser.updatedAt,
    createdAt: fullUser.createdAt,
  };
}

/**
 * A new temporary password for a login (the employee record's Reset / Resend sign-in, after its
 * own checks: S44 / S59). The plaintext is returned once and never stored.
 */
export async function resetUserPassword(id: string): Promise<{ tempPassword: string }> {
  const tempPassword = generateTemporaryPassword(randomInt);
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await repository.updateUserPassword(id, passwordHash, true);
  return { tempPassword };
}

/**
 * The employee record's self-service login (S44), created with the employee.
 *
 * Resolves the target role by the requested slug, falling back to the canonical
 * employee self-service slug and then the legacy `standard_staff` slug. If no
 * matching role exists, the employee self-service role is ensured (created and
 * seeded with its standard grants) before the account is created, so hire-time
 * provisioning never fails silently on tenants with legacy or missing role data.
 */
export async function createSecureUserAccount(
  employeeId: string,
  email: string,
  roleSlug: string = EMPLOYEE_ROLE_SLUG,
  name?: string | null
) {
  const cleanEmail = email.trim().toLowerCase();

  const existing = await repository.findUserByEmail(cleanEmail);
  if (existing) {
    throw new UserExistsError(cleanEmail);
  }

  // Resolve role: requested slug -> canonical employee slug -> legacy fallback slug
  let role = await roleRepository.findRoleBySlug(roleSlug);
  if (!role && roleSlug !== EMPLOYEE_ROLE_SLUG) {
    role = await roleRepository.findRoleBySlug(EMPLOYEE_ROLE_SLUG);
  }
  if (!role && roleSlug !== EMPLOYEE_ROLE_SLUG_FALLBACK) {
    role = await roleRepository.findRoleBySlug(EMPLOYEE_ROLE_SLUG_FALLBACK);
  }

  // Auto-repair: ensure the canonical self-service role + grants exist
  if (!role) {
    const ensured = await ensureEmployeeSelfServiceRole(await getDb());
    if (ensured) role = ensured;
  }

  if (!role) throw new UserFacingError(`The role "${roleSlug}" was not found.`);

  const tempPassword = generateTemporaryPassword(randomInt);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await repository.createUser({
    name: name?.trim() || null,
    employeeId,
    email: cleanEmail,
    passwordHash,
    isActive: true,
    mustChangePassword: true,
  }, role.id);

  return { user, tempPassword };
}
