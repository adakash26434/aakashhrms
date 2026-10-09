export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { lettersPage } from "@/lib/services/letter.service";
import { LettersClient } from "@/components/letters/letters-client";

export const metadata: Metadata = {
  title: "HR letters | AakashHRMS",
  description: "Appointment, confirmation, promotion, transfer, experience and NOC letters with a chalani register.",
};

export default async function LettersPage() {
  await ensureTenantContext();
  // VIEW within scope; issuing, templates and voiding re-check on each action.
  const scope = await checkPermissionWithScope("VIEW", "HR_LETTERS");
  const [issue, templates, canVoid] = await Promise.all([
    hasPermission("ADD", "HR_LETTERS"),
    hasPermission("EDIT", "HR_LETTERS"),
    hasPermission("DELETE", "HR_LETTERS"),
  ]);
  const data = await lettersPage(scope, { issue, templates, void: canVoid });
  return <LettersClient data={data} />;
}
