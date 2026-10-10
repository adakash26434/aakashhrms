export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { rolesPageAction } from "@/app/actions/role.actions";
import { RolesClient } from "@/components/admin/roles-client";

export const metadata: Metadata = {
  title: "Roles & permissions | AakashHRMS",
  description: "What each role can do and where: the permission matrix, the people who hold each role and its history.",
};

// Admin → Roles & permissions (4.13): a company-wide control. The action checks Users & roles →
// View with a company-wide role and works out what the viewer may change (S59).
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await ensureTenantContext();
  const [result, { role }] = await Promise.all([rolesPageAction(), searchParams]);
  if (!result.success) throw new Error(result.error);
  return <RolesClient initial={result.data} initialRoleId={typeof role === "string" ? role : null} />;
}
