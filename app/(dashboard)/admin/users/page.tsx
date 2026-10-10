export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { usersPageAction } from "@/app/actions/user.actions";
import { UsersClient } from "@/components/admin/users-client";

export const metadata: Metadata = {
  title: "Users | AakashHRMS",
  description: "Who signs in: each login's role, what it covers and the employee it belongs to.",
};

// Admin → Users (4.13): a company-wide control. The action checks Users & roles → View with a
// company-wide role and works out what the viewer may change (S59); every change checks again.
export default async function UsersPage() {
  await ensureTenantContext();
  const result = await usersPageAction();
  if (!result.success) throw new Error(result.error);
  return <UsersClient initial={result.data} />;
}
