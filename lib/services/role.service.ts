import { getDb } from '@/lib/db';
import * as repository from '@/lib/repositories/role.repository';
import * as userRepository from '@/lib/repositories/user.repository';
import type { RoleRecord, RoleRow } from '@/lib/repositories/role.repository';
import type { Tx } from '@/lib/repositories/user.repository';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { UserFacingError } from '@/lib/errors/action-error';
import { recordAuditLog } from '@/lib/services/audit.service';
import { AccessRefusedError, accessActor, changedFields, roleFacts } from '@/lib/services/user.service';
import {
  GRANTABLE,
  SCOPE_LABEL,
  grantLabel,
  isAdminRole,
  normalizeGrants,
  normalizeRoleForm,
  presetGrants,
  roleKind,
  roleSlugFor,
  sortGrants,
  validateRoleForm,
  type RoleFormErrors,
} from '@/lib/engines/role.engine';
import {
  lastAdministratorProblem,
  loginChangeProblem,
  newRoleProblem,
  permissionChangeProblem,
  roleChangeProblem,
  roleDeleteProblem,
  roleDetailsProblem,
  roleReachProblem,
  type AccessActor,
} from '@/lib/engines/user-access.engine';
import type { PermissionChange, RoleMember, RoleStart, RoleView, RolesPage } from '@/lib/types/role';

// Admin → Roles (4.13, S59): roles and the permission matrix. Every change is checked against the
// access rules inside the same company-wide lock as logins, with the facts read again there, and
// audited (permissions in words, before → after); grants and revokes also go to the permission
// change log. The actions require a company-wide role first.

const MODULE = 'USERS_ROLES' as const;
const ALL_GRANTS = sortGrants(GRANTABLE);

export class RoleValidationError extends Error {
  constructor(public errors: RoleFormErrors) {
    super('Some fields need attention.');
    this.name = 'RoleValidationError';
  }
}

const SUPPORT_ACTOR: AccessActor = { userId: '', isAdmin: false, grants: new Set(), roleId: null };

async function administrationTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(async (tx) => {
    await userRepository.lockAdministration(tx);
    return fn(tx);
  });
}

async function auditRefusals<T>(actorId: string, action: 'ADD' | 'EDIT' | 'DELETE', work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AccessRefusedError) {
      await recordAuditLog({ userId: actorId, action, module: MODULE, recordId: error.recordId, result: error.result, newValues: error.attempted });
    }
    throw error;
  }
}

/** A refusal about a role: about the actor's own role it is DENIED_SELF (S21). */
function refuse(problem: string | null, actor: AccessActor, roleId: string | null, attempted: Record<string, unknown>): void {
  if (problem) throw new AccessRefusedError(problem, roleId && roleId === actor.roleId ? DENIED_SELF : 'DENIED_PERMISSION', roleId, attempted);
}

const loginLabel = (r: { name: string | null; email: string }) => r.name?.trim() || r.email;

/** The permissions in words for the audit log (at most 40, then a count). */
function grantWords(keys: readonly string[]): string[] {
  const words = keys.slice(0, 40).map(grantLabel);
  return keys.length > 40 ? [...words, `and ${keys.length - 40} more`] : words;
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export async function rolesPage(viewer: { userId: string; isImpersonation?: boolean }, can: RolesPage['can']): Promise<RolesPage> {
  const [roleRecords, logins, actor] = await Promise.all([
    repository.findRoleRecords(),
    userRepository.findLoginRecords(),
    viewer.isImpersonation ? Promise.resolve(SUPPORT_ACTOR) : accessActor(viewer.userId),
  ]);
  const support = viewer.isImpersonation ? 'Platform support views roles only.' : null;
  const byId = new Map(roleRecords.map((r) => [r.id, r]));

  const roles: RoleView[] = roleRecords.map((r) => {
    const facts = roleFacts(r);
    const admin = isAdminRole(r.slug);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      scopeType: admin ? 'GLOBAL' : r.scopeType,
      kind: roleKind(r),
      grants: admin ? ALL_GRANTS : sortGrants(r.grants.filter((k) => GRANTABLE.has(k))),
      logins: r.logins,
      activeLogins: r.activeLogins,
      cannotChange: support ?? (can.edit ? roleChangeProblem(actor, facts, 'permissions') : 'Changing roles needs Users & roles → Edit.'),
      cannotDelete: support ?? (can.delete ? roleDeleteProblem(actor, facts, r.logins) : 'Deleting roles needs Users & roles → Delete.'),
      cannotGive: support ?? (can.edit ? roleReachProblem(actor, facts) : 'Giving roles needs Users & roles → Edit.'),
    };
  });

  const members: RoleMember[] = logins.map((l) => {
    const role = l.roleId ? byId.get(l.roleId) : undefined;
    const facts = { id: l.id, label: loginLabel(l), isActive: l.isActive, role: role ? roleFacts(role) : null };
    return {
      id: l.id,
      label: loginLabel(l),
      email: l.email,
      isActive: l.isActive,
      roleId: l.roleId,
      employee: l.employeeId ? { code: l.employeeCode ?? '', name: l.employeeName ?? '' } : null,
      cannotMove: support ?? (can.edit ? loginChangeProblem(actor, facts, 'role') : 'Giving roles needs Users & roles → Edit.'),
    };
  });

  return {
    roles,
    logins: members,
    viewerGrants: actor.isAdmin ? 'all' : sortGrants([...actor.grants].filter((k) => GRANTABLE.has(k))),
    viewerRoleId: actor.roleId,
    can,
  };
}

