import * as repository from '@/lib/repositories/role.repository';
import { RoleRow, PermissionRow, RoleWithStats } from '@/lib/repositories/role.repository';
import type { CreateRoleInput, UpdateRoleInput, CloneRoleInput, ScopeType } from '@/lib/types/role';
import { getDb } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RoleNotFoundError extends Error {
  constructor(public idOrSlug: string) {
    super(`Role ${idOrSlug} not found.`);
    this.name = 'RoleNotFoundError';
  }
}

export class SystemRoleModificationError extends Error {
  constructor(public roleName: string, action = 'modify') {
    super(`Cannot ${action} system-protected role: "${roleName}". This role is required by the platform.`);
    this.name = 'SystemRoleModificationError';
  }
}

export class RoleInUseError extends Error {
  constructor(public roleName: string, public userCount: number) {
    super(
      `Cannot delete role "${roleName}" because it is currently assigned to ${userCount} active user(s). Reassign these users before deleting.`
    );
    this.name = 'RoleInUseError';
  }
}

export class DuplicateRoleNameError extends Error {
  constructor(public roleName: string) {
    super(`A role with the name "${roleName}" already exists.`);
    this.name = 'DuplicateRoleNameError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRoleSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAllRoles(): Promise<RoleRow[]> {
  return repository.findAllRoles();
}

export async function getAllRolesWithStats(): Promise<RoleWithStats[]> {
  return repository.findAllRolesWithStats();
}

export async function getAllPermissions(): Promise<PermissionRow[]> {
  return repository.findAllPermissions();
}

export async function getRoleWithPermissions(roleId: string) {
  const role = await repository.findRoleById(roleId);
  if (!role) throw new RoleNotFoundError(roleId);

  const permissions = await repository.getRolePermissions(roleId);
  return { role, permissions };
}

export async function getRoleBySlug(slug: string) {
  return repository.findRoleBySlug(slug);
}

// ---------------------------------------------------------------------------
// Writes / Mutations
// ---------------------------------------------------------------------------

export async function createCustomRole(data: CreateRoleInput, changedByUserId: string): Promise<RoleRow> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error('Role name is required.');
  }

  // Check unique name
  const existing = await repository.findRoleByName(trimmedName);
  if (existing) {
    throw new DuplicateRoleNameError(trimmedName);
  }

  const slug = generateRoleSlug(trimmedName);
  const existingSlug = await repository.findRoleBySlug(slug);
  const finalSlug = existingSlug ? `${slug}_${Date.now().toString(36)}` : slug;

  const newRole = await repository.createRole({
    name: trimmedName,
    slug: finalSlug,
    scopeType: data.scopeType,
    description: data.description?.trim() || null,
    isSystemRole: false,
    isProtected: false,
  });

  // Assign initial permissions if provided
  if (data.initialPermissionIds && data.initialPermissionIds.length > 0) {
    await repository.assignPermissionsToRole(newRole.id, data.initialPermissionIds, changedByUserId);
  }

  // Record audit log
  await getDb().insert(auditLogs).values({
    userId: changedByUserId,
    action: 'ADD',
    module: 'USERS_ROLES',
    recordId: newRole.id,
    result: 'SUCCESS',
    newValues: {
      id: newRole.id,
      name: newRole.name,
      slug: newRole.slug,
      scopeType: newRole.scopeType,
      description: newRole.description,
    },
    ipAddress: '127.0.0.1',
  });

  return newRole;
}

export async function updateCustomRole(
  roleId: string,
  data: UpdateRoleInput,
  changedByUserId: string
): Promise<RoleRow> {
  const role = await repository.findRoleById(roleId);
  if (!role) throw new RoleNotFoundError(roleId);

  // If system role or protected, name cannot be changed
  if (role.isSystemRole || role.isProtected) {
    if (data.name && data.name.trim() !== role.name) {
      throw new SystemRoleModificationError(role.name, 'rename');
    }
  }

  const trimmedName = data.name.trim();
  if (trimmedName && trimmedName !== role.name) {
    const existing = await repository.findRoleByName(trimmedName);
    if (existing && existing.id !== roleId) {
      throw new DuplicateRoleNameError(trimmedName);
    }
  }

  const updated = await repository.updateRole(roleId, {
    name: trimmedName || undefined,
    scopeType: data.scopeType,
    description: data.description !== undefined ? data.description.trim() : undefined,
  });

  if (!updated) throw new RoleNotFoundError(roleId);

  // Record audit log
  await getDb().insert(auditLogs).values({
    userId: changedByUserId,
    action: 'EDIT',
    module: 'USERS_ROLES',
    recordId: roleId,
    result: 'SUCCESS',
    oldValues: {
      name: role.name,
      scopeType: role.scopeType,
      description: role.description,
    },
    newValues: {
      name: updated.name,
      scopeType: updated.scopeType,
      description: updated.description,
    },
    ipAddress: '127.0.0.1',
  });

  return updated;
}

export async function cloneCustomRole(data: CloneRoleInput, changedByUserId: string): Promise<RoleRow> {
  const sourceRole = await repository.findRoleById(data.sourceRoleId);
  if (!sourceRole) throw new RoleNotFoundError(data.sourceRoleId);

  const trimmedName = data.newRoleName.trim();
  if (!trimmedName) {
    throw new Error('New role name is required.');
  }

  const existing = await repository.findRoleByName(trimmedName);
  if (existing) {
    throw new DuplicateRoleNameError(trimmedName);
  }

  const slug = generateRoleSlug(trimmedName);
  const existingSlug = await repository.findRoleBySlug(slug);
  const finalSlug = existingSlug ? `${slug}_${Date.now().toString(36)}` : slug;

  return repository.cloneRole(
    data.sourceRoleId,
    {
      name: trimmedName,
      slug: finalSlug,
      scopeType: data.scopeType,
      description: data.description?.trim() || `Cloned from ${sourceRole.name}`,
    },
    changedByUserId
  );
}

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[],
  changedByUserId: string
) {
  const role = await repository.findRoleById(roleId);
  if (!role) throw new RoleNotFoundError(roleId);

  return repository.assignPermissionsToRole(roleId, permissionIds, changedByUserId);
}

export async function deleteCustomRole(roleId: string, changedByUserId: string): Promise<boolean> {
  const role = await repository.findRoleById(roleId);
  if (!role) throw new RoleNotFoundError(roleId);

  if (role.isSystemRole || role.isProtected) {
    throw new SystemRoleModificationError(role.name, 'delete');
  }

  // Check if active users are assigned to this role
  const userCount = await repository.countUsersAssignedToRole(roleId);
  if (userCount > 0) {
    throw new RoleInUseError(role.name, userCount);
  }

  const deleted = await repository.deleteRole(roleId);

  if (deleted) {
    await getDb().insert(auditLogs).values({
      userId: changedByUserId,
      action: 'DELETE',
      module: 'USERS_ROLES',
      recordId: roleId,
      result: 'SUCCESS',
      oldValues: {
        id: role.id,
        name: role.name,
        slug: role.slug,
        scopeType: role.scopeType,
      },
      ipAddress: '127.0.0.1',
    });
  }

  return deleted;
}
