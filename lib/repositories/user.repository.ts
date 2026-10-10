import { getDb } from "@/lib/db";
import { users, userRoles, roles, employees, departments, designations, branches } from "@/lib/db/schema";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { UserWithRole } from "../types/user";
import { ADMIN_ROLE_SLUGS } from "@/lib/engines/role.engine";

// Logins (4.13). Writes that change who can do what (role, branches, status, password,
// delegation) run inside `administrationTx` in the service: one company-wide lock, the facts read
// again inside it, so two administrators acting at once can't, say, both remove each other.

export type UserRow = typeof users.$inferSelect;
export type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
type Q = Awaited<ReturnType<typeof getDb>> | Tx;

const delegatedUsers = alias(users, "delegated_users");

/** Everything Admin → Users shows about a login (one role per login: the first, as sign-in reads it). */
export interface LoginRecord {
  id: string;
  name: string | null;
  email: string;
  employeeId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  createdAt: Date;
  delegatedToUserId: string | null;
  delegatedUntil: Date | null;
  assignedBranchIds: string[];
  assignedDepartmentIds: string[];
  roleId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  employeeStatus: string | null;
  employeeBranch: string | null;
  employeeDesignation: string | null;
}

/** Logins with their role and employee: all of them, or the ones asked for. */
export async function findLoginRecords(q?: Q, ids?: readonly string[]): Promise<LoginRecord[]> {
  if (ids && !ids.length) return [];
  const db = q ?? (await getDb());
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      employeeId: users.employeeId,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
      delegatedToUserId: users.delegatedToUserId,
      delegatedUntil: users.delegatedUntil,
      assignedBranchIds: users.assignedBranchIds,
      assignedDepartmentIds: users.assignedDepartmentIds,
      roleId: userRoles.roleId,
      employeeCode: employees.employeeCode,
      employeeName: employees.fullName,
      employeeStatus: employees.status,
      employeeBranch: branches.name,
      employeeDesignation: designations.name,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(employees, eq(employees.id, users.employeeId))
    .leftJoin(branches, eq(branches.id, employees.branchId))
    .leftJoin(designations, eq(designations.id, employees.designationId))
    .where(ids ? inArray(users.id, [...ids]) : undefined)
    .orderBy(asc(sql`lower(coalesce(${users.name}, ${users.email}))`), asc(users.id), asc(userRoles.roleId));
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({
      ...r,
      mustChangePassword: !!r.mustChangePassword,
      assignedBranchIds: r.assignedBranchIds ?? [],
      assignedDepartmentIds: r.assignedDepartmentIds ?? [],
      roleId: r.roleId ?? null,
    }));
}

/** Active logins holding a company administrator role. */
export async function findActiveAdminIds(q?: Q): Promise<string[]> {
  const db = q ?? (await getDb());
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.isActive, true), inArray(roles.slug, [...ADMIN_ROLE_SLUGS])));
  return rows.map((r) => r.id);
}

/** The role the user holds (the first, as sign-in reads it). */
export async function findRoleIdOfUser(userId: string, q?: Q): Promise<string | null> {
  const db = q ?? (await getDb());
  const [row] = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId)).orderBy(asc(userRoles.roleId)).limit(1);
  return row?.roleId ?? null;
}

