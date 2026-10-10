export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { evaluationsPage } from "@/lib/services/evaluation.service";
import { EvaluationClient } from "@/components/evaluation/evaluation-client";

export const metadata: Metadata = {
  title: "Performance evaluation | AakashHRMS",
  description: "का.स.मू. — evaluation cycles, stage-by-stage marks and grades.",
};

const STATUS_FILTERS = ["waiting", "in_progress", "final"];

export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "PERFORMANCE");
  // The bell opens the evaluations waiting for this person's marks (?status=waiting).
  const { status } = await searchParams;
  const [add, edit, approve, lock] = await Promise.all([
    hasPermission("ADD", "PERFORMANCE"),
    hasPermission("EDIT", "PERFORMANCE"),
    hasPermission("APPROVE", "PERFORMANCE"),
    hasPermission("LOCK", "PERFORMANCE"),
  ]);
  const ctx = { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
  const data = await evaluationsPage(ctx, { open: add, start: add, rate: edit, finalize: approve, close: lock, editForm: edit });
  return <EvaluationClient data={data} myUserId={scope.userId} initialStatus={STATUS_FILTERS.includes(status ?? "") ? status : undefined} />;
}
