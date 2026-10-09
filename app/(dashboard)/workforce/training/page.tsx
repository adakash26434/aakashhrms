export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { trainingPage } from "@/lib/services/training.service";
import { TrainingClient } from "@/components/training/training-client";

export const metadata: Metadata = {
  title: "Training | AakashHRMS",
  description: "Training programmes, nominations, attendance, scores and service bonds.",
};

export default async function TrainingPageRoute() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "TRAINING");
  const [add, manage] = await Promise.all([hasPermission("ADD", "TRAINING"), hasPermission("EDIT", "TRAINING")]);
  const data = await trainingPage({ userId: scope.userId, actorEmployeeId: scope.employeeId, scope }, { add, manage });
  return <TrainingClient data={data} />;
}