/** Serializes every change to logins and roles in this company (see the file comment). */
export async function lockAdministration(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('aakashhrms.administration'))`);
}

/** Active employees with no login yet: the choices for linking a login to its employee. */
export async function findLinkableEmployees(): Promise<{ id: string; code: string; name: string }[]> {
  const rows = await (await getDb())
    .select({ id: employees.id, code: employees.employeeCode, name: employees.fullName })
    .from(employees)
    .leftJoin(users, eq(users.employeeId, employees.id))
    .where(and(eq(employees.status, "Active"), isNull(users.id)))
    .orderBy(asc(employees.fullName));
  return rows;
}

/** The employee a login is being linked to, and the login that already has it (if any). */
export async function findEmployeeForLink(employeeId: string, q?: Q): Promise<{ id: string; code: string; status: string; fullName: string; linkedLoginId: string | null } | null> {
  const db = q ?? (await getDb());
  const [row] = await db
    .select({ id: employees.id, code: employees.employeeCode, status: employees.status, fullName: employees.fullName, linkedLoginId: users.id })
    .from(employees)
    .leftJoin(users, eq(users.employeeId, employees.id))
    .where(eq(employees.id, employeeId))
    .limit(1);
  return row ? { ...row, linkedLoginId: row.linkedLoginId ?? null } : null;
}

export async function findOrgChoices(): Promise<{ branches: { id: string; name: string; code: string; active: boolean }[]; departments: { id: string; name: string; code: string; active: boolean }[] }> {
  const db = await getDb();
  const [b, d] = await Promise.all([
    db.select({ id: branches.id, name: branches.name, code: branches.code, status: branches.status }).from(branches).orderBy(asc(branches.name)),
    db.select({ id: departments.id, name: departments.name, code: departments.code, status: departments.status }).from(departments).orderBy(asc(departments.name)),
  ]);
  return {
    branches: b.map((r) => ({ id: r.id, name: r.name, code: r.code, active: r.status !== "inactive" })),
    departments: d.map((r) => ({ id: r.id, name: r.name, code: r.code, active: r.status !== "inactive" })),
  };
}

export async function emailTaken(email: string, exceptId: string | null, q?: Q): Promise<boolean> {
  const db = q ?? (await getDb());
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email.trim().toLowerCase()), exceptId ? ne(users.id, exceptId) : undefined))
    .limit(1);
  return !!row;
}

/** Writes a login and its one role (a new login: id null). Inside `administrationTx`. */
export async function saveLoginTx(
  tx: Tx,
  id: string | null,
  values: { name: string; email: string; employeeId: string | null; assignedBranchIds: string[]; assignedDepartmentIds: string[]; roleId: string },
  newPasswordHash?: string
): Promise<string> {
  let loginId = id;
  if (!loginId) {
    if (!newPasswordHash) throw new Error("A new login needs its temporary password");
    const [row] = await tx
      .insert(users)
      .values({ ...values, passwordHash: newPasswordHash, isActive: true, mustChangePassword: true, tempPassword: null })
      .returning({ id: users.id });
    loginId = row.id;
  } else {
    await tx.update(users).set({ ...values, updatedAt: new Date() }).where(eq(users.id, loginId));
  }
  await tx.delete(userRoles).where(and(eq(userRoles.userId, loginId), ne(userRoles.roleId, values.roleId)));
  await tx.insert(userRoles).values({ userId: loginId, roleId: values.roleId }).onConflictDoNothing();
  return loginId;
}

/** Gives logins one role (Roles → People → Add). Inside `administrationTx`. */
export async function setRoleOfLoginsTx(tx: Tx, loginIds: readonly string[], roleId: string): Promise<void> {
  if (!loginIds.length) return;
  await tx.delete(userRoles).where(and(inArray(userRoles.userId, [...loginIds]), ne(userRoles.roleId, roleId)));
  await tx.insert(userRoles).values(loginIds.map((userId) => ({ userId, roleId }))).onConflictDoNothing();
  await tx.update(users).set({ updatedAt: new Date() }).where(inArray(users.id, [...loginIds]));
}

/** Claim-first: true when the login moved from the other state. */
export async function setLoginActiveTx(tx: Tx, id: string, active: boolean): Promise<boolean> {
  const rows = await tx
    .update(users)
    .set({ isActive: active, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.isActive, !active)))
    .returning({ id: users.id });
  return rows.length > 0;
}

/**
 * A new temporary password: changed at the next sign-in, failed attempts and any lock cleared so
 * it works at once. S2: the plaintext is never stored (temp_password stays NULL).
 */
export async function setTemporaryPasswordTx(tx: Tx, id: string, passwordHash: string): Promise<void> {
  await tx
    .update(users)
    .set({ passwordHash, mustChangePassword: true, tempPassword: null, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function setDelegationTx(tx: Tx, id: string, delegateId: string | null, until: Date | null): Promise<void> {
  await tx.update(users).set({ delegatedToUserId: delegateId, delegatedUntil: delegateId ? until : null, updatedAt: new Date() }).where(eq(users.id, id));
}

/** Logins other people's delegations point at (cleared when a login is made inactive). */
export async function clearDelegationsToTx(tx: Tx, delegateId: string): Promise<number> {
  const rows = await tx
    .update(users)
    .set({ delegatedToUserId: null, delegatedUntil: null, updatedAt: new Date() })
    .where(eq(users.delegatedToUserId, delegateId))
    .returning({ id: users.id });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Used by the employee record (S44) and onboarding
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string) {
  const result = await (await getDb()).select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  return result.length > 0 ? result[0] : null;
}

export async function findUserByEmployeeId(employeeId: string) {
  const result = await (await getDb()).select().from(users).where(eq(users.employeeId, employeeId));
  return result.length > 0 ? result[0] : null;
}

/**
 * Finds a single user with joined role, employee, delegation, and scoping details.
 */
export async function findUserWithRoleById(id: string): Promise<UserWithRole | null> {
  const rows = await (await getDb())
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      employeeId: users.employeeId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      mustChangePassword: users.mustChangePassword,
      delegatedToUserId: users.delegatedToUserId,
      delegatedToUserName: delegatedUsers.name,
      delegatedToUserEmail: delegatedUsers.email,
      delegatedUntil: users.delegatedUntil,
      assignedBranchIds: users.assignedBranchIds,
      assignedDepartmentIds: users.assignedDepartmentIds,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleId: roles.id,
      roleName: roles.name,
      roleSlug: roles.slug,
      roleScopeType: roles.scopeType,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      branchName: branches.name,
      branchCode: branches.code,
      departmentName: departments.name,
      departmentCode: departments.code,
      designationName: designations.name,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .leftJoin(delegatedUsers, eq(users.delegatedToUserId, delegatedUsers.id))
    .where(eq(users.id, id))
    .limit(1);

  if (!rows.length) return null;

  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    employeeId: r.employeeId,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt,
    mustChangePassword: r.mustChangePassword,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    delegatedToUserId: r.delegatedToUserId ?? null,
    delegatedToUserName: r.delegatedToUserName || r.delegatedToUserEmail || null,
    delegatedUntil: r.delegatedUntil ?? null,
    assignedBranchIds: r.assignedBranchIds || [],
    assignedDepartmentIds: r.assignedDepartmentIds || [],
    roleId: r.roleId ?? null,
    roleName: r.roleName ?? null,
    roleSlug: r.roleSlug ?? null,
    roleScopeType: (r.roleScopeType as "GLOBAL" | "BRANCH" | "DEPARTMENT" | "SELF") ?? null,
    employeeCode: r.employeeCode ?? null,
    employeeName: r.fullName || null,
    employeeBranch: r.branchName ?? null,
    employeeBranchCode: r.branchCode ?? null,
    employeeDepartment: r.departmentName ?? null,
    employeeDepartmentCode: r.departmentCode ?? null,
    employeeDesignation: r.designationName ?? null,
  };
}

/**
 * Creates a new user record and assigns the given roleId in a single transaction (the employee
 * record's self-service login, S44).
 */
export async function createUser(data: typeof users.$inferInsert, roleId?: string) {
  return await (await getDb()).transaction(async (tx) => {
    const newUsers = await tx.insert(users).values({
      ...data,
      email: data.email.trim().toLowerCase(),
    }).returning();
    const user = newUsers[0];

    if (roleId) {
      await tx.insert(userRoles).values({
        userId: user.id,
        roleId: roleId,
      });
    }

    return user;
  });
}

/**
 * Updates a login's email or role from the employee record (S44: the service checks who may).
 */
export async function updateUser(id: string, data: Partial<typeof users.$inferInsert>, roleId?: string) {
  return await (await getDb()).transaction(async (tx) => {
    if (roleId) await lockAdministration(tx);
    const updatePayload: Partial<typeof users.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.email) {
      updatePayload.email = data.email.trim().toLowerCase();
    }

    const result = await tx.update(users)
      .set(updatePayload)
      .where(eq(users.id, id))
      .returning();

    if (roleId) {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx.insert(userRoles).values({
        userId: id,
        roleId: roleId,
      });
    }

    return result[0];
  });
}

/**
 * Updates a user's password hash and optional mustChangePassword flag.
 * SECURITY (S2): plaintext temporary passwords are never persisted; the
 * legacy temp_password column is always cleared.
 */
export async function updateUserPassword(
  id: string,
  passwordHash: string,
  mustChangePassword?: boolean
) {
  const updateData: {
    passwordHash: string;
    updatedAt: Date;
    tempPassword: null;
    failedLoginAttempts: number;
    lockedUntil: null;
    mustChangePassword?: boolean;
  } = {
    passwordHash,
    updatedAt: new Date(),
    tempPassword: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  if (mustChangePassword !== undefined) {
    updateData.mustChangePassword = mustChangePassword;
  }

  const result = await (await getDb()).update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();
  return result[0];
}
