export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { getLetterForPrint } from "@/lib/services/letter.service";
import { LetterView } from "@/components/letters/letter-view";

export const metadata: Metadata = {
  title: "Letter | AakashHRMS",
  description: "Printable HR letter.",
};

export default async function LetterPage({ params }: { params: Promise<{ letterId: string }> }) {
  await ensureTenantContext();
  // VIEW and the employee in scope; a letter outside the scope reads as not found.
  const scope = await checkPermissionWithScope("VIEW", "HR_LETTERS");
  const { letterId } = await params;
  const [data, canVoid] = await Promise.all([getLetterForPrint(letterId, scope), hasPermission("DELETE", "HR_LETTERS")]);
  if (!data) notFound();
  return <LetterView letter={data.letter} letterhead={data.letterhead} canVoid={canVoid} />;
}
