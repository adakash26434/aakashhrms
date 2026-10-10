import { myLoans } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { MyLoansClient } from "@/components/self-service/my-loans-client";
import type { MyLoansData } from "@/lib/types/loan";

export const dynamic = "force-dynamic";

export const metadata = { title: "My loans | Self-Service Portal", description: "Loans and salary advances: what is left, requests and repayments." };

/** 4.10: the signed-in employee's own loans, requests and the types they may ask for (employee from the session). */
export default async function MyLoansPage() {
  const lang = await essLang();
  let data: MyLoansData = { loans: [], requests: [], types: [] };
  let problem: string | null = null;
  try {
    data = await myLoans();
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  if (problem) return <p className="text-sm text-danger">{problem}</p>;
  return <MyLoansClient lang={lang} data={data} />;
}