/** Grants and revokes of one role (or every role), newest first. */
export async function permissionHistory(opts: { roleId?: string; since?: Date | null; limit?: number } = {}): Promise<PermissionChange[]> {
  const rows = await repository.findPermissionChanges(opts);
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    roleId: r.roleId,
    roleName: r.roleName,
    by: r.byName?.trim() || r.byEmail || 'Unknown',
    permission: r.grant ? grantLabel(r.grant) : 'A permission no longer offered',
    change: r.change,
  }));
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

function startGrants(start: RoleStart | undefined, roles: readonly RoleRecord[]): { grants: string[]; from: string } {
  if (!start || start.kind === 'empty') return { grants: [], from: 'Empty' };
  if (start.kind === 'preset') {
    const grants = presetGrants(String(start.id ?? ''));
    if (!grants) throw new UserFacingError('That starting point no longer exists.');
    return { grants, from: `Preset: ${start.id}` };
  }
  const source = roles.find((r) => r.id === start.id);
  if (!source) throw new UserFacingError('The role to copy no longer exists.');
  if (isAdminRole(source.slug)) throw new UserFacingError("The administrator role can't be copied: it is the one role that can do everything.");
  return { grants: normalizeGrants(source.grants), from: `Copy of ${source.name}` };
}

/**
 * Adds a role (id null: empty, from a preset or a copy of another) or saves a role's name,
 * description and scope.
 */
export async function saveRole(id: string | null, raw: unknown, ctx: { userId: string }): Promise<{ id: string; name: string }> {
  const form = normalizeRoleForm(raw);
  const start = (raw && typeof raw === 'object' ? (raw as { start?: RoleStart }).start : undefined) ?? undefined;
  const actor = await accessActor(ctx.userId);

  const saved = await auditRefusals(ctx.userId, id ? 'EDIT' : 'ADD', () =>
    administrationTx(async (tx) => {
      const roles = await repository.findRoleRecords(tx);
      const current = id ? roles.find((r) => r.id === id) : undefined;
      if (id && !current) throw new UserFacingError('Not found: this role no longer exists.');
      const errors = validateRoleForm(form, roles.filter((r) => r.id !== id).map((r) => r.name));
      if (errors) throw new RoleValidationError(errors);
      const attempted = { name: form.name, scope: SCOPE_LABEL[form.scopeType] };

      if (current) {
        refuse(roleDetailsProblem(actor, roleFacts(current), { name: form.name, scopeType: form.scopeType }), actor, current.id, attempted);
        await repository.updateRoleTx(tx, current.id, { name: form.name, scopeType: form.scopeType, description: form.description || null });
        return {
          id: current.id,
          name: form.name,
          before: { name: current.name, scope: SCOPE_LABEL[current.scopeType], description: current.description ?? '' },
          after: { name: form.name, scope: SCOPE_LABEL[form.scopeType], description: form.description },
          grants: null as string[] | null,
          from: null as string | null,
        };
      }

      const { grants, from } = startGrants(start, roles);
      refuse(newRoleProblem(actor, grants, form.scopeType), actor, null, { ...attempted, from });
      const created = await repository.createRoleTx(tx, { name: form.name, slug: roleSlugFor(form.name, new Set(roles.map((r) => r.slug))), scopeType: form.scopeType, description: form.description || null });
      await repository.setRoleGrantsTx(tx, created, [], grants, ctx.userId);
      return { id: created.id, name: created.name, before: null, after: { name: form.name, scope: SCOPE_LABEL[form.scopeType], description: form.description }, grants, from };
    })
  );

  if (saved.before) {
    const { oldValues, newValues, changed } = changedFields(saved.before, saved.after);
    if (changed) await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: MODULE, recordId: saved.id, oldValues, newValues });
  } else {
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: MODULE, recordId: saved.id, newValues: { ...saved.after, startedFrom: saved.from, permissions: grantWords(saved.grants ?? []) } });
  }
  return { id: saved.id, name: saved.name };
}

/**
 * Saves a role's permissions. `baseline` is what the screen started from: when the role changed
 * meanwhile (someone else saved it), nothing is saved and the screen reloads.
 */
