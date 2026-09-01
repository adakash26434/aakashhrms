export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getAllUsersWithKPIs, getUnlinkedEmployeesForUserLink } from "@/lib/services/user.service";
import { getAllRoles } from "@/lib/services/role.service";
import { findAllBranches } from "@/lib/repositories/branch.repository";
import { findAllDepartments } from "@/lib/repositories/department.repository";
import { UserClient } from "@/components/admin/users/user-client";
import { PageHeader } from "@/components/ui/page-header";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function UsersPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "USERS_ROLES");

  const [{ users, kpis }, roles, branchesList, departmentsList, unlinkedEmployees] = await Promise.all([
    getAllUsersWithKPIs(),
    getAllRoles(),
    findAllBranches(),
    findAllDepartments(),
    getUnlinkedEmployeesForUserLink(),
  ]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <PageHeader
        title="User Accounts & Access Control"
        description="Manage system login accounts, assign security roles, configure data scoping & proxy delegation, and control account status."
      />
      <Suspense fallback={<UsersLoadingSkeleton />}>
        <UserClient
          initialUsers={users}
          initialKPIs={kpis}
          roles={roles}
          branches={branchesList.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
          departments={departmentsList.map((d) => ({ id: d.id, name: d.name, code: d.code }))}
          unlinkedEmployees={unlinkedEmployees}
        />
      </Suspense>
    </div>
  );
}

function UsersLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-gray-100" />
    </div>
  );
}
