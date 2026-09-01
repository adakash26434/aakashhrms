export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { PayHeadClient } from "@/components/pay-head/pay-head-client";
import { getPayHeadData } from "@/lib/services/pay-head.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Pay Heads | AakashHRMS",
  description:
    "Configure allowance and deduction pay heads with calculation rules, tax effects, statutory flags, and department/position applicability.",
};

/**
 * Server component for the Pay Head Setup page.
 *
 * Fetches the initial dataset through the **service layer**
 * (which in turn calls the repository and the static
 * department/designation mocks). The page itself is server-
 * rendered; the client component takes over from there and owns
 * all subsequent mutations via the same service.
 *
 * This pattern means: when the backend goes live, only the
 * `getPayHeadData()` body changes (it will hit the DB or call a
 * Server Action). The server-component file and its imports stay
 * identical.
 */
export default async function PayHeadsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "PAY_HEADS");

  const data = await getPayHeadData();
  return <PayHeadClient initialData={data} />;
}
