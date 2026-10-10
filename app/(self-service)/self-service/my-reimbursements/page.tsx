import { myReimbursements } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { MyReimbursementsClient } from "@/components/self-service/my-reimbursements-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "My reimbursements | Self-Service Portal", description: "Claim back bills and follow their approval and payment." };

/** F16: the signed-in employee's own reimbursement claims (the employee comes from the session). */
export default async function MyReimbursementsPage() {
  const lang = await essLang();
  let data: Awaited<ReturnType<typeof myReimbursements>> = { claims: [], types: [] };
  let problem: string | null = null;
  try {
    data = await myReimbursements();
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  if (problem) return <p className="text-sm text-danger">{problem}</p>;
  return <MyReimbursementsClient lang={lang} claims={data.claims} types={data.types} />;
}