export async function saveRolePermissions(roleId: string, raw: unknown, ctx: { userId: string }): Promise<{ added: number; removed: number }> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as { grants?: unknown; baseline?: unknown };
  const next = normalizeGrants(input.grants);
  const baseline = normalizeGrants(input.baseline);
  const actor = await accessActor(ctx.userId);

  const result = await auditRefusals(ctx.userId, 'EDIT', () =>
    administrationTx(async (tx) => {
      const role = await repository.findRoleRecord(roleId, tx);
      if (!role) throw new UserFacingError('Not found: this role no longer exists.');
      const shown = sortGrants(role.grants.filter((k) => GRANTABLE.has(k)));
      if (shown.join('|') !== baseline.join('|')) throw new UserFacingError('Someone else changed this role meanwhile: your changes were not saved. Refresh and make them again.');
      refuse(permissionChangeProblem(actor, roleFacts(role), next), actor, role.id, { permissions: 'change' });
      // Stored keys the matrix doesn't offer (old "grant all" rows) go too.
      const changed = await repository.setRoleGrantsTx(tx, role, role.grants, next, ctx.userId);
      return { name: role.name, ...changed };
    })
  );

  if (result.added.length || result.removed.length) {
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EDIT',
      module: MODULE,
      recordId: roleId,
      newValues: { name: result.name, granted: grantWords(result.added), revoked: grantWords(result.removed) },
    });
  }
  return { added: result.added.length, removed: result.removed.length };
}

/** Deletes a role nobody holds (never a built-in one). Its change history stays, by name. */
export async function deleteRole(roleId: string, ctx: { userId: string }): Promise<void> {
  const actor = await accessActor(ctx.userId);
  const role = await auditRefusals(ctx.userId, 'DELETE', () =>
    administrationTx(async (tx) => {
      const record = await repository.findRoleRecord(roleId, tx);
      if (!record) throw new UserFacingError('Not found: this role no longer exists.');
      refuse(roleDeleteProblem(actor, roleFacts(record), record.logins), actor, record.id, { name: record.name });
      if (!(await repository.deleteRoleTx(tx, record.id))) throw new UserFacingError('Someone else deleted this role just now: refresh.');
      return record;
    })
  );
  await recordAuditLog({
    userId: ctx.userId,
    action: 'DELETE',
    module: MODULE,
    recordId: roleId,
    oldValues: { name: role.name, scope: SCOPE_LABEL[role.scopeType], permissions: grantWords(sortGrants(role.grants.filter((k) => GRANTABLE.has(k)))) },
  });
}

/** Gives these logins this role (Roles → People → Add): each within reach, never one's own. */
export async function addRoleMembers(roleId: string, rawIds: unknown, ctx: { userId: string }): Promise<number> {
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds.filter((x): x is string => typeof x === 'string'))].slice(0, 200) : [];
  if (!ids.length) throw new UserFacingError('Choose the logins to give this role.');
  const actor = await accessActor(ctx.userId);

  const moved = await auditRefusals(ctx.userId, 'EDIT', () =>
    administrationTx(async (tx) => {
      const roleRecords = await repository.findRoleRecords(tx);
      const roles = new Map(roleRecords.map((r) => [r.id, r]));
      const role = roles.get(roleId);
      if (!role) throw new UserFacingError('Not found: this role no longer exists.');
      refuse(roleReachProblem(actor, roleFacts(role)), actor, null, { role: role.name });
      const logins = await userRepository.findLoginRecords(tx, ids);
      if (logins.length !== ids.length) throw new UserFacingError('One of those logins no longer exists: refresh.');
      let admins = await userRepository.findActiveAdminIds(tx);
      const changes: { id: string; name: string; before: string }[] = [];
      for (const login of logins) {
        if (login.roleId === roleId) continue;
        const current = login.roleId ? roles.get(login.roleId) : undefined;
        const facts = { id: login.id, label: loginLabel(login), isActive: login.isActive, role: current ? roleFacts(current) : null };
        const problem = loginChangeProblem(actor, facts, 'role');
        if (problem) throw new AccessRefusedError(problem, login.id === actor.userId ? DENIED_SELF : 'DENIED_PERMISSION', login.id, { role: role.name });
        const last = lastAdministratorProblem(facts, { isActive: login.isActive, roleSlug: role.slug }, admins);
        if (last) throw new UserFacingError(last);
        if (isAdminRole(current?.slug) && !isAdminRole(role.slug)) admins = admins.filter((a) => a !== login.id);
        changes.push({ id: login.id, name: facts.label, before: current?.name ?? 'No role' });
      }
      if (role.scopeType === 'BRANCH' || role.scopeType === 'DEPARTMENT') {
        const missing = logins.filter((l) => (role.scopeType === 'BRANCH' ? !l.assignedBranchIds.length : !l.assignedDepartmentIds.length));
        if (missing.length) throw new UserFacingError(`${loginLabel(missing[0])} has no ${role.scopeType === 'BRANCH' ? 'branches' : 'departments'} chosen: give them this role under Users, where you choose them.`);
      }
      await userRepository.setRoleOfLoginsTx(tx, changes.map((c) => c.id), roleId);
      return { role: role.name, changes };
    })
  );

  for (const c of moved.changes) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: MODULE, recordId: c.id, oldValues: { name: c.name, role: c.before }, newValues: { name: c.name, role: moved.role } });
  }
  return moved.changes.length;
}

// ---------------------------------------------------------------------------
// Used by the employee record (S44)
// ---------------------------------------------------------------------------

export async function getAllRoles(): Promise<RoleRow[]> {
  return repository.findAllRoles();
}
