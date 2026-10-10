export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { auditPageAction } from "@/app/actions/audit.actions";
import { AuditClient } from "@/components/admin/audit-client";

export const metadata: Metadata = {
  title: "Audit log | AakashHRMS",
  description: "Who did what, as which role, when and from where — and what was refused.",
};

type Params = { period?: string; module?: string; action?: string; outcome?: string; user?: string };

// Admin → Audit log (4.13): the whole company's trail, so a company-wide role only (S59). The
// filter comes from the URL (ids and choices only, never search text) and is checked on the server.
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  await ensureTenantContext();
  const p = await searchParams;
  const result = await auditPageAction({ period: p.period, module: p.module, action: p.action, outcome: p.outcome, userId: p.user });
  if (!result.success) throw new Error(result.error);
  return <AuditClient initial={result.data} />;
}
