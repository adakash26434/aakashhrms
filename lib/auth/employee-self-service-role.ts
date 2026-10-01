import { and, eq } from "drizzle-orm";
import { permissions, rolePermissions, roles } from "@/lib/db/schema";
import type { ActionType, ModuleType } from "@/lib/types/role";

import {
  EMPLOYEE_ROLE_SLUG,
  EMPLOYEE_ROLE_SLUG_FALLBACK,
  EMPLOYEE_SELF_SERVICE_GRANTS,
  type RolePermissionGrant,
  ROLE_PERMISSION_PRESETS,
} from "@/lib/constants/role-presets";

export {
  EMPLOYEE_ROLE_SLUG,
  EMPLOYEE_ROLE_SLUG_FALLBACK,
  EMPLOYEE_SELF_SERVICE_GRANTS,
  type RolePermissionGrant,
  ROLE_PERMISSION_PRESETS,
};

// ponytail: drizzle tenant vs app db share insert/select; no shared Database type in this repo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

async function grantPermissionsToRole(db: AnyDb, roleId: string, grants: RolePermissionGrant[]) {
  for (const g of grants) {
    const permRes = await db
      .select()
      .from(permissions)
      .where(and(eq(permissions.action, g.action), eq(permissions.module, g.module)))
      .limit(1);
    if (permRes[0]) {
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId: permRes[0].id })
        .onConflictDoNothing();
    }
  }
}

export async function ensureEmployeeSelfServiceRole(db: AnyDb) {
  let [role] = await db.select().from(roles).where(eq(roles.slug, EMPLOYEE_ROLE_SLUG)).limit(1);

  if (!role) {
    [role] = await db.select().from(roles).where(eq(roles.slug, EMPLOYEE_ROLE_SLUG_FALLBACK)).limit(1);
  }

  if (!role) {
    const inserted = await db
      .insert(roles)
      .values({
        name: "Employee Self-Service",
        slug: EMPLOYEE_ROLE_SLUG,
        scopeType: "SELF",
        isSystemRole: true,
        isProtected: true,
        description:
          "Standard employee role for self-service portal, payslip viewing, and leave requests.",
      })
      .onConflictDoNothing({ target: roles.slug })
      .returning();
    role =
      inserted[0] ||
      (await db.select().from(roles).where(eq(roles.slug, EMPLOYEE_ROLE_SLUG)).limit(1))[0];
  }

  if (role) {
    await grantPermissionsToRole(db, role.id, EMPLOYEE_SELF_SERVICE_GRANTS);
  }

  const [fallback] = await db
    .select()
    .from(roles)
    .where(eq(roles.slug, EMPLOYEE_ROLE_SLUG_FALLBACK))
    .limit(1);
  if (fallback && fallback.id !== role?.id) {
    await grantPermissionsToRole(db, fallback.id, EMPLOYEE_SELF_SERVICE_GRANTS);
  }

  return role ?? fallback ?? null;
}
