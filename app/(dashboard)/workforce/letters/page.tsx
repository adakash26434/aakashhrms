export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { lettersPage } from "@/lib/services/letter.service";
import { LettersClient } from "@/components/letters/letters-client";

export const metadata: Metadata = {
  title: "HR letters | AakashHRMS",
  description: "Joining papers and HR letters in English and Nepali, with your own letterhead and a chalani register.",
};

export default async function LettersPage({ searchParams }: { searchParams: Promise<{ pack?: string | string[] }> }) {
  await ensureTenantContext();
  // VIEW within scope; issuing, templates and voiding re-check on each action.
  const scope = await checkPermissionWithScope("VIEW", "HR_LETTERS");
  const [issue, templates, canVoid] = await Promise.all([
    hasPermission("ADD", "HR_LETTERS"),
    hasPermission("EDIT", "HR_LETTERS"),
    hasPermission("DELETE", "HR_LETTERS"),
  ]);
  const data = await lettersPage(scope, { issue, templates, void: canVoid });
  const { pack } = await searchParams;
  // ?pack=<employee id> opens the joining pack for that employee (the window re-checks scope on the server).
  const packEmployeeId = typeof pack === "string" && /^[0-9a-f-]{36}$/i.test(pack) ? pack : undefined;
  return <LettersClient data={data} packEmployeeId={packEmployeeId} />;
}
