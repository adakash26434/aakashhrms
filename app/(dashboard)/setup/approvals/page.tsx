export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { approvalSettingsPage, contextFor } from "@/lib/services/approval-settings.service";
import { ApprovalSettingsClient } from "@/components/approval-settings/approval-settings-client";

export const metadata: Metadata = {
  title: "Approvals | AakashHRMS",
  description: "Who approves salary changes and loans, with custom rules for salary changes.",
};

export default async function ApprovalsPage() {
  await ensureTenantContext();
  // Salary structure or Loans → View; each section shows only with its module's View, and the
  // buttons only with its Approve and a company-wide role (the actions check again).
  return <ApprovalSettingsClient initial={await approvalSettingsPage(await contextFor())} />;
}
