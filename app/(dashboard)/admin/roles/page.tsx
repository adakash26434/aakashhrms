export const dynamic = "force-dynamic";

import { Suspense } from "react";
import {
  getAllRolesWithStats,
  getAllPermissions,
  getRoleWithPermissions,
} from "@/lib/services/role.service";
import { getPermissionChangeLogs } from "@/lib/services/audit.service";
import RoleClient from "@/components/admin/roles/role-client";
import { PageHeader } from "@/components/ui/page-header";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata = {
  title: "Roles & Permissions | AakashHRMS",
  description:
    "Configure custom roles, granular 25-module permission matrices, and security audit history.",
};

export default async function RolesPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "USERS_ROLES");

  const [roles, allPermissions, permissionChangeLogs] = await Promise.all([
    getAllRolesWithStats(),
    getAllPermissions(),
    getPermissionChangeLogs(),
  ]);

  // Pre-load existing permissions for every role
  const rolePermissionsMap: Record<string, string[]> = {};
  await Promise.all(
    roles.map(async (role) => {
      const { permissions: perms } = await getRoleWithPermissions(role.id);
      rolePermissionsMap[role.id] = perms.map((p) => p.id);
    }),
  );

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <PageHeader
        title="Roles & Permissions"
        description="Configure system and custom roles, assign granular module-level permissions across 25 modules, and audit security change history."
      />
      <Suspense fallback={<RolesLoadingSkeleton />}>
        <RoleClient
          roles={roles}
          allPermissions={allPermissions}
          rolePermissionsMap={rolePermissionsMap}
          permissionChangeLogs={permissionChangeLogs}
        />
      </Suspense>
    </div>
  );
}

function RolesLoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-48 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl bg-gray-50 h-125" />
    </div>
  );
}
