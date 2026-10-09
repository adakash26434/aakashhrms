import { myClaims } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { MyClaimsClient } from "@/components/self-service/my-claims-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "My travel claims | Self-Service Portal", description: "Submit field-visit claims and follow their approval." };

export default async function MyClaimsPage() {
  const lang = await essLang();
  let data: Awaited<ReturnType<typeof myClaims>> = { claims: [], hasRateCard: false };
  let problem: string | null = null;
  try {
    data = await myClaims();
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  if (problem) return <p className="text-sm text-rose-600">{problem}</p>;
  return <MyClaimsClient lang={lang} claims={data.claims} hasRateCard={data.hasRateCard} />;
}
